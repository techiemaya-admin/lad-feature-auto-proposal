import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { getDatabase } from "../db/database.js";
import type { CompanyRow } from "../routes/companies.js";
import type { VariableRow } from "../routes/variables.js";
import { generateJson } from "./ai-extraction.service.js";
import { getAISettings } from "./ai-settings.service.js";
import { logPipelineArtifact } from "./pipeline-log.js";
import { evaluate, sampleCheck, validate } from "./pricing-calculator.js";
import { fromWire, toWire, type AiPricingRules, type PricingRules, type PricingRulesState, type Stage2Context } from "./pricing-rules.types.js";
import type { MutationLogEntry } from "./template-mutator.service.js";

/**
 * Stage 4 compile: pricing notes + sample quotation + the confirmed Stage 2 variables → PricingRules.
 * The model writes the sheet; validate/evaluate/sampleCheck grade it; one retry gets the error list.
 */

export interface CompileInput {
  companyName: string;
  homeLocation: string;
  pricingSpec: string;
  quotationMarkdown: string;
  stage2: Stage2Context;
  /** Values the template engine reported as covered by a drafted paragraph/loop (no tag of their own). */
  covered: string[];
}

export function loadCompany(companyId: string): CompanyRow | undefined {
  return getDatabase().prepare("SELECT * FROM company_sessions WHERE company_id = ?").get(companyId) as unknown as CompanyRow | undefined;
}

/** Same rows the template mutator reads; loop columns live under descriptor.columns. */
export function loadStage2Context(companyId: string): Stage2Context {
  const rows = getDatabase()
    .prepare(`SELECT * FROM company_variables WHERE company_id = ? AND is_deleted = 0 ORDER BY sort_order ASC, created_at ASC`)
    .all(companyId) as unknown as VariableRow[];
  const ctx: Stage2Context = { variables: [], loop_tables: [] };
  for (const row of rows) {
    let d: any = {};
    try { d = JSON.parse(row.descriptor_json); } catch { /* corrupt descriptor: treated as empty */ }
    if (row.category === "table_loop") {
      ctx.loop_tables.push({ loop_tag: d.loop_tag || row.variable_name, columns: d.columns ?? [], row_labels: d.row_labels ?? [] });
    } else {
      ctx.variables.push({
        variable_name: row.variable_name, natural_name: row.natural_name, category: row.category, data_type: row.data_type,
        sample_value: typeof d.sample_value === "string" ? d.sample_value : "",
        condition_flag: d.visibility_rule?.condition_flag || undefined, enum_options: d.enum_options, paragraph_mode: d.paragraph_config?.mode,
      });
    }
  }
  return ctx;
}

export function buildCompileInput(company: CompanyRow, stage2: Stage2Context): CompileInput {
  let ws: any = {};
  try { ws = JSON.parse(company.working_state_json || "{}"); } catch { ws = {}; }
  const details: MutationLogEntry[] = ws.template_stats?.details ?? [];
  return {
    companyName: company.company_name,
    homeLocation: company.location ?? "",
    pricingSpec: company.pricing_spec,
    quotationMarkdown: company.quotation_markdown ?? "",
    stage2,
    covered: details.filter((d) => d.action === "covered").map((d) => d.target),
  };
}

export interface PreviousAttempt { wire: AiPricingRules; errors: string[] }

