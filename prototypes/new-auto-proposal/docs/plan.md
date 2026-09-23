# Auto-Proposal Prototype — Architectural Plan & Blueprint

## 1. Executive Summary & Problem Context

Sales teams running AI outbound/inbound campaigns generate high volumes of inbound leads. When a lead requests a quote or pricing, automation breaks down: an account manager or sales rep must manually interpret unstructured messages, calculate rates from mental models or spreadsheets, copy numbers into a Word template, and email it back.

For small-to-midsize service businesses (marketing agencies, IT MSPs, dev shops), this manual quoting step is slow (hours to days), inconsistent, and bottlenecked against inbound volume.

This prototype (`prototypes/new-auto-proposal`) builds and proves an end-to-end concept for **Zero-Config Quotation Auto-Generation**:
1. **Import & Ingest:** Preload company profile (`companies_dataset.json`) and, for the dev harness only, the natural-language pricing notes (`pricing_spec`) and a sample lead message from `Mock Data/test_seeds.json`.
2. **Document Understanding:** Convert real `.docx` quotations into Markdown via `@firecrawl/anydoc`.
3. **Variable Detection & Taxonomy:** Discover scalar entities, pricing numbers, table loops, and dynamic paragraphs with human-in-the-loop review.
4. **Non-Destructive Word Mutation:** Use `docxmlater` to replace text anchors and collapse repeating table rows into dynamic loop syntax while preserving headers and summary footers.
5. **Interactive Pricing Engine:** Compile natural pricing notes into visual rule cards and deterministic JSON execution logic.
6. **Proposal Generation & Verification:** Ingest an unstructured lead message, extract structured facts (read-only; a missing fact drafts a clarification email and opens a reply loop — the thread is re-read until nothing is missing), compute exact totals deterministically (a review rule declines), draft narrative paragraphs as `{tag}` placeholders that code fills, render the `.docx` with `easy-template-x` and a PDF with headless LibreOffice.

---

## 2. System Architecture & Component Flow

The system runs a **5-stage sequential pipeline** anchored by an **ambient shell** (Slide-Over Configuration Drawer and Bottom Dev Dock). For full interaction and visual specifications, consult [docs/design.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/design.md).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM PIPELINE FLOW (5 STAGES)                           │
└────────────────────────────────────────────────────────────────────────────────────────┘

[STAGE 1: BRIEFING CAPSULE]
  Prompt Spec Textarea + Docked Quotation Dropzone (.docx)
  └── [Send ➔] executes Stage 1 backend & locks capsule into read-only summary
            │
            ├── @firecrawl/anydoc converts .docx to Markdown
            └── the extraction model finds dynamic variables
            │
            ▼
[STAGE 2: VARIABLE LEDGER]
  Chips grouped in 3 rows: [Customer inputs] [Pricing] [Paragraphs]; tap a chip to open its detail tray
  ├── Tray: inline rename, category dropdown, leave out / bring back, AST-verified custom chip via [+ Add one]
  ├── Paragraph mode: [Fixed text] vs [Drafted per client] (glyph on the chip)
  ├── Any edit or re-scan drops the Stage 3 template until regenerated
  └── [Generate template ➔]
            │
            ▼
[STAGE 3: TEMPLATE CHECKPOINT]
  docxmlater finds every occurrence of each verbatim sample_text and derives the mutation (text / paragraph block / conditional row / loop)
  ├── Preview-first card: clipped docx-preview thumbnail (click → full modal) + one-line summary
  ├── Unplaced fields listed as chips; tapping one opens that variable's tray in Stage 2
  └── [Set up pricing ➔]
            │
            ▼
[STAGE 4: PRICING ENGINE & RULE CARDS]
  The rule compiler builds rules from: Prompt Spec + Confirmed Variables + Sample Quote Values
  ├── Interactive visual cards for Tiers, Breakpoints, Add-ons, and Taxes
  ├── Per lead input: "If the lead doesn't say it" = ask (required) / assume a default (amber chip, header count) / leave blank, plus an assume_when reading hint
  ├── Pure JavaScript deterministic math execution engine (100% calculation precision)
  └── [Proceed to Check & Generate Proposal ➔]
            │
            ▼
