# 02: Quotation Upload and AnyDoc Markdown Inspection

**What to build:** An end-to-end quotation document ingestion pipeline. The tenant can upload a real Microsoft Word (`.docx`) proposal file using a drag-and-drop / file selector, or click a 1-click "Load Sample Quotation" button pre-configured for each company from `Mock Data/`. The backend stores the file under `storage/<company_id>/original_quotation.docx`, immediately converts it into semantic GitHub-Flavored Markdown using `@firecrawl/anydoc`, and returns the extracted Markdown along with document metadata to the frontend. The frontend displays the file status and renders the Markdown output inside an expandable "Extracted Document Markdown" reviewer dropdown.

**Blocked by:** 01: Foundation and Multi-Company Shell

**Status:** ready-for-agent

- [ ] Install `@firecrawl/anydoc` and `multer` in backend dependencies.
- [ ] Configure Multer storage to route uploaded `.docx` files to `storage/<company_id>/original_quotation.docx`.
- [ ] Implement backend route `POST /api/companies/:id/quotation/upload` accepting `.docx` uploads and converting them to Markdown via `@firecrawl/anydoc`.
- [ ] Implement backend route `POST /api/companies/:id/quotation/load-mock` to automatically copy the company's corresponding `.docx` from `Mock Data/` and convert to Markdown.
- [ ] Store document metadata (filename, size, extracted markdown, parse timestamp) in SQLite.
- [ ] Build Quotation Ingestion card in the frontend with upload dropzone and "Load Sample Quotation" quick-action button.
- [ ] Render a collapsible "Reviewer Inspection: AnyDoc Markdown Preview" accordion displaying the extracted headings, paragraphs, and tables.
- [ ] Verify that uploading all three sample documents (`Proposal_Northstar`, `Proposal_FortressIT`, `Proposal_Fieldstone`) produces clean, readable Markdown in the inspector.
