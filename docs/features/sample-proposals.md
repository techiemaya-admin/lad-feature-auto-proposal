# Sample proposals

Paths below are relative to repo root.

Pipeline: [architecture.md](../architecture.md). Screen behaviour: [ui.md](../ui.md) §3.2. Pricing contract: [pricing-engine.md](pricing-engine.md).

## Purpose and workflow

A saved template can create its own sample Word proposal instead of requiring an existing quotation upload. This works for both ICP-generated and custom library cards. Import ICP still creates three briefs, not three documents; document generation happens inside the selected template's briefing.

1. Open a template and review its pricing brief.
2. Click **Generate sample proposal**. The AI selects services relevant to this template and creates a fictional customer and requirements. Code calculates prices and creates and attaches the Word file automatically.
3. Review the customer, scenario, totals, pricing sources and **Sample assumptions and accuracy notes** in the frontend. Download the attached document if desired.
4. Optionally edit the sample or add sections. Reviewed edits require complete pricing inputs and confirmation before rebuilding the document.
5. Click the usual **Send** button to persist the document and briefing. Continue through Variable Ledger, Draft Proposal, Pricing Engine and Lead & Proposal (the Stage 4 button reads **Proceed to Check & Generate Proposal**).

The sample is a concrete example from which the reusable template is built. Its prose, sections, service rows, numbers and layout are inputs to extraction and mutation. The final customer proposal still uses the lead and the separately compiled pricing rules. Generating a sample does not replace these later stages or send anything to a customer. Uploading an existing Word quotation remains supported.

## Design decisions

- Sample generation is a Stage 1 shortcut, not a separate pipeline: its document enters the same extraction and mutation flow as an upload.
- The model proposes a calculation plan; `pricing-calculator.ts` owns every number.
- Estimates are explicit and never modify the authoritative pricing brief or Stage 5's handling of missing lead data.
- Review notes live in `working_state_json.sample_review_notes`, outside document content.
- Custom sections become ordinary paragraphs in the Variable Ledger, not a separate conditional engine.

## AI context and pricing

The model receives the saved company profile (`data_json`), company name, selected template name and description, and the pricing brief currently in the editor, including unsaved edits. It uses the configured shared AI provider/model. The selected offer and B2B/B2C context guide the fictional scenario. It includes relevant services and mandatory fees rather than every service the company sells.

The pricing brief is authoritative. Stated rates, bands, commitments, discount restrictions, taxes and setup fees should be retained. Missing seller inputs do not leave an incomplete sample or print “To confirm”: the model supplies explicit illustrative assumptions, and code produces a fully priced document. Approximate or starting rates in the brief take precedence over invented estimates. Unknown tax can be represented as an explicitly noted 0% sample assumption; that does not establish tax exemption. Currency, billing and conflicting-rule interpretations are also explained in frontend notes when uncertain.

The AI returns a calculation plan, not trusted final totals:

- Literal inputs are classified as `brief`, `scenario` or `assumption`; derived nodes use `formula`.
- Brief literals require a verbatim source quote containing the number. Fictional scenario inputs are positive whole quantities, not seller prices, taxes or discounts.
- Assumption literals require an explanation. Code automatically adds an accuracy note for each numeric estimate, even if the model omits it from its notes.
- Allowed operations are `literal`, `add`, `sub`, `mul`, `div`, `min` and `max`. References point to earlier nodes; arbitrary code is not evaluated. Reserved constants are zero, one, hundred and months per year.
- Rates must derive from brief or assumption inputs. Scenario inputs cannot supply tax or discount policies. Invalid references, cycles, unsupported operations and invalid arithmetic are rejected.

`pricing-calculator.ts` evaluates the plan and calculates line prices. Rates are rounded to cents; discounts precede tax, with cent rounding. Totals are grouped separately for one-time, monthly and annual charges, rather than summing incompatible billing periods. Invalid AI output receives one automatic correction attempt; a second invalid response fails instead of producing an incomplete document.

Validation limits include 1–8 service lines, whole quantities from 1–10,000, rates from 0–1,000,000, discount/tax percentages from 0–100 with at most two decimal places, and at most 80 calculation nodes. Pricing briefs are limited to 20,000 characters. Manual rebuilds also require complete numeric fields, currency and billing periods.

These checks validate structure, arithmetic and quoted evidence; they cannot prove that the AI interpreted every commercial rule correctly. Assumptions do not modify the authoritative pricing brief. Review them before using the sample for pricing verification: estimated sample values may disagree with the later compiled rules. Sample estimates never alter the Stage 4 rules or Stage 5's handling of incomplete real lead data.

## Custom sections

**Add section** is available beside the generation button while the briefing is unlocked, including before a draft exists. If necessary, it first generates the base sample and then opens the editor. Up to eight sections can be added, edited, removed or reordered. Each has a title, body and position:

| Position | Location |
| --- | --- |
| `before_scope` | After the overview |
| `before_pricing` | After the scope |
| `before_terms` | Before the terms |
| `after_terms` | After the terms |

Array order is preserved within each position. Titles allow 120 characters, bodies 4,000 and AI instructions 2,000; template braces and control characters are rejected.

Users can write the body themselves or generate/regenerate it with AI. Section generation receives company/template context, the current brief, sample scenario and scope, other sections, and the user's instructions. It returns short plain-text prose without changing line items or calculated totals.

A “Room to grow” section should propose supported upgrades outside the quoted scope, explicitly optional and subject to separate agreement. If no supported upgrade exists, it should discuss future needs rather than invent an offering, price or guarantee.

Sections become ordinary Word paragraphs and enter the Variable Ledger. Users can review fixed versus AI-adjusted content there. This does not introduce a separate conditional whole-section engine. Section editing state is transient: after reload or navigation, regenerate a sample to reopen this editor. The submitted Word document itself persists. Full regeneration preserves the sections still in the editor; incomplete sections must be filled or removed first.

