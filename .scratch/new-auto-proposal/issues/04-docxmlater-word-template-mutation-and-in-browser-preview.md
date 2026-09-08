# 04: docXMLater Word Template Mutation and Minimal Checkpoint Preview

**What to build:** An AST-safe Word document mutation pipeline that converts the uploaded quotation into a dynamic template, followed by a minimal inline confirmation checkpoint (`TemplateCheckpointCard.tsx`). When the tenant confirms variables and clicks "Confirm Variables & Generate Template", the backend uses `docxmlater` to locate text anchors and replace them with `{variable_name}` tags without corrupting Word run formatting. For repeating table structures, it identifies line-item tables, converts the first sample row into a loop row (`{#items} {item_name} | {item_price} {/items}`), deletes duplicate sample rows, and strictly preserves table headers (Row 0) and summary footers (Subtotal, Tax, Total, Terms). The resulting template is saved to `storage/<company_id>/template.docx`. In the frontend, rather than a heavy, blocking canvas, the system presents a sleek, low-profile confirmation card detailing placed tags and collapsed loops, an optional "Quick Preview (.docx)" modal using `docx-preview`, a download button, and a primary `[Proceed to Pricing Engine ➔]` button to maintain flow momentum.

**Blocked by:** 03: Gemini Variable Extraction and Categorized Review Chip-Deck

**Status:** ready-for-agent

- [ ] Install `docxmlater` in backend and `docx-preview` in frontend dependencies.
- [ ] Implement backend mutation service and endpoint `POST /api/companies/:id/template/generate` using `docxmlater` to load `original_quotation.docx` and perform anchor text run replacements with `{tags}`.
- [ ] Implement smart table loop collapsing: detect line-item table index, insert `{#items}` loop syntax into row 1, prune redundant item rows, and preserve header and summary footer rows.
- [ ] Save the generated file to `storage/<company_id>/template.docx` and provide download endpoint `GET /api/companies/:id/template/download`.
- [ ] Build Minimal Template Checkpoint Card (`TemplateCheckpointCard.tsx`) displaying tag replacement count, loop status, and quick advance button `[Proceed to Pricing Engine ➔]`.
- [ ] Implement optional "Quick Preview (.docx)" modal embedding `docx-preview` for on-demand inspection.
- [ ] Add "Download Template .docx" button.
- [ ] Hook AST replacement logs and mutation statistics into the Bottom Dev Dock tab.
- [ ] Verify generated `.docx` template opens cleanly in Microsoft Word without schema repair errors and contains all expected `{tag}` and `{#loop}` markers.
