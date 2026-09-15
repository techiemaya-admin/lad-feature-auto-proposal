# Plan: Issue 05 — Pricing Compiler, Rule Cards, Deterministic Math

Paths are relative to `prototypes/new-auto-proposal/` unless noted. Ticket: [`.scratch/new-auto-proposal/issues/05-pricing-compiler-visual-rule-cards-and-deterministic-math.md`](../../../../.scratch/new-auto-proposal/issues/05-pricing-compiler-visual-rule-cards-and-deterministic-math.md). Spec: [`.scratch/new-auto-proposal/spec.md`](../../../../.scratch/new-auto-proposal/spec.md) §4.

## Context

Stage 4 of the prototype pipeline. Owner-written pricing prose (`company_sessions.pricing_spec`) must become (1) rules a non-technical user can read and tweak on cards, (2) a pure-JS calculator that reproduces the three ground-truth totals to the cent, and (3) a payload keyed by the company's *current* template tags so Stage 5 can hydrate `template.docx`.

**Decided with the user (2026-09-15/16):**
- **Mental model = a spreadsheet whose cells are the Stage 2 variables.** No internal key vocabulary, no bindings map. Every Stage 2 `pricing` variable gets a *definition* written in terms of other variables. Pricing-only helpers (inputs like `location_count`, constants like `minimum_seat_commitment`, intermediates like `stackable_addon_count`) live inside the rules JSON with `in_document: false` — never in `company_variables`.
- Rerunning any earlier stage resets Stage 4 (hard-reset policy).
- Persist in `working_state_json.pricing_rules` (already seeded `null` on submit, wiped on unlock). No new table.
- Formulas are **one flat operation per variable** (`{op, args}`); nesting = add a helper variable.
- Tables (the cards) are **generic grids with a `kind` hint**; the AI picks columns per company.
- Live **per-variable self-check**: evaluate with `sample_inputs`, compare each document variable to its Stage 2 `sample_value`, ✓/✗ on the ledger.
- Compile **auto-retries once** on structural errors *or* sample mismatches, feeding the error list back.

**Research that shaped this (details in the conversation):** `pricing_engine_parsed` never existed in the dataset; variable names differ per extraction run; Gemini responseSchema can't do unions or dynamic keys and skips optional fields; DeepSeek (default provider) has no schema → server-side validation is the gate; the main backend's pricing engine is the anti-pattern list (float money, enum drift, unused priority, no assumption flags, zero-total as control flow); PricingLogic paper + Fowler: LLM writes the program, runtime executes, small DSL + deterministic validator + repair loop; Stripe: name `volume` vs `graduated` explicitly (we implement `volume` only — whole quantity at the band rate — `ponytail:` comment for graduated).

---

## 1. The rules document (`PricingRules`)

`P/backend/src/services/pricing-rules.types.ts` (backend) mirrored in `P/frontend/src/types/pricing.ts`.

