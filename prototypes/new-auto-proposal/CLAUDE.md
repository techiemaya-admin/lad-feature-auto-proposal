# CLAUDE.md — Auto-Proposal Prototype (`new-auto-proposal`)

Self-contained proof of concept demonstrating zero-configuration proposal generation: real Word quotation + natural-language pricing notes in, client-ready `.docx` proposals out.

## Context Pointers

- **UI/UX Design Specification:** [docs/design.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/design.md) — read when implementing front-end layouts, component structure, tonal styling, or ambient drawers.
- **Architecture & Pipeline Blueprint:** [docs/plan.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/plan.md) — read when modifying the 5-stage pipeline, document mutation flow, variable taxonomy, or execution sequence.
- **Feature Specification:** [.scratch/new-auto-proposal/spec.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/spec.md) — read when implementing user stories, API contracts, or testing seams.
- **Implementation Tickets & Issues:** [.scratch/new-auto-proposal/issues/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/) — read when claiming, updating, or tracking frontier task tickets.
- **Pricing Verification Guide:** [Mock Data/verification_guide.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/verification_guide.md) — read when verifying pricing formulas and benchmark calculation numbers.
- **Mock Dataset:** [Mock Data/companies_dataset.json](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/companies_dataset.json) — read when seeding company profiles, initial state, or ground-truth rule definitions.
- **Dev Seeds:** [Mock Data/test_seeds.json](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/test_seeds.json) — dev-only `pricing_spec` (Stage 1 prompt prefill) and `sample_lead_text` (Stage 5 textarea prefill) per company; never imported by the main backend.

---

## Architectural Guardrails

### 1. Deterministic Math Execution
- Use pure JavaScript calculation logic for all monetary totals, discounts, and taxes.
- Never use LLM arithmetic; restrict Gemini to parameter extraction, natural rule compilation, and sales narrative drafting.
- Verify calculations against [Mock Data/verification_guide.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/verification_guide.md).

