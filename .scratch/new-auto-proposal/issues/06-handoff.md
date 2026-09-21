# Handoff: implement ticket 06 — Lead Simulator (Stage 5)

Paste this into a fresh session. Everything below was decided with the user on 2026-09-16/18; do not re-open the decisions, ask only if the code contradicts them.

## Read first (in this order, nothing else up front)
1. `prototypes/new-auto-proposal/CLAUDE.md` — guardrails (math is code, model is prose; required schema fields; hard-reset policy; `logger`/artifacts).
2. `.scratch/new-auto-proposal/issues/06-lead-simulator-proposal-generation-and-verification.md` — the ticket (checkboxes to tick as you go).
3. `prototypes/new-auto-proposal/docs/plans/06-lead-simulator.md` — the plan: API contracts §1, sub-features A/B/C §2–4, doc drift §5, verification §7. **This is the spec. Follow it.**
4. `prototypes/new-auto-proposal/docs/plans/05-pricing-engine.md` §1 only if you need the `PricingRules` semantics (`input` kinds, `condition`, `rows`, `needs_review`).

Working directory for everything: `prototypes/new-auto-proposal/` (`backend/`, `frontend/`). Use `graft ask`/`graft grep` before opening files.

## Ground truth in code (exact anchors)
- **Stage 5 entry point already exists:** `backend/src/routes/rules.ts` `POST /:id/rules/calculate` → `evaluate()` + `buildProposalPayload()` (`backend/src/services/pricing-calculator.ts:330-353`). The payload already contains every pricing tag (formatted like the quotation), `has_*` booleans, loop arrays, tier matrix. Stage 5 adds only: customer inputs (`client_name`), dates, `ai_generated` paragraphs.
- **Model calls:** `generateJson<T>(prompt, geminiSchema, jsonShapeSuffix)` in `backend/src/services/ai-extraction.service.ts:18` — provider-agnostic (DeepSeek default). Copy the pattern in `pricing-compiler.service.ts:204` (`ModelCall` seam for tests). Every field the code depends on must be `required` in the schema.
- **Stage 2 context:** `loadStage2Context(companyId)` + `loadCompany(companyId)` in `backend/src/services/pricing-compiler.service.ts:27-55` (variables with `category`, `data_type`, `sample_value`, `condition_flag`, `enum_options`, `paragraph_mode`). Paragraph tips (`purpose/tone/length_guideline/guidance`) live in `company_variables.descriptor_json.paragraph_config` — read them directly there (the context loader only carries `paragraph_mode`).
- **Voice drawer text:** `getCompanyConfiguration(companyId)` in `backend/src/services/company-config.service.ts:33` → `style_notes`, `reference_proposal_text`, `clarification_notes` (each ≤ 6,000 chars, may be `""`).
- **Rules state:** `working_state_json.pricing_rules` (`PricingRulesState`, `.rules` is `PricingRules`); `working_state_json.template_stats.tier_matrix`; `working_state_json.stage` must be `"lead_simulation"` (set by `POST /rules/proceed`).
- **Template:** `storage/<id>/template.docx` (`getStorageDir()` from `backend/src/db/database.ts`). `easy-template-x` is installed; `TemplateHandler` is already imported in `template-mutator.service.ts:4`.
- **Artifacts for the Dev Dock logs tab:** `logPipelineArtifact(companyId, name, content)` (`backend/src/services/pipeline-log.ts:22`), never throws.
- **Hard-reset points to extend** (delete `storage/<id>/proposal.docx|pdf`): `backend/src/routes/briefing.ts:140-147` (submit) and `:238` (unlock), `backend/src/routes/template.ts:54` (regenerate), `backend/src/routes/rules.ts` compile handler.
- **Routes registration:** `backend/src/app.ts:32-38` — add `app.use("/api/companies", proposalRouter)` before `companiesRouter`.
- **Seeding:** `backend/src/db/seed.ts:76-135` (`upsertCompany`, `seedAllCompanies`, `resetCompanyById`; candidate-path lookup at `:50-66`). Company response: `formatCompanyResponse` in `backend/src/routes/companies.ts:29`.
- **Stage 2 `data_type` enum to extend with `"date"`:** `backend/src/services/gemini.service.ts:25` (type) and `:75-79` (schema), `backend/src/services/deepseek.service.ts:21` (prompt shape), `frontend/src/types/variable.ts:3-9`.
- **Frontend mount point:** `frontend/src/components/CompanyProfileCard.tsx:231-247` renders `PricingEngineDeck`; render `<LeadSimulator>` right after it when `company.stage === "lead_simulation"` (prop `stage` on `Company`, `frontend/src/types/company.ts:73`). Shimmer: `<div className="shimmer-bar" />` (`PricingEngineDeck.tsx:128`, CSS in `frontend/src/index.css:166`). Fluid textarea pattern: `PromptDocCapsule.tsx:41-55` (also how it syncs a prefilled value on company switch — copy for `sample_lead_text`). API helpers: `frontend/src/services/api.ts:317-325` (`calculatePricing`, `proceedToLeadSimulation`) — same error unwrapping.
- **Sample lead emails (verbatim source):** `Mock Data/verification_guide.md` lines 25 (co1), 60 (co2), 98 (co3). Pricing text to move: `pricing_engine_spec.pricing_context` per company in `Mock Data/companies_dataset.json`.
- **PDF:** LibreOffice 25.2 is installed at `C:\Program Files\LibreOffice\program\soffice.exe`. Add `libreoffice-convert`; read `SOFFICE_PATH` from env, add it to `backend/.env.example`.