```ts
type Unit = "money" | "percent" | "integer" | "text" | "boolean" | "rows";
type CompareOp = "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in";
type Cell = string | number | boolean | null;        // null in an integer column = unbounded (cap ∞)
type Row = Record<string, Cell>;
type Value = number | string | boolean | string[] | Row[];

interface RuleTable { id; label; kind: "packages"|"bands"|"addons"|"taxes"|"splits"|"other";
  columns: { key; label; unit: Exclude<Unit,"rows"> }[]; rows: Row[] }
interface Where { column; op: CompareOp; value_var?: string; value?: Cell; values?: Cell[] }   // values only for "in"
interface Cond  { var;    op: CompareOp; value_var?: string; value?: Cell; values?: Cell[] }
interface Formula { op: "add"|"sub"|"mul"|"div"|"min"|"max"; args: (string|number)[] }      // "col:<key>" allowed inside rows.map

type RuleVariable = { name; label; in_document: boolean; unit: Unit; condition_flag: string /* "" = none */ } & (
  | { kind: "input"; input_type: "integer"|"choice"|"multi_choice"|"boolean"|"us_state";
      options_table?; options_column?; options?: string[]; required: boolean }
  | { kind: "constant"; value: Cell }                                   // percent stored as fraction 0.0825
  | { kind: "lookup"; table; where: Where[]; take: string }             // first row in table order where ALL hold
  | { kind: "formula" } & Formula                                       // add/mul/min/max n-ary (≥1), sub/div exactly 2
  | { kind: "condition"; all: Cond[] }                                  // boolean
  | { kind: "aggregate"; fn: "sum"|"count"; table; rows: "selected"|"all"; selected_var?; key_column; column?; where?: Where[] }
  | { kind: "rows"; table; rows: "selected"|"all"; selected_var?; key_column; where?: Where[];
      map: Record<string /* loop column tag */, string /* column key */ | Formula> } );

interface PricingRules { version: 1; tables: RuleTable[]; variables: RuleVariable[];
  review_rules: { when: Cond[]; reason: string }[];
  assumptions: { text: string; resolved_as: string }[];
  sample_inputs: Record<string, Value> }

interface Evaluation { values: Record<string,Value>; present: Record<string,boolean>;
  needs_review: { reason: string; source?: string }[]; order: string[] }
interface ValidationError { path: string; message: string }              // "variables[3].args[1]"
interface SampleCheckEntry { name; computed: string; expected: string; ok: boolean; note?: string }
interface Stage2Context { variables: { variable_name; natural_name?; category; data_type; sample_value; condition_flag?; enum_options?; paragraph_mode? }[];
  loop_tables: { loop_tag; columns: string[]; row_labels: string[] }[] }
interface PricingRulesState { rules; compiled_at; validation_errors: ValidationError[]; sample_check: SampleCheckEntry[]; evaluation: Evaluation|null }
```