export function buildCompilePrompt(input: CompileInput, previous?: PreviousAttempt): string {
  const s2 = input.stage2;
  const line = (v: Stage2Context["variables"][number]) =>
    `- ${v.variable_name} | ${v.natural_name ?? ""} | ${v.data_type ?? ""} | sample: ${JSON.stringify(v.sample_value)}${v.condition_flag ? ` | flag: ${v.condition_flag}` : ""}${v.enum_options?.length ? ` | options: ${v.enum_options.join(" / ")}` : ""}`;
  const pricing = s2.variables.filter((v) => v.category === "pricing");
  const inputs = s2.variables.filter((v) => v.category === "customer_input");
  const flags = [...new Set(s2.variables.map((v) => v.condition_flag).filter(Boolean))] as string[];
  const flagOwners = (f: string) => s2.variables.filter((v) => v.condition_flag === f).map((v) => `${v.variable_name} (${v.category})`).join(", ");

  const retry = previous
    ? `
==================== YOUR PREVIOUS ATTEMPT ====================
${JSON.stringify(previous.wire)}

==================== ERRORS TO FIX ====================
${previous.errors.map((e) => `- ${e}`).join("\n")}

Return the FULL corrected JSON (every table and every variable), not a patch.
`
    : "";

  return `
You are turning an agency's pricing notes into a spreadsheet the proposal engine can calculate from.
A spreadsheet = TABLES (the price lists) + one DEFINITION per cell. The engine does all arithmetic; you never compute a number that the tables and definitions can derive.
The cells are the variable names from the agency's proposal template, listed below. Define each one in terms of tables, lead inputs and other cells.

==================== PRICING NOTES (written by the agency owner) ====================
${input.pricingSpec}

==================== SAMPLE QUOTATION (one real proposal, markdown) ====================
${input.quotationMarkdown}

==================== THE AGENCY ====================
Name: "${input.companyName}"  Based in: "${input.homeLocation || "unknown"}"

==================== CELLS YOU MUST DEFINE (in_document: true, exactly these names) ====================
${pricing.map(line).join("\n") || "(none)"}

Customer inputs already in the document (define as kind "input" with in_document: true ONLY the ones the maths needs, e.g. seat counts; a value the agency sets rather than the lead — validity days, payment terms — is kind "constant" with in_document: true and the sample value; names, dates and free text are NOT yours):
${inputs.map(line).join("\n") || "(none)"}

Flags to define as kind "condition" (name exactly as listed; each must be TRUE for the sample lead):
${flags.map((f) => `- ${f} — controls ${flagOwners(f)}`).join("\n") || "(none)"}

Loop tables to define as kind "rows" (map keys must be EXACTLY these columns):
${s2.loop_tables.map((t) => `- ${t.loop_tag} → columns [${t.columns.join(", ")}], ${t.row_labels.length} rows in the sample`).join("\n") || "(none)"}

Values covered by drafted prose (no tag of their own; define them anyway so the drafter receives them):
${input.covered.join(", ") || "(none)"}

==================== RULES ====================
1. Every variable is ONE flat operation: kind input | constant | lookup | formula | condition | aggregate | rows. To nest, add a helper variable with in_document: false (lead inputs like location_count, constants like minimum_seat_commitment, intermediates like stackable_addon_count). Helpers are invisible to the document.
2. Units: money | percent | integer | text | boolean | rows. Percent values are FRACTIONS (8.25% → "0.0825"). Money has no symbol. An empty cell in an integer column means "unbounded" (no cap).
3. formula: op add | mul | min | max take 1+ args; sub | div take exactly 2. args are variable names or numeric literals (as strings). Never put text variables in a formula.
4. lookup: first row of the table, in table order, where ALL where-conditions hold; take = the column to read. Put cheapest / smallest tier first so caps resolve upward. where uses column op value_var|value; ops eq neq gte lte gt lt in.
   No row matched is a real outcome, and you choose what it means: leave "fallback" as "" and the quote STOPS for a human to handle (the safe default — use it whenever a missing row means the sheet genuinely cannot price this lead), or set "fallback" to the value that applies to everyone the table does not list. Set a fallback only when the notes say what that value is; never invent one. When one lookup on a table gets a fallback its siblings on the same table usually need one too, or the document prints a rate beside a blank name.
5. Who picks a tier? Decide from the notes, per tier table:
   * The notes size the tiers by ONE count the lead states ("for one location", "up to 3 locations", "up to 50 seats"): the RULES pick. The tier is a lookup on the tier table where the cap column gte the lead's count input (cheapest row first, empty cap = unlimited). The lead states the count and is never asked to name the tier — a count past every cap leaves the lookup with no row, which already stops the quote, so no review rule for it.
   * The tiers are different offerings that no single count decides (a support level chosen for its SLA, a project type such as landing page vs e-commerce): the LEAD picks → kind input, input_type choice, options_table + options_column.
   A value the AGENCY sets and the lead never decides (validity days, payment terms, a fixed contract length) → kind constant, never input.
6. Bands (volume discounts by seat count): table kind "bands" with min/max integer columns (max empty = open-ended), lookup where min lte X AND max gte X. Floors / minimum commitments → formula max. Whole quantity gets the band rate; bands never stack.
7. Add-ons the lead picks: table kind "addons" + a multi_choice input + aggregate (sum/count, rows: "selected", selected_var, key_column) + a rows variable for the document's loop.
   * Every row of that table carries a FIXED money fee. The loop prints one amount per row and can only read that amount from the row's own columns, so an add-on priced as a share of something else ("rush delivery +20% of base price") does NOT go in the table: give it a boolean input, a constant for the rate, and a formula mul[that input, what the percentage is of, the rate] — the boolean counts as 1 when true and 0 when false, so the fee appears only when they asked for it. Add that fee to the table's subtotal afterwards. Forcing it into the table means adding money to a percentage, which is not a number and will be rejected.
   * Any rows loop whose contents differ by which package the lead ends up with (phase lists, deliverables, what is included) needs ONE table holding every package's rows plus a column naming the package, and the loop filters on it with a where. Without that filter every proposal prints whichever package's rows you happened to enter, so a Landing Page quote goes out carrying the E-commerce phases.
8. Payment splits: table kind "splits" with a percent column "share" and a rows variable whose amount map entry is { op: "mul", args: ["col:share", "<total variable>"] }.
9. Taxes. First decide from the notes whether tax depends on WHERE THE BUYER IS.
   * It does not apply at all (the notes say the agency does not charge it, or are unsure and the SAMPLE QUOTATION shows no tax): define NO tax variables whatsoever — no rate, no flag, no amount — and say what you concluded in assumptions[].
   * It applies at one rate for every buyer (a national VAT/GST, a flat surcharge): kind constant for the rate, and if the document declares a has_tax flag it reads [tax_rate gt 0] — true because the rate is above zero, and it turns itself off if the agency later sets that rate to 0 on the deck. NO taxes table, NO region input, NO count. Asking a lead for their region to apply a rate that never varies is a bug.
   * It does (rates differ by state / province / country, or only some places are taxed): table kind "taxes" (a region code column, the jurisdiction name, the rate), a region input whose options_table + options_column point at that same code column, an aggregate count over the table where the code equals the input, and a condition on that count. Never assume the agency's own location for the lead.
   Either way, say in assumptions[] what happens to a buyer the notes do not cover. If a region with no row means "we charge them nothing" (a seller taxed only where they have a presence), that is the count + condition shape and needs nothing more. If instead every buyer owes something, the uncovered buyer must not silently lose the tax line: give the rate and jurisdiction lookups a fallback (rule 4), or add a review_rules[] entry so a human prices them.
10. Flags are condition variables named EXACTLY as the flags listed above and no others — that list comes from the document, so a flag you add yourself guards nothing and is read as a claim about the proposal. condition_flag on a variable is an OPTIONAL skip guard: set it only on variables that cannot be computed unless the flag holds (a tax lookup for a region with no tax row). Leave amounts that feed a flag unguarded — never create a cycle.
11. Variable, table and column names: snake_case identifiers. Every table row lists every column. Every variable object carries every field; use "" / [] / false for the ones its kind does not use.
12. When the notes leave something open (tax basis, rush pricing, monthly vs annual), decide, record it in assumptions[] (text = what was unclear, resolved_as = what you did), and if a lead must NOT be auto-quoted add a review_rules[] entry (when: conditions, reason). A cap the notes state for an option the LEAD picks ("up to 100 products", "up to 8 pages") that a lead's number can exceed is exactly that: the sheet cannot price past it, so a review rule must fire (compare the lead input against the cap column). A tier the rules pick from that number (rule 5) needs no such rule.
13. sample_inputs = the lead facts behind the SAMPLE QUOTATION (one entry per input variable, defaults do not count: value for scalars, values for multi_choice). Running your sheet on sample_inputs must reproduce every sample value above exactly.
14. For every input decide what happens when the lead does not say it: required true (we ask them), or a default (we assume it: default for scalars, default_values for multi_choice) plus assume_when (one line telling the reader how to read the lead's words for this field, e.g. "a yearly plan means 12"), or neither (left blank). Never a default for any input the tax calculation reads — a wrong tax figure is a legal error in a document the client signs, so the lead must state it. To cover a buyer your tax table does not list, use a lookup fallback (rule 4) instead: that is the agency's own policy, not a guess about this lead. Put the reasoning behind each default in assumptions[].
15. Return only the JSON object.
${retry}`;
}

