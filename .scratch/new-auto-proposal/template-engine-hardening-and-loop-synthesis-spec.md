<!-- labels: ready-for-agent -->
# Specification — Lossless Template Mutator Hardening, Semantic Table Seams, and Dynamic Loop Synthesis

**Specification Version:** 1.0.0  
**Context:** `prototypes/new-auto-proposal`  
**Target Efficiencies:** Resolves Level 1 (Engine), Level 2 (Model), Level 3 (Prompt/Schema), and Level 4 (Architecture) failures documented in `Templatized Documents.md`.  
**Related Epics & Specifications:**
- Master Prototype Spec: [spec.md](spec.md)
- Variable & Template Architecture Spec: [variable-and-template-architecture-spec.md](variable-and-template-architecture-spec.md)
- Issue 03: [03-gemini-variable-extraction-and-interactive-review-table.md](issues/03-gemini-variable-extraction-and-interactive-review-table.md)
- Issue 04: [04-docxmlater-word-template-mutation-and-in-browser-preview.md](issues/04-docxmlater-word-template-mutation-and-in-browser-preview.md)
- Diagnostic Ground Truth: [Templatized Documents.md](../../prototypes/new-auto-proposal/docs/Templatized%20Documents.md)

---

## 1. Problem Statement & Root Cause Analysis

When converting agency quotation Word documents (`.docx`) into dynamic automated proposal templates, the initial implementation of the templatizing phase produced critical structural corruptions, misaligned variables, and broken table geometries. A forensic investigation across the three benchmark proposals (`Fieldstone Studio`, `Fortress IT Group`, and `Northstar Digital`) revealed that these failures were not isolated bugs, but compound failures spanning all four levels of the system:

### Level 1: Templatizing Engine Defects (`template-mutator.service.ts`)
1. **Default Header Row Overwriting:** The table locator function defaulted to `allowHeaderRow: true` and ignored explicit row indexes. When targeting data cells without an exact Col 0 string match, it resolved to Row 0 (the table header), repeatedly overwriting column titles like `"Prepared By"` and `"Amount"` with `{proposal_valid_until}` and `{total_investment}` while leaving data rows untouched.
2. **Catastrophic Direct Substitution Fallthrough (Case B):** In `executeReplaceTableCell`, when sample text was provided but not found within the designated cell (due to index shifts or layout differences), the function fell through to an unverified direct substitution (`table.setCell`), destroying unrelated cells (e.g., wiping out the `"Standard — Recommended"` package header in Fortress IT).
3. **Premature Paragraph Exit:** In `executeReplaceTextRun`, the loop over body paragraphs executed an immediate `return` upon finding the first match. This replaced the customer name in the title line (`Prepared for {client_name}`) but left every subsequent occurrence in the introductory body text completely hardcoded.
4. **Unconstrained Substring Replacement:** Substring replacement lacked word-boundary (`\b`) validation. Searching for numeric sample values like `"5"` matched the digit `"5"` inside dollar amounts, corrupting `$75.00` into `$7{server_count}.00`.
5. **Rigid Row 1 Table Loop Assumption:** The repeating table collapser assumed all loops start on Row 1. In hybrid tables containing a base tier (Row 1), add-on items (Rows 2–3), and summary footers (Rows 4–6), it collapsed Row 1 into `{#addon_items}` and pruned the real add-ons.

### Level 2: AI Model Execution & Extraction Anomalies
1. **Empty Column Tag Arrays (`columns: []`):** Across all proposals, Gemini returned empty arrays for repeating loop columns, causing the mutator to wrap loop tags around hardcoded sample text (`{#project_phases} 1 | Discovery | ... {/project_phases}`) rather than dynamic field tags.
2. **Hallucinated Table Coordinate Shifts:** The model miscalculated table numbers (e.g., assigning `table_index: 1` to proposal date metadata, directing it into the Tier Comparison Matrix).
3. **Truncated and Over-Inclusive Sample Strings:** The model truncated multi-sentence paragraphs to their first sentence (leaving the rest hardcoded) and included static labels like `"Prepared for "` inside customer company names.
4. **Missing Conditional Row Tags:** The model emitted `replace_table_cell` instead of `wrap_conditional_row` for tax and discount variables, causing conditional tags (`{#has_tax}`) to never be placed in the template.

### Level 3: Prompt & Context Omissions (`gemini.service.ts`)
1. **Schema Property Omission:** The structured JSON schema fed to Gemini completely omitted the `columns` property from `compound_tables`, making it impossible for the model to emit column definitions.
2. **Absence of a Document Table Manifest:** The prompt provided raw Markdown text without an enumerated table manifest, forcing the LLM to guess 0-based OpenXML table indexes.
3. **Unenforced Locator Parameters:** Directives did not mandate `row_identifier` or `col_index` for cell mutations, resulting in ambiguous coordinates.
4. **Markdown Syntax Leakage:** In list items, markdown bullet hyphens (`- `) leaked into sample text, which failed to match list-formatted Word paragraphs (`<w:numPr>`).

