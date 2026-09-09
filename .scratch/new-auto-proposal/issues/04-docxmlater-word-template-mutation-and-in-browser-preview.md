# 04: docXMLater Word Template Mutation and Minimal Checkpoint Preview

**What to build:** A lossless, AST-safe Word document mutation engine powered by `docxmlater@12.1.0` and an inline confirmation checkpoint (`TemplateCheckpointCard.tsx`). When the user clicks `[ Generate Template ➔ ]` in the Variable Review Deck, the backend loads `storage/<company_id>/original_quotation.docx` and executes confirmed mutation instructions directly in memory: text runs are replaced with `{variable_name}` tags without corrupting Word run formatting, conditional table rows are wrapped across cells (`{#has_tax}`), and repeating line-item tables collapse into single-row loops (`{#items}...{/items}`) while strictly preserving Row 0 headers and summary footers (Subtotal, Tax, Total, Terms) under ECMA-376 table invariants. The mutated template is saved to `storage/<company_id>/template.docx`. In the frontend, the workspace reveals a sleek, elevated confirmation card with placed tag counts, loop status, an optional `[ Quick Preview (.docx) ]` modal powered by `docx-preview`, a `[ Download Template .docx ]` button, and a primary advance CTA `[ Proceed to Pricing Engine ➔ ]` to maintain flow momentum.

**Specification:** [variable-and-template-architecture-spec.md](../variable-and-template-architecture-spec.md)  
**Master Spec:** [spec.md](../spec.md)  
**Design Guide:** [docs/design.md](../../prototypes/new-auto-proposal/docs/design.md)  
**Research Reference:** [prototypes/test-docXMLater/RESEARCH.md](../../prototypes/test-docXMLater/RESEARCH.md)  
**Blocked by:** 03: Gemini Variable Extraction and Categorized Review Deck  

**Status:** completed

---

## 1. Problem Statement & Background

