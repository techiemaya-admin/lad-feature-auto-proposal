# AGENTS.md — Auto-Proposal Prototype (`new-auto-proposal`)

Self-contained proof of concept demonstrating zero-configuration proposal generation: real Word quotation + natural-language pricing notes in, client-ready `.docx` proposals out.

## Context Pointers

- **UI/UX Design Specification:** [docs/design.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/design.md) — read when implementing front-end layouts, briefing capsules, chip-decks, or ambient drawers.
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

### 3. Unidirectional State Discipline (Hard Reset Policy)
- The workflow progresses strictly forward across the 5 stages: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Lead Simulation.
- Once submitted, earlier stages transition into a read-only locked summary.
- Editing an earlier stage safely rewinds downstream progress behind an explicit confirmation warning dialog, clearing downstream database records to prevent complex bidirectional synchronization bugs.
- User input text in the prompt box and uploaded files are preserved during rewinds.

### 4. Ambient Decoupling & Two-Tier Exposure
- Primary linear canvas focuses exclusively on the 5-stage proposal pipeline.
- Peripheral configurations (AI tone/style, customer clarification triggers, email toggles) reside in an ambient slide-over drawer (`ConfigurationSheet.tsx`).
- Technical inspection data (AnyDoc Markdown, raw Variables JSON, Rule Schema JSON, AST mutation logs) resides in a docked, collapsible bottom HUD (`DevDock.tsx`).

### 5. Per-Company Session Isolation
- Store working files on disk under `backend/storage/<company_id>/`.
- Persist variable tables, rule schemas, and configurations in SQLite so switching company tabs maintains progress.
- Provide an explicit "Reset to Mock Default" action to re-seed from `companies_dataset.json`.

### 6. Surface Hierarchy & Anti-"Box-in-Box" Guardrail
- **Strictly Avoid "Boxing a Box":** Never nest bordered containers inside bordered containers (e.g. no card inside a card, no bordered input inside a bordered card, no bordered code block inside a bordered drawer).
- **Tonal Hierarchy via Darker Shades:** Use darker/different background shades to communicate visual hierarchy against the page background, rather than drawing nested outlines. Input areas and editors should blend seamlessly into their tonal surface without heavy outer strokes.

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

### Phase 2: Compound Briefing Capsule & Quotation Ingestion
1. Build fused Prompt textarea + docked dropzone capsule (`PromptDocCapsule.tsx`).
2. Support natural multiline Enter and company-specific realistic AI placeholders.
3. Convert `.docx` to Markdown via `@firecrawl/anydoc` and route through Multer.
4. Implement read-only locked state with `[Edit / Reset ✎]` button and confirmation warning modal.
- **Completion Criteria:** Submitting briefing parses `.docx` into clean Markdown, locks the prompt card, and unlocks the downstream variable stage.

### Phase 3: Categorized Variable Review Chip-Deck
1. Implement Gemini variable extraction returning: `natural_name`, `variable_name`, `type`, `description`, `sample_from_quotation`, `context_anchor`.
2. Build Categorized Variable Review Chip-Deck UI (`VariableReviewDeck.tsx`) with 3 buckets (`Customer Inputs`, `Pricing Placeholders`, `Narrative Paragraphs`).
3. Implement inline renaming, type dropdown bucket movement, and delete action (retaining static text).
4. Implement `[Fixed Boilerplate]` vs `[AI-Generated]` toggle for paragraph cards with prompt tips.
5. Implement `[+ Add Chip]` modal with exact quotation text AST verification.
- **Completion Criteria:** Discovered variables render in distinct chip buckets; custom chips bind accurately; confirming advances to the template checkpoint.

### Phase 4: docXMLater Mutation & Minimal Checkpoint
1. Integrate `docxmlater` text-run swapper to replace sample anchors with `{variable_name}` tags.
2. Implement table loop collapser: preserve header and footer rows, convert first item row to `{#items}`, prune static sample rows.
3. Build Minimal Template Checkpoint Card (`TemplateCheckpointCard.tsx`) with tag counts, optional `docx-preview` modal, and `[Proceed to Pricing Engine ➔]` button.
- **Completion Criteria:** Generated `template.docx` contains valid `{tags}` and loop rows without repair warnings; checkpoint advances smoothly to pricing.

### Phase 5: Pricing Engine Rule Cards & Math Interpreter
1. Implement Gemini rule compiler translating `pricing_engine_spec`, confirmed variables, and sample quote values into `PricingRuleSchema` JSON.
2. Build Interactive Rule Cards UI (`PricingEngineDeck.tsx`) for Tiers, Multipliers, Addons, and Taxes.
3. Implement pure JavaScript deterministic calculation engine verifying ground-truth benchmarks.
- **Completion Criteria:** Rule cards accurately reflect spec; math calculations reproduce ground truth ($35,073.00, $2,734.80/mo + $3,150.00, $10,445.00).

### Phase 6: Lead Simulator & Proposal Verification
1. Build lead simulation panel with freeform email textarea and "Load Sample Lead Message" button.
2. Extract lead parameters using Gemini, calculate prices via math engine, and draft narrative sections based on prompt tips.
3. Hydrate final proposal `.docx` via `easy-template-x` and preview in-browser via `docx-preview`.
- **Completion Criteria:** Lead inquiries generate finished `.docx` proposals matching exact ground-truth benchmarks.

### Auxiliary: Ambient Shell Enhancements
1. Build Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`) for AI tone/style, clarification thresholds, and email toggles.
2. Build Bottom Developer Dock (`DevDock.tsx`) for AnyDoc Markdown, Variables JSON, Rule Schema JSON, and pipeline logs.
- **Completion Criteria:** Settings drawer and developer dock operate independently without interrupting the primary generative flow.
