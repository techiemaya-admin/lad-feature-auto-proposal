# Auto-Proposal — Architectural Plan & Blueprint

Paths relative to repo root unless noted.

## 1. Executive Summary

Sales teams running AI outbound/inbound campaigns generate high volumes of inbound leads. When a lead requests a quote, automation breaks down: someone must interpret unstructured messages, calculate rates from mental models or spreadsheets, copy numbers into a Word template, and email it back. Slow, inconsistent, bottlenecked.

This project proves **zero-config quotation auto-generation**:

1. **Import & ingest:** company profile (`Mock Data/companies_dataset.json`); dev-only pricing notes and sample lead from `Mock Data/test_seeds.json`.
2. **Document understanding:** real `.docx` quotations → Markdown via `@firecrawl/anydoc`.
3. **Variable detection & taxonomy:** scalar entities, pricing numbers, table loops, dynamic paragraphs, with human-in-the-loop review.
4. **Non-destructive Word mutation:** `docxmlater` replaces text anchors and collapses repeating rows into loop syntax, preserving styling.
5. **Interactive pricing engine:** natural pricing notes → visual rule cards + deterministic JSON execution.
6. **Proposal generation & verification:** unstructured lead message → structured facts (missing fact drafts a clarification email and opens a reply loop) → exact totals from code → `{tag}`-placeholder narrative → `.docx` via `easy-template-x` + PDF via headless LibreOffice. A review reason marks the proposal a draft; the document is still built.

## 2. System Architecture & Component Flow

5-stage sequential pipeline + ambient shell (settings drawer/views + bottom Dev Dock). UI spec: [design.md](design.md).

```
[STAGE 1: BRIEFING]  Stage1Briefing.tsx
  Prompt textarea + quotation dropzone (.docx) + optional AI-generated sample (SampleProposalBuilder.tsx)
  └── [Send] → AnyDoc Markdown + variable extraction; capsule locks into read-only summary
             │
             ▼
[STAGE 2: VARIABLE LEDGER]  Stage2VariableLedger.tsx
  Chips grouped in 4 rows: [Customer inputs] [Fixed & auto-filled] [Pricing] [Paragraphs]
  ├── Detail tray: inline rename, category switch, leave out / bring back, [+ Add one] custom chip
  ├── Paragraph mode: [Fixed text] vs [Drafted per client]
  ├── Any edit or re-scan drops the Stage 3 template until regenerated
  └── [Generate template ➔]
             │
             ▼
[STAGE 3: TEMPLATE CHECKPOINT]  Stage3TemplateCheck.tsx + DocxDocumentPreview.tsx
  docxmlater finds every occurrence of each verbatim sample_text and derives the mutation
  ├── Preview-first card: clipped docx-preview thumbnail (click → full modal) + summary
  ├── Unplaced fields listed as chips; tapping one focuses that variable in Stage 2
  └── [Set up pricing ➔]
             │
             ▼
[STAGE 4: PRICING ENGINE]  Stage4PricingEngine.tsx + pricing/LedgerTray.tsx
  Rule compiler builds rules from: pricing brief + confirmed variables + sample quote values
  ├── One auto-repair pass on errors/mismatch; 300 ms debounced PUT /rules on edits
  ├── Assumption strip → one editable card per table → "What we ask the lead"
  │     → calculation ledger (readable rule · sample · quotation · ✓/✗)
  ├── "Held for review when" rules are editable (add / edit / delete; a half-finished rule blocks Proceed)
  └── [Proceed to Stage 5 ➔] (blocked while structural errors exist)
             │
             ▼
[STAGE 5: LEAD & PROPOSAL]  Stage5LeadSimulator.tsx (+ Stage5ReceiptSummary.tsx)
  Lead textarea prefilled with assigned/routed email or dev sample → [Generate proposal]
  ├── POST /lead/extract → read-only facts; required fact missing → clarification email
  │     + reply loop (the thread is re-read until nothing is missing)
  ├── POST /proposal/generate → evaluate → needs_review → payload → {tag} narrative
  │     → easy-template-x .docx → LibreOffice PDF (failure → pdf: null)
  └── Split view: facts + assumptions + numbers ledger | PDF <iframe> + downloads

AMBIENT SHELL:
├── Header tabs (LadSettingsHeader.tsx): companies, AI model picker, Business Profile / Voice & Inbox / Auto Proposal / ICP Strategy
├── HeroBanner.tsx + StageStepper.tsx: workspace identity + 1-5 navigation
├── BusinessProfileView / VoiceInboxView / ConfigurationSheet.tsx: per-company settings (company_configurations)
├── TemplateLibraryView.tsx: library-first entry, ICP import, custom templates, routing panel
└── DevDock.tsx: AnyDoc MD, Variables JSON, Rule Schema JSON, logs (bottom HUD)
```

