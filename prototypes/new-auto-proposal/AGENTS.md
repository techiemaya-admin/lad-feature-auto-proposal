# AGENTS.md — Auto-Proposal Prototype (`new-auto-proposal`)

Self-contained proof of concept demonstrating zero-configuration proposal generation: real Word quotation + natural-language pricing notes in, client-ready `.docx` proposals out.

## Context Pointers

- **Architecture & Pipeline Blueprint:** [docs/plan.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/plan.md) — read when modifying document mutation flows, variable classes, or testing matrix.
- **Feature Specification:** [.scratch/new-auto-proposal/spec.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/spec.md) — read when implementing user stories, API contracts, or testing seams.
- **Implementation Tickets:** [.scratch/new-auto-proposal/issues/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/) — read when claiming or working the frontier tickets.
- **Pricing Verification Guide:** [Mock Data/verification_guide.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/verification_guide.md) — read when verifying mathematical calculations and test numbers.
- **Mock Dataset:** [Mock Data/companies_dataset.json](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/companies_dataset.json) — read when seeding company profiles and ground-truth rule definitions.

---

## Architectural Guardrails

### 1. Deterministic Math Execution
- Use pure JavaScript calculation logic for all monetary totals, discounts, and taxes.
- Restrict Gemini to parameter extraction, natural rule compilation, and sales narrative drafting.
- Verify calculations against ground-truth benchmarks:
  - Northstar (`co1_seo`): **$35,073.00**
  - Fortress IT (`co2_msp`): **$2,734.80/mo recurring + $3,150.00 setup**
  - Fieldstone (`co3_dev`): **$10,445.00**

### 2. AST-Safe Word Processing Pipeline
- Extract Markdown using `@firecrawl/anydoc` (local Rust-based parser) for LLM analysis.
- Mutate Word templates using `docxmlater` to preserve styling, typography, and page layout.
- Preserve table header (Row 0) and summary footer rows (Subtotal, Tax, Total, Terms).
- Collapse repeating line-item rows into a single loop row (`{#items}...{/items}`) and prune static sample rows.
- Hydrate final proposals using `easy-template-x`.

### 3. Two-Tier UI Exposure
- Present tenant-facing controls clearly: clean variable tables, interactive pricing cards, in-browser `docx-preview`, and lead simulation.
- Disclose technical inspection data behind collapsible accordion dropdowns: raw AnyDoc Markdown, AST mutation logs, and compiled JSON rule schemas.

### 4. Per-Company Session Isolation
- Store working files on disk under `backend/storage/<company_id>/`.
- Persist variable tables and rule schemas in SQLite so switching company tabs maintains progress.
- Provide an explicit "Reset to Mock Default" action to re-seed from `companies_dataset.json`.

---

## Development & Execution Sequence

Implement phases strictly in order. Each phase must satisfy its completion criteria before advancing.

### Phase 0: Workspace Foundation
1. Configure `backend/` with Express, TypeScript (`tsx watch`), Multer, CORS, SQLite, and `storage/` directory setup.
2. Configure `backend/.env` with `GEMINI_API_KEY`.
3. Configure `frontend/` shell with Vite, TailwindCSS, Shadcn UI tabs, and toast notifications.
- **Completion Criteria:** Backend serves health endpoint; frontend renders shell and connects to backend without errors.

### Phase 1: Company Harness & Mock Ingestion
1. Build 3 company tabs (`co1_seo` Northstar, `co2_msp` Fortress, `co3_dev` Fieldstone).
2. Implement "Import Settings" pulling profile and prefilling the editable `pricing_engine_spec` textarea.
3. Add collapsible Reviewer Dropdown showing raw company JSON.
- **Completion Criteria:** Switching tabs loads isolated company state; importing pre-fills profile and pricing spec; edits persist across tab switches.

### Phase 2: AnyDoc Parsing & Variable Review Table
1. Implement `.docx` upload (with 1-click load from `Mock Data/`).
2. Convert `.docx` to Markdown via `@firecrawl/anydoc` and expose in a collapsible dropdown.
3. Implement Gemini variable extraction returning: `natural_name`, `variable_name`, `type`, `description`, `sample_from_quotation`, `context_anchor`.
4. Build Variable Review Table UI with inline editing, [Fixed | AI-Generated] paragraph toggle, and "Add Custom Variable" modal.
- **Completion Criteria:** Uploading sample document displays extracted Markdown in dropdown and populates the variable table with valid types and samples.

### Phase 3: Template Generation Engine
1. Integrate `docxmlater` text-run swapper to replace sample anchors with `{variable_name}` tags.
2. Implement table loop collapser: preserve header and footer rows, convert first item row to `{#items}`, prune static sample rows.
3. Save generated `template.docx` to `storage/<company_id>/`.
4. Render in-browser preview via `docx-preview` and provide download button.
- **Completion Criteria:** Downloaded `template.docx` contains valid `{tags}` and loop rows, opens in Microsoft Word without repair warnings, and previews cleanly in the browser.

### Phase 4: Pricing Engine Rule Cards & Math Interpreter
1. Implement Gemini rule compiler translating `pricing_engine_spec` into structured JSON schema.
2. Build Interactive Rule Cards UI (Tiers, Multipliers, Addons, Taxes) with inline adjustments.
3. Add collapsible JSON editor with "Save & Re-compile" option.
4. Implement deterministic JavaScript pricing calculation engine.
- **Completion Criteria:** Rule cards reflect natural spec; inline changes update backend rule JSON; calculation engine reproduces ground-truth numbers for each company.

### Phase 5: Lead Simulator & Verification
1. Build lead input panel with freeform textarea and "Load Sample Lead Message" button.
2. Extract lead parameters (seats, locations, addons, state) using Gemini.
3. Calculate exact pricing via deterministic math engine.
4. Generate dynamic narrative copy using Gemini based on prompt hints.
5. Render finalized proposal `.docx` using `easy-template-x`.
6. Preview result in `docx-preview` and provide download button.
- **Completion Criteria:** Pasting sample inquiry produces a complete `.docx` proposal matching the exact dollar figures in `verification_guide.md`.
