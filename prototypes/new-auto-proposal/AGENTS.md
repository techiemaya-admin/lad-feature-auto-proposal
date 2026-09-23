# AGENTS.md — Auto-Proposal Prototype (`new-auto-proposal`)

Self-contained proof of concept for zero-configuration proposal generation: a real Word quotation + natural-language pricing notes in, client-ready `.docx` + PDF proposals out.

**This prototype is standalone.** TypeScript + ESM + SQLite, a flat `backend/src/services/`, no multi-tenancy, no Postgres. The root guardrails describe the main backend and do not apply here — only the commit format and the documentation policy carry over.

## Context Pointers

- **UI/UX design spec:** [docs/design.md](docs/design.md) — front-end layouts, component structure, tonal styling, ambient drawers.
- **Architecture & pipeline blueprint:** [docs/plan.md](docs/plan.md) — the 5-stage pipeline, mutation flow, variable taxonomy, execution order.
- **Feature spec:** [.scratch/new-auto-proposal/spec.md](../../.scratch/new-auto-proposal/spec.md) — user stories, API contracts, testing seams.
- **Tickets:** [.scratch/new-auto-proposal/issues/](../../.scratch/new-auto-proposal/issues/) — claiming, updating, tracking work.
- **Pricing verification guide:** [Mock Data/verification_guide.md](Mock%20Data/verification_guide.md) — formulas and benchmark arithmetic.
- **Mock dataset:** [Mock Data/companies_dataset.json](Mock%20Data/companies_dataset.json) — company profiles, ground-truth rules.
- **Dev seeds:** [Mock Data/test_seeds.json](Mock%20Data/test_seeds.json) — dev-only `pricing_spec` (Stage 1 prefill) and `sample_lead_text` (Stage 5 prefill); the main backend never imports it.

---

## Architectural Guardrails

### 1. Deterministic math
- All arithmetic — totals, discounts, taxes — runs in pure JavaScript (`pricing-calculator.ts`).
- The model reads and writes prose: parameter extraction, rule compilation, narrative drafting. Every number comes from code.
- Check totals against [Mock Data/verification_guide.md](Mock%20Data/verification_guide.md).

### 2. Text-only extraction contract
- The extraction model returns verbatim text and nothing else: `sample_text`, `category`, `condition_flag`, `enum_options`, rare `context_text`, and loop tables by `header_texts` + `row_labels`. The engine (`template-mutator.service.ts`) owns every locator and derives each mutation from the variable itself.
- Every field the engine reads is `required` in the response schema — optional fields get skipped regardless of prompt wording.
- Provider and model live in the `app_settings` table (`ai-settings.service.ts`) and are stamped into each `logs/<company>/*-variables-raw.json` as `ai`. Default `deepseek-flash`; `gemini-flash-lite` drops money amounts.
- Mutation mechanics — loop collapse, tier matrix, paragraph sub-spans, ordering: [docs/plan.md](docs/plan.md) §4.2–4.3.

### 3. Lossless Word mutation
- Parse with `@firecrawl/anydoc`; verify a modified `.docx` by converting it back to Markdown, never by reading binary XML.
- `docxmlater` mutates in place so styling, typography and page layout survive. Variables apply longest `sample_text` first, so overlapping values stay intact.
- Every variable yields a `details[]` entry, and every placed tag is re-checked after mutation: `applied`, `covered` (the value lives inside a drafted paragraph or loop, so the drafter receives it as input), or a reported miss. A variable is always accounted for.
- Hydrate with `easy-template-x`; convert to PDF with headless LibreOffice (`SOFFICE_PATH`). A PDF failure still returns the `.docx` (`pdf: null` + `pdf_error`). Stage 5 previews the PDF in an `<iframe>`; `docx-preview` is Stage 3 only.