**Semantics the engine guarantees (no definition needed):**
- `condition_flag` on a rules variable = *skip guard*: when that flag is false the variable is not evaluated, value = zero-of-unit (`0 | "" | false | []`), `present=false`, and no lookup-miss/div-zero review fires. The guard is **optional** — use it on things that can't be computed unless the flag holds (e.g. `tax_rate`/`tax_jurisdiction` lookups for a non-TX lead). A flag derived from the amount it would hide (`has_addons = addon_subtotal > 0`) simply leaves `addon_subtotal` unguarded; the validator reports any real cycle with a domain message naming both variables.
- Row presence in the proposal payload comes from the **Stage 2 flag** (`descriptor.visibility_rule.condition_flag`): `payload.has_x = values.has_x`. Every Stage 2 flag (rows *and* paragraphs, e.g. co3's live `has_tax` on `tax_note`) must be a defined `condition` variable.
- Text compare (`eq/neq/in`, choice matching, `key_column` matching) is whitespace-normalised and case-insensitive (fixes `E-Commerce` vs `E-commerce`); the canonical value written out is the table's.
- `null` cell in a `gte/gt` comparison = always true (unbounded cap); in `lte/lt` = always false.
- Money rounded to cents (`Math.round((x + Number.EPSILON) * 100) / 100`) **immediately after each money variable**; integers `Math.round`; percent stays a fraction. Loop money cells rounded at row construction. For `kind: "splits"` tables, a `rows.map` formula `mul ["col:share", <total_var>]` gets the rounding remainder added to the last row so milestones always sum to the total.
- Amounts are **unsigned** (templates hard-code the `−` glyph).
- Missing required input, lookup with no matching row, division by zero, and any matching `review_rules[]` entry → `needs_review[]` (explicit "decline to auto-quote"; never a silent 0).

**Evaluation:** deps = `condition_flag` ∪ referenced names (`args`, `where[].value_var`, `all[].var/value_var`, `selected_var`, `rows.map` formula names; `col:` refs excluded). Kahn topological sort, ties by declaration index (stable ledger order); leftovers = cycle. Then one pass in order applying the kind semantics above; finally `review_rules`.

**`validate(rules, stage2)`** (domain-level messages, path + message): duplicate names / table ids / column keys; bad identifier; unknown variable / table / column / take / key_column / options_table; arity; choice input without an options source; `selected` without a choice/multi_choice `selected_var`; cycle; `condition_flag` naming a non-condition variable; every non-deleted Stage 2 `pricing` variable has an `in_document:true` definition; every Stage 2 flag is a defined `condition`; every Stage 2 loop_tag has a `rows` variable whose `map` keys equal its `columns`.

**`formatLike(sample, value)`**: parse `sample` as `pre + number + post` (`$3,000/mo` → `$`, thousands, 0 dp, `/mo`; `8.25%` → percent ×100, 2 dp; `25–49 seat band` → text passthrough); emit `pre + toLocaleString("en-US", {min,max: decimals}) + post`; if the sample's decimals would lose precision (`"10%"` vs 0.0825) use the minimal decimals ≤ 4. Booleans → `Yes/No`. `parseSampleNumber(sample)` is its inverse for the sample check.

**`sampleCheck(rules, evaluation, stage2)`**: every `in_document` variable with a Stage 2 match (pricing + customer_input): money/percent within 0.005 / 1e-6, integer equal, text normalised-equal; if Stage 2 has a flag → `present` must be true; loops → row count equals `row_labels.length`; every Stage 2 flag's condition variable must be true under `sample_inputs`. `computed`/`expected` are formatted strings for the ledger.

**`buildProposalPayload(rules, evaluation, stage2, tierMatrix?)`** → `Record<string, string|boolean|Row[]>`: document variables via `formatLike(sample_value, value)` (`""` when not present), loops as row arrays with money/percent cells formatted, every `condition` variable as boolean, plus `buildTierMatrixPayload(tierMatrix, String(values[tierMatrix.selector]))` (`template-mutator.service.ts:326`) when a matrix exists.

---

## 2. Sub-feature A — calculator, validator, fixtures, tests (no AI, no routes)

**New `P/backend/src/services/pricing-calculator.ts`** — pure; exports `evaluate`, `validate`, `formatLike`, `parseSampleNumber`, `sampleCheck`, `buildProposalPayload`. Duplicate the 1-line `norm` from `template-mutator.service.ts:74` rather than importing that module's DB side; import only `buildTierMatrixPayload`.

**New fixtures** `P/backend/src/tests/fixtures/{co1_seo,co2_msp,co3_dev}.rules.json` — typed `PricingRules`, names aligned to the existing `*.variables.json` fixtures. Hand-verified sketches:

*co1_seo → $35,073.00.* Tables: `packages` (`name·text, monthly_rate·money, location_cap·integer`: Local/1000/1, Growth/3000/3, Authority/8000/null); `taxes` (`state, state_name, rate·percent`: TX/Texas/0.0825). Inputs: `location_count` int req, `client_state` us_state req, `annual_prepay` bool. `selected_tier`[doc] = lookup packages where `location_cap gte location_count` → name; `selected_tier_rate`[doc] = lookup where `name eq selected_tier` → monthly_rate; `contract_months`[doc] = 12; `base_investment_amount`[doc] = mul[rate, months] (36,000); `annual_discount_percentage`[doc] = 0.10; `has_annual_discount` = [annual_prepay eq true]; `annual_discount_amount`[doc] ⚑has_annual_discount = mul[base, pct] (3,600); `subtotal_amount`[doc] = sub[base, discount] (32,400); `tax_match_count` = aggregate count taxes all where `state eq client_state`; `has_tax` = [tax_match_count gt 0]; `tax_jurisdiction`/`tax_rate`[doc] ⚑has_tax = lookups; `tax_amount`[doc] ⚑has_tax = mul[subtotal, tax_rate] (2,673.00); `total_investment_amount`[doc] = add[subtotal, tax] (**35,073.00**). `sample_inputs` {2, "TX", true}. Assumptions: tax basis post-discount; non-prepay leads = 12 months at monthly rate, discount row hidden.

*co2_msp → $2,734.80/mo + $3,150.00.* Tables: `tiers` (`name, rate_per_seat·money, sla·text`: 45/65/85); `volume_bands` (`min_seats, max_seats, discount_per_seat·money, label·text`: 0/24/0, 25/49/5/"25–49 seat band", 50/null/10); `taxes` (OH/Ohio/0.06). Inputs: `seat_count`[doc] int req, `selected_tier`[doc] choice(tiers.name) req, `extra_device_count`[doc] int, `client_state` us_state req. `minimum_seat_commitment` = 10; `billed_seat_count` = max[seat_count, min]; `base_rate_per_seat`[doc] = lookup tiers → rate; `volume_band_discount` = lookup bands where `min_seats lte billed AND max_seats gte billed` → discount; `has_volume_adjustment` = [volume_band_discount gt 0]; `volume_discount_per_seat`[doc] = add[volume_band_discount]; `volume_tier_band`[doc] ⚑ = lookup → label; `adjusted_seat_rate`[doc] = sub[base, discount] (60); `seat_subtotal`[doc] = mul[billed, adjusted] (2,520); `extra_device_rate`[doc] = 12; `has_extra_devices` = [extra_device_count gt 0]; `extra_device_subtotal`[doc] = mul (60); `monthly_recurring_subtotal`[doc] = add (2,580); tax as co1 on the recurring subtotal (154.80); `total_monthly_recurring`[doc] (**2,734.80**); `onboarding_rate_per_seat`[doc] = 75; `setup_fee_total`[doc] = mul[billed, 75] (**3,150.00**, never in a tax basis). `sample_inputs` {42, "Standard", 5, "OH"}.

*co3_dev → $10,445.00; 5,222.50 / 5,222.50.* Tables: `templates` (`name, fee·money, product_cap·integer, scope_summary, timeline, needs_scoping·boolean`: Landing Page/2500/null, Business Website/6000/null, E-Commerce Build/9500/100/"up to 100 products"/"4–6 weeks", Custom Web App/22000/null/…/true); `phases` (other: `template, phase_number, milestone_title, deliverable_summary` — the 5 E-Commerce rows from `Mock Data/markdown/Co3…md`); `addons` (`name, line_label, fee·money, stackable·boolean`: Copywriting/600, Basic SEO Setup/450, CMS Integration/800, Extra Revision Round/300); `payment_splits` (`milestone_name, trigger_description, share·percent`: 0.5/0.5). Inputs: `product_count` int req, `project_template_name`[doc] choice req, `selected_addons` multi_choice(addons.name), `rush_delivery` bool. `template_product_cap`, `template_needs_scoping`, `template_scope_summary`[doc], `typical_delivery_timeline`[doc], `base_template_fee`[doc] = lookups on templates; `milestones`[doc] = rows phases all where `template eq project_template_name`; `addon_items`[doc] = rows addons selected → {addon_name: line_label, addon_fee: fee}; `stackable_addon_count` = aggregate count selected where `stackable eq true`; `addon_flat_subtotal` = aggregate sum selected fee (1,050); `rush_percentage` = 0.20; `rush_fee` = mul[rush_delivery, base_template_fee, rush_percentage]; `addon_subtotal`[doc] = add[addon_flat_subtotal, rush_fee]; `has_addons` = [addon_subtotal gt 0]; `bundle_discount_percentage`[doc] = 0.10; `has_bundle_discount` = [stackable_addon_count gte 2]; `bundle_discount_amount`[doc] ⚑ = mul[addon_flat_subtotal, pct] (105); `addon_total_after_discount` = sub; `tax_rate` = 0; `tax_amount` = mul; `total_project_investment`[doc] = add[base, addon_total, tax] (**10,445**); `payment_milestones`[doc] = rows payment_splits all map {…, payment_amount: mul["col:share", total_project_investment]}. `review_rules`: [product_count gt template_product_cap] "exceeds the template's product cap — needs a scoping call"; [template_needs_scoping eq true] "Custom Web App always needs a scoping call". `sample_inputs` {60, "E-Commerce Build", ["Copywriting","Basic SEO Setup"], false}. Assumptions: tax 0%; rush = 20% of base added to add-on subtotal; thirds split not modelled.

**New `P/backend/src/tests/pricing-calculator.test.ts`** (`node:test`, offline, picked up by `npm test`):
- Adapter `.variables.json` → `Stage2Context` (`sample_value = sample_text`, `columns = column_tags`).
- Benchmarks to the cent (all three, incl. split amounts `[5222.5, 5222.5]`).
- verification_guide §4.1–4.3: co1 `{3}`→Growth, `{15}`→Authority, no `annual_prepay`→`present.annual_discount_amount===false` & subtotal 36,000, `"CA"`→no tax line; co2 `25`→−5, `50`→−10, `60`→−10 only, `7`→billed 10 (seat subtotal 650, setup 750), setup excluded from tax, no state→`needs_review` + no tax; co3 one add-on→no bundle, Copywriting+rush→no bundle & 2,500, `100`→no review, `140`→review, Custom Web App→review.
- `validate`: cycle, unknown name, unknown table/column, Stage 2 pricing variable undefined, Stage 2 flag undefined, `sub` with 3 args, choice without options.
- `formatLike`: `("$3,000/mo",3000)`, `("8.25%",0.0825)`, `("10%",0.1)`, `("10%",0.0825)→"8.25%"`, `("$36,000.00",35073)→"$35,073.00"`, `("42",42)`, text passthrough.
- `sampleCheck` all `ok` for each fixture.
- `buildProposalPayload` keys ⟷ template tags: render each fixture with `applyTemplate` exactly as `template-mutator.test.ts:35-45`, scan `\{([a-z0-9_]+)\}` (skip `{#…}`/`{/…}`), assert every pricing/flag/loop/`tierN_*` tag is a non-empty payload key and vice-versa. **Never** compare against `Mock Data/templated_markdown/*.md` — it is drifted (`tier_left_*`, `{#has_copywriting}`) from what the engine emits.

---

## 3. Sub-feature B — compile, AI call, retry, routes, persistence

**Refactor (small):** `gemini.service.ts:196-226` → extract `generateJsonWithGemini<T>(prompt, schema, model)`; `deepseek.service.ts:34-79` → `generateJsonWithDeepSeek<T>(prompt, jsonShapeSuffix, model)`; `ai-extraction.service.ts` gains `generateJson<T>(prompt, schema, suffix)` using the same `getAISettings()` dispatch (lines 6-11). Existing extract functions become thin wrappers.

**New `P/backend/src/services/pricing-compiler.service.ts`:**
- `loadStage2Context(companyId)` — same query as `template-mutator.service.ts:416-420`; loop rows read `descriptor.columns` (stored under that key at `routes/variables.ts:195`, *not* `column_tags`).
- `buildCompileInput` — `pricing_spec`, `quotation_markdown`, home state from `company.location` (`/\b([A-Z]{2})\b\s*$/`; co3 "Remote (…)" → none), `template_stats.details` with `action:"covered"`, `template_stats.tier_matrix`.
- `buildCompilePrompt(input, previousAttempt?)` — sections: role ("turn pricing notes into a spreadsheet: tables plus one definition per cell; the engine does the arithmetic"); PRICING NOTES; SAMPLE QUOTATION markdown; AGENCY + home state; CELLS YOU MUST DEFINE (one line per Stage 2 pricing variable `name | natural_name | data_type | sample | condition_flag | enum_options`; customer inputs the maths needs; flags to define incl. paragraph flags, "must be TRUE for the sample lead"; loop tags with exact `columns`; covered values); numbered rules (one op per formula, helpers `in_document:false`, percent as fractions, unbounded cap = empty cell, flags are `condition` variables named exactly as the flag, guard only what can't be computed without the flag, tier picked by lead → `input choice`, tier picked by rules → `lookup` in table order cheapest first, bands → min/max + `lte/gte`, floors → `max`, splits → `share` column + `rows` with `col:share`, add-ons → table + `multi_choice` + `aggregate`/`rows`, unsure → `assumptions[]` (+ `review_rules[]` if it must not be auto-quoted), `sample_inputs` = the lead facts behind the sample quotation). On retry: YOUR PREVIOUS ATTEMPT (wire JSON) + ERRORS TO FIX (`path: message` list, then `name: computed X, quotation says Y`) + "return the full corrected JSON".
- **Wire shape** `AiPricingRules` (Gemini-safe: all fields present/required, no unions, no dynamic keys): table rows as `cells: [{column, text}]` (`""` = null); every variable carries every kind's fields (`""`/`[]`/`false` when unused); `args` as strings (numeric strings → numbers); `map` as `[{loop_column, column, op, args}]`; `sample_inputs` as `[{name, value, values}]`. `pricingRulesResponseSchema: ResponseSchema` for Gemini; `PRICING_JSON_SHAPE` suffix for DeepSeek (same shape spelled out like `deepseek.service.ts:12-32`). `fromWire()` types cells by column unit (money strips `$`/`,`; `%` → ÷100; integer parseInt; boolean true/yes/1), lenient to native numbers/booleans; `toWire()` for the retry prompt and the test stub.
- `compilePricingRules(companyId): Promise<PricingRulesState>` — call → `fromWire` → `validate` → `evaluate(rules, sample_inputs)` → `sampleCheck`; if any structural error or `!ok` → **one** retry with errors appended; keep the attempt with fewer (structural, then sample) errors. `logPipelineArtifact(id, "rules-raw.json", {ai: getAISettings(), ...wire})` and `"rules-repair.json"` (mirrors `routes/variables.ts:141`).
- `setRulesModelCall(fn | null)` — test seam replacing the network call. `buildRulesState(rules, ctx)` shared by compile and PUT.

**New `P/backend/src/routes/rules.ts`** (Router + response shapes of `routes/template.ts`):
- `POST /:id/rules/compile` — 400 without `quotation_markdown` or Stage 2 pricing variables; persist `working_state.pricing_rules = state`, `stage: "pricing_engine"`; `{success, pricing_rules}`.
- `GET /:id/rules` — 404 "Pricing rules have not been compiled yet" when null.
- `PUT /:id/rules` body `{rules}` — validate against live Stage 2; structural errors → 400 `{success:false, errors:[{path,message}]}` (nothing persisted); else re-evaluate + sample check, persist.
- `POST /:id/rules/calculate` body `{inputs}` → `{success, evaluation, payload}` (Stage 5's entry point; a sample check against a non-sample lead is meaningless, so it is not returned — the deck's live check goes through `PUT`).
- `POST /:id/rules/proceed` — 409 if no rules or validation errors; `stage: "lead_simulation"`; returns `formatCompanyResponse(row)`.

**Edits:** `P/backend/src/app.ts:30-33` mount `rulesRouter` before `companiesRouter`; `routes/template.ts:50-64` add `pricing_rules: null` to the spread (template regeneration resets Stage 4); `routes/briefing.ts:233-238` add explicit `pricing_rules: null`.

**New `P/backend/src/tests/pricing.routes.test.ts`** (supertest; setup as `variables.test.ts:14-52`; insert `co1_seo.variables.json` rows as `template-mutator.test.ts:178-185`; `setRulesModelCall(async () => toWire(co1Fixture))`): GET 404 before compile → compile 200 with all-ok sample check and `stage==="pricing_engine"` → GET 200 → PUT with `sub` of 3 args → 400 with `errors[0].path` → PUT valid edit (`annual_discount_percentage` 0.15) → 200 with a mismatch entry → calculate `{location_count:3, client_state:"CA"}` → `payload.has_tax===false`, `total_investment_amount==="$36,000.00"` → `/template/generate` clears rules (GET 404) → compile again → `/briefing/unlock` clears (GET 404). Plus: stub returns a cyclic rules set first and the fixture second → second attempt persisted.

---

## 4. Sub-feature C — frontend

**Types/API:** new `P/frontend/src/types/pricing.ts`; `types/company.ts:69-76` add `pricing_rules?: PricingRulesState | null`; `services/api.ts` (after line 249) add `compilePricingRules`, `fetchPricingRules`, `updatePricingRules` (attach `errors` on 400), `calculatePricing`, `proceedToLeadSimulation` — error unwrapping as `generateTemplate` (214-225).

**New `P/frontend/src/components/pricing/PricingEngineDeck.tsx`** (+ `RuleTableCard.tsx`, `LedgerTray.tsx`, `readable.ts` in the folder):
- Shell = `TemplateCheckpointCard.tsx:120` card classes; `shimmer-bar` (`index.css:167`) while compiling; error panel pattern from `VariableReviewDeck.tsx:423-439` with "Try again" (never a stuck shimmer).
- Sections: **assumptions strip** (amber panel classes from `TemplateCheckpointCard.tsx:187`) → **one `RuleTableCard` per `tables[]`** (icon/title by `kind`; cells editable and typed by column unit; `font-mono tabular-nums` on money/percent/integer; empty integer = "∞"; add/remove row; `hover:-translate-y-0.5 transition-transform duration-100`) → **"What we ask the lead"** (input variables: label, type chip, required) → **Calculation ledger** (variables in `evaluation.order` minus inputs/constants shown above: label, `readable(def)`, computed value, Stage 2 sample, ✓/✗ from `sample_check`; helpers get a dashed "not in document" chip; tap → `LedgerTray` docked under the ledger with the connector from `VariableReviewDeck.tsx:579-608`; `[+ Add variable]` dashed chip as at 563-572) → **review rules** list → footer: "N of M match" + ghost `Regenerate` + primary `Proceed to Lead Simulation` (`bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`, disabled while validation errors exist).
- `LedgerTray`: `TrayHeader` pattern (`VariableReviewDeck.tsx:663-682`); `CustomDropdown` for kind/op/unit/table/column; operand chips (variable names + literal number input); condition rows (var / op / value or value_var); delete only for helpers.
- `readable.ts`: `formula` → `base_investment_amount × annual_discount_percentage`; `lookup` → `Packages · first row where location_cap ≥ location_count → monthly_rate`; `condition` → `annual_prepay is true`; `aggregate` → `count of selected Add-ons where stackable = true`; `rows` → `one row per selected Add-ons`; `constant` → value formatted by unit.
- State: local `rules` copy; every edit → `setRules` + 300 ms debounced `updatePricingRules`; response replaces `sample_check`/`evaluation`; a 400 shows its `errors` inline and keeps local edits.

**Wiring:** `App.tsx` — state `pricingRules`, `rulesStatus` (after line 42); load from `working_state.pricing_rules` in the effect at 123-168; `handleGenerateTemplate` (264-288) and `handleVariablesEdited` (257-262) → `setPricingRules(null)`; replace stub `handleProceedToPricing` (290-295) with compile; add `handleRulesChange`, `handleProceedToLeadSimulation`; pass props at 487-503 / 508-513. `CompanyProfileCard.tsx` — new props; render `<PricingEngineDeck>` after the checkpoint block (163-177) when `templateStats && (pricingRules || rulesStatus.status !== "idle")`; pass full `activeVariables` (sample values), not just `naturalNames`. `DevDock.tsx` — prop `pricingRules`; rules tab (339-357) → textarea seeded with the rules JSON, `JSON.parse` on blur with error, "Apply" → PUT, list `validation_errors`; `handleCopy` (71-72) copies rules JSON; stage labels (80-84, 375-379) add `pricing_engine` → "Stage 4: Pricing Engine", `lead_simulation` → "Stage 5: Lead Simulation".

---

## 5. Sub-feature D — doc drift to flag (do NOT apply without user confirmation)

- `P/docs/plan.md` §5 (133-153): replace the Tiers/Breakpoints/Addons/Discounts/Tax tree with the spreadsheet model (`tables[]` by kind + `variables[]` over Stage 2 names, helpers `in_document:false`), persistence key, five endpoints, `logs/<id>/*-rules-raw.json`; update "what the engine must do itself" items 3, 6, 7, 8.
- `P/docs/design.md` §3.4 (152-166): cards = one per table by kind + inputs + ledger + review rules; CTA "Proceed to Lead Simulation" (resolves the `Confirm Rules & Test Simulator` conflict); §4.2 Tab 4 → editable "Pricing Rules JSON"; §2 stage values `pricing_engine` → `lead_simulation`.
- `.scratch/new-auto-proposal/spec.md` §4 (66-84): `PricingRuleSchema` interface superseded by `PricingRules`; add the endpoint contracts; §Tested Modules add `pricing-calculator.test.ts` + `*.rules.json` + `setRulesModelCall`.
- `.scratch/new-auto-proposal/issues/05-…md` line 10 ("Create SQLite schema") → rules live in `working_state_json.pricing_rules`.
- `Mock Data/templated_markdown/*.md` is drifted from the engine's tags — flag for a refresh, not required for this issue.

---

## 6. Assumptions & known ceilings (stated, not blocking)

- co1 monthly (non-prepay) lead: quoted as 12 months at the monthly rate, discount row hidden; recorded in `assumptions[]`. Effective monthly rate, when Stage 2 extracted it, is `div[total, contract_months]`.
- co2 label "Seat subtotal ({seat_count} seats × …)" reads the lead's count while billing the floor; the `minimum_commitment_note` paragraph explains it.
- Rush delivery has no row in the sample table → boolean input feeding the add-on subtotal; if a later Stage 2 run has a rush row the compiler binds it.
- Bands are `volume` mode only (`ponytail:` graduated/marginal not implemented; add a `mode` column and a per-band loop when a company needs it).
- Rounding is half-up on cents (`ponytail:` no half-even); all benchmark arithmetic is exact so no ambiguity in tests.
- `PUT /variables` alone doesn't clear rules server-side; the UI hides the deck and `/template/generate` clears — acceptable for the prototype.

## 7. Verification

1. `cd P/backend && npm test` — all existing suites + `pricing-calculator.test.ts` (three benchmarks to the cent, §4 edge cases, validator, formatLike, sample check, payload⟷tag parity) + `pricing.routes.test.ts` green, offline.
2. `npm run typecheck` in `P/backend` and `P/frontend`.
3. Live run (needs `DEEPSEEK_API_KEY` or `GEMINI_API_KEY`): `npm run dev` both sides; for each company at Stage 3 press **Set up pricing** → deck appears with tables, ledger, and "N of M match"; expect all-green on at least co1 and co2 on the first or repaired attempt; inspect `logs/<id>/*-rules-raw.json`. Edit a price on a card → ledger recalculates within ~300 ms, sample check turns amber on the affected rows. Break the JSON in the DevDock → error listed, nothing persisted. Regenerate template → deck disappears; unlock → `GET /rules` 404.
4. `POST /api/companies/co2_msp/rules/calculate` with `{seat_count: 7, selected_tier: "Essential", client_state: "OH"}` → `billed_seat_count 10`, no volume row, setup `$750.00`; with no `client_state` → `needs_review` entry and `has_tax: false`.
5. Implementation order: A (calculator green against fixtures first — "benchmarks are the acceptance test") → B → C → then present D's doc diffs for approval and refresh `graft build`.
