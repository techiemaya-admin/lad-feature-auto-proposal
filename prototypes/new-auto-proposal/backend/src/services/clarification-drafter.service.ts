import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { CompanyRow } from "../routes/companies.js";
import { generateJson } from "./ai-extraction.service.js";
import { getAISettings } from "./ai-settings.service.js";
import { getCompanyConfiguration } from "./company-config.service.js";
import { logPipelineArtifact } from "./pipeline-log.js";
import type { LeadField } from "./lead-extractor.service.js";
import type { Value } from "./pricing-rules.types.js";

/**
 * Stage 5, missing-fact branch: a short reply asking the lead for what the message left out, and — for the
 * simulator — the lead's answer to it. Neither is sent; the thread of both is what the extractor re-reads
 * until nothing is missing. Plan: docs/plans/06-lead-simulator.md §1.2.
 */

export interface ClarificationInput {
  company: CompanyRow;
  fields: LeadField[];
  inputs: Record<string, Value>;
  missing: string[];
  /** Facts filled from a rule default; the email states them and invites a correction. */
  assumed?: string[];
  leadText: string;
}

export interface ClarificationEmail {
  subject: string;
  body: string;
}

const DEFAULT_NOTES = "Friendly and brief. Thank them, confirm what you understood, ask only for what is missing, one question per item, no pricing yet.";

export function buildClarifyPrompt(input: ClarificationInput): string {
  const { company, fields, inputs, missing, leadText } = input;
  const assumed = input.assumed ?? [];
  const config = getCompanyConfiguration(company.company_id);
  let data: any = {};
  try { data = JSON.parse(company.data_json); } catch { data = {}; }
  const label = (n: string) => fields.find((f) => f.name === n)?.label ?? n;
  const line = (f: LeadField) => `- ${f.label}: ${Array.isArray(inputs[f.name]) ? (inputs[f.name] as string[]).join(", ") : String(inputs[f.name])}`;
  const answered = fields.filter((f) => !missing.includes(f.name) && inputs[f.name] !== null && inputs[f.name] !== undefined && inputs[f.name] !== "");
  const known = answered.filter((f) => !assumed.includes(f.name)).map(line);
  const assuming = answered.filter((f) => assumed.includes(f.name)).map(line);

  return `
You write a reply for "${company.company_name}"${data.company_details?.industry ? ` (${data.company_details.industry})` : ""} to an inbound lead whose message left out something the quote needs.

==================== HOW WE WRITE THESE (from the owner) ====================
${config.clarification_notes || DEFAULT_NOTES}
${config.style_notes ? `\nHouse style:\n${config.style_notes}` : ""}

==================== THE LEAD'S MESSAGE ====================
"""
${leadText}
"""

==================== WHAT WE ALREADY KNOW ====================
${known.join("\n") || "(nothing usable yet)"}

==================== WHAT WE'RE ASSUMING ====================
${assuming.join("\n") || "(nothing)"}

==================== WHAT WE STILL NEED ====================
${missing.map((n) => `- ${label(n)}`).join("\n")}

==================== RULES ====================
1. Ask for every missing item, plainly, in the lead's own terms (not our field names). Explain in half a sentence why it matters for the price when that helps.
2. Do not quote or estimate a price. Do not promise a timeline.
3. Sign off as the ${company.company_name} team. Plain text, short paragraphs, no markdown.
4. subject: a short reply-style subject line.
5. The message may already be a thread (parts headed "From: the lead" / "From: ${company.company_name}"). Never re-ask what the lead answered in a later part.
6. State each assumption in one plain line and invite a correction; do not ask for it.
`;
}

/** The simulator playing the lead: answers the last ask in the thread, in the lead's own voice. */
export function buildReplyPrompt(company: CompanyRow, leadText: string): string {
  return `
You play the lead who wrote to "${company.company_name}". Below is the thread so far; its last part is ${company.company_name}'s reply asking you for details.

==================== THE THREAD ====================
"""
${leadText}
"""

==================== RULES ====================
1. Answer every question in that last part, plainly, one short line each. Invent a plausible specific only where the thread has none; never contradict what the lead already said.
2. Same voice as the lead's earlier parts. One-line greeting at most, no pricing talk, no markdown.
3. subject: a short "Re:" subject line.
`;
}

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: { subject: { type: SchemaType.STRING }, body: { type: SchemaType.STRING } },
  required: ["subject", "body"],
} as ResponseSchema;
const JSON_SHAPE = `
==================== OUTPUT FORMAT ====================
Respond with ONLY a single JSON object — no markdown fences, no commentary: { "subject": string, "body": string }
`;

type ModelCall = (prompt: string) => Promise<ClarificationEmail>;
let modelCall: ModelCall | null = null;
/** Test seam: replaces the network call. null restores the real provider dispatch. */
export function setClarifyModelCall(fn: ModelCall | null): void {
  modelCall = fn;
}
const callModel: ModelCall = (prompt) => (modelCall ?? ((p) => generateJson<ClarificationEmail>(p, responseSchema, JSON_SHAPE)))(prompt);

async function draftEmail(company: CompanyRow, prompt: string, artifact: string): Promise<ClarificationEmail> {
  const raw = await callModel(prompt);
  logPipelineArtifact(company.company_id, artifact, { ai: getAISettings(), ...raw });
  return { subject: String(raw.subject ?? ""), body: String(raw.body ?? "") };
}

export const draftClarification = (input: ClarificationInput): Promise<ClarificationEmail> =>
  draftEmail(input.company, buildClarifyPrompt(input), "clarify-raw.json");

export const draftLeadReply = (company: CompanyRow, leadText: string): Promise<ClarificationEmail> =>
  draftEmail(company, buildReplyPrompt(company, leadText), "lead-reply-raw.json");