### 4. Stage 5 never lets the model touch a number
- The lead extractor only reads: `null` = not said, `assumptions[]` for its readings of the lead's own words. `evaluate` + `buildProposalPayload` produce every value.
- Dates are computed (`fillDates`), seller-owned values (validity days, payment terms) are compiled as constants, and a silent lead input follows its Stage 4 setting — Ask / Assume / Blank.
- Nothing reaches a lead on its own: a human reviews every proposal and sends it. `needs_review` flags what that human must check; the document is still built, with only the values a problem touches left blank to fill by hand. The code still declines instead — ticket 09.
- The narrative drafter writes `{tag}` placeholders; code substitutes them from the payload.
- Contracts, the Ask/Assume/Blank rules and the clarification reply loop: [docs/plans/06-lead-simulator.md](docs/plans/06-lead-simulator.md).

### 5. Forward-only state (hard reset)
- The workflow runs strictly forward: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Check & Generate Proposal.
- A submitted stage becomes a read-only locked summary.
- Editing an earlier stage rewinds downstream progress behind a confirmation dialog, clearing downstream database records and generated files (`template.docx`, `proposal.docx` / `proposal.pdf`) so state stays consistent.
- Prompt text and uploaded files survive a rewind.

### 6. Ambient decoupling
- The primary canvas holds the 5-stage pipeline alone.
- Per-company drafter preferences (style notes, reference proposal, clarification-email notes) and the mock inbox link live in the slide-over drawer (`ConfigurationSheet.tsx`), backed by `company_configurations`.
- Technical inspection data (AnyDoc Markdown, Variables JSON, Rule Schema JSON, mutation logs) lives in the collapsible bottom HUD (`DevDock.tsx`).

### 7. Per-company isolation
- Working files sit on disk under `backend/storage/<company_id>/`. Stage 5 runs are transient: `proposal.docx` / `proposal.pdf` are overwritten per generate, there is no proposals table, and a refresh clears the on-screen result.
- Variable tables, rule schemas and configurations persist in SQLite so switching company tabs keeps progress; app-wide settings (AI provider/model) live in `app_settings`.
- "Reset to Mock Default" re-seeds from `companies_dataset.json` + `Mock Data/test_seeds.json`.

### 8. Testing
- `npm test` runs offline (`tsx --test`); route tests stub the model call. The live extraction contract is `npm run test:live`.
- Keep the golden test green: `tests/template-mutator.test.ts` pins the engine against `Mock Data/templated_markdown/*.md`, using `tests/fixtures/*.variables.json` (ideal responses) and `*.raw.json` (real model logs, which catch model quirks the ideal fixtures miss).
- Tests assert observable behaviour and calculation accuracy — the three benchmark totals to the cent — rather than private helpers.
- `tests/fixtures/*.raw.json` are captured model logs, not inputs to tune. A failing raw fixture means the engine must handle it; fix the engine, never the fixture.
- Assert that a fact reached a prompt (a value, an option list, the lead's own words). Leave the prompt's wording to the eval — `npm run test:live`, run by a human before a demo and after any prompt change.
- One check per behaviour, not per company or per function. A new test earns its place by failing for a reason no existing test covers; name that reason in its title. Extending a test beats adding a file.
- Every assertion runs on every pass. A check inside `if (…)` reports green when it silently skips, so seed the state it needs or drop it and say in a comment what is left to the eye.

### 9. Context-rich commits
- Format: `<type>(<scope>): <imperative summary>`, then a blank line.
- The body explains WHY (problem, failure mode, motivation) before HOW (approach, trade-offs, fallbacks).
- Reference related issues, plans or ADRs with `REFS:` when they exist.

---

## Documentation Policy

- **Flag drift, then wait.** When a change alters architecture, API endpoints, pipeline stages or component responsibilities, name the affected docs (`docs/design.md`, `docs/plan.md`, `.scratch/new-auto-proposal/spec.md`), show the diff, and apply it once the user approves.
- **Keep these files timeless.** Active work, tickets, checklists and phase status live in [.scratch/new-auto-proposal/issues/](../../.scratch/new-auto-proposal/issues/).
