# 08: Seller-Owned Assumption Policy for Lead Inputs

**What to build:** Today the extractor decides on its own whether a fact the lead never stated is guessed or asked, and decides differently run to run (`logs/co1_seo/2026-09-21_02-4*`: `contract_months_input` came back `12` on read 1 and `null` on read 2 of the same text → two clarification emails where one would do; validity — a seller decision — was asked of the lead). Move that decision to the seller: every customer input in the Stage 4 rules carries *what happens when the lead is silent* — **Ask** (today's `required: true`), **Assume** a `default` (new), or **Blank** (today's `required: false`) — plus an optional one-line `assume_when` hint telling the extractor how to read the lead's words for that field. Seller-owned values (validity days, payment terms) stop being inputs: the compiler emits them as constants. The model only reads; code fills gaps and tags them `assumed`; one email asks for everything still missing and lists what was assumed.

**Blocked by:** 05 (completed), 06 (completed)

**Status:** completed (2026-09-21)

**Decisions (2026-09-21, do not re-open):**
- Settings live on the Stage 4 rule input only (`default`, `assume_when`); Stage 2 untouched; Stage 5 facts panel stays read-only (no per-lead override).
- Seller-set = `kind: "constant"` from the compiler, not a flag. Deletes `isDurationVariable`.
- Compiler may propose all three (never a default for `us_state` or any input a tax lookup reads). Every Assume shows a permanent amber chip in Stage 4 + header count — that *is* the review; no "reviewed" state.
- One hint box. A hint works under Ask too (seller-authorised interpretation, reported in `assumptions[]`). ~~Unhinted integer inputs get a code backstop (number must appear in the lead's text).~~ Dropped after review: it fought extractor rule 6 (summed device counts) and invited edge cases; the model is trusted to read, `assumptions[]` shows its interpretations.
- Assumed facts reach the lead only inside a clarification email that is being sent anyway (one "we're assuming …" line), and in the proposal prose via wording ("based on a 12-month term"). No document section, no confirm-only email.
- "Affects: …" line in the tray only when a lookup's `where.value_var` is this input.
- Not changing model temperature. No migration: reset + recompile the mock companies.

## Ground truth (anchors)
- Rule input type: `backend/src/services/pricing-rules.types.ts:84-92`. Wire schema (all fields required, `""`/`[]` for unused): `pricing-compiler.service.ts:149-190`; `sample_inputs` already uses the `value` / `values` pair for scalar vs multi_choice — mirror it as `default` / `default_values`.
- Compiler prompt rules 5, 9, 12, 13: `pricing-compiler.service.ts:~100-140`.
- `validate` input branch + `coerceInput` + `inputOptions`: `pricing-calculator.ts:575-878`, `:180-204`, `:168-177`.
- Lead fields / extractor prompt / raw→inputs loop: `lead-extractor.service.ts:24-38`, `:82-106`, `:126-151`. `missingFields` `:43`.
- `isDurationVariable` (delete) and its branch: `proposal-generator.service.ts:48-49`, `:169-173`; use in `leadFields` `:34`.
- Clarify prompt "WHAT WE ALREADY KNOW": `clarification-drafter.service.ts:37-39`, rules `:60-65`. Narrative facts list: `narrative-drafter.service.ts:93-95`.
- Routes: `routes/proposal.ts:52-63` (extract), `:66-80` (clarify), `:97-110` (generate re-checks `missingFields`).
- Tray "Required" dropdown: `frontend/src/components/pricing/LedgerTray.tsx:260`. Chip row: `PricingEngineDeck.tsx:235`. `readable.ts:55`. Facts panel: `LeadSimulator.tsx:421-442`; extract/clarify wiring `:87-118`; `api.ts:336`. Types: `frontend/src/types/pricing.ts`, `types/proposal.ts:17-24`.

## Steps (one commit each, `<type>(new-auto-proposal): …`, WHY before HOW)

- [x] **1 — Rules shape.** `pricing-rules.types.ts`: input gains `default?: Cell | string[]`, `assume_when?: string`. Wire schema + normaliser: `default: STR`, `default_values: STRS`, `assume_when: STR`. `validate`: a default must `coerceInput` cleanly and, for choice/multi_choice, be listed options (reuse `inputOptions`). Frontend `types/pricing.ts` mirrors. Test: one assertion — choice default not in options → error.
- [x] **2 — Compiler prompt.** Amend rule 5/13 and add one rule: *seller-owned values the lead never decides (validity days, payment terms) are `constant`, not `input`; for each input decide `required` (ask), or `default` + `assume_when` (assume when unsaid), never a default for `us_state` or an input a tax lookup reads; put the reasoning in `assumptions[]`.* Nothing else in the prompt changes.
- [x] **3 — Extractor.** `leadFields`: carry `default`/`assume_when`; `defined` = **all** rule variable names (so a Stage 2 field the rules now hold as a constant is not re-added as free text); drop `isDurationVariable`. Prompt: rule 7 reworded to interpretations only (no "inferred" values); per-field `(read it as: <assume_when>)` suffix when set. After the raw→inputs loop: `fillDefaults(fields, inputs)` → fills blanks from `default`, returns `assumed: string[]`. `LeadFacts` gains `assumed`. Test (mocked model, one case): Assume field `null` → filled + in `assumed`. (The `numberInText` backstop shipped here was dropped afterwards — see the decision above.)
- [x] **4 — Generator + routes.** Delete the `isDurationVariable` branch in `generateProposal`. `generate` route calls `fillDefaults` before `missingFields` (server-side truth) and passes `assumed` to the drafter. `clarify` route accepts `assumed` from the body.
- [x] **5 — Prompts.** Clarify: add section `WHAT WE'RE ASSUMING` (label: value) + rule *"State each assumption in one plain line and invite a correction; do not ask for it."* Narrative: the fact line reads `- <label>: <value> (assumed — write "based on", never "as you said")`. No other prompt text.
- [x] **6 — Stage 4 UI.** `LedgerTray`: the Required yes/no becomes *If the lead doesn't say it: Ask / Assume … / Leave blank* (writes `required` + `default`); default field typed by `input_type` (dropdown for choice, checklist for multi_choice, text otherwise); `assume_when` textarea; when a default is set and a lookup's `where.value_var` is this input: one muted line "affects: <lookup labels>". `readable.ts`: `assumes <value> unless the lead says otherwise`. `PricingEngineDeck`: amber chip on Assume inputs + header count "N assumptions".
- [x] **7 — Stage 5 UI.** `FactsForm` shows `(Assumed)` next to filled defaults (neutral, not the amber "not in the message"). `readThread`/`runClarify` pass `assumed`; `api.ts` + `types/proposal.ts` updated.
- [x] **8 — Verify live** (reset all three companies, recompile): co1 sample lead → 0 emails, `Validity` gone from the lead form, contract term `(Assumed)` or read via hint; co1 "dental office in Round Rock, what do you charge?" → **one** email asking locations + payment frequency and stating the assumed term; co2 with no seat count → assumed 10, reply "actually 55" → 55 wins; co3 unchanged (`$10,445.00`).
- [x] **9 — Doc drift** (show diff, wait for OK): `CLAUDE.md` §2 sentence "dates and validity windows are never asked" → "dates are computed; seller-owned values are constants; a silent lead input follows its Ask/Assume/Blank setting"; `docs/plan.md` Stage 4/5; `spec.md` §5; `docs/plans/06-lead-simulator.md` §1.1 contract (`assumed[]`).

## Live verification notes (2026-09-21, step 8)
- All three companies reset + recompiled with the new prompt. Compiler proposed defaults + hints on its own (co1 `pay_annually` false, co2 `managed_device_count` 0, co3 `product_count` / `page_count` 0, `payment_split` "50/50"); validity days / contract months / minimum commitment came out as constants and left the lead form.
- First co1 compile still put `validity_days` (a Stage 2 customer input) nowhere → asked as free text. Fixed by routing seller-owned customer inputs to `constant` in the compiler's customer-inputs line (commit `fix(new-auto-proposal): compile a seller-owned customer input as a constant`); recompile → `const validity_days = 14`, gone from the form.
- co1 sample lead → **1 email**, not 0: this compile made `selected_tier` a lead choice (rule 5 "a tier the LEAD picks") instead of the fixture's lookup-by-location, so the tier was asked; the model-lead then picked "Local" and the cap review rule declined. Compile variance outside this ticket — the seller can switch the tier to a lookup in Stage 4.
- co1 "dental office in Round Rock" → one email asking tier, locations, name; with the first compile (pay_annually Assume) the email carried "We're assuming you're not paying annually upfront; feel free to correct that".
- co2 no seat count (seller set Assume 10 via PUT /rules) → `assumed: ["seat_count"]`, 0 emails, generated; prose: "Billing is based on 10 seats". Follow-up lead part "Actually it's 55 people" re-read → 55, `assumed: []`.
- co3 unchanged: one email for the state, then `$10,445.00`.

## Non-negotiables
- The model never fills a gap. `default` is applied by code, in one function, on both extract and generate.
- No new files. No `policy` enum — Ask/Assume/Blank is derived from `required` + `default`.
- Prompts change only where listed in steps 2, 3, 5. No lines that name the incident ("annual ≠ 12 months").
- Ponytail ceiling to mark: affects-line reads direct lookup refs only, not the transitive graph.
