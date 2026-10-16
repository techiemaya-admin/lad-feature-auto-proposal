# AGENTS.md — Auto-Proposal

Zero-configuration proposal generation: an uploaded or AI-generated sample Word quotation + natural-language pricing notes in, client-ready `.docx` + PDF proposals out.

Stack: TypeScript + ESM, Express backend with SQLite (`backend/src/`), Vite + shadcn frontend (`frontend/src/`). Multi-company (company tabs), template-scoped workflows (`proposal_templates`), no auth layer — resource-ownership checks only.

## Context Pointers

- **Generated sample proposals:** [docs/generated-sample-proposals.md](docs/generated-sample-proposals.md) — automatic sample pricing, custom sections, frontend-only accuracy notes, Word compatibility.
- **Architecture & pipeline blueprint:** [docs/plan.md](docs/plan.md) — the 5-stage pipeline, mutation flow, variable taxonomy, execution order.
- **UI/UX design spec:** [docs/design.md](docs/design.md) — layouts, component structure, theme tokens.
- **Template library & email routing:** [docs/template-library.md](docs/template-library.md) — ICP import, custom templates, capacity, saved-email routing.
- **Pricing engine plan:** [docs/plans/05-pricing-engine.md](docs/plans/05-pricing-engine.md) — rule schema, compiler, deterministic math.
- **Lead simulator plan:** [docs/plans/06-lead-simulator.md](docs/plans/06-lead-simulator.md) — extraction, clarification loop, generation.
- **Date type plan:** [docs/plans/07-date-type.md](docs/plans/07-date-type.md) — dates as sheet values (`today`, `add_days`/`add_months`).
- **Review-rules plan:** [docs/plans/08-editable-review-rules.md](docs/plans/08-editable-review-rules.md) — editable "held for review" rules (backend round-trips the full object today; Stage 4 UI is read-only, upgrade pending).
- **Pricing verification guide:** [Mock Data/verification_guide.md](Mock%20Data/verification_guide.md) — formulas and benchmark arithmetic.
- **Mock dataset:** [Mock Data/companies_dataset.json](Mock%20Data/companies_dataset.json) — company profiles only (no pricing).
- **Dev seeds:** [Mock Data/test_seeds.json](Mock%20Data/test_seeds.json) — dev-only `pricing_spec` and `sample_lead_text`.

---

## Architectural Guardrails

### 1. Deterministic math
- Sample generation may use explicitly identified estimates for missing seller inputs; code calculates complete prices and records estimate notes in the frontend. Estimates do not change the authoritative pricing brief or Stage 5 missing-data rules.
- All arithmetic — totals, discounts, taxes — runs in pure JavaScript (`backend/src/services/pricing-calculator.ts`).
- The model reads and writes prose: parameter extraction, rule compilation, narrative drafting. Every number comes from code.
- Check totals against [Mock Data/verification_guide.md](Mock%20Data/verification_guide.md): co1 `$35,073.00`, co2 `$2,734.80/mo + $3,150.00` setup, co3 `$10,445.00`. Pinned by `backend/src/tests/pricing-calculator.test.ts`.

### 2. Text-only extraction contract
- The extraction model returns verbatim text and nothing else: `sample_text`, `category`, `condition_flag`, `enum_options`, rare `context_text`, and loop tables by `header_texts` + `row_labels`. The engine (`backend/src/services/template-mutator.service.ts`) owns every locator and derives each mutation from the variable itself.
- One exception: for a `date`, the model also returns `date_format`, a date-fns pattern it derives rather than copies. Code trusts it only when the sample reads with it and prints back exactly; otherwise `MMMM d, yyyy` is used. Stage 2 date-format editing UI is pending — see [docs/plans/07-date-type.md](docs/plans/07-date-type.md).
- Every field the engine reads is `required` in the response schema — optional fields get skipped regardless of prompt wording.
- Provider and model live in the `app_settings` table (`backend/src/services/ai-settings.service.ts`) and are stamped into each `backend/logs/<company>/<template>/*-variables-raw.json` as `ai`. Default `deepseek-flash`.
- Mutation mechanics — loop collapse, tier matrix, paragraph sub-spans, ordering: [docs/plan.md](docs/plan.md).

### 3. Lossless Word mutation
- Serialize generated samples and mutated templates through `wordDocumentBuffer` (`backend/src/services/word-document-buffer.ts`) so ZIP headers remain compatible with LibreOffice. Keep sample review notes in `working_state_json.sample_review_notes`, outside document content.
- Parse with `@firecrawl/anydoc`; verify a modified `.docx` by converting it back to Markdown, never by reading binary XML.
- `docxmlater` mutates in place so styling, typography and page layout survive. Variables apply longest `sample_text` first, so overlapping values stay intact.
- Every variable yields a `details[]` entry, and every placed tag is re-checked after mutation: `applied`, `covered` (the value lives inside a drafted paragraph or loop, so the drafter receives it as input), or a reported miss. A variable is always accounted for.
- Hydrate with `easy-template-x`; convert to PDF with headless LibreOffice (`SOFFICE_PATH`). A PDF failure still returns the `.docx` (`pdf: null` + `pdf_error`). Stage 5 previews the PDF in an `<iframe>`; `docx-preview` is Stage 3 only.