## Build order (one commit each, `<type>(new-auto-proposal): …`, WHY before HOW)
1. **A — seeds + `date` type.** `Mock Data/test_seeds.json` `{ note, companies:[{company_id, pricing_spec, sample_lead_text}] }`; remove `pricing_engine_spec` from `companies_dataset.json`; `seed.ts` `loadSeeds()`; `formatCompanyResponse` attaches `sample_lead_text` (`""` when absent); `date` added to the three enum spots + one prompt line ("proposal dates and validity dates → `date`"). Tests: `companies.test.ts` covers spec seeded + `sample_lead_text` returned. `npm test` green.
2. **B — backend.** Files: `services/lead-extractor.service.ts`, `services/clarification-drafter.service.ts`, `services/narrative-drafter.service.ts`, `services/proposal-generator.service.ts` (incl. `fillDates`, `clearProposalFiles`), `routes/proposal.ts`. Contracts exactly as plan §1.1–1.5. Tests listed in plan §3 (offline, stub the model via a `ModelCall` seam; generation check converts `proposal.docx` with `@firecrawl/anydoc` `toMarkdown` and asserts `$35,073.00` present and no `{`/`}` left). Live calls only in `tests/gemini.live.ts`.
3. **C — frontend.** `components/LeadSimulator.tsx`, `types/proposal.ts`, `api.ts` `extractLead / draftClarification / generateProposal`. Layout and states per plan §4. Tactile buttons: `bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`.
4. **Manual verification** (plan §7): three sample leads → `$35,073.00` / `$2,734.80` + `$3,150.00` / `$10,445.00`; co2 without the last sentence → stops on `client_state` + clarification email; co3 "140 products" → declined, no files. Backend `npm run dev` (port 3001), frontend `npm run dev`.
5. **Doc drift** — present the diffs for plan §5 and **wait for the user's OK** before touching `AGENTS.md`/`CLAUDE.md`/`docs/*`/`spec.md`. Tick the ticket checkboxes; set status `completed` at the end.

## Non-negotiables (the things a fresh agent gets wrong)
- `generate` takes `{inputs, lead_text}` and never re-extracts. `lead_text` is only drafter context.
- Model never types a number: drafter returns `{tag}` placeholders, code substitutes from the payload; unknown tags stripped and reported. Dates computed in code (`fillDates`).
- Missing required fact → 400 from `generate`; the UI stops at the facts form and calls `lead/clarify`. `needs_review` → `{success:false, declined:true}` with **no** file written.
- PDF failure → `pdf: null` + `pdf_error`, still 200 with the docx.
- Nothing persisted for runs; no new tables. Seeds are dev-only and live in `test_seeds.json`, never in `companies_dataset.json`.
- All response-schema fields `required`. Log every raw model response with `logPipelineArtifact`.
- Ponytail: reuse `evaluate`, `buildProposalPayload`, `generateJson`, `logPipelineArtifact`, `TemplateHandler`, the shimmer bar, the fluid textarea; no new abstractions beyond the five files named. Mark deliberate ceilings with `ponytail:` comments (date-suffix copy, string-date fallback, per-run soffice spawn).