### 2. AST-Safe Word Processing Pipeline
- Extract Markdown using `@firecrawl/anydoc` (local Rust-based parser) for LLM analysis.
- Gemini's extraction contract is **text-only**: verbatim `sample_text`, `category`, `condition_flag`, rare `context_text`, and loop tables by `header_texts` + `row_labels`. Never ask the model for table indexes, row identifiers, or mutation actions — the engine (`template-mutator.service.ts`) finds every occurrence and derives the mutation from the variable (see `docs/plan.md` §4.2–4.3).
- Anything the engine depends on must be a `required` field in the Gemini response schema; optional fields get skipped regardless of prompt wording.
- Mutate Word templates using `docxmlater` to preserve styling, typography, and page layout. Apply variables longest `sample_text` first so overlapping values never clobber each other.
- Loop tables: locate by header text, collapse the `row_labels` rows into a single `{#loop}...{/loop}` row, and leave header / base-fee / subtotal / total rows untouched.
- Tier comparison matrix: located by the selector's `enum_options` in a header row, tagged positionally (`{tierN_name}`, `{tierN_rM}`), never re-styled; hydration rotates the selected tier into the highlighted column via `buildTierMatrixPayload`. A `condition_flag` on a `paragraph` variable wraps the paragraph itself.
- Paragraph variables: a sample that is only a sub-span of its paragraph replaces that span (the numbers in the sentence around it keep their own tags); `paragraph_config.mode: "fixed"` keeps the text in place and lets values inside it tag inline. Numbers and counts inside prose are always their own variables — the drafter never does arithmetic.
- Every mutation must produce a `details[]` entry (`applied`, `info`); after all mutations the engine verifies each tag survived. A value that only lives inside a drafted paragraph or loop is reported `covered` (the drafter receives it as input, no separate tag), a tag that vanished is flipped to a miss. Never silently drop a variable. Context-text skips are not misses.
- Keep the golden test (`tests/template-mutator.test.ts` + `tests/fixtures/*.variables.json` ideal responses + `*.raw.json` real model logs) green: it pins the engine against `Mock Data/templated_markdown/*.md` and against real model quirks. `npm test` is offline; the live Gemini contract check is `npm run test:live`.
- Extraction model: the provider/model default and any change made in the header model picker live in the `app_settings` table (`ai-settings.service.ts`), never in memory, and are stamped into every `logs/<company>/*-variables-raw.json` as `ai`. Default is `deepseek-flash`; `gemini-flash-lite` drops money amounts and must not be the accident.
- Verify modified `.docx` files by converting to Markdown via `@firecrawl/anydoc` rather than inspecting raw binary XML.
- Hydrate final proposals using `easy-template-x`; convert to PDF with headless LibreOffice (`soffice --headless --convert-to pdf`, binary from `SOFFICE_PATH`, warm profile in the temp dir). A PDF failure never fails the run (`pdf: null` + `pdf_error`, the `.docx` still returns). Stage 5 previews the PDF in an `<iframe>`; `docx-preview` is Stage 3 only.
- Stage 5 never lets the model touch a number: the lead extractor only reads (`null` = not said, `assumptions[]` for interpretations of the lead's own words), `evaluate` + `buildProposalPayload` produce every value, dates are computed (`data_type: "date"`, earliest sample date → today, offsets and suffixes kept), seller-owned values (validity days, payment terms) are compiled as constants, and a silent lead input follows its Stage 4 setting — Ask (`required`), Assume (`default`, filled by `fillDefaults` in code on both extract and generate, reported in `assumed[]`, shown `(Assumed)`; never on a `us_state` or an input a tax lookup reads) or Blank — with an optional `assume_when` hint telling the extractor how to read the lead's words. The narrative drafter writes `{tag}` placeholders that code substitutes from the payload (unknown tags stripped and reported). A missing required fact stops at the read-only facts panel, drafts a clarification email (which also states what was assumed and invites a correction) and opens a reply loop: the customer's reply (typed, or drafted by `POST /lead/reply` playing the lead) joins the thread (`From: the lead` / `From: <company>` transcript sent as `lead_text`), which is re-read whole — the lead's latest word wins, no hand edits — until nothing is missing, then it generates; a matching review rule declines with no document.

### 3. Unidirectional State Discipline (Hard Reset Policy)
- The workflow progresses strictly forward across the 5 stages: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Check & Generate Proposal.
- Once submitted, earlier stages transition into a read-only locked summary.
- Editing an earlier stage safely rewinds downstream progress behind an explicit confirmation dialog, clearing downstream database records and generated files (`template.docx`, `proposal.docx` / `proposal.pdf`) to prevent state desync.
- User input text in the prompt box and uploaded files are preserved during rewinds.

### 4. Ambient Decoupling & Two-Tier Exposure
- Primary linear canvas focuses exclusively on the 5-stage proposal pipeline.
- Per-company drafter preferences (style notes, reference proposal, clarification-email notes) and the mock inbox link reside in an ambient slide-over drawer (`ConfigurationSheet.tsx`, opened from the company strip), backed by the `company_configurations` table.
- Technical inspection data (AnyDoc Markdown, raw Variables JSON, Rule Schema JSON, AST mutation logs) resides in a docked, collapsible bottom HUD (`DevDock.tsx`).

### 5. Per-Company Session Isolation
- Store working files on disk under `backend/storage/<company_id>/`. Stage 5 runs are not persisted: `proposal.docx` / `proposal.pdf` are overwritten on every generate, there is no proposals table, and a refresh clears the on-screen result.
- Persist variable tables, rule schemas, and configurations in SQLite so switching company tabs maintains progress; app-wide settings (AI provider/model) live in `app_settings`.
- Provide an explicit "Reset to Mock Default" action to re-seed from `companies_dataset.json` + `Mock Data/test_seeds.json`.

### 6. **Context-Rich Commits:**
- Format: `<type>(<scope>): <imperative summary>` followed by a blank line.
- Body must explain **WHY** (problem, failure mode, or motivation) before **HOW** (approach, trade-offs, and fallbacks).
- Reference related issues, plans, or ADRs (`REFS:`) if any.

---

## Documentation & Maintenance Policy

Keep documentation continuously aligned with codebase realities:
- **Synchronous Doc Updates:** When code changes alter architecture, API endpoints, pipeline stages, or component responsibilities, immediately update the corresponding documentation (`docs/design.md`, `docs/plan.md`, `.scratch/new-auto-proposal/spec.md`).
- **Zero Ephemeral State:** Never store transient task lists, sprint checklists, phase status, or volatile data in `AGENTS.md` or `CLAUDE.md`. Track active work and tickets in [.scratch/new-auto-proposal/issues/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/).