## Word appearance and compatibility

The sample uses Letter pages, approximately three-quarter-inch margins, Calibri body text, a larger title, navy section headings and pale divider rules. Pricing tables use a navy header, alternating light rows, padding, borders, right-aligned numbers and emphasized totals. Headers repeat across pages, table rows stay together, and headings stay with subsequent content. Custom sections use the same styling.

Only proposal content appears in Word: seller/customer/date, requirements, overview, scope, investment, terms and custom sections. Internal accuracy notes, missing-information checklists and calculation instructions are excluded. Auto-generated core prose rejects “To confirm,” “To be agreed,” “To be confirmed” and “TBD.” Notes appear only in the frontend, including the locked briefing summary.

`word-document-buffer.ts` materializes the ZIP entries with JSZip and `streamFiles: false`. LibreOffice rejects streamed ZIP headers from `docxmlater`; `streamFiles: false` avoids that general input/output error without changing the document parts. Both sample generation and template mutation use this helper. JSZip is a direct backend dependency. Existing documents need regeneration to receive the styling and ZIP handling.

## API and persistence

All endpoints below use `/api/companies/:companyId/templates/:templateId` as their prefix and require a template owned by that company.

| Endpoint | Request | Result |
| --- | --- | --- |
| `POST /briefing/sample-draft` | `pricing_spec`, optional `sections` | JSON containing `draft`, `customer`, `currency`, `scenario`, `questions`, `lines`, `pricing_sources`, `totals`, and `document_base64` |
| `POST /briefing/sample-document` | `draft`, `customer`, `currency`, `lines`, `confirmed: true`; optional `scenario`, `questions`, `sections` | Word attachment named `generated_sample_proposal.docx` |
| `POST /briefing/sample-section` | `pricing_spec`, `scenario`, `scope`, optional `sections`, and `section` with title, position and optional instructions | `{section: {title, content, position}}` |

These are previews: they do not persist the generated document. Missing/foreign templates return 404, locked briefings return 409, invalid input returns 400, invalid AI responses return 502, and unexpected errors return 500. Existing workflow write serialization also applies.

The ordinary multipart `/briefing/submit` accepts optional `sample_review_notes`, encoded as a JSON array of up to 80 strings of at most 1,000 characters. The response field is named `questions` for compatibility; it contains these explanatory notes.

Submitting:

- stores the file as `backend/storage/<company_id>/<template_id>/original_quotation.docx` and uses the normal filename metadata, AnyDoc Markdown conversion and downstream reset/locking flow;
- persists notes separately in `working_state_json.sample_review_notes`; they survive restart and briefing unlock;
- clears previous notes when a replacement file arrives without notes, and preserves them when the same file is resubmitted without notes;
- needs no database migration or extra table.

The frontend:

- prevents Send while generation/review is open;
- tracks which brief produced the attached generated file, so changing the brief requires regeneration before Send;
- clears that association and generated review notes when a manual replacement is uploaded;
- ignores stale async results after a brief change or unmount, and revokes replaced download URLs;
- uses the existing reset confirmation when a locked briefing is edited, clearing downstream work.

## Where this lives

| File | Responsibility |
| --- | --- |
| `backend/src/services/sample-proposal.service.ts` | AI sample planning, evidence and calculation validation, retry, complete input checks and styled Word generation |
| `backend/src/services/sample-sections.service.ts` | Section validation and context-aware AI drafting |
| `backend/src/services/pricing-calculator.ts` | Deterministic sample arithmetic, rounding and billing-period totals |
| `backend/src/services/word-document-buffer.ts` | LibreOffice-compatible ZIP serialization |
| `backend/src/services/template-mutator.service.ts` | Uses the shared Word buffer helper |
| `backend/src/routes/briefing.ts` | Preview endpoints and submission/unlock persistence of notes |
| `backend/package.json`, `backend/package-lock.json` | Direct JSZip dependency |
| `backend/src/tests/sample-proposal.test.ts` | Pricing, generation, sections, document and persistence regressions |
| `frontend/src/components/SampleProposalBuilder.tsx` | Generation, optional editing, confirmation, notes and attachment state |
| `frontend/src/components/SampleSectionsEditor.tsx` | Section controls and AI drafting |
| `frontend/src/components/PromptDocCapsule.tsx` | Builder integration, downloads, brief association, Send gating and persisted notes display |
| `frontend/src/components/CompanyProfileCard.tsx`, `frontend/src/App.tsx` | Pass notes through briefing submission |
| `frontend/src/services/api.ts` | Includes notes in multipart submission |
| `frontend/src/types/company.ts` | Types persisted sample review notes |

## Verification

Run `npm test` and `npm run typecheck` from `backend`, and `npm run build` from `frontend`. Tests stub AI calls; these results do not establish live model quality. LibreOffice opening is checked through headless PDF conversion and visual inspection.

Regression coverage:

- the three pricing benchmarks (SEO annual 35,073; MSP monthly 2,734.80 plus 3,150 setup; development 10,445);
- contextual offer selection inputs, explicit estimates and their notes;
- invalid evidence/calculations and automatic retry;
- complete manual pricing, ownership and locking, section placement;
- Word ZIP compatibility and notes persistence without document leakage.

For a manual check:

1. Generate from a selected template; inspect its services and totals.
2. Remove a rate from the brief and regenerate; confirm the sample stays fully priced and accuracy notes appear only in the UI.
3. Add a handwritten and an AI-generated section, rebuild, download and open in LibreOffice.
4. Send and reload; verify the document and notes persist.
5. Change the brief; verify stale generated files cannot be sent, then continue through the Variable Ledger and pricing verification.
