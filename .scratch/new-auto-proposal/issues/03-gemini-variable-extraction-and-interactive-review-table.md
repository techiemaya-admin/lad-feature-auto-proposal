# 03: Gemini Variable Extraction and Categorized Review Chip-Deck

**What to build:** An AI-powered variable detection and categorized chip-card interface (`VariableReviewDeck.tsx`). After briefing submission, the backend prompts Google Gemini with the document Markdown and company context to discover dynamic variables conforming to the taxonomy (`natural_name`, `variable_name`, `type`, `description`, `sample_from_quotation`, `context_anchor`). The frontend displays these variables as modular interactive chips organized into three distinct buckets: **Customer Inputs** (`customer_input`), **Pricing Placeholders** (`pricing`), and **Narrative Paragraphs** (`paragraph`), with filter pills and count badges at the top. Tenants can edit natural names inline, change category buckets via a dropdown (moving to paragraph defaults to `[Fixed Boilerplate]`), and delete false positives (which leaves the text as static Word content). Paragraph cards feature a `[Fixed Boilerplate]` vs. `[AI-Generated]` toggle with prompt tip guidance. A `[+ Add Chip]` action allows users to supply an exact quotation text snippet, validated against the document AST in the backend. At the bottom, a `[Confirm Variables & Generate Template ➔]` button advances to template generation.

**Blocked by:** 02: Compound Briefing Capsule and Quotation Ingestion Pipeline

**Status:** ready-for-agent

- [ ] Set up Google Gemini client in backend with `GEMINI_API_KEY` from `backend/.env`.
- [ ] Implement backend service and endpoint `POST /api/companies/:id/variables/extract` prompting Gemini to extract structured variables matching the taxonomy.
- [ ] Create SQLite schema to store and persist discovered variables per company, with endpoints `GET /api/companies/:id/variables` and `PUT /api/companies/:id/variables`.
- [ ] Implement backend endpoint `POST /api/companies/:id/variables/custom` verifying that a user-submitted quotation text snippet exists in the document AST and binding it as a new anchored variable.
- [ ] Build Categorized Variable Review Chip-Deck UI (`VariableReviewDeck.tsx`) with 3 category buckets and filter pills with item counts.
- [ ] Apply 3 deterministic semantic color palettes for instant scannability: Electric Sky (`customer_input`), Mint/Emerald (`pricing`), and Amethyst/Violet (`paragraph`).
- [ ] Implement staggered cascade entrance animation (`animate-in fade-in slide-in-from-bottom-2` with 25ms stagger, max 300ms) when chips load.
- [ ] Implement compact chip-card anatomy with tactile hover lift (`hover:-translate-y-0.5`), inline renaming, type/bucket dropdown, quotation snippet preview, and delete action (retaining static text).
- [ ] Implement paragraph card mode toggle: `[Fixed Boilerplate]` (verbatim quote text editable) vs `[AI-Generated]` (prompt tip input). Default to Fixed when switching to Paragraph.
- [ ] Build `[+ Add Chip]` modal with quotation snippet input and AST text verification.
- [ ] Implement primary `[Confirm Variables & Generate Template ➔]` advance button with ambient gradient glow.
- [ ] Hook raw variables JSON into the Bottom Dev Dock tab.
- [ ] Verify that variable modifications, bucket moves, and custom chips persist across tab switches in SQLite.