const STR = { type: SchemaType.STRING } as const;
const BOOL = { type: SchemaType.BOOLEAN } as const;
const STRS = { type: SchemaType.ARRAY, items: STR } as const;
const obj = (properties: Record<string, unknown>): ResponseSchema =>
  ({ type: SchemaType.OBJECT, properties, required: Object.keys(properties) }) as ResponseSchema;
const arr = (items: ResponseSchema) => ({ type: SchemaType.ARRAY, items }) as ResponseSchema;

const condSchema = obj({ var: STR, column: STR, op: STR, value_var: STR, value: STR, values: STRS });

/** Gemini-safe wire schema: no unions, no dynamic keys, everything required (optional fields get skipped). */
export const pricingRulesResponseSchema: ResponseSchema = obj({
  version: { type: SchemaType.NUMBER },
  tables: arr(obj({
    id: STR, label: STR, kind: STR,
    columns: arr(obj({ key: STR, label: STR, unit: STR })),
    rows: arr(obj({ cells: arr(obj({ column: STR, text: STR })) })),
  })),
  variables: arr(obj({
    name: STR, label: STR, in_document: BOOL, unit: STR, condition_flag: STR, kind: STR,
    input_type: STR, options_table: STR, options_column: STR, options: STRS, required: BOOL,
    default: STR, default_values: STRS, assume_when: STR,
    value: STR,
    table: STR, where: arr(condSchema), take: STR, fallback: STR,
    op: STR, args: STRS,
    all: arr(condSchema),
    fn: STR, rows: STR, selected_var: STR, key_column: STR, column: STR,
    map: arr(obj({ loop_column: STR, column: STR, op: STR, args: STRS })),
  })),
  review_rules: arr(obj({ when: arr(condSchema), reason: STR })),
  assumptions: arr(obj({ text: STR, resolved_as: STR })),
  sample_inputs: arr(obj({ name: STR, value: STR, values: STRS })),
});

