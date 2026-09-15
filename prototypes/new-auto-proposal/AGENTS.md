# AGENTS.md — Auto-Proposal Prototype (`new-auto-proposal`)

Self-contained proof of concept demonstrating zero-configuration proposal generation: real Word quotation + natural-language pricing notes in, client-ready `.docx` proposals out.

## Context Pointers

- **UI/UX Design Specification:** [docs/design.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/design.md) — read when implementing front-end layouts, component structure, tonal styling, or ambient drawers.
- **Architecture & Pipeline Blueprint:** [docs/plan.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/plan.md) — read when modifying the 5-stage pipeline, document mutation flow, variable taxonomy, or execution sequence.
- **Feature Specification:** [.scratch/new-auto-proposal/spec.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/spec.md) — read when implementing user stories, API contracts, or testing seams.
- **Implementation Tickets & Issues:** [.scratch/new-auto-proposal/issues/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/) — read when claiming, updating, or tracking frontier task tickets.
- **Pricing Verification Guide:** [Mock Data/verification_guide.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/verification_guide.md) — read when verifying pricing formulas and benchmark calculation numbers.
- **Mock Dataset:** [Mock Data/companies_dataset.json](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/companies_dataset.json) — read when seeding company profiles, initial state, or ground-truth rule definitions.

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
- Every mutation must produce a `details[]` entry (`applied`, `info`) so misses and context-skipped occurrences are visible in the Template Checkpoint; never silently drop a variable.
- Keep the golden test (`tests/template-mutator.test.ts` + `tests/fixtures/*.variables.json`) green: it pins the engine against `Mock Data/templated_markdown/*.md`. `npm test` is offline; the live Gemini contract check is `npm run test:live`.
- Verify modified `.docx` files by converting to Markdown via `@firecrawl/anydoc` rather than inspecting raw binary XML.
- Hydrate final proposals using `easy-template-x`.

### 3. Unidirectional State Discipline (Hard Reset Policy)
- The workflow progresses strictly forward across the 5 stages: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Lead Simulation.
- Once submitted, earlier stages transition into a read-only locked summary.
- Editing an earlier stage safely rewinds downstream progress behind an explicit confirmation dialog, clearing downstream database records to prevent state desync.
- User input text in the prompt box and uploaded files are preserved during rewinds.

### 4. Ambient Decoupling & Two-Tier Exposure
- Primary linear canvas focuses exclusively on the 5-stage proposal pipeline.
- Peripheral configurations (AI tone/style, customer clarification triggers, email toggles) reside in an ambient slide-over drawer (`ConfigurationSheet.tsx`).
- Technical inspection data (AnyDoc Markdown, raw Variables JSON, Rule Schema JSON, AST mutation logs) resides in a docked, collapsible bottom HUD (`DevDock.tsx`).

### 5. Per-Company Session Isolation
- Store working files on disk under `backend/storage/<company_id>/`.
- Persist variable tables, rule schemas, and configurations in SQLite so switching company tabs maintains progress.
- Provide an explicit "Reset to Mock Default" action to re-seed from `companies_dataset.json`.

### 6. **Context-Rich Commits:**
- Format: `<type>(<scope>): <imperative summary>` followed by a blank line.
- Body must explain **WHY** (problem, failure mode, or motivation) before **HOW** (approach, trade-offs, and fallbacks).
- Reference related issues, plans, or ADRs (`REFS:`) if any.

---

## Documentation & Maintenance Policy

Keep documentation continuously aligned with codebase realities:
- **Synchronous Doc Updates:** When code changes alter architecture, API endpoints, pipeline stages, or component responsibilities, immediately update the corresponding documentation (`docs/design.md`, `docs/plan.md`, `.scratch/new-auto-proposal/spec.md`).
- **Zero Ephemeral State:** Never store transient task lists, sprint checklists, phase status, or volatile data in `AGENTS.md` or `CLAUDE.md`. Track active work and tickets in [.scratch/new-auto-proposal/issues/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/).
