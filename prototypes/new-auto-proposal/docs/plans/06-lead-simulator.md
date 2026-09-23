# Plan: Issue 06 — Lead Simulator, Proposal Generation, and Verification

Paths are relative to `prototypes/new-auto-proposal/` unless noted. Ticket: [`.scratch/new-auto-proposal/issues/06-lead-simulator-proposal-generation-and-verification.md`](../../../../.scratch/new-auto-proposal/issues/06-lead-simulator-proposal-generation-and-verification.md). Spec: [`.scratch/new-auto-proposal/spec.md`](../../../../.scratch/new-auto-proposal/spec.md) §5.

## Context

Stage 5 of the prototype pipeline. A pasted inbound lead message becomes (1) structured lead facts the user can see and fix, (2) exact numbers from the Stage 4 calculator, (3) drafted narrative paragraphs that never contain a model-typed number, and (4) a hydrated `.docx` plus a `.pdf`, previewed in the browser and downloadable. When the message lacks a required fact, the stage stops at the facts form and drafts a clarification email instead; when the rules say "needs review", it declines to produce a document.

Most of the machinery already exists: `POST /rules/calculate` returns `{evaluation, payload}` where `buildProposalPayload` (`pricing-calculator.ts:330`) fills every pricing tag, `has_*` boolean, loop array and the tier matrix in the quotation's notation. Stage 5 only fills the gaps the payload leaves — Stage 2 `customer_input` variables (`client_name`, dates) and `ai_generated` paragraph variables — and renders.

**Decided with the user (2026-09-16/18):**
- Two endpoints, run back-to-back by the UI: `POST /lead/extract` (message → facts) and `POST /proposal/generate` (**structured facts** → document). `generate` never re-reads the email; production separates these steps too (a human or a clarification email sits between them).
- Missing required fact → stop at the facts form (field highlighted) **and** draft a clarification email (`POST /lead/clarify`, separate call so a rep who just types the fact never pays for it). Not sent — shown with a Copy button; the form stays editable so the demo can continue by hand.
- `evaluation.needs_review` non-empty → **no document**; a "Declined to auto-quote" panel lists the reasons. No clarification email for this case.
- Dev-only seeds (`pricing_spec`, `sample_lead_text`) move to a **separate file** `Mock Data/test_seeds.json`; `companies_dataset.json` keeps only what the main backend imports (`pricing_engine_spec` is removed from it). `sample_lead_text` is not stored — the company response attaches it from the file and the Stage 5 textarea starts with it (as `PromptDocCapsule` starts with `pricing_spec`). "Reset to mock default" stays and re-seeds from both files.
- No `proposals` table, no persistence of runs. Files overwrite `storage/<id>/proposal.docx` / `proposal.pdf`; a refresh loses the on-screen result, the files stay downloadable.
- Dates are code, not model: Stage 2 gains `data_type: "date"`; Stage 5 fills every date customer input deterministically (earliest sample date → today, the others keep their offset, sample format and suffix kept). Fallback for old extractions: a `string` whose sample parses as a month-name date (`ponytail:`). Seller-owned values (validity days, payment terms) are compiled as constants, never asked (seen live on co1 and co2).
- Drafter writes `{tag}` placeholders, never numbers; one model call for all `ai_generated` paragraphs, every paragraph a required field.
- Extractor `assumptions[]` (range picked, number words, inferred devices) shown as an amber strip under the facts form.
- PDF via LibreOffice headless (`soffice --headless --convert-to pdf` spawned directly with a persistent profile; `libreoffice-convert` was tried and dropped — a fresh profile per run costs 20–30 s and its harmless stderr "parser error" is mistaken for failure; same binary in a Docker image in production). PDF failure never fails the run: `pdf: null` + reason, docx still returned.
- Preview = the PDF in an `<iframe>`; `docx-preview` is not used on Stage 5. No benchmark banner / `sampleCheck` on Stage 5.
- Left panel = facts form + numbers ledger only; prose is visible in the preview.

## 1. Contracts

### 1.1 Lead facts (`LeadFacts`)
Built per company, nothing hardcoded:
- every `kind: "input"` variable of the rules (`name`, `input_type` integer | number | boolean | choice | multi_choice | region | text, `options`, `required`, `default?`, `assume_when?`);
- plus every Stage 2 `customer_input` variable that no rule variable defines (constants count) and is not a date (e.g. `client_name`) — required, `text`.

