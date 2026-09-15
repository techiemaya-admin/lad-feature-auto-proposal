# 05: Pricing Compiler, Visual Rule Cards, and Deterministic Math

**What to build:** Stage 4. The AI compiles the company's natural-language `pricing_spec`, the sample quotation, and the confirmed Stage 2 variables into `PricingRules` — a spreadsheet whose cells are the Stage 2 variable names (no internal key vocabulary, no bindings map). Each pricing variable gets one definition (`input` / `constant` / `lookup` / one-op `formula` / `condition` / `aggregate` / `rows`) in terms of other variables; pricing-only helpers live inside the rules JSON with `in_document: false`. A pure JavaScript calculator (`backend/src/services/pricing-calculator.ts`) evaluates the rules with zero LLM arithmetic and is verified to the cent against `Mock Data/verification_guide.md`. The deck (`PricingEngineDeck.tsx`) shows editable table cards (packages, bands, add-ons, taxes, splits — one per compiled table), the lead inputs, a per-variable calculation ledger with a live ✓/✗ check against the sample quotation's own values, assumptions, and review rules; the Dev Dock tab edits the raw JSON. Rerunning any earlier stage resets Stage 4.

**Design & plan:** `prototypes/new-auto-proposal/docs/plans/05-pricing-engine.md` (schema, engine semantics, fixtures sketch, file-by-file steps). Spec: `.scratch/new-auto-proposal/spec.md` §4.

**Blocked by:** 04: docXMLater Word Template Mutation and Minimal Checkpoint Preview (completed)

**Status:** completed

**Decisions (2026-09-16):** spreadsheet-over-Stage-2-names model; one flat operation per variable (nest via helpers); generic table grids with a `kind` hint; persisted in `working_state_json.pricing_rules` (no new table); per-variable sample check on the deck; compile auto-retries once on structural errors or sample mismatches.

## A — Calculator (green before any UI)
- [x] `backend/src/services/pricing-rules.types.ts`: `PricingRules`, `RuleVariable` kinds, `Evaluation`, `ValidationError`, `SampleCheckEntry`, `Stage2Context`, `PricingRulesState`, wire shape `AiPricingRules` + `fromWire` / `toWire`.
- [x] `backend/src/services/pricing-calculator.ts` (pure): `evaluate` (topological order; money rounded to cents per variable; percent as fraction; normalised text compare; `null` = unbounded; optional `condition_flag` skip guard; splits remainder to last row; `needs_review` for missing required input / lookup miss / div-by-zero / `review_rules`), `validate` (domain-level `{path, message}` errors incl. cycles, unknown names/tables/columns, Stage 2 pricing variables without definitions, Stage 2 flags without a `condition`, loop `map` keys ≠ `columns`), `formatLike` / `parseSampleNumber`, `sampleCheck`, `buildProposalPayload` (uses existing `buildTierMatrixPayload`).
- [x] Fixtures `backend/src/tests/fixtures/{co1_seo,co2_msp,co3_dev}.rules.json` aligned to `*.variables.json` names (sketches in the plan).
- [x] `backend/src/tests/pricing-calculator.test.ts`: benchmarks — Northstar 2 locations, TX, annual = **$35,073.00**; Fortress 42 seats, Standard, 5 devices, OH = **$2,734.80/mo + $3,150.00 setup**; Fieldstone E-commerce + Copywriting + SEO = **$10,445.00** ($5,222.50 / $5,222.50); every `verification_guide.md` §4.1–4.3 boundary; validator cases; `formatLike` cases; all-green sample check per fixture; payload keys ⟷ tags rendered by `applyTemplate`.

## B — Compile, routes, persistence
- [x] Extract `generateJsonWithGemini` / `generateJsonWithDeepSeek` / `generateJson` from the extraction services (existing extract functions become wrappers).
- [x] `backend/src/services/pricing-compiler.service.ts`: `loadStage2Context` (reads `descriptor.columns` for loops), `buildCompileInput` (spec, quotation markdown, home state, covered values, tier matrix), `buildCompilePrompt` (+ retry section with previous attempt and errors), Gemini `responseSchema` + DeepSeek JSON-shape suffix for the flat wire shape, `compilePricingRules` (validate → evaluate `sample_inputs` → sample check → one retry → keep the better attempt), `setRulesModelCall` test seam, logs `rules-raw.json` / `rules-repair.json` with `ai` stamp.
- [x] `backend/src/routes/rules.ts`: `POST /:id/rules/compile`, `GET /:id/rules`, `PUT /:id/rules` (400 `errors[]`, nothing persisted), `POST /:id/rules/calculate`, `POST /:id/rules/proceed` (`stage: "lead_simulation"`); mount before `companiesRouter` in `app.ts`.
- [x] `routes/template.ts` generate and `routes/briefing.ts` unlock clear `pricing_rules`; compile sets `stage: "pricing_engine"`.
- [x] `backend/src/tests/pricing.routes.test.ts` (supertest, model call stubbed): 404 before compile → compile → PUT invalid 400 → PUT edit → calculate `{location_count: 3, client_state: "CA"}` → template regenerate clears → unlock clears; cyclic-first-attempt repaired by the second.