Entry flow: header company tabs → `TemplateLibraryView` (import ICP / open card / routing) → keyed `TemplateWorkspace` (`App.tsx`) → `StageStepper` 1–5. `TemplatesApp.tsx` is a thin re-export of `App`.

## 3. The 4-Tier Taxonomy

| Backend tier | Frontend bucket | Handling | Examples |
|---|---|---|---|
| Tier 1: scalar entity | Customer inputs / Fixed & auto-filled | Fixed string facts, replaced directly in text runs | `client_name`, `client_state` / `proposal_date`, `validity_days`, `payment_terms` |
| Tier 2: deterministic pricing | Pricing placeholders | Computed totals/rates; JS math only, never LLM arithmetic | `seat_count`, `rate_per_seat`, `subtotal`, `tax_amount`, `grand_total` |
| Tier 3: repeating table rows | Pricing placeholders (⊞ chips) | Arrays of objects rendered into table loops (`{#items}…{/items}`) | `line_items[]`, `payment_milestones[]`, `addon_list[]` |
| Tier 4: dynamic narrative & logic | Narrative paragraphs (❝ fixed / ✦ drafted) | Tailored copy or static clauses; Fixed vs Drafted-per-client toggle | `scope_of_work`, `sla_terms` |

**Fixed & auto-filled is a screen label, not a pipeline tier.** Values the lead is never asked for (dates, seller-set terms) get their own bucket so the reviewer is not told the lead will be asked. Inside the pipeline a `fixed` variable is handled exactly like `customer_input`. Stage 4 defines the values and has the final say.

## 4. Document Pipeline: Transformation & Mutation Strategy

### 4.1 Parsing with `@firecrawl/anydoc`
- `.docx` → clean GitHub-Flavored Markdown in milliseconds. Markdown (headings, lists, tables) is what the model reads — never heavy XML. Shown in the Dev Dock.

### 4.2 Variable extraction contract — text only
No locators, no mutation instructions in the extraction contract (`ai-extraction.service.ts` dispatching `gemini.service.ts` / `deepseek.service.ts`):

| Field | Meaning |
|---|---|
| `sample_text` | Verbatim text from the quotation (multi-line for paragraph blocks). The engine searches for exactly this. |
| `category` | `customer_input` / `fixed` / `pricing` / `paragraph`. |
| `condition_flag` | `has_tax`, … — engine wraps the row (or paragraph) in `{#flag}…{/flag}`. `""` = always shown. |
| `enum_options` | Tier selector options; engine finds the tier matrix by name — no locator needed. |
| `context_text` | Almost always `""` (= replace everywhere). Only when identical text appears elsewhere with a different meaning. |
| `loop_tables[]` | `header_texts`, `loop_tag`, `column_tags`, `row_labels`. No table indexes. |
| `date_format` | Date-only exception: a date-fns pattern the model derives; verified by code (read + print-back). |

Every field the engine depends on is `required` in the response schema.

### 4.3 Template mutation with `docxmlater`
`backend/src/services/template-mutator.service.ts` owns all location logic:

- Every paragraph (body or table cell) containing `sample_text` is a hit. Matching tolerates NBSP/run whitespace, dash/quote variants, stripped list markers; bare-word samples match whole words only.
- `paragraph` → hit paragraph becomes `{tag}`; following siblings in the same list or listed in multi-line `sample_text` are pruned. Sub-span replacement when the sample is one sentence of a paragraph. `fixed` mode keeps text; inner values tag inline.
- `condition_flag` → value replaced **and** row wrapped (`{#flag}` first cell / `{/flag}` last cell); on paragraphs `{#flag}{tag}{/flag}`.
- Bare numbers without `context_text` only replace inside table cells when a table hit exists.
- Ordering: longest `sample_text` first; context-narrowed before equal-length global.
- Loop collapse: table by `header_texts`, rows by `row_labels`; first loop row gets tags + `{#loop}…{/loop}`, rest removed; header/subtotal/total rows untouched.
- Post-check: every placed tag verified; swallowed tags become `covered` (drafter input) or reported misses. Only `applied: false` counts as "didn't land".
- Tier matrix (columns = tiers): tagged positionally; selected tier rotates into the highlighted column at hydration via `buildTierMatrixPayload`.
- Golden test: `backend/src/tests/template-mutator.test.ts` + `fixtures/*.variables.json` + `*.raw.json` must reproduce `Mock Data/templated_markdown/*.md` (18/18 green).

