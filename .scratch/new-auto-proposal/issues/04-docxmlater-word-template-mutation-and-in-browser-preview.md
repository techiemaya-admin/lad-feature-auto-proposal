# 04: docXMLater Word Template Mutation and In-Browser Preview

**What to build:** An AST-safe Word document mutation pipeline that converts an uploaded `.docx` quotation into a dynamic template. When the tenant confirms variables and clicks "Generate Word Template", the backend uses `docxmlater` to locate text anchors and replace them with `{variable_name}` tags without corrupting Word run formatting. For repeating table structures, it identifies line-item tables, converts the first sample row into a loop row (`{#items} {item_name} | {item_price} {/items}`), deletes duplicate sample rows, and strictly preserves table headers (Row 0) and summary footers (Subtotal, Tax, Total, Terms). The resulting template is saved to `storage/<company_id>/template.docx`. In the frontend, the user sees an in-browser preview rendered via `docx-preview` and a "Download Template .docx" button.

**Blocked by:** 03: Gemini Variable Extraction and Interactive Review Table

**Status:** ready-for-agent

- [ ] Install `docxmlater` in backend and `docx-preview` in frontend dependencies.
- [ ] Implement backend mutation service and endpoint `POST /api/companies/:id/template/generate` using `docxmlater` to load `original_quotation.docx` and perform anchor text run replacements with `{tags}`.
- [ ] Implement smart table loop collapsing: detect line-item table index, insert `{#items}` loop syntax into row 1, prune redundant item rows, and preserve header and summary footer rows.
- [ ] Save the generated file to `storage/<company_id>/template.docx` and provide download endpoint `GET /api/companies/:id/template/download`.
- [ ] Build Template Preview panel in the frontend embedding `docx-preview` to render the Word document layout inside a canvas/DOM container.
- [ ] Add "Download Template .docx" action button.
- [ ] Add collapsible Reviewer Dropdown showing replacement logs and AST mutation details.
- [ ] Verify generated `.docx` template opens cleanly in Microsoft Word without schema repair errors and contains all expected `{tag}` and `{#loop}` markers.
