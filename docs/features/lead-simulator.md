# Lead simulator & proposal generation

Stage 5 of the pipeline. A pasted inbound lead message becomes (1) structured lead facts the user can see and fix, (2) exact numbers from the Stage 4 calculator, (3) drafted narrative paragraphs that never contain a model-typed number, and (4) a hydrated `.docx` plus a `.pdf`, previewed in the browser and downloadable. When the message lacks a required fact, the stage stops at the facts form and drafts a clarification email instead. When the rules flag a review reason, the document is still built and marked a draft.

The Stage 4 payload already fills every pricing tag, `has_*` boolean, loop array and the tier matrix in the quotation's notation. Stage 5 fills the gaps the payload leaves — Stage 2 `customer_input` (or `fixed`) variables such as `client_name` and dates, and `ai_generated` paragraph variables — then renders.

Paths relative to repo root. Pipeline overview: [../architecture.md](../architecture.md). Pricing contract: [pricing-engine.md](pricing-engine.md).

## Design decisions

- The UI runs `POST /lead/extract` (message → facts) then `POST /proposal/generate` (**structured facts** → document) back-to-back; `generate` never re-reads the email (production separates these steps too — a human or a clarification email sits between them). Two optional helpers hang off the facts form: `POST /lead/clarify` drafts the ask email and `POST /lead/reply` has the model play the lead so the thread can be re-read.
- Missing required fact → stop at the facts form (field highlighted) **and** draft a clarification email (`POST /lead/clarify`, a separate call so a rep who just types the fact never pays for it). Not sent — shown with a Copy button; the form stays editable so the demo can continue by hand.
- A review flag does not block generation. A human sends every proposal, so the document is built, the reasons are shown to the human, and only the values a reason touches are left blank. No clarification email for this case.
- Dev-only seeds (`pricing_spec`, `sample_lead_text`) live in `Mock Data/seeds/test_seeds.json`; `companies_dataset.json` keeps only what the main backend imports. `sample_lead_text` is not stored — the company response attaches it from the file and the Stage 5 textarea starts with it (as `PromptDocCapsule` starts with `pricing_spec`). "Reset to mock default" re-seeds from both files.
- No `proposals` table, no persistence of runs. Files overwrite `backend/storage/<company>/<template>/proposal.docx` / `proposal.pdf`; a refresh loses the on-screen result, the files stay downloadable.
- Dates are code, not model: Stage 2 gains `data_type: "date"`, and dates are Stage 4 sheet values built from `today` — see [dates.md](dates.md). Seller-owned values (validity days, payment terms) are compiled as constants, never asked.
- Drafter writes `{tag}` placeholders, never numbers; one model call for all `ai_generated` paragraphs, every paragraph a required field.
- Extractor `assumptions[]` (range picked, number words, inferred devices) shown as an amber strip under the facts form.
- PDF via LibreOffice headless (`soffice --headless --convert-to pdf` spawned directly with a persistent profile; `libreoffice-convert` was tried and dropped — a fresh profile per run costs 20–30 s and its harmless stderr "parser error" is mistaken for failure; the same binary runs in a Docker image in production). PDF failure never fails the run: `pdf: null` + reason, docx still returned.
- Preview = the PDF in an `<iframe>`; `docx-preview` is not used on Stage 5. No benchmark banner / `sampleCheck` on Stage 5.
- Layout: facts, assumptions, thread and numbers ledger sit above the result; the generated-proposal card splits narrative (left) and document preview (right).

## 1. Contracts

### 1.1 Lead facts (`LeadFacts`)

Built per company, nothing hardcoded:

- every `kind: "input"` variable of the rules (`name`, `input_type` integer | choice | multi_choice | boolean | region | text, `options`, `required`, `default?`, `assume_when?`);
- plus every Stage 2 `customer_input` (or `fixed`) variable that no rule variable defines (constants count) and is not a date (e.g. `client_name`) — required, `text`.

