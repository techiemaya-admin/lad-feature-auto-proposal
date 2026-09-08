# 03: Gemini Variable Extraction and Interactive Review Table

**What to build:** An AI-powered variable detection and management interface. When the quotation is uploaded or when clicking "Analyze Variables", the backend invokes Google Gemini with the document's Markdown representation and the company profile to discover dynamic variables conforming to the 4-tier taxonomy (`natural_name`, `variable_name`, `type`, `description`, `sample_from_quotation`, `context_anchor`). The frontend renders an interactive, editable table displaying these variables. Tenants can modify natural names, rename variable keys, change types (`customer_input`, `pricing`, `paragraph`), and delete false positives. For paragraph variables, tenants can toggle between `[Fixed]` (revealing an editable text area pre-filled with the quote text) and `[AI-Generated]` (revealing a prompt tip input). A modal allows adding custom variables by pasting or selecting quotation text.

**Blocked by:** 02: Quotation Upload and AnyDoc Markdown Inspection

**Status:** ready-for-agent

- [ ] Set up Google Gemini client in backend with `GEMINI_API_KEY` from `backend/.env`.
- [ ] Implement backend service and endpoint `POST /api/companies/:id/variables/extract` that prompts Gemini with document Markdown and company context to extract structured variables matching the taxonomy.
- [ ] Create SQLite schema to store and persist discovered variables per company, with endpoints `GET /api/companies/:id/variables` and `PUT /api/companies/:id/variables`.
- [ ] Implement backend endpoint `POST /api/companies/:id/variables/custom` allowing the user to submit a quotation text snippet to be analyzed and added as a new variable.
- [ ] Build Variable Review Table UI using Shadcn Table with inline edit inputs for natural name, variable name, and category dropdown.
- [ ] Implement paragraph variable mode switcher: [Fixed | AI-Generated], rendering prefilled quote text for Fixed or prompt tip for AI-Generated.
- [ ] Build "Add Custom Variable" dialog modal with quotation snippet input and AI binding.
- [ ] Verify that variable modifications and custom variables persist across tab switches in SQLite.