## C — Frontend
- [x] `frontend/src/types/pricing.ts`; `CompanyWorkingState.pricing_rules`; `services/api.ts` wrappers (`compilePricingRules`, `fetchPricingRules`, `updatePricingRules`, `calculatePricing`, `proceedToLeadSimulation`).
- [x] `components/pricing/PricingEngineDeck.tsx` (+ `RuleTableCard`, `LedgerTray`, `readable.ts`): assumptions strip; one editable grid card per table (icon by `kind`, add/remove row, `font-mono tabular-nums` on money/percent/integer cells, `hover:-translate-y-0.5 transition-transform duration-100`); "What we ask the lead"; calculation ledger (readable definition · computed sample · quote sample · ✓/✗; tap → tray to change kind/operator/operands/conditions; `[+ Add variable]` helper chips marked "not in document"); review rules; footer "N of M match" + ghost `Regenerate` + primary `Proceed to Lead Simulation` (`bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`, disabled while validation errors exist). Shimmer while compiling; explicit error panel with retry.
- [x] Edits → 300 ms debounced `PUT /rules`; response refreshes sample check and evaluation; 400 errors shown inline without losing edits.
- [x] `App.tsx`: `handleProceedToPricing` → compile; `handleGenerateTemplate` / `handleVariablesEdited` null the rules; `CompanyProfileCard.tsx` renders the deck after Stage 3; `DevDock.tsx` rules tab → editable JSON with validation + Apply, stage labels for `pricing_engine` / `lead_simulation`.

## D — Docs (flag diffs, apply only with confirmation)
- [x] `docs/plan.md` §5, `docs/design.md` §3.4 / §4.2 / stage list, this issue's linked plan; note `Mock Data/templated_markdown/*.md` is drifted from the engine's tags.
- [x] `graft build` after the code lands.

## Comments

**2026-09-16 — landed on `new-auto-proposal-demo`:** `8125269` calculator + schema + fixtures + benchmarks (A), `09157df` generateJson refactor + compiler + `/rules` routes + route tests (B), `a75c426` deck / tray / Dev Dock / App wiring (C), `e425613` Windows temp-dir flake, `e298177` review fixes (in-flight edit no longer dropped by the debounced PUT; `/calculate` no longer returns a sample check; `tierMatrix` dropped from the compile input; shared request helper + `RulesValidationError`; shared commit-on-blur input). Backend `npm test` 59/59 offline; frontend typecheck + build clean.

Deliberate deviations from the plan: constants stay in the calculation ledger (nothing else would let an owner edit `contract_months` or `annual_discount_percentage`); `compilePricingRules(companyId, company, stage2)` takes the loaded row and context so the route can 400 before any model call. `Mock Data/templated_markdown/*.md` remains drifted from the engine's tags (`tier_left_*`, `{#has_copywriting}`) — flagged for a refresh, not needed by any test.

**2026-09-16 — live co1 compile (deepseek-flash, ×2):** 200 in ~73 s, 0 validation errors, 13/13 sample values match on the deck. First attempt each time had one structural error (`key_column: ""` on the `rows: "all"` tax aggregate) that the repair pass fixed — `11b01e7` relaxes the validator so the first attempt is green. Notable model choices (all editable on the deck, worth knowing for issue 06): `selected_tier` came back as a lead `choice` rather than a lookup by location count; inputs were `selected_tier`, `contract_months`, `payment_frequency` (Monthly / Annual Prepay lookup with 0% / 10%), `us_state`; a review rule fires on every taxed quote ("confirm the exact Texas rate"). Logs: `logs/co1_seo/2026-09-16_02-08-*` and `02-10-*`.