Extractor response schema: one **required** property per field (`null` when the message does not say it), plus `assumptions: string[]` (required, may be empty). Rules in the prompt: number words → digits; a range → the higher end, noted in `assumptions`; never infer a state/jurisdiction that is not stated; choice values must be one of `options` (case-insensitive, the option's spelling is returned).

`POST /api/companies/:companyId/templates/:templateId/lead/extract` body `{ lead_text }` → `{ success, fields: LeadField[], inputs, missing: string[], assumptions: string[], assumed: string[] }` (`fields` = the form definition, so the UI renders the right control per fact) where `missing` = required fields still `null` after `fillDefaults` filled every blank field that has a `default` (those names are `assumed`). 400 when `lead_text` is empty or > 12,000 chars; 409 when `stage !== "lead_simulation"` or no rules. The raw response is logged as `lead-raw`.

### 1.2 Clarification email

`POST /api/companies/:companyId/templates/:templateId/lead/clarify` body `{ lead_text, inputs, missing, assumed? }` → `{ success, subject, body }`. Prompt inputs: company basics, `clarification_notes` + `style_notes` (Voice drawer; empty → built-in default), the natural names of the missing fields, the lead text. Logged as `clarify-raw`.

### 1.3 Lead reply (simulator)

`POST /api/companies/:companyId/templates/:templateId/lead/reply` body `{ lead_text }` (the thread so far, ending with our ask) → `{ success, subject, body }`. The model plays the lead; the caller appends the reply to the thread and re-extracts. Logged as `lead-reply-raw.json`.

### 1.4 Proposal generation

`POST /api/companies/:companyId/templates/:templateId/proposal/generate` body `{ inputs, lead_text, assumed? }` →

```
{ success: true, evaluation, payload, narrative: { [name]: { text, tags_placed: string[] } },
  files: { docx: "/api/companies/:companyId/templates/:templateId/proposal/download?format=docx&client=…",
           pdf: <same with pdf> | null }, pdf_error?: string }
```

Always this shape: a non-empty `evaluation.needs_review` marks it a draft. `generate` re-applies the server-side defaults and returns 400 with a `missing` list when required inputs are still absent.

Steps inside `proposal-generator.service.ts`:

1. `evaluate(rules, inputs)`; `needs_review` travels with the result.
2. `buildProposalPayload(rules, evaluation, stage2, tier_matrix)` — the pricing half.
3. Customer inputs: `payload[name] = inputs[name]` for the extracted text fields; dates come out of the sheet, evaluated with `today` (§1.5).
4. Narrative: one `generateJson` call (§1.6); substitute `{tag}` → `payload[tag]` for known keys; unknown tags are stripped and reported in `tags_placed` diagnostics; `payload[paragraph_name] = text`.
5. `easy-template-x` `TemplateHandler.process(template.docx, payload)` → `backend/storage/<company>/<template>/proposal.docx`.
6. headless `soffice` → `backend/storage/<company>/<template>/proposal.pdf`; on error `pdf: null`, `pdf_error`.
7. Log `proposal-payload` and `narrative-raw` artifacts.

`GET /api/companies/:companyId/templates/:templateId/proposal/download?format=docx|pdf[&client=…][&download=1]` — the PDF is served `inline` (so the Stage 5 `<iframe>` renders it instead of downloading); `download=1`, and any `.docx`, get `Content-Disposition: attachment; filename="Proposal - <client_name>.<ext>"`. 404 with a message when the file is absent.

### 1.5 Dates

Dates are sheet values built from `today` — see [dates.md](dates.md).

### 1.6 Narrative drafter

Prompt sections: company profile (name, value proposition, industry); voice (`style_notes`, optional `reference_proposal_text` as a few-shot); the lead message; the lead facts (natural names + values); AVAILABLE TAGS — every payload key with its formatted value, and the instruction "write `{tag}` wherever a number, price, tier name, count or date belongs; never type the value"; one block per `ai_generated` paragraph with its `sample_value` (structure reference), `purpose`, `tone`, `length_guideline`, `guidance`, and which tags were `covered` by it (must appear). Response schema `{ [paragraph_name]: string }`, all required. Fixed-mode paragraphs are not drafted (they are static text in the template).

## 2. Seeds and the date type

- `Mock Data/seeds/test_seeds.json`: `{ note, companies: [{ company_id, pricing_spec, sample_lead_text }] }` for co1/co2/co3 (pricing text lives here, not in `companies_dataset.json`; emails come from the verification guide).
- `backend/src/db/seed.ts`: `loadSeeds()` uses the same candidate-path lookup; `upsertCompany` takes `pricing_spec` from the seed entry (`""` when absent); `CompanyRecord` has no `pricing_engine_spec`.
- `routes/companies.ts` `formatCompanyResponse` attaches `sample_lead_text` from the seeds (`""` when absent). Frontend `types/company.ts` has `sample_lead_text: string`.
- `gemini.service.ts` / `deepseek.service.ts` extraction schema + prompt: the `data_type` enum adds `"date"` ("proposal dates and validity dates"); frontend `VariableDataType` adds `"date"`.
- `companies.test.ts` asserts the seeded spec still lands and `sample_lead_text` is returned.

## 3. Backend services and routes

`services/lead-extractor.service.ts` (schema builder + call + `missing`), `services/clarification-drafter.service.ts` (`draftClarification` + `draftLeadReply`), `services/narrative-drafter.service.ts` (prompt + substitution), `services/proposal-generator.service.ts` (steps §1.4, dates from the sheet per [dates.md](dates.md), docx + pdf), `routes/proposal.ts` (five routes above), registered in `app.ts`.

- Dependency: Node's `execFile` on the soffice binary (`SOFFICE_PATH` env, documented in `.env.example`, then the platform default paths); persistent profile in the temp dir (storage/ has spaces in its path and soffice fails silently on a spaced profile URL).
- Hard reset: `briefing/unlock`, `template` regeneration and `rules/compile` also delete that template's `proposal.docx|pdf` through one helper, `clearProposalFiles`.
- Tests (offline, `npm test`): date handling per [dates.md](dates.md); placeholder substitution (known/unknown tags, `covered` tags); extractor schema builder for the co1/co2/co3 rules fixtures (field list + required flags); generation end-to-end with a stubbed model on the co1 fixtures → `proposal.docx` converted with `@firecrawl/anydoc` contains `$35,073.00` and no `{`/`}` left; routes: 409 before Stage 5, 400 on missing inputs, draft-box path. Live model calls only in `test:live`.

## 4. Frontend

- `stages/Stage5LeadSimulator.tsx`, rendered by the template workspace (`App.tsx`) once `working_state.stage === "lead_simulation"`.
- Textarea (Stage 1 fluid pattern, starts with `company.sample_lead_text`) + `[ Generate proposal ➔ ]`. Shimmer bar (`.shimmer-bar`) during extract / clarify / generate; explicit error panel with retry, never a stuck shimmer.
- Flow: extract → if `missing.length` → facts form with the missing fields highlighted + clarification email card (subject, body, Copy) → user fills → `[ Generate ]`; else auto-continue to generate.
- Layout and component details: [ui.md](../ui.md) §3.5. Feature-specific: editable facts by type, the clarification/reply loop, and the generate flow; the ledger, Draft box and preview are screen behaviour owned by that section.
- `services/api.ts`: `extractLead`, `draftClarification`, `draftLeadReply`, `generateProposal`; `types/proposal.ts` for the contracts. `DevDock.tsx` covers the `lead_simulation` stage label; the logs tab picks up the new artifacts automatically.

## 5. Assumptions & known ceilings

- Clarification and generation are separate model calls; the extract→generate hop is two HTTP requests (fine for a harness; production would queue them).
- One `soffice` process per run (~10–20 s on Windows with the warm profile); production runs the same converter in a container with a warm instance.
- Unknown `{tags}` written by the drafter are stripped, not retried.

## 6. Verification

- `npm test` green. `npm run test:live` includes one extract + one narrative call on co1.
- Manual: co1 sample → Growth, `$35,073.00`, PDF preview, both downloads; co2 sample → Standard, `$2,734.80` / `$3,150.00`; co3 sample → E-Commerce + Copywriting + SEO, `$10,445.00`; co2 message with the last sentence removed → stops with `client_state` missing + clarification email; co3 "140 products" → the proposal is built and flagged for review, with the affected values marked `[to confirm]`.