Extractor response schema: one **required** property per field (`null` when the message does not say it), plus `assumptions: string[]` (required, may be empty). Rules in the prompt: number words → digits; a range → the higher end, noted in `assumptions`; never infer a state/jurisdiction that is not stated; choice values must be one of `options` (case-insensitive, the option's spelling is returned).

`POST /api/companies/:id/lead/extract` body `{ lead_text }` → `{ success, fields: LeadField[], inputs, missing: string[], assumptions: string[], assumed: string[] }` (`fields` = the form definition above, so the UI renders the right control per fact) where `missing` = required fields still `null` after `fillDefaults` filled every blank field that has a `default` (those names are `assumed`). 400 when `lead_text` is empty or > 12,000 chars; 409 when `stage !== "lead_simulation"` or no rules. Raw response logged via `logPipelineArtifact(id, "lead-raw", …)`.

### 1.2 Clarification email
`POST /api/companies/:id/lead/clarify` body `{ lead_text, inputs, missing }` → `{ success, subject, body }`. Prompt inputs: company basics, `clarification_notes` + `style_notes` (Voice drawer; empty → built-in default), the natural names of the missing fields, the lead text. Logged as `clarify-raw`.

### 1.3 Proposal generation
`POST /api/companies/:id/proposal/generate` body `{ inputs, lead_text }` →
```
{ success: true, evaluation, payload, narrative: { [name]: { text, tags_placed: string[] } },
  files: { docx: "/api/companies/:id/proposal/download?format=docx", pdf: <same with pdf> | null }, pdf_error?: string }
```
or `{ success: false, declined: true, needs_review: [...] , evaluation }` (200, no document) when `evaluation.needs_review` is non-empty, or 400 when required inputs are missing.

Steps inside `proposal-generator.service.ts`:
1. `evaluate(rules, inputs)`; decline on `needs_review`.
2. `buildProposalPayload(rules, evaluation, stage2, tier_matrix)` — the pricing half.
3. Customer inputs: `payload[name] = inputs[name]` for the extracted text fields; dates via `fillDates(stage2Variables, today)` (§1.4).
4. Narrative: one `generateJson` call (§1.5); substitute `{tag}` → `payload[tag]` for known keys; unknown tags are stripped and reported in `tags_placed` diagnostics; `payload[paragraph_name] = text`.
5. `easy-template-x` `TemplateHandler.process(template.docx, payload)` → `storage/<id>/proposal.docx`.
6. headless `soffice` → `storage/<id>/proposal.pdf`; on error `pdf: null`, `pdf_error`.
7. Log `proposal-payload` and `narrative-raw` artifacts.

`GET /api/companies/:id/proposal/download?format=docx|pdf[&download=1]` — the PDF is served `inline` (so the Stage 5 `<iframe>` renders it instead of downloading); `download=1`, and any `.docx`, get `Content-Disposition: attachment; filename="Proposal - <client_name>.<ext>"`. 404 with a message when the file is absent.

### 1.4 Dates (`fillDates`)
Date customer inputs = `data_type === "date"` **or** (fallback, `ponytail:`) a `string` whose `sample_value` starts with a parseable month-name date. Earliest sample = anchor → `today`; every other date = today + (sample − anchor). Output keeps the sample's format (`September 7, 2026`) and any trailing suffix (` (14 days)`), suffix left verbatim. Pure function, unit-tested.

### 1.5 Narrative drafter
Prompt sections: company profile (name, value proposition, industry); voice (`style_notes`, optional `reference_proposal_text` as a few-shot); the lead message; the lead facts (natural names + values); AVAILABLE TAGS — every payload key with its formatted value, and the instruction "write `{tag}` wherever a number, price, tier name, count or date belongs; never type the value"; one block per `ai_generated` paragraph with its `sample_value` (structure reference), `purpose`, `tone`, `length_guideline`, `guidance`, and which tags were `covered` by it (must appear). Response schema `{ [paragraph_name]: string }`, all required. Fixed-mode paragraphs are not drafted (they are static text in the template).

## 2. Sub-feature A — seeds & the `date` type (small, separate commit)
- `Mock Data/test_seeds.json`: `{ note, companies: [{ company_id, pricing_spec, sample_lead_text }] }` for co1/co2/co3 (pricing text moved from `companies_dataset.json`, emails from `verification_guide.md` §1.2/2.2/3.2).
- `backend/src/db/seed.ts`: `loadSeeds()` (same candidate-path lookup); `upsertCompany` takes `pricing_spec` from the seed entry (`""` when absent); drop `pricing_engine_spec` from `CompanyRecord`.
- `routes/companies.ts` `formatCompanyResponse`: attach `sample_lead_text` from the seeds (`""` when absent). Frontend `types/company.ts` gains `sample_lead_text: string`.
- `gemini.service.ts` / `deepseek.service.ts` extraction schema + prompt: `data_type` enum adds `"date"` ("proposal dates and validity dates"); frontend `VariableDataType` adds `"date"`.
- Tests: `companies.test.ts` asserts the seeded spec still lands and `sample_lead_text` is returned.

## 3. Sub-feature B — backend services & routes
New files: `services/lead-extractor.service.ts` (schema builder + call + `missing`), `services/clarification-drafter.service.ts`, `services/narrative-drafter.service.ts` (prompt + substitution), `services/proposal-generator.service.ts` (steps §1.3, `fillDates`, docx + pdf), `routes/proposal.ts` (4 routes above), registered in `app.ts`.
- No new dependency: `execFile` on the soffice binary (`SOFFICE_PATH` env, documented in `.env.example`, then the platform default paths); persistent profile in the temp dir (storage/ has spaces in its path and soffice fails silently on a spaced profile URL).
- Hard-reset: `briefing/unlock`, `template` regeneration and `rules/compile` also delete `storage/<id>/proposal.docx|pdf` (one helper `clearProposalFiles(id)`).
- Tests (offline, `npm test`): `fillDates`; placeholder substitution (known/unknown tags, `covered` tags); extractor schema builder for the co1/co2/co3 rules fixtures (field list + required flags); generation end-to-end with a stubbed model on the co1 fixtures → `proposal.docx` converted with `@firecrawl/anydoc` contains `$35,073.00` and no `{`/`}` left; routes: 409 before Stage 5, 400 on missing inputs, declined path. Live model calls only in `test:live`.

## 4. Sub-feature C — frontend
- `components/LeadSimulator.tsx`, rendered by `CompanyProfileCard.tsx` under the pricing deck when `company.stage === "lead_simulation"`.
- Textarea (Stage 1 fluid pattern, starts with `company.sample_lead_text`) + `[ Generate proposal ➔ ]`. Shimmer bar (`.shimmer-bar`) during extract / clarify / generate; explicit error panel with retry, never a stuck shimmer.
- Flow: extract → if `missing.length` → facts form with the missing fields highlighted + clarification email card (subject, body, Copy) → user fills → `[ Generate ]`; else auto-continue to generate.
- Split view (`lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`): left = facts form (inputs by type: integer, boolean switch, choice dropdown, multi-choice chips, state/text) + amber assumptions strip + numbers ledger (in-document money/percent/integer variables in `evaluation.order`, `font-mono tabular-nums`, last money value emphasised) or the "Declined to auto-quote" panel; right = `<iframe src={files.pdf}>` (inline; the download button appends `&download=1`) or "PDF preview unavailable — download the .docx" + `[ Download .docx ]` `[ Download .pdf ]` (`bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`).
- `services/api.ts`: `extractLead`, `draftClarification`, `generateProposal`; `types/proposal.ts` for the contracts. `DevDock.tsx`: stage label already covers `lead_simulation`; the logs tab picks up the new artifacts automatically.

## 5. Sub-feature D — doc drift to flag (do NOT apply without user confirmation)
- `AGENTS.md` / `CLAUDE.md` §2 & §5: "Reset to Mock Default re-seeds from `companies_dataset.json`" → from `companies_dataset.json` + `test_seeds.json`; `docx-preview` is Stage 3 only, Stage 5 previews the PDF.
- `docs/plan.md` §2 Stage 5 box and §4.4; `docs/design.md` §2 Stage 5 box and §3.5 (PDF iframe, facts form, clarification card, declined panel; "Load Sample Inquiry" button replaced by prefill).
- `.scratch/new-auto-proposal/spec.md` §5 API list.

## 6. Assumptions & known ceilings (stated, not blocking)
- Clarification and generation are separate model calls; the extract→generate hop is two HTTP requests (fine for a harness; production would queue them).
- Date offsets are calendar days from the sample; a "(14 days)" suffix is copied, not recomputed (`ponytail:` — parse the suffix when a template needs it).
- One `soffice` process per run (~10–20 s on Windows with the warm profile); production runs the same converter in a container with a warm instance.
- Unknown `{tags}` written by the drafter are stripped, not retried.

## 7. Verification
- `npm test` green (new tests in §3). `npm run test:live` extended with one extract + one narrative call on co1.
- Manual: co1 sample → Growth, `$35,073.00`, PDF preview, both downloads; co2 sample → Standard, `$2,734.80` / `$3,150.00`; co3 sample → E-Commerce + Copywriting + SEO, `$10,445.00`; co2 message with the last sentence removed → stops with `client_state` missing + clarification email; co3 "140 products" → declined panel, no files.