### 4.4 Proposal hydration with `easy-template-x`
Payload keys equal `variable_name`; conditionals need boolean `has_*`; loops need arrays keyed by `loop_tag`; tier matrix from `buildTierMatrixPayload`. Outputs the finalized proposal for download/preview.

### 4.5 Stage 5 generation (`proposal-generator.service.ts`)
- `POST /lead/extract` → facts + `missing` + `assumptions` + `assumed`; `POST /lead/clarify` → ask email; `POST /lead/reply` → model plays the lead; `POST /proposal/generate` → `{evaluation, payload, narrative, files, pdf_error?}`; `GET /proposal/download?format=docx|pdf`.
- Facts built per company from rules `input` variables + undefined non-date customer inputs; dates never asked (sheet computes from `today` = server local date).
- Drafter: one call for all `ai_generated` paragraphs as `{tag}` placeholders; code substitutes, strips/reports unknown tags.
- PDF via `soffice --headless`; failure → `pdf: null`. Artifacts logged to `backend/logs/<company>/<template>/`. No proposals table; files overwritten per run.

## 5. Pricing Engine: Rule Cards & Deterministic Math

```
[Natural Language Spec] → (rule compiler) → [PricingRules: spreadsheet whose cells are Stage 2 names]
  ├── tables[]: generic grids with kind hint (packages | bands | addons | taxes | splits | other)
  ├── variables[]: input | constant | lookup | formula | condition | aggregate | rows
  │     in_document:true = Stage 2 pricing variable; false = pricing-only helper
  ├── review_rules[] (flag for human), assumptions[], sample_inputs
  └── persisted in working_state_json.pricing_rules; compile + repair logged
        ├── [Stage4PricingEngine] one card per table, ledger with ✓/✗ vs sample, editable review rules
        └── [pricing-calculator.ts] topological evaluation, cents rounding, condition-flag guards,
            needs_review (missing input / lookup miss / ÷0 / broken date / review rule),
            formatLike() prints values in the quotation's notation
```

API (`/api/companies/:companyId/templates/:templateId/rules`): `POST /compile` (validate → evaluate sample → sample check → one auto-repair; stage → `pricing_engine`) · `GET` · `PUT` (400 `errors[{path,message}]`, nothing persisted) · `POST /calculate` (`{inputs}` → `{evaluation, payload}`) · `POST /proceed` (409 while structural errors; stage → `lead_simulation`). Full schema: [plans/05-pricing-engine.md](plans/05-pricing-engine.md).

Engine notes (verified against fixtures): tag values are display strings — compute numerically, print with `formatLike`; parse percents from the sample string; add-on multi-select is a `multi_choice` input with `aggregate`/`rows`; drafted paragraphs receive numbers as inputs and return `{tags}`; text compares are case-insensitive; minimum-commitment = `constant` + `formula max`.

## 6. Ground-Truth Test Profiles

1. **Northstar Digital (`co1_seo`)** — tiered packages Local $1,000 / Growth $3,000 / Authority $8,000; tier match by location cap; 10% annual prepay discount; 8.25% TX tax post-discount. Benchmark: Bloom & Co (2 locations, TX, annual) = **$35,073.00**.
2. **Fortress IT Group (`co2_msp`)** — Essential $45 / Standard $65 / Premium $85; 25–49 seats −$5, 50+ −$10; extra devices $12; setup $75/seat untaxed; OH 6% on recurring; 10-seat floor. Benchmark: Whitfield (42 seats, Standard, 5 devices, OH) = **$2,734.80/mo + $3,150.00** setup.
3. **Fieldstone Studio (`co3_dev`)** — Landing $2.5k / Business $6k / E-Commerce $9.5k; add-ons; 2+ stackable add-ons 10% off add-on subtotal; 50/50 milestones. Benchmark: Rosewood (E-commerce $9.5k + $600 + $450 − 10%) = **$10,445.00** ($5,222.50 / $5,222.50).

Arithmetic: [Mock Data/verification_guide.md](../Mock%20Data/verification_guide.md). All three pinned in `pricing-calculator.test.ts`.