### 4. Stage 5 never lets the model touch a number
- The lead extractor only reads: `null` = not said, `assumptions[]` for its readings of the lead's own words. `evaluate` + `buildProposalPayload` produce every value.
- Dates are sheet values: the compiler builds each from the reserved `today` with `add_days` / `add_months`, and code does the maths. Seller-owned values (validity days, payment terms) are compiled as constants, and a silent lead input follows its Stage 4 setting — Ask / Assume / Blank.
- Nothing reaches a lead on its own: a human reviews every proposal and sends it. `needs_review` flags what that human must check; the document is still built, with only the values a problem touches left blank to fill by hand: a broken value (and everything computed from it) prints `[to confirm]`; a review rule blanks nothing. Empty `needs_review` = ready; otherwise a Draft box lists the reasons.
- The narrative drafter writes `{tag}` placeholders; code substitutes them from the payload.
- Contracts, the Ask/Assume/Blank rules and the clarification reply loop: [docs/plans/06-lead-simulator.md](docs/plans/06-lead-simulator.md).

### 5. Forward-only state (hard reset)
- The workflow runs strictly forward: Briefing ➔ Variable Ledger ➔ Template Checkpoint ➔ Pricing Engine ➔ Lead & Proposal.
- A submitted stage becomes a read-only locked summary.
- Editing an earlier stage rewinds downstream progress behind a confirmation dialog, clearing downstream database records and generated files (`template.docx`, `proposal.docx` / `proposal.pdf`) so state stays consistent.
- Prompt text and uploaded files survive a rewind.

### 6. Ambient decoupling
- The primary canvas holds the 5-stage pipeline alone (`StageStepper` + `Stage1Briefing` … `Stage5LeadSimulator` in `frontend/src/components/stages/`).
- Per-company drafter preferences (style notes, reference proposal, clarification-email notes) live in the settings drawer (`ConfigurationSheet.tsx` / `BusinessProfileView` / `VoiceInboxView`), backed by `company_configurations`. The mock inbox link lives in the template library view (`TemplateLibraryView.tsx`) so it is controlled from one place across templates.
- Technical inspection data (AnyDoc Markdown, Variables JSON, Rule Schema JSON, mutation logs) lives in the collapsible bottom HUD (`DevDock.tsx`).
- Small known debt: `App.tsx` (company switch, template switch) and `CompanyProfileCard.tsx` still use native `window.confirm` in 3 places instead of the shared `ConfirmDialog`. New code must use `ConfirmDialog`; these call sites are pending migration.

### 7. Per-company isolation
- Working files sit on disk under `backend/storage/<company_id>/<template_id>/`. Logs sit under `backend/logs/<company_id>/<template_id>/`. Stage 5 runs are transient: `proposal.docx` / `proposal.pdf` are overwritten per generate, there is no proposals table, and a refresh clears the on-screen result.
- Variable tables, rule schemas and configurations persist in SQLite so switching company tabs keeps progress; app-wide settings (AI provider/model) live in `app_settings`.
- The template library persists one editable lead email per company in `mock_email_routes`; assignments must reference a template owned by that company. Email edits clear its assignment; version checks reject stale AI results. Stage 5 prefill uses the selected template's assigned email before the dev sample. Connect inbox remains a mock flag, not mailbox access.
- "Reset to Mock Default" re-seeds from `companies_dataset.json` + `Mock Data/test_seeds.json`.

### 8. Testing
- `npm test` (in `backend/`) runs offline (`tsx --test`); route tests stub the model call. The live contracts (variable extraction, rules compile, lead + narrative) are `npm run test:live` (needs API key, never in CI).
- Keep the golden test green: `backend/src/tests/template-mutator.test.ts` pins the engine against `Mock Data/templated_markdown/*.md`, using `tests/fixtures/*.variables.json` (ideal responses) and `*.raw.json` (real model logs, which catch model quirks the ideal fixtures miss). Full suite is 98 tests green (verified Oct 2026 after fixing `Mock Data` paths to repo root).
- Tests assert observable behaviour and calculation accuracy — the three benchmark totals to the cent — rather than private helpers.
- `tests/fixtures/*.raw.json` are captured model logs, not inputs to tune. A failing raw fixture means the engine must handle it; fix the engine, never the fixture.
- Assert that a fact reached a prompt (a value, an option list, the lead's own words). Leave the prompt's wording to the eval — `npm run test:live`, run by a human before a demo and after any prompt change.
- One check per behaviour, not per company or per function. A new test earns its place by failing for a reason no existing test covers; name that reason in its title. Extending a test beats adding a file.
- Every assertion runs on every pass. A check inside `if (…)` reports green when it silently skips, so seed the state it needs or drop it and say in a comment what is left to the eye.

### 9. Context-rich commits
- Format: `<type>(<scope>): <imperative summary>`, then a blank line.
- The body explains WHY (problem, failure mode, motivation) before HOW (approach, trade-offs, fallbacks).

---

## Documentation Policy

- **Flag drift, then wait.** When a change alters architecture, API endpoints, pipeline stages or component responsibilities, name the affected docs (`docs/design.md`, `docs/plan.md`, `docs/template-library.md`, `docs/plans/*`), show the diff, and apply it once the user approves.
- **Keep these files timeless.** No phase status, tickets, checklists, or merge records in `docs/` — describe the code as it is, including its current limitations.