[STAGE 5: LEAD SIMULATION & VERIFICATION]
  Inbound lead message textarea, prefilled with the company's dev-only sample_lead_text
  ├── POST /lead/extract → structured facts per the rules' inputs (+ client name): null = not said, assumptions[]; code fills Assume defaults → assumed[]
  │     └── required fact missing → read-only facts panel (field highlighted) + POST /lead/clarify ask → reply box (typed, or POST /lead/reply drafts it as the lead) → re-extract the thread
  ├── POST /proposal/generate (facts in, never the email): evaluate → needs_review → reasons flagged for the human, document still built with the affected values blank (ticket 09; today: declined, no file)
  │     ├── buildProposalPayload (every pricing tag, has_* flags, loops, tier matrix) + customer facts + fillDates (code)
  │     ├── one model call drafts every ai_generated paragraph as {tag} placeholders → code substitutes from the payload
  │     ├── easy-template-x → storage/<id>/proposal.docx; headless LibreOffice → proposal.pdf (failure → pdf: null)
  │     └── nothing persisted: files overwritten per run, no proposals table
  └── Split view: facts form + assumptions + numbers ledger | PDF <iframe> + .docx / .pdf downloads

AMBIENT SHELL COMPONENTS:
├── Slide-Over Configuration Drawer ("Voice & inbox"): style notes, reference proposal, clarification-email notes, mock inbox link
└── Bottom Dev Dock (HUD): Collapsible tray for AnyDoc MD, Variables JSON, Rule Schema JSON, Logs
```

---

## 3. The 4-Tier Taxonomy & 3-Bucket Visual Mapping

The underlying engine classifies variables into four architectural tiers, mapped to three intuitive visual buckets in the frontend Chip-Deck:

| Backend Architectural Tier | Class | Front-End Visual Bucket | Purpose & Handling | Examples |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Scalar Entity** | Inbound message & tenant profile | **Customer Inputs** | Fixed string facts. Replaced directly in text runs. | `client_name`, `client_state`, `contact_email`, `rep_name`, `date` |
| **Tier 2: Deterministic Pricing** | Rule engine calculations | **Pricing Placeholders** | Computed numeric totals and rates. Handled strictly by JS math; never generated by LLM arithmetic. | `seat_count`, `rate_per_seat`, `subtotal`, `tax_amount`, `grand_total` |
| **Tier 3: Repeating Table Rows** | Rule line items & milestones | **Pricing Placeholders** | Dynamic array of objects rendered into table loops (`{#items}...{/items}`). | `line_items[]`, `payment_milestones[]`, `addon_list[]` |
| **Tier 4: Dynamic Narrative & Logic** | Model generation & boolean toggles | **Narrative Paragraphs** | Tailored sales copy or static legal clauses. Controlled via [Fixed \| AI-Generated] toggle with prompt tips. | `scope_of_work`, `deliverables`, `sla_terms`, `payment_terms` |

---

## 4. Document Pipeline: Transformation & Mutation Strategy

### 4.1 Parsing with `@firecrawl/anydoc`
- Converts incoming `.docx` files to clean, semantic GitHub-Flavored Markdown in single-digit milliseconds.
- Markdown output exposes headings, list items, and table syntax without sending heavy XML to the LLM.
- Displayed in the UI inside a collapsible Reviewer Dropdown.

### 4.2 Variable Extraction Contract — text only
The extraction model is reliable at *reading* ("this exact text is the tax amount") and unreliable at *positional bookkeeping* ("table 2, row `Subtotal`, column 1"). The extraction contract (`gemini.service.ts` / `deepseek.service.ts`, dispatched by `ai-extraction.service.ts`) therefore contains no locators and no mutation instructions:

| Field | Meaning |
| :--- | :--- |
| `sample_text` | Verbatim text copied from the quotation. Multi-line for paragraph/bullet blocks. The engine searches for exactly this. |
| `category` | `customer_input` / `pricing` / `paragraph`. `paragraph` = client-specific prose the salesperson would rewrite per lead (intro, tier justification, add-on menu, what's-included list, tax/commitment notes). |
| `condition_flag` | `has_tax`, `has_annual_discount`, … — the engine wraps the containing table row (or, for a `paragraph` variable, the paragraph itself) in `{#flag}…{/flag}`. `""` = always shown. |
| `enum_options` | On the tier selector (`selected_tier`): every tier offered. The engine uses these names to find the tier comparison matrix — no locator needed. |
| `context_text` | Almost always `""` (= replace everywhere). Only when the identical text appears elsewhere with a different meaning: the row label / nearby words of the right occurrence. |
| `loop_tables[]` | `header_texts` (exact row-0 cell texts), `loop_tag`, `column_tags`, `row_labels` (exact first-cell text of each repeating row). No table indexes. |

Every field the engine depends on is `required` in the response schema — optional schema fields get skipped by `gemini-2.5-flash` regardless of prompt wording.

### 4.3 Template Mutation with `docxmlater`
`backend/src/services/template-mutator.service.ts` owns **all** location logic and derives the mutation from the variable itself:

- Every paragraph (body or table cell) containing `sample_text` is a hit. Matching tolerates NBSP/run-on whitespace, `-`/`−`/`–` and straight/curly quote variants, and stripped `- `/`• ` list markers; bare-word samples match whole words only.
- `category: paragraph` → the hit paragraph becomes `{tag}`; following siblings in the same list (`numId`) or listed in the multi-line `sample_text` are pruned. Formatting is kept only when the paragraph is uniformly formatted. If the sample is only a sub-span of the paragraph (one sentence of it), just that span is replaced and the rest stays static — e.g. `Equivalent to {monthly_equivalent}/month … {minimum_commitment_note}`. `paragraph_config.mode: "fixed"` keeps the text as written; the client name / numbers inside it are separate variables and tag inline.
- Sample cleanup (`sampleLines`): models copy from markdown, so list markers, `**bold**` / `*italic*` / `_x_` emphasis and `\_` escapes are stripped before matching — the Word file has none of them.
- `condition_flag` set → value replaced **and** the row wrapped with `{#flag}` in cell 0 / `{/flag}` in the last cell (easy-template-x row loop). On a `paragraph` variable the paragraph becomes `{#flag}{tag}{/flag}` and is dropped when the flag is false.
- Otherwise → text replaced in place at every hit, preserving run formatting via `replaceTextCrossRun`.
- A bare number (`5`, `42`) without `context_text` only replaces inside table cells when any table hit exists (a `5` in "within 5 business days" is not the variable).
- **Ordering:** variables are applied longest `sample_text` first, and a context-narrowed variable before an equal-length global one — this is what makes `Growth Package — 12 months × $3,000/mo` survive `$3,000/mo`, and lets `$60.00` (managed devices, with context) and `$60.00` (adjusted rate, global) coexist.
- **Loop collapse:** table located by `header_texts` (position-wise), loop rows by `row_labels`; the first loop row gets `{column_tags}` and `{#loop}…{/loop}`, the rest are removed. Header, base-fee, subtotal, discount and total rows are untouched because they are not in `row_labels`.
- Every variable yields a `details[]` entry (`applied`, `info`) surfaced in the Template Checkpoint, including `N other occurrence(s) skipped by context_text` and `"…" not found in document` — the review deck is where model variance gets caught. After all mutations `applyTemplate` checks every placed tag against the final text: a tag swallowed by a later paragraph/loop mutation, or a value that only ever lived inside one (`location_count` = "two" inside the intro paragraph), becomes `action: "covered"` (applied, no tag; the drafter of that block receives it as input); a tag that vanished for any other reason is flipped to a miss. The UI treats only `applied: false` as "didn't land".
- **Tier comparison matrix** (columns = tiers, rows = features): easy-template-x has no column loops and the "recommended" highlight is cell shading the engine never touches, so the matrix is tagged **positionally** and the selected tier is *rotated into the highlighted column* at hydration. Detection: the table whose header row names ≥2 of the selector's `enum_options` including its `sample_text`. Every tier column's cells become `{tierN_name}` (header text outside the name, e.g. ` — Recommended`, stays) and `{tierN_rM}`; label columns stay static. The captured grid + `recommended_index` are returned as `tier_matrix` and persisted in `template_stats`; `buildTierMatrixPayload(matrix, selectedTier)` produces the flat tag values with the selected tier in the highlighted column and the others in their original order (Local → `Growth | Local — Recommended | Authority`). Runs before the global replacements so `{selected_tier}` / `{selected_tier_rate}` do not touch the matrix.

Golden test: `backend/src/tests/template-mutator.test.ts` + `tests/fixtures/*.variables.json` (an ideal model response per company) must reproduce the tag layout of `Mock Data/templated_markdown/*.md`, plus the matrix rotation, conditional-paragraph and "a miss is reported, never dropped" cases. `tests/fixtures/*.raw.json` are real model responses copied from `logs/` and must come through with zero losses (placed or covered) — the ideal fixtures alone never go red on model quirks. Live extraction quality is measured by `npm run test:live` (`tests/gemini.live.ts`, needs `GEMINI_API_KEY`, not part of `npm test`) as "every `sample_text` is verbatim in the quotation markdown".

Model choice: provider/model are persisted in `app_settings` (default `deepseek-flash`) and stamped into every `variables-raw.json` log as `ai`. Measured on Co1 (2026-09-15, 2 runs each): `gemini-flash-lite-latest` dropped `$36,000.00` in 3 of 4 runs regardless of prompt; `gemini-2.5-flash` and `deepseek-flash` returned every amount.

### 4.4 Proposal Hydration with `easy-template-x`
- Ingests the templated `.docx` binary and a hydrated JSON data payload.
- Expands table loops dynamically to match the lead's exact line items.
- Payload keys equal `variable_name`; conditionals need boolean `has_*` keys; loops need arrays keyed by `loop_tag`; the tier matrix values come from `buildTierMatrixPayload(template_stats.tier_matrix, selected_tier)`.
- Outputs the finalized proposal document ready for download and browser preview.

### 4.5 Stage 5 Generation (`proposal-generator.service.ts`)
- `POST /api/companies/:id/lead/extract` (`{lead_text}` → `{fields, inputs, missing, assumptions, assumed}`), `POST /lead/clarify` (`{lead_text, inputs, missing, assumed?}` → `{subject, body}`), `POST /lead/reply` (`{lead_text: thread}` → `{subject, body}`, the model playing the lead), `POST /proposal/generate` (`{inputs, lead_text, assumed?}` → `{evaluation, payload, narrative, files, pdf_error?}` or `{declined: true, needs_review}`; defaults re-applied server-side before the missing check, 400 when a required fact is missing, 409 before `stage === "lead_simulation"`), `GET /proposal/download?format=docx|pdf`.
- Facts are built per company from the rules' `input` variables plus the Stage 2 customer inputs no rule variable defines (a validity window the compiler holds as a constant is not re-asked); dates (`data_type: "date"` or a month-name sample) are never asked — `fillDates` moves the earliest sample date to today and keeps every other date's offset, format and suffix. A silent input follows its Ask / Assume / Blank setting: `fillDefaults` (the one place a gap is filled) applies `default` on extract and again on generate, and names the fields in `assumed[]`.
- The drafter gets the voice-drawer notes, the lead message, the facts, every payload tag with its value and every boolean flag with its label; it returns one string per `ai_generated` paragraph; `{tag}` placeholders are substituted in code, unknown tags stripped and reported in `narrative[name].unknown_tags`.
- PDF via `soffice --headless --convert-to pdf` (`SOFFICE_PATH`, persistent profile in the temp dir); a failure returns the `.docx` with `pdf: null`. Every raw model response and the final payload land in `logs/<company>/` for the Dev Dock. Full design: [docs/plans/06-lead-simulator.md](plans/06-lead-simulator.md).

---

## 5. Pricing Engine Architecture: Rule Cards & Deterministic Math

```
[Natural Language Spec]
       │ (rule compiler)
       ▼
[PricingRules — a spreadsheet whose cells are the Stage 2 variable names]
       ├── tables[]: generic grids with a kind hint (packages | bands | addons | taxes | splits | other)
       ├── variables[]: one flat definition per cell — input | constant | lookup | formula | condition | aggregate | rows
       │     in_document:true = a Stage 2 pricing variable; in_document:false = pricing-only helper
       ├── review_rules[] ("flag for human review"), assumptions[], sample_inputs (the sample lead)
       └── persisted in working_state_json.pricing_rules; both compile attempts logged to logs/<id>/*-rules-raw.json / *-rules-repair.json
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[PricingEngineDeck]                [pricing-calculator.ts (pure)]
- one editable card per table      - topological evaluation, cents rounding per money variable
- lead inputs + calculation ledger - condition_flag skip guard, null = unbounded, splits remainder
- per-variable ✓/✗ vs the sample   - needs_review: missing input / lookup miss / ÷0 / review rule
- Dev Dock: raw JSON + Apply       - formatLike() writes values in the quotation's notation
```

API (`/api/companies/:id/rules`): `POST /compile` (validate → evaluate `sample_inputs` → sample check → one auto-repair; stage → `pricing_engine`) · `GET` · `PUT` (400 `errors[{path,message}]`, nothing persisted) · `POST /calculate` (`{inputs}` → `{evaluation, payload}`, Stage 5's entry point) · `POST /proceed` (409 while errors exist; stage → `lead_simulation`). Template regeneration and briefing unlock null `pricing_rules` (hard-reset policy). Schema and engine semantics: [docs/plans/05-pricing-engine.md](plans/05-pricing-engine.md) §1.

### What the Variable Ledger hands the Pricing Engine (read before building Stage 4)

Verified against `logs/*/variables-raw.json` and `company_variables` on 2026-09-15 (24 / 25 / 17 rows for co1 / co2 / co3, every row with a `sample_value`, matching `Mock Data/templated_markdown/*.md` structurally).

**What is there and reliable**
- Every money amount in every table is a `pricing` / `currency` variable with a `{tag}` in the template. Optional rows carry a `condition_flag` on their amount variable (`has_annual_discount`, `has_tax`, `has_volume_adjustment`, `has_extra_devices`, `has_bundle_discount`); the payload needs the matching boolean.
- `selected_tier` is `data_type: enum` with `enum_options` = every tier offered; `template_stats.tier_matrix` (in `working_state_json`) holds the comparison grid; `buildTierMatrixPayload(matrix, selectedTier)` produces its tags.
- Customer inputs the math needs exist even when they have no tag of their own (`covered` — they live inside a drafted paragraph): `location_count` (co1, tier selection), `seat_count` / `managed_device_count` (co2), `product_count` (co3).
- Loops (`co3`: `milestones`, `addon_items`, `payment_milestones`) expect an array keyed by `loop_tag` with one object per row keyed by `column_tags`.

**What the engine must do itself**
1. **Tag values are display strings, not numbers.** `selected_tier_rate` in co1 is `$3,000/mo`, `sales_tax_rate` is `8.25%`. Compute with numbers, then format each tag exactly like its `sample_value` (currency symbol, thousands separator, decimals, `/mo` suffix): one `formatLike(sample, value)` helper.
2. **Parse percentages from the sample string**, not from `data_type` — the model types `10%` as `number` in one run and `string` in the next. `"8.25%"` → `0.0825`.
3. **Add-on selection (co3) is not a customer input.** It is only present as the `addon_items` loop and the `addon_menu` paragraph. The rule schema must define the add-on multi-select itself and emit both the loop rows and the menu paragraph's inputs. *Resolved:* a `multi_choice` input over an `addons` table, `aggregate` (sum / count) for the totals, `rows` for the loop.
4. **Drafted paragraphs get numbers as inputs, never compute them.** Every variable marked `covered` by a paragraph, plus every value that paragraph mentions (`$8,000/mo` upgrade price, `10 seats` floor), goes into the drafter's input set; the drafter returns text with `{tags}` for the program to fill — it never writes a number itself.
5. **Words for numbers.** `location_count` is `"two"` in both co1 and co2; the lead form collects an integer, the drafter spells it.
6. **Labels that encode a rule are not all tagged yet.** Known static text that depends on the rule outcome: co2 `Volume adjustment (25–49 seat band)` (add `volume_tier_band` as a custom chip), co2 `Ohio state tax` and co1 `{client_state}` (only co1 extracted the state), co3 `Base template: up to 100 products, … 4–6 weeks` and `(base template, up to 100 products)` (tier-dependent; add as a custom paragraph). Fix these in Variable Review, not in code. *Resolved for the labels that are chips:* `volume_tier_band` is a `lookup` of the bands table's label column; `template_scope_summary` / `typical_delivery_timeline` are lookups on the templates table.
7. **co3 `enum_options` casing:** the option reads `E-commerce`, the sample and heading `E-Commerce`; compare tiers case-insensitively or fix the option in the review deck. *Resolved:* every text compare in the calculator is whitespace-normalised and case-insensitive; the table's spelling is what gets written out.
8. **Minimum-commitment rules appear as prose, not rows.** co1 `minimum_engagement_months` = 3, co2 `minimum_seat_commitment` = 10 (covered by its note). The rule schema needs a floor/minimum concept; the template only displays it. *Resolved:* a `constant` helper plus `formula max` (`billed_seat_count = max(seat_count, minimum_seat_commitment)`).
9. **Benchmarks are the acceptance test.** The three totals below must come out of the interpreter to the cent before any UI work; `Mock Data/verification_guide.md` has the arithmetic.

### The Three Ground-Truth Test Profiles

1. **Northstar Digital (`co1_seo`) — Tiered Package Selection:**
   - 3 packages: Local ($1,000/mo, 1 loc), Growth ($3,000/mo, up to 3 locs), Authority ($8,000/mo, unltd).
   - Rules: Discrete tier match by location cap; 10% annual prepay discount; 8.25% TX sales tax on post-discount subtotal.
   - Benchmark: Bloom & Co (2 clinics, TX, annual) = **$35,073.00**.

2. **Fortress IT Group (`co2_msp`) — Per-Seat Formula with Breakpoints:**
   - Base rates by tier: Essential ($45), Standard ($65), Premium ($85).
   - Rules: 25–49 seats = -$5/seat; 50+ seats = -$10/seat. Devices beyond 1:1 = $12/device/mo. Setup fee = $75/seat (untaxed). OH tax = 6% on recurring only. 10-seat floor.
   - Benchmark: Whitfield & Associates (42 seats, Standard, 5 extra devices, OH) = **$2,734.80/mo recurring + $3,150.00 one-time setup**.

3. **Fieldstone Studio (`co3_dev`) — Fixed Template + Add-ons & Milestone Split:**
   - Base templates: Landing Page ($2.5k), Business Site ($6k), E-Commerce ($9.5k).
   - Rules: Add-ons list; 2+ stackable add-ons = 10% off add-on subtotal only. 50/50 payment milestone split.
   - Benchmark: Rosewood Home Goods (E-commerce $9.5k + Copywriting $600 + SEO $450 - 10% bundle disc) = **$10,445.00** ($5,222.50 deposit / $5,222.50 launch).

---

## 6. Macro Phase Roadmap

| Phase | Title | Core Objective | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Infrastructure & Shell** | Establish decoupled backend & frontend | Express + TypeScript server, SQLite database, storage directory structure, Vite + Shadcn shell. |
| **Phase 1** | **Company Harness & Mock Ingestion** | Multi-company switching & profile review | 3 Company tabs, "Import Settings" button prefilling data, editable pricing spec textarea, collapsible JSON inspector. |
| **Phase 2** | **Compound Briefing Capsule & Ingestion** | Ingest quotation & lock briefing capsule | Fused Prompt textarea + docked dropzone, Enter=newline, Send validation, AnyDoc Markdown converter, locked state with reset warning modal. |
| **Phase 3** | **Categorized Variable Review Chip-Deck** | Review dynamic variables in 3 buckets | Model variable extraction, 3-bucket chip-deck (Customer Inputs, Pricing Placeholders, Paragraphs), AST-verified custom chip modal, dropdown bucket switcher, [Fixed \| AI] paragraph toggle. |
| **Phase 4** | **docxmlater Mutation & Minimal Checkpoint** | Mutate .docx AST & confirm template | `docxmlater` replacement pipeline, smart table row collapse, compact inline checkpoint card with tag stats and optional `docx-preview` modal. |
| **Phase 5** | **Pricing Compiler & Rule Cards** | Compile spec to visual & executable rules | Rule compiler using Prompt + Variables + Sample Quote Values, interactive rule cards UI, collapsible JSON editor, deterministic JS math engine. |
| **Phase 6** | **Check & Generate Proposal** | Generate proposal from lead message & verify math | Prefilled lead textarea, structured fact extraction with a read-only facts panel and a clarification-reply loop on a missing fact, deterministic numbers ledger, placeholder-only narrative drafting, `easy-template-x` + LibreOffice PDF generation with iframe preview and downloads, declined panel on review rules. |
| **Auxiliary** | **Ambient Shell Enhancements** | Independent settings & developer tools | Slide-Over Configuration Drawer (free-text voice notes, reference proposal, clarification-email notes, mock inbox link) and Bottom Developer Dock (AnyDoc MD, Variables JSON, Rule Schema JSON, pipeline logs + run artifacts). |
