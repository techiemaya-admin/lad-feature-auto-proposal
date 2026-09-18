import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { getDatabase } from "../db/database.js";
import type { CompanyRow } from "../routes/companies.js";
import { generateJson } from "./ai-extraction.service.js";
import { getAISettings } from "./ai-settings.service.js";
import { getCompanyConfiguration } from "./company-config.service.js";
import { logPipelineArtifact } from "./pipeline-log.js";
import type { PricingRules, Stage2Context, Value } from "./pricing-rules.types.js";

/**
 * Stage 5 narrative: every ai_generated paragraph in ONE model call. The model writes `{tag}` placeholders
 * wherever a number, price, tier name, count or date belongs; code substitutes them from the payload, so a
 * model-typed number can never reach the document. Plan: docs/plans/06-lead-simulator.md §1.5.
 */

export interface ParagraphTips {
  purpose?: string;
  tone?: string;
  length_guideline?: string;
  guidance?: string;
}

export interface NarrativeParagraph {
  text: string;
  /** Placeholders that resolved to a payload value. */
  tags_placed: string[];
  /** Placeholders the payload had no value for — stripped, not retried. */
  unknown_tags: string[];
}
export type NarrativeResult = Record<string, NarrativeParagraph>;

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
const isScalar = (v: unknown): v is string | number | boolean => ["string", "number", "boolean"].includes(typeof v);

/** `{tag}` → payload[tag] for scalar values; unknown tags are removed and reported. */
export function substitutePlaceholders(text: string, payload: Record<string, unknown>): NarrativeParagraph {
  const tags_placed: string[] = [];
  const unknown_tags: string[] = [];
  const out = text.replace(PLACEHOLDER, (_, tag: string) => {
    const v = payload[tag];
    if (isScalar(v)) {
      tags_placed.push(tag);
      return String(v);
    }
    unknown_tags.push(tag);
    return "";
  });
  // Stripping a tag can leave "  " or " ," behind; collapse it without touching newlines.
  return { text: out.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;])/g, "$1"), tags_placed, unknown_tags };
}

/** Drafter tips live in descriptor_json.paragraph_config (Stage 2 context only carries the mode). */
export function loadParagraphTips(companyId: string): Record<string, ParagraphTips> {
  const rows = getDatabase()
    .prepare("SELECT variable_name, descriptor_json FROM company_variables WHERE company_id = ? AND is_deleted = 0 AND category = 'paragraph'")
    .all(companyId) as unknown as { variable_name: string; descriptor_json: string }[];
  const out: Record<string, ParagraphTips> = {};
  for (const r of rows) {
    try {
      out[r.variable_name] = JSON.parse(r.descriptor_json)?.paragraph_config ?? {};
    } catch {
      out[r.variable_name] = {};
    }
  }
  return out;
}

export interface NarrativeInput {
  company: CompanyRow;
  rules: PricingRules;
  stage2: Stage2Context;
  payload: Record<string, unknown>;
  inputs: Record<string, Value>;
  leadText: string;
  coveredBy: Record<string, string[]>;
  tips?: Record<string, ParagraphTips>;
}

/** Paragraphs the model drafts: category paragraph, not fixed-mode (fixed text is static in the template). */
export const draftedParagraphs = (stage2: Stage2Context) =>
  stage2.variables.filter((v) => v.category === "paragraph" && v.paragraph_mode !== "fixed");

