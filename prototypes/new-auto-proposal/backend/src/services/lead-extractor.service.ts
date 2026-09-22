import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { CompanyRow } from "../routes/companies.js";
import { generateJson } from "./ai-extraction.service.js";
import { getAISettings } from "./ai-settings.service.js";
import { logPipelineArtifact } from "./pipeline-log.js";
import { inputOptions } from "./pricing-calculator.js";
import type { InputType, PricingRules, Stage2Context, Value } from "./pricing-rules.types.js";
import { isDateVariable } from "./proposal-generator.service.js";

/**
 * Stage 5 step 1: an inbound lead message → the facts the calculator needs. The field list is built per
 * company from the rules' `input` variables plus the Stage 2 customer inputs the rules do not define at all
 * (client name); dates are never asked — code fills them. A silent lead follows the input's own setting:
 * required → asked, default → assumed by code (never by the model), neither → blank.
 * Plan: docs/plans/06-lead-simulator.md §1.1.
 */

export interface LeadField {
  name: string;
  label: string;
  input_type: InputType | "text";
  options: string[];
  required: boolean;
  /** Filled in by `fillDefaults` when the lead does not say it. */
  default?: Value;
  /** Seller-authorised reading of the lead's words for this field. */
  assume_when?: string;
}

export function leadFields(rules: PricingRules, stage2: Stage2Context): LeadField[] {
  const fields: LeadField[] = [];
  for (const v of rules.variables) {
    if (v.kind !== "input") continue;
    const s2 = stage2.variables.find((x) => x.variable_name === v.name);
    if (s2 && isDateVariable(s2)) continue; // the calendar fills dates, even when a compile asked for them
    fields.push({
      name: v.name, label: s2?.natural_name || v.label, input_type: v.input_type, options: inputOptions(v, rules), required: v.required,
      ...(v.default === undefined ? {} : { default: v.default }), ...(v.assume_when ? { assume_when: v.assume_when } : {}),
    });
  }
  // Every rule variable counts as defined: a Stage 2 input the sheet holds as a constant (validity days) is not re-asked as text.
  const defined = new Set(rules.variables.map((v) => v.name));
  for (const v of stage2.variables) {
    if (v.category !== "customer_input" || defined.has(v.variable_name) || isDateVariable(v)) continue;
    fields.push({ name: v.variable_name, label: v.natural_name || v.variable_name, input_type: "text", options: [], required: true });
  }
  return fields;
}

export const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Required fields the facts do not answer. */
export const missingFields = (fields: LeadField[], inputs: Record<string, unknown>) =>
  fields.filter((f) => f.required && isBlank(inputs[f.name])).map((f) => f.name);

/** Blank facts take their field's default (in place); returns the names filled. The only place a gap is ever filled. */
export function fillDefaults(fields: LeadField[], inputs: Record<string, Value>): string[] {
  const assumed: string[] = [];
  for (const f of fields) {
    if (f.default === undefined || !isBlank(inputs[f.name])) continue;
    inputs[f.name] = f.default;
    assumed.push(f.name);
  }
  return assumed;
}

// --- schema: one required, nullable property per field + assumptions ---------------------------------

const typeOf = (f: LeadField) =>
  f.input_type === "integer" ? SchemaType.NUMBER : f.input_type === "boolean" ? SchemaType.BOOLEAN : SchemaType.STRING;

export function leadFactsSchema(fields: LeadField[]): ResponseSchema {
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    properties[f.name] =
      f.input_type === "multi_choice"
        ? { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, format: "enum", enum: f.options }, nullable: true }
        : f.input_type === "choice"
          ? { type: SchemaType.STRING, format: "enum", enum: f.options, nullable: true }
          : { type: typeOf(f), nullable: true };
  }
  properties.assumptions = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
  return { type: SchemaType.OBJECT, properties, required: Object.keys(properties) } as ResponseSchema;
}

const shapeOf = (f: LeadField) => {
  const opts = f.options.map((o) => JSON.stringify(o)).join(" | ");
  switch (f.input_type) {
    case "integer": return "number | null";
    case "boolean": return "boolean | null";
    case "choice": return `${opts} | null`;
    case "multi_choice": return `[${opts}] | null`;
    case "us_state": return '"TX" (two-letter code) | null';
    default: return "string | null";
  }
};
export const leadFactsJsonShape = (fields: LeadField[]) => `
==================== OUTPUT FORMAT ====================
Respond with ONLY a single JSON object — no markdown fences, no commentary — with exactly these fields (every one present, null when the message does not say it):
{ ${fields.map((f) => `"${f.name}": ${shapeOf(f)}`).join(", ")}, "assumptions": string[] }
`;