### Level 4: Architectural Plan Gaps
1. **The "Pruning vs. Synthesis" Trap:** The architecture assumed optional rows could always be handled by conditional wrapping. However, conditional tags can only *prune* existing rows; they cannot *synthesize* catalog add-ons that were not present in the original sample quote.
2. **Homogeneous Table Assumptions:** The plan lacked an architectural model for hybrid composite tables containing base rows, repeating sub-ranges, and calculation footers in a single table container.

---

## 2. Solution

A hardened, deterministic, and AST-safe templatizing architecture that guarantees 100% layout fidelity and zero collateral corruption:

1. **Pre-Computed OpenXML Table Manifest:** Before prompting the AI, the backend inspects the `.docx` binary via `docxmlater` to construct a ground-truth Table Manifest (indexes, header titles, row counts, and sample labels). This manifest is injected directly into the Gemini prompt as `LAYER 1.5`.
2. **Semantic Header Matching with Integer Fallback:** The mutator resolves tables using column header matching (e.g., verifying `"Line Item | Amount"`), falling back to integer coordinates only as an advisory hint. This makes table targeting immune to index drift.
3. **Dynamic Add-On Repeating Loops (`{#addon_items}`):** Optional add-on menus are modeled as repeating table loops rather than brittle conditional rows. This enables the downstream pricing engine and proposal simulator to synthesize 0, 1, 2, or 5 add-ons dynamically without OpenXML row fabrication.
4. **Mid-Table Sub-Range Loop Collapsing:** The mutator supports explicit `template_row_index` and deletion bounds, allowing sub-table sections (such as add-ons in Row 2) to collapse into loops while strictly preserving Row 1 (Base Project) and trailing calculation footers.
5. **Two-Tier Text Replacement with Lexical Scope Safety:**
   - *High-Entropy Entities (`client_name`, `client_company_name`):* Replaced across all body paragraphs globally, taking advantage of `easy-template-x` lexical scope resolution to resolve from root payload data everywhere.
   - *Low-Entropy Terms (Enums, Numbers, Currency):* Replaced strictly using word boundaries (`\b`) and scoped via `context_anchor`.
6. **Non-Destructive Mutation Contract:** In `executeReplaceTableCell`, direct cell text overwrites are prohibited when sample text is provided. If text does not match, the mutator logs an info event and preserves cell formatting, guaranteeing zero destructive fallthrough.
7. **Container Paragraph Collapse for Lists:** Bulleted scope and SLA sections are treated as a single `ai_generated` narrative container (`{scope_deliverables_summary}`). The mutator injects the tag into paragraph 1 and prunes redundant sibling bullet paragraphs from the AST.

---

## 3. User Stories

### Persona: Agency Tenant & Account Manager
1. As an agency tenant, I want dynamic variables like client company name to be replaced consistently throughout my entire proposal (in headings, intros, and next steps), so that I never send a proposal with a previous client's name lingering in the text.
2. As an agency tenant, I want my proposal template to dynamically include whichever add-ons a lead requests (whether 0, 2, or 5), even if my uploaded sample quote only featured 2 add-ons.
3. As an agency tenant, I want my base package build row to remain distinct and visible above my dynamic add-ons, so that my pricing structure is clear and readable.
4. As an agency tenant, I want my payment terms to flexibly render 2 milestones (50/50) or 3 milestones (thirds) depending on the lead's preference, without corrupting Word table borders or cell shading.
5. As an agency tenant, I want scope-inclusion and deliverable bullet lists to adapt dynamically to the recommended package tier, so that clients never receive proposals promising higher-tier SLA commitments or device counts than they paid for.
6. As an agency tenant, I want the table column headers (like `"Line Item"`, `"Amount"`, `"Phase"`, `"Deliverable"`) and my agency's `"Prepared By"` branding to remain 100% intact during template generation, so that my proposal retains its polished corporate formatting.

### Persona: Reviewer & Quality Assurance Engineer
7. As a reviewer inspecting mutated Word templates, I want `template-mutator.service.ts` to strictly refuse to overwrite Header Row 0, ensuring that column titles are never replaced with dynamic variable tags.
8. As a reviewer inspecting AST mutations, I want table targeting to match column header titles semantically, so that off-by-one table index errors from the AI cannot corrupt unrelated tables.
9. As a reviewer inspecting AST mutations, I want `executeReplaceTableCell` to fail cleanly without touching cell contents when sample text does not match, eliminating catastrophic cell destruction.
10. As a reviewer inspecting mutated `.docx` binaries, I want numeric variables (like seat counts or server counts) to use strict word-boundary matching, preventing collisions with numbers in surrounding currency values.
11. As a reviewer verifying OpenXML integrity, I want repeating line-item loops (`milestones`, `addon_items`, `payment_milestones`) to contain dynamic `{field}` tags in their cells rather than hardcoded sample numbers, so that downstream hydration generates variable data across all rows.