Converting an agency's original Microsoft Word proposal into an automated template faces critical engineering hurdles:
1. **Word Text Run Splitting (`<w:r><w:t>`):** Word arbitrarily fragments words (due to spellcheck, edits, and XML escaping). Naive string replacement or regex searching corrupts or misses text like `"Whitfield & Associates"`.
2. **Table Loop Geometry & ECMA-376 Invariants:** Tables require strict OpenXML geometry. Arbitrary row deletion can leave empty tables (violating ECMA-376's single-row rule) or strip critical column headers (Row 0) and summary footers.
3. **Styling Loss:** Template substitution engines frequently strip table cell background colors (`<w:shd>`), borders, and bold typography during text injection.
4. **Workflow Momentum:** Forcing tenants into a heavy, slow document canvas halts quoting momentum. A low-profile confirmation checkpoint card provides immediate verification while keeping the user moving forward.

---

## 2. Architectural Decisions & Alternatives Evaluated

### Decision D: Standardized 4-Action Mutation Schema
- **Selected Approach:** `docxmlater` executes 4 concrete mutation actions using semantic locators:
  1. `replace_text_run`: Uses `context_anchor` to safely replace text in body paragraphs.
  2. `replace_table_cell`: Uses `table_index`, `row_identifier`, and `col_index` to replace cell text without touching `<w:tcPr>` shading or borders.
  3. `wrap_conditional_row`: Wraps calculation rows across cells (`{#has_tax}` in Cell 0, `{/has_tax}` in Cell 1) so `easy-template-x` can prune zero-dollar rows cleanly.
  4. `collapse_repeating_table`: Converts Row 1 into a loop row (`{#items}...{/items}`), deletes redundant sample rows (Row 2+), and strictly preserves Row 0 (headers) and summary footers.
- **Alternatives Evaluated:**
  - *Naive Global Regex Search and Replace:* Fails due to run splitting and replaces duplicate values (e.g. `$60.00`) in the wrong sections.
  - *Raw XPath / XML Node Rewriting:* Extremely fragile; easily triggers Word's "Unreadable content" repair warning.

### Decision E: Static Word Shading with Dynamic Recommended Badges (Tier Matrix)
- **Selected Approach:** In the 3-tier comparison matrix, Word's pre-styled cell background shading and borders remain static. Dynamic variables template the tier names, rates, SLAs, and a dynamic recommendation badge (`{tier_2_badge}`).
- **Alternative Evaluated:** Dynamically shifting XML `<w:shd>` tags across columns via code.
- **Why Rejected:** `easy-template-x` cannot dynamically shift XML attributes across table columns without fragile low-level XML rewriting.

### Decision H: docXMLater Table Loop ECMA-376 Structural Invariants
- **Selected Approach:** Repeating table collapse strictly preserves Row 0 as the static column header and transforms Row 1 into the loop row. Redundant sample rows are deleted, but trailing summary rows (Subtotal, Tax, Total, Payment Terms) are preserved with zero row deletion.
- **Rationale:** Under ECMA-376 OpenXML rules, tables must contain at least one row, and pruning headers or summary rows breaks table geometry.

### Decision: Low-Profile Checkpoint Card (vs. Blocking Document Canvas)
- **Selected Approach:** Compact inline card displaying placed tag counts, loop status, an optional `[ Quick Preview (.docx) ]` modal using `docx-preview`, a download button, and `[ Proceed to Pricing Engine ➔ ]`.
- **Rationale:** Follows the design vision of Rush Away Auto-Proposal: minimal, fluid, and anti-AI-slop.

---

## 3. docXMLater Mutation Engine Architecture

### In-Memory DOM Manipulation (`backend/src/services/template-mutator.service.ts`):
1. **Load:** Reads `storage/<company_id>/original_quotation.docx` into `docxmlater.Document`.
2. **Text Run Mutations (`replace_text_run`):**
   - Finds paragraphs matching `context_anchor` via `doc.findParagraphsByText(context_anchor)`.
   - Utilizes native `Paragraph.prototype.replaceTextCrossRun(sample_text, `{${template_tag}}`, { caseSensitive: false })` to replace text spanning across arbitrary Word XML runs (`<w:r><w:t>`) without manual XML manipulation.
3. **Table Cell Mutations (`replace_table_cell`) with Hybrid Resolution:**
   - Evaluates `table_index` first as a fast path.
   - If the row matching `row_identifier` is not found, automatically falls back to scanning all tables (`doc.getTables()`) to locate the row semantically, preventing off-by-one indexing errors from AnyDoc markdown discrepancies.
   - Replaces text in cell at `col_index` with `{template_tag}` while preserving cell shading `<w:shd>` and borders.
4. **Conditional Row Wrapping (`wrap_conditional_row`):**
   - Injects `{#condition_tag}` prefix into Cell 0 and `{/condition_tag}` suffix into Cell 1 (or last cell).
   - Allows downstream `easy-template-x` to prune the entire row if the boolean flag resolves to false.
5. **Repeating Table Collapsing (`collapse_repeating_table`):**
   - Keeps Row 0 (header) untouched.
   - Injects loop opening `{#loop_tag}` into Row 1, Cell 0, and loop closing `{/loop_tag}` into Row 1, last Cell.
   - Replaces column sample values in Row 1 with dynamic `{field}` tags.
   - **Reverse-Order Deletion Guard:** In `docxmlater`, `table.removeRow(index)` immediately re-splices `table.rows`. Pruning redundant sample rows MUST be executed in reverse order (`for (let i = summaryStartIndex - 1; i >= delete_sample_rows_from; i--) table.removeRow(i);`) or repeatedly deleting `delete_sample_rows_from`. Forward loops cause index shifts that skip rows and delete summary footers.
6. **Save:** Serializes modified document buffer to `storage/<company_id>/template.docx`.


---

## 4. UI/UX Architecture (`TemplateCheckpointCard.tsx`)

Following `DESIGN.md`:
- **Surface:** Elevated white card (`bg-card rounded-2xl border border-border/80 shadow-xs p-6 space-y-4`).
- **Anti-AI-Slop Copywriting:** Clean, human language:
  - Header: `Dynamic Template Generated Successfully` (accompanied by emerald checkmark badge).
  - Subtitle: `18 dynamic fields and 1 repeating table configured`.
- **Controls & Actions:**
  - `[ Quick Preview (.docx) ]` (`variant="outline" size="sm"`): Opens an unbloated modal embedding `docx-preview` on an in-memory blob.
  - `[ Download Template .docx ]` (`variant="ghost" size="sm"`): Triggers direct browser download via `GET /api/companies/:id/template/download`.
  - Primary CTA: `[ Proceed to Pricing Engine ➔ ]` (`h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`).

---

## 5. API Contracts

### 1. `POST /api/companies/:id/template/generate`
- **Trigger:** Tenant clicks `[ Generate Template ➔ ]` in `VariableReviewDeck`.
- **Behavior:** Loads active confirmed variables from `company_variables` table, mutates `original_quotation.docx`, and saves `storage/<company_id>/template.docx`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "template_path": "storage/co2_msp/template.docx",
    "tags_placed_count": 22,
    "loops_collapsed_count": 1,
    "conditional_rows_wrapped_count": 3
  }
  ```

### 2. `GET /api/companies/:id/template/download`
- **Response:** Streams the binary `.docx` file with headers:
  - `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `Content-Disposition: attachment; filename="template.docx"`