export function buildNarrativePrompt(input: NarrativeInput): string {
  const { company, rules, stage2, payload, inputs, leadText, coveredBy } = input;
  const config = getCompanyConfiguration(company.company_id);
  const tips = input.tips ?? {};
  let data: any = {};
  try { data = JSON.parse(company.data_json); } catch { data = {}; }

  const labelOf = new Map<string, string>();
  for (const v of stage2.variables) labelOf.set(v.variable_name, v.natural_name || v.variable_name);
  for (const v of rules.variables) if (!labelOf.has(v.name)) labelOf.set(v.name, v.label);

  const facts = Object.entries(inputs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `- ${labelOf.get(k) ?? k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  const tags = Object.entries(payload)
    .filter(([, v]) => (typeof v === "string" && v !== "") || typeof v === "number")
    .map(([k, v]) => `- {${k}} = ${JSON.stringify(v)}`);
  // Seen live: with has_tax unmentioned the drafter wrote "sales tax applies" for a lead with no state.
  const flags = Object.entries(payload)
    .filter(([, v]) => typeof v === "boolean")
    .map(([k, v]) => `- ${k}${labelOf.has(k) ? ` (${labelOf.get(k)})` : ""}: ${v ? "yes" : "no"}`);
  const paragraphs = draftedParagraphs(stage2).map((v) => {
    const t = tips[v.variable_name] ?? {};
    const covered = coveredBy[v.variable_name] ?? [];
    return [
      `### ${v.variable_name}`,
      t.purpose ? `Purpose: ${t.purpose}` : "",
      t.tone ? `Tone: ${t.tone}` : "",
      t.length_guideline ? `Length: ${t.length_guideline}` : "",
      t.guidance ? `Guidance: ${t.guidance}` : "",
      covered.length ? `Must include these placeholders: ${covered.map((c) => `{${c}}`).join(", ")}` : "",
      `Sample from the reference quotation (structure and register only — it was written for a different client):\n"""\n${v.sample_value}\n"""`,
    ].filter(Boolean).join("\n");
  });

  return `
You are the proposal writer at "${company.company_name}"${data.company_details?.industry ? ` (${data.company_details.industry})` : ""}.
${data.company_details?.value_proposition ? `Value proposition: ${data.company_details.value_proposition}\n` : ""}
Write the client-specific paragraphs of a proposal for the lead below. The document, prices and dates already exist; you only write prose.

==================== VOICE ====================
${config.style_notes || "Plain, confident, specific. Short sentences. No hype, no filler."}
${config.reference_proposal_text ? `\nA proposal in the house voice, for reference (different client, do not copy facts from it):\n"""\n${config.reference_proposal_text}\n"""` : ""}

==================== THE LEAD'S MESSAGE ====================
"""
${leadText}
"""

==================== LEAD FACTS (confirmed) ====================
${facts.join("\n") || "(none)"}

==================== WHAT APPLIES TO THIS LEAD ====================
Settled by the pricing rules — write to them, never against them (a "no" means that thing is NOT part of this proposal):
${flags.join("\n") || "(none)"}

==================== AVAILABLE TAGS ====================
Every number, price, percentage, tier or package name, count and date in the proposal is a tag. Write the tag — e.g. "billed at {selected_tier_rate}" — wherever such a value belongs. NEVER type the value itself, never do arithmetic, never invent a figure that has no tag. Tags you may use (with their current values, so you know what each one means):
${tags.join("\n") || "(none)"}

==================== PARAGRAPHS TO WRITE ====================
${paragraphs.join("\n\n")}

==================== RULES ====================
1. Return one field per paragraph, keyed exactly by its name. Plain text only: no markdown, no headings, no bullet markers unless the sample uses them (then copy its line structure, one line per bullet, newline-separated).
2. Address the client by the name in the facts. Reflect what THEY said in their message; do not restate the whole message.
3. Use only facts listed above. If the sample mentions something the lead did not (a third location, a timeline), leave it out or generalise.
4. Every value goes through a tag. A paragraph listed with "Must include these placeholders" must contain each of them verbatim.
5. Keep each paragraph close to the sample's length unless a length guideline says otherwise.
`;
}

const responseSchema = (names: string[]): ResponseSchema =>
  ({ type: SchemaType.OBJECT, properties: Object.fromEntries(names.map((n) => [n, { type: SchemaType.STRING }])), required: names }) as ResponseSchema;
const jsonShape = (names: string[]) => `
==================== OUTPUT FORMAT ====================
Respond with ONLY a single JSON object — no markdown fences, no commentary — with exactly these string fields (every one present):
{ ${names.map((n) => `"${n}": string`).join(", ")} }
`;

type ModelCall = (prompt: string, names: string[]) => Promise<Record<string, string>>;
let modelCall: ModelCall | null = null;
/** Test seam: replaces the network call. null restores the real provider dispatch. */
export function setNarrativeModelCall(fn: ModelCall | null): void {
  modelCall = fn;
}
const callModel: ModelCall = (prompt, names) =>
  (modelCall ?? ((p, n) => generateJson<Record<string, string>>(p, responseSchema(n), jsonShape(n))))(prompt, names);

/** One call for every drafted paragraph; placeholders substituted from the payload; raw response logged. */
export async function draftNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  const names = draftedParagraphs(input.stage2).map((v) => v.variable_name);
  if (names.length === 0) return {};
  const tips = input.tips ?? loadParagraphTips(input.company.company_id);
  const raw = await callModel(buildNarrativePrompt({ ...input, tips }), names);
  logPipelineArtifact(input.company.company_id, "narrative-raw.json", { ai: getAISettings(), ...raw });
  const out: NarrativeResult = {};
  for (const n of names) out[n] = substitutePlaceholders(typeof raw[n] === "string" ? raw[n] : "", input.payload);
  return out;
}