/** The same shape spelled out for DeepSeek (json_object mode, no typed schema). */
export const PRICING_JSON_SHAPE = `
==================== OUTPUT FORMAT ====================
Respond with ONLY a single JSON object — no markdown fences, no commentary — matching exactly this shape (every field present; "" / [] / false when unused):
{
  "version": 1,
  "tables": [ { "id": string, "label": string, "kind": "packages" | "bands" | "addons" | "taxes" | "splits" | "other",
                "columns": [ { "key": string, "label": string, "unit": "money" | "percent" | "integer" | "text" | "boolean" } ],
                "rows": [ { "cells": [ { "column": string, "text": string } ] } ] } ],
  "variables": [ {
      "name": string, "label": string, "in_document": boolean, "unit": "money" | "percent" | "integer" | "text" | "boolean" | "rows", "condition_flag": string,
      "kind": "input" | "constant" | "lookup" | "formula" | "condition" | "aggregate" | "rows",
      "input_type": "integer" | "choice" | "multi_choice" | "boolean" | "region" | "", "options_table": string, "options_column": string, "options": string[], "required": boolean,
      "default": string, "default_values": string[], "assume_when": string,
      "value": string,
      "table": string, "where": [ { "column": string, "var": "", "op": string, "value_var": string, "value": string, "values": string[] } ], "take": string, "fallback": string,
      "op": "add" | "sub" | "mul" | "div" | "min" | "max" | "", "args": string[],
      "all": [ { "var": string, "column": "", "op": string, "value_var": string, "value": string, "values": string[] } ],
      "fn": "sum" | "count" | "", "rows": "selected" | "all" | "", "selected_var": string, "key_column": string, "column": string,
      "map": [ { "loop_column": string, "column": string, "op": string, "args": string[] } ]
  } ],
  "review_rules": [ { "when": [ { "var": string, "column": "", "op": string, "value_var": string, "value": string, "values": string[] } ], "reason": string } ],
  "assumptions": [ { "text": string, "resolved_as": string } ],
  "sample_inputs": [ { "name": string, "value": string, "values": string[] } ]
}
`;