---

## 6. Edge Cases & Mitigations

1. **Embedded Variables Inside Table Label Cells:**
   - *Scenario:* Fortress IT Table 3 Row 5 has label: `Seat subtotal (42 seats × $60.00)`.
   - *Mitigation:* Mutation allows Cell 0 to replace label with composite tags: `Seat subtotal ({seat_count} seats × ${adjusted_seat_rate})`.
2. **OpenXML Single-Row Invariant:**
   - *Scenario:* ECMA-376 requires every table to have at least one row.
   - *Mitigation:* Loop collapse guarantees Row 0 and Row 1 are never removed; only redundant sample rows (Row 2+) are deleted.
3. **Summary Row Protection:**
   - *Scenario:* Subtotal, Tax, Total, and Terms rows sit beneath repeating sample items.
   - *Mitigation:* `delete_sample_rows_from` stops before summary row identifiers, leaving calculation footers intact.
4. **Cell Styling Retention:**
   - *Scenario:* Text replacement wipes background fill `<w:shd>` or font style `<w:rPr>`.
   - *Mitigation:* `docxmlater` modifies run text nodes without replacing `<w:tcPr>` or paragraph style elements.
5. **Hybrid Table Locator Resolution (Off-by-One Guard):**
   - *Scenario:* AnyDoc markdown omits a layout box or callout table, causing Gemini's `table_index` to not match physical Word tables.
   - *Mitigation:* Engine uses `table_index` first as a candidate, falling back to full-document table scan to locate the row matching `row_identifier` semantically.
6. **`easy-template-x` Loop Boundary Alignment:**
   - *Scenario:* Incorrect placement of loop tags breaks row-level cloning.
   - *Mitigation:* `{#items}` placed in Row 1 Cell 0, `{/items}` placed in Row 1 final cell, ensuring clean table row duplication.
7. **Shifting Indices in Table Row Deletion:**
   - *Scenario:* Deleting sample rows forward shifts row indices dynamically, skipping alternate rows and accidentally deleting summary footers.
   - *Mitigation:* Delete in reverse order (`i = summaryStartIndex - 1` down to `delete_sample_rows_from`), preserving intact lower indices.
8. **Stale Template Lifecycle:**
   - *Scenario:* User unlocks briefing and uploads a different quote, but old `template.docx` remains on disk.
   - *Mitigation:* Unlocking briefing cleans up `storage/<company_id>/template.docx` if it exists.


---

## 7. Acceptance Criteria

- [x] Install `docxmlater@12.1.0` in `prototypes/new-auto-proposal/backend/package.json`.
- [x] Install `docx-preview` in `prototypes/new-auto-proposal/frontend/package.json`.
- [x] Implement `template-mutator.service.ts` in backend supporting:
  - [x] `replace_text_run` with `context_anchor` matching and native `replaceTextCrossRun` handling.
  - [x] `replace_table_cell` with hybrid table resolution (candidate index + semantic row fallback).
  - [x] `wrap_conditional_row` with cross-cell `{#flag}` and `{/flag}` injection.
  - [x] `collapse_repeating_table` with header preservation (Row 0), loop row synthesis (Row 1 with `{#loop}` in Cell 0 and `{/loop}` in last Cell), reverse-order redundant sample row deletion, and summary footer preservation.
- [x] Implement API endpoints:
  - [x] `POST /api/companies/:id/template/generate` (executes mutation and saves `storage/<company_id>/template.docx`).
  - [x] `GET /api/companies/:id/template/download` (streams binary `.docx`).
- [x] Build `TemplateCheckpointCard.tsx` with:
  - [x] Status banner ("Dynamic Template Generated Successfully") with tag & loop counts.
  - [x] `[ Quick Preview (.docx) ]` modal embedding `docx-preview`.
  - [x] `[ Download Template .docx ]` download button.
  - [x] Primary advance button `[ Proceed to Pricing Engine ➔ ]`.
- [x] Hook mutation statistics and tag placement records into Bottom Dev Dock Tab 5 (`Pipeline Logs`).
- [x] Verify generated `template.docx` for Northstar (`co1_seo`), Fortress IT (`co2_msp`), and Fieldstone (`co3_dev`):
  - [x] Opens in Microsoft Word without schema repair warnings.
  - [x] Preserves all cell background shading `<w:shd>`, borders, and bold fonts.
  - [x] Contains clean single-brace tags (`{client_name}`, `{selected_tier}`) and loop syntax (`{#items}...{/items}`).