### Persona: Lead Simulator Agent & Downstream Pricing Engine
12. As a lead simulator agent, I want generated templates to leverage `easy-template-x` lexical scope resolution, so that root data properties (`client_name`, `selected_tier`, `proposal_date`) resolve seamlessly inside nested table loops and conditional rows without redundant payload mapping.
13. As a downstream pricing compiler, I want the calculated output to emit `addon_items: []` when 0 add-ons are chosen, allowing `easy-template-x` to prune the loop row cleanly and automatically evaluate `has_addons: false`.
14. As a lead simulator agent, I want multi-bullet scope sections to be represented by a single narrative tag (`{scope_deliverables_summary}`), allowing Gemini to draft a complete, formatted bulleted clause matching the lead's specific tier and headcount.
15. As a reviewer verifying proposal output, I want the hydrated `.docx` proposal to match our ground-truth financial benchmarks ($35,073.00, $2,734.80 + $3,150.00, and $10,445.00) with 100% mathematical and typographical precision.

---

## 4. Implementation Decisions

### Decision 1: Pre-Computed AST Table Manifest (`docxmlater` Upfront Inspection)
- **Module:** `backend/src/routes/variables.ts` & `backend/src/services/gemini.service.ts`
- **Design:** Before calling `extractVariablesWithGemini`, the backend loads `original_quotation.docx` into memory via `docxmlater.Document.loadFromBuffer()`. It iterates through `doc.getTables()` and formats an explicit manifest:
  ```text
  LAYER 1.5: DOCUMENT TABLE MANIFEST (WORD OPENXML AST)
  - Table 0: Metadata [Date | Prepared By | Proposal Valid Until] (2 rows, 3 cols)
  - Table 1: Tier Comparison Matrix [Local | Growth — Recommended | Authority] (4 rows, 3 cols)
  - Table 2: Investment Summary [Line Item | Amount] (7 rows, 2 cols)
  ```
- **Rationale:** Eliminates LLM guesswork regarding table numbers and provides an exact mapping between rendered Markdown pipe tables and OpenXML `<w:tbl>` elements.

### Decision 2: Semantic Table Locators with Header Verification
- **Module:** `backend/src/services/template-mutator.service.ts`
- **Design:** In `findTableAndRow`, the locator function first verifies whether the candidate table at `table_index` has headers matching the expected context. If headers do not match (or if `table_index` is omitted), it scans all document tables to find the one whose Row 0 contains the matching header tokens (e.g., `["line item", "amount"]` or `["milestone", "trigger", "amount"]`).
- **Safety Invariant:** `allowHeaderRow` defaults to `false`. Row 0 is permanently protected from scalar variable overwrites and conditional row wrapping.

### Decision 3: Flattened String Array for Table Loop Columns
- **Module:** `backend/src/services/gemini.service.ts`
- **Design:** In `extractionResponseSchema`, `compound_tables` defines:
  ```typescript
  compound_tables: {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        table_id: { type: SchemaType.STRING },
        natural_name: { type: SchemaType.STRING },
        table_index: { type: SchemaType.NUMBER },
        type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["comparison_matrix", "repeating_loop"],
        },
        loop_tag: { type: SchemaType.STRING },
        columns: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: ["table_id", "natural_name", "table_index", "type"],
    },
  }
  ```
- **Execution:** When collapsing a repeating table, `executeCollapseRepeatingTable` maps array index `i` to cell index `i` in the template row, wrapping the tag into `{col_name}`. This avoids complex object nesting that triggers Gemini 400 schema validation errors.

### Decision 4: Mid-Table Sub-Range Loop Collapsing
- **Module:** `backend/src/services/template-mutator.service.ts`
- **Design:** Extend `executeCollapseRepeatingTable` to accept explicit `template_row_index`, `delete_sample_rows_from`, and `delete_sample_rows_count`.
- **Hybrid Table Rules (e.g., Fieldstone Investment Table):**
  - Row 0: Column headers preserved.
  - Row 1: Base Tier Project (`E-Commerce Build`) preserved as a static/scalar data row.
  - Row 2: Converted to `{#addon_items}{addon_name} | {addon_fee}{/addon_items}`.
  - Row 3: Redundant sample add-on row pruned in reverse order.
  - Rows 4–6: Subtotal, discount, and total rows strictly preserved.