/** The choices of a choice / multi_choice field, spelled the one way every Stage 5 prompt uses ("" for other fields). */
export const optionsHint = (f: LeadField) => (f.options.length ? ` — one of ${f.options.map((o) => `"${o}"`).join(", ")}` : "");

export function buildExtractPrompt(company: CompanyRow, fields: LeadField[], leadText: string): string {
  const line = (f: LeadField) =>
    `- ${f.name} (${f.label}): ${f.input_type}${optionsHint(f)}${f.required ? "" : " (optional)"}${f.assume_when ? ` (read it as: ${f.assume_when})` : ""}`;
  return `
You read an inbound lead message for "${company.company_name}" and fill in the facts the pricing calculator needs.

==================== THE MESSAGE ====================
"""
${leadText}
"""

==================== FIELDS ====================
${fields.map(line).join("\n")}

==================== RULES ====================
1. A field the message does not answer is null. Never guess a value the message does not support; a null is the correct answer for "not said".
2. Number words become digits ("two clinics" → 2). A range takes its higher end ("40-50 seats" → 50) — say so in assumptions.
3. State / jurisdiction: only from what the message says — never assume the agency's home state or a "typical" client. A named state counts, and so does a well-known city that identifies one ("Austin area" → TX; note it in assumptions). No city, no state → null. Two-letter codes.
4. choice fields must be exactly one of the listed options, spelled as listed; pick the option whose description the lead's words match and record why in assumptions. multi_choice fields list every matching option (empty array when the lead asked for none).
5. boolean fields: true only when the message says so ("we'd rather pay once a year" → true); null when unmentioned.
6. Servers, kiosks or shared machines beyond one device per person count as extra devices.
7. assumptions: one short sentence per interpretation of the lead's own words (range picked, option matched, devices counted, a "read it as" hint applied). Never a value the message does not contain — gaps are filled elsewhere, not by you. Empty when every value was explicit.
8. The message may be a thread (parts headed "From: the lead" / "From: ${company.company_name}"). Only the lead's parts carry facts; our parts only ask. When a later part from the lead changes or adds to an earlier one, the later part wins.
`;
}

type ModelCall = (prompt: string, fields: LeadField[]) => Promise<Record<string, unknown>>;
let modelCall: ModelCall | null = null;
/** Test seam: replaces the network call. null restores the real provider dispatch. */
export function setLeadModelCall(fn: ModelCall | null): void {
  modelCall = fn;
}
const callModel: ModelCall = (prompt, fields) =>
  (modelCall ?? ((p, f) => generateJson<Record<string, unknown>>(p, leadFactsSchema(f), leadFactsJsonShape(f))))(prompt, fields);

export interface LeadFacts {
  /** The per-company form definition, so the UI renders the right control per fact. */
  fields: LeadField[];
  inputs: Record<string, Value>;
  missing: string[];
  assumptions: string[];
  /** Fields the lead left blank that code filled from the seller's default. */
  assumed: string[];
}

/** Extract, canonicalise choices, fill defaults, list the required fields still null. */
export async function extractLeadFacts(company: CompanyRow, rules: PricingRules, stage2: Stage2Context, leadText: string): Promise<LeadFacts> {
  const fields = leadFields(rules, stage2);
  const raw = await callModel(buildExtractPrompt(company, fields, leadText), fields);
  logPipelineArtifact(company.company_id, "lead-raw.json", { ai: getAISettings(), ...raw });

  const inputs: Record<string, Value> = {};
  for (const f of fields) {
    const v = raw[f.name];
    const canon = (s: unknown) => f.options.find((o) => o.toLowerCase() === String(s).trim().toLowerCase()) ?? String(s);
    inputs[f.name] = isBlank(v)
      ? null
      : f.input_type === "choice"
        ? canon(v)
        : f.input_type === "multi_choice"
          ? (Array.isArray(v) ? v : [v]).map(canon)
          : f.input_type === "integer"
            ? Number.isFinite(Number(v)) ? Math.round(Number(v)) : null
            : f.input_type === "boolean"
              ? v === true || /^(true|yes)$/i.test(String(v))
              : f.input_type === "us_state"
                ? String(v).trim().toUpperCase()
                : String(v);
  }
  const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.map(String).filter(Boolean) : [];
  const assumed = fillDefaults(fields, inputs);
  return { fields, inputs, missing: missingFields(fields, inputs), assumptions, assumed };
}