type ModelCall = (prompt: string) => Promise<AiPricingRules>;
let modelCall: ModelCall | null = null;
/** Test seam: replaces the network call. null restores the real provider dispatch. */
export function setRulesModelCall(fn: ModelCall | null): void {
  modelCall = fn;
}
const callModel: ModelCall = (prompt) => (modelCall ?? ((p) => generateJson<AiPricingRules>(p, pricingRulesResponseSchema, PRICING_JSON_SHAPE)))(prompt);

/** Validate → evaluate the sample lead → per-variable check. Shared by compile and PUT. */
export function buildRulesState(rules: PricingRules, stage2: Stage2Context, compiledAt = new Date().toISOString()): PricingRulesState {
  const validation_errors = validate(rules, stage2);
  if (validation_errors.length) return { rules, compiled_at: compiledAt, validation_errors, sample_check: [], evaluation: null };
  const evaluation = evaluate(rules, rules.sample_inputs);
  return { rules, compiled_at: compiledAt, validation_errors, sample_check: sampleCheck(rules, evaluation, stage2), evaluation };
}

const issuesOf = (s: PricingRulesState) => [s.validation_errors.length, s.sample_check.filter((c) => !c.ok).length] as const;
const errorLines = (s: PricingRulesState) => [
  ...s.validation_errors.map((e) => `${e.path}: ${e.message}`),
  ...s.sample_check.filter((c) => !c.ok).map((c) => `${c.name}: computed ${c.computed}, quotation says ${c.expected}${c.note ? ` (${c.note})` : ""}`),
];

/** One compile with one repair pass; the better of the two attempts is returned (fewest structural, then sample, errors). */
export async function compilePricingRules(companyId: string, company: CompanyRow, stage2: Stage2Context): Promise<PricingRulesState> {
  const input = buildCompileInput(company, stage2);
  const attempt = async (previous?: PreviousAttempt) => {
    const wire = await callModel(buildCompilePrompt(input, previous));
    return { wire, state: buildRulesState(fromWire(wire), stage2) };
  };

  const first = await attempt();
  logPipelineArtifact(companyId, "rules-raw.json", { ai: getAISettings(), errors: errorLines(first.state), ...first.wire });
  if (issuesOf(first.state).every((n) => n === 0)) return first.state;

  // Re-serialise through toWire so the model sees the typed reading of its own output (what fromWire kept).
  const second = await attempt({ wire: toWire(first.state.rules), errors: errorLines(first.state) });
  logPipelineArtifact(companyId, "rules-repair.json", { ai: getAISettings(), errors: errorLines(second.state), ...second.wire });
  const [a, b] = [issuesOf(first.state), issuesOf(second.state)];
  return b[0] < a[0] || (b[0] === a[0] && b[1] <= a[1]) ? second.state : first.state;
}