### Decision 5: Non-Destructive Cell Mutation Contract
- **Module:** `backend/src/services/template-mutator.service.ts`
- **Design:** In `executeReplaceTableCell`:
  - When `sample_text` is specified, it must match within the cell paragraphs (via cross-run replacement).
  - If no match occurs in the primary cell, adjacent data cells in that specific row are checked.
  - If still not found, **the function returns `{ applied: false }` and preserves the cell text**. Case B blind substitution is strictly prohibited when `sample_text` is provided.
  - Direct cell substitution (`table.setCell`) is permitted only when `sample_text` is omitted AND an exact `row_identifier` label match was established on Col 0.

### Decision 6: Two-Tier Text Run Replacement Strategy
- **Module:** `backend/src/services/template-mutator.service.ts`
- **Design:**
  - **Global Replacement:** When `row.variable_name` represents an entity name (`client_name`, `client_company_name`), the mutator replaces all case-insensitive occurrences across all paragraphs in the document, ensuring title and body intro paragraphs are synchronized.
  - **Anchored & Word-Bounded Replacement:** For enums (`selected_tier`), counts (`server_count`), and numbers, replacement requires a `context_anchor` and uses a regex word boundary (`\b`), preventing substring collisions inside currency values.

### Decision 7: Container Paragraph Collapse for Multi-Bullet Scope Lists
- **Module:** `backend/src/services/template-mutator.service.ts` & `backend/src/services/gemini.service.ts`
- **Design:**
  - The Gemini prompt classifies scope deliverables and SLA bullet lists as category: `paragraph` with `mode: "ai_generated"`.
  - When mutating, `executeReplaceTextRun` recognizes list container variables: it strips markdown `- ` prefixes, locates the first paragraph of the list, injects `{scope_deliverables_summary}`, and prunes the remaining bullet paragraphs (2..N) from the document AST.

---

## 5. Testing Decisions

### What Makes a Good Test
Tests must verify observable external artifacts and behavior, never private internal functions:
1. **Word AST Structure Verification:** Assert that mutated `.docx` files contain valid OpenXML table grids, intact header cells (Row 0), and correctly placed `{tags}`.
2. **Lossless Style Invariants:** Assert that table cell shading (`<w:shd>`), cell borders (`<w:tcBorders>`), and bold run properties (`<w:b>`) are preserved.
3. **End-to-End Hydration Check:** Hydrate the mutated template with varied test payloads (e.g. 0 add-ons vs. 3 add-ons; 50/50 split vs. thirds) via `easy-template-x` and verify that the rendered document has no orphaned tags, broken table rows, or syntax leaks.
4. **Markdown Equivalence Verification:** Convert hydrated proposals to Markdown via `@firecrawl/anydoc` and compare against the expected ground-truth benchmarks in `Templatized Documents.md`.

### Tested Modules & Test Seams
1. **Primary Seam 1 (Extraction API):** `POST /api/companies/:id/variables/extract` — verify that Gemini returns valid variables, complete `columns` arrays for repeating loops, and correct mutation actions.
2. **Primary Seam 2 (Template Generation API):** `POST /api/companies/:id/template/generate` — verify that the template mutator processes all variables and outputs a valid `storage/<company_id>/template.docx`.
3. **Primary Seam 3 (Hydration Bridge):** `hydrateProposalTemplate(templateBuffer, payload)` — verify dynamic array expansion, zero-item loop removal, conditional row pruning, and root-scope variable resolution.

### Prior Art
- Unit and integration tests in `prototypes/new-auto-proposal/backend/src/tests/template-mutator.test.ts`.
- Mock proposals and ground truth outputs in `prototypes/new-auto-proposal/docs/Templatized Documents.md`.

---

## 6. Out of Scope

1. **Low-Level XML Shading Manipulation:** Dynamically moving `<w:shd>` background fill colors across columns in the 3-Tier Comparison Matrix based on user selection is out of scope; the template maintains static pre-styled shading on the anchor tier with dynamic recommended badges (`{tier_x_badge}`).
2. **Interactive Word Document Canvas:** In-browser editing of raw `.docx` files is out of scope; template mutation is completely automated and inspected via `docx-preview`.
3. **Downstream Pricing Logic Compilation:** Compiling natural language prompts into JavaScript calculation rule cards is covered in Issue 05 and is out of scope for this templating spec.

---

## 7. Further Notes & Traceability

- This specification completely addresses and supersedes the diagnostic findings in `Templatized Documents.md` and the audit in `Mock Data/templated_markdown/TEMPLATE_ARCHITECTURE_AUDIT.md`.
- All mutation tags strictly adhere to standard single-brace `easy-template-x` syntax (`{tag}`, `{#loop}...{/loop}`, `{#condition}...{/condition}`).
