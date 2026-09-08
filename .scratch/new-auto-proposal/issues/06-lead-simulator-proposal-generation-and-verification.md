# 06: Lead Simulator, Proposal Generation, and Verification

**What to build:** An end-to-end proposal generation simulator and verification harness. The tenant provides an unstructured inbound inquiry email via a freeform textarea or clicks a "Load Sample Lead Message" button (pre-loading Bloom & Co for Northstar, Whitfield for Fortress, or Rosewood for Fieldstone). Clicking "Generate Proposal" triggers Gemini to extract structured lead parameters (seats, locations, addons, state), passes them to the deterministic math engine to compute exact prices and line items, directs Gemini to draft personalized narrative paragraphs using configured prompt tips, and invokes `easy-template-x` to hydrate the `template.docx` into a completed `.docx` proposal. The resulting proposal is rendered in the browser via `docx-preview`, accompanied by an instant download button and a verification banner checking calculated totals against ground truth.

**Blocked by:** 04: docXMLater Word Template Mutation and In-Browser Preview, 05: Pricing Compiler, Visual Rule Cards, and Deterministic Math

**Status:** ready-for-agent

- [ ] Install `easy-template-x` in backend dependencies.
- [ ] Implement backend endpoint `POST /api/companies/:id/lead/extract` using Gemini to extract lead parameters (seats, locations, selected package/addons, state, billing preference) from raw email text.
- [ ] Implement backend endpoint `POST /api/companies/:id/proposal/generate` that:
  1. Calls parameter extraction on the inbound email.
  2. Executes deterministic math calculation to compute line items, taxes, and totals.
  3. Generates tailored sales narratives for AI paragraph variables based on lead pain points and prompt tips.
  4. Merges computed data and narrative into `storage/<company_id>/template.docx` via `easy-template-x`.
  5. Saves output to `storage/<company_id>/generated_proposal.docx`.
- [ ] Provide download endpoint `GET /api/companies/:id/proposal/download`.
- [ ] Build Lead Simulation Panel in the frontend with inquiry textarea and "Load Sample Lead Message" pre-fill button.
- [ ] Embed `docx-preview` container to display the generated proposal `.docx` directly in the browser DOM.
- [ ] Add "Download Generated Proposal .docx" button.
- [ ] Build Verification Status Banner comparing output numbers with `verification_guide.md` ground truth ($35,073.00, $2,734.80/mo + $3,150.00, $10,445.00) and showing green checkmarks when exact match is achieved.
