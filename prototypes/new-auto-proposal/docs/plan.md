# Auto-Proposal Prototype — Architectural Plan & Blueprint

## 1. Executive Summary & Problem Context

Sales teams running AI outbound/inbound campaigns generate high volumes of inbound leads. When a lead requests a quote or pricing, automation breaks down: an account manager or sales rep must manually interpret unstructured messages, calculate rates from mental models or spreadsheets, copy numbers into a Word template, and email it back.

For small-to-midsize service businesses (marketing agencies, IT MSPs, dev shops), this manual quoting step is slow (hours to days), inconsistent, and bottlenecked against inbound volume.

This prototype (`prototypes/new-auto-proposal`) builds and proves an end-to-end concept for **Zero-Config Quotation Auto-Generation**:
1. **Import & Ingest:** Preload company profile and natural-language pricing notes (`pricing_engine_spec`).
2. **Document Understanding:** Convert real `.docx` quotations into Markdown via `@firecrawl/anydoc`.
3. **Variable Detection & Taxonomy:** Discover scalar entities, pricing numbers, table loops, and dynamic paragraphs with human-in-the-loop review.
4. **Non-Destructive Word Mutation:** Use `docxmlater` to replace text anchors and collapse repeating table rows into dynamic loop syntax while preserving headers and summary footers.
5. **Interactive Pricing Engine:** Compile natural pricing notes into visual rule cards and deterministic JSON execution logic.
6. **Proposal Generation & Verification:** Ingest unstructured lead emails, extract parameters via Gemini, compute exact totals deterministically, generate tailored sales copy, and render final `.docx` documents using `easy-template-x`.

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
            └── Gemini extracts dynamic variables
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
  Gemini compiles rules from: Prompt Spec + Confirmed Variables + Sample Quote Values
  ├── Interactive visual cards for Tiers, Breakpoints, Add-ons, and Taxes
  ├── Pure JavaScript deterministic math execution engine (100% calculation precision)
  └── [Proceed to Lead Simulation ➔]
            │
            ▼
[STAGE 5: LEAD SIMULATION & VERIFICATION]
  Inbound lead message (email) + "Load Sample Lead Message"
  ├── Gemini extracts lead deal parameters (seats, locations, addons, state)
  ├── Deterministic math computes exact subtotal, discounts, taxes, and total
  ├── Gemini drafts tailored narrative copy using prompt tips
  ├── easy-template-x renders finalized proposal .docx
  └── In-browser proposal preview via docx-preview + one-click download

AMBIENT SHELL COMPONENTS:
├── Slide-Over Configuration Drawer: AI Tone & Style, Clarification Triggers, Email settings
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
| **Tier 4: Dynamic Narrative & Logic** | Gemini generation & boolean toggles | **Narrative Paragraphs** | Tailored sales copy or static legal clauses. Controlled via [Fixed \| AI-Generated] toggle with prompt tips. | `scope_of_work`, `deliverables`, `sla_terms`, `payment_terms` |

---

## 4. Document Pipeline: Transformation & Mutation Strategy

### 4.1 Parsing with `@firecrawl/anydoc`
- Converts incoming `.docx` files to clean, semantic GitHub-Flavored Markdown in single-digit milliseconds.
- Markdown output exposes headings, list items, and table syntax without sending heavy XML to the LLM.
- Displayed in the UI inside a collapsible Reviewer Dropdown.

### 4.2 Variable Extraction Contract (Gemini) — text only
Gemini is reliable at *reading* ("this exact text is the tax amount") and unreliable at *positional bookkeeping* ("table 2, row `Subtotal`, column 1"). The extraction contract (`backend/src/services/gemini.service.ts`) therefore contains no locators and no mutation instructions:

| Field | Meaning |
| :--- | :--- |
| `sample_text` | Verbatim text copied from the quotation. Multi-line for paragraph/bullet blocks. The engine searches for exactly this. |
| `category` | `customer_input` / `pricing` / `paragraph`. `paragraph` = client-specific prose the salesperson would rewrite per lead (intro, tier justification, add-on menu, what's-included list, tax/commitment notes). |
| `condition_flag` | `has_tax`, `has_annual_discount`, … — the engine wraps the containing table row (or, for a `paragraph` variable, the paragraph itself) in `{#flag}…{/flag}`. `""` = always shown. |
| `enum_options` | On the tier selector (`selected_tier`): every tier offered. The engine uses these names to find the tier comparison matrix — no locator needed. |
| `context_text` | Almost always `""` (= replace everywhere). Only when the identical text appears elsewhere with a different meaning: the row label / nearby words of the right occurrence. |
| `loop_tables[]` | `header_texts` (exact row-0 cell texts), `loop_tag`, `column_tags`, `row_labels` (exact first-cell text of each repeating row). No table indexes. |

Every field the engine depends on is `required` in the Gemini response schema — optional schema fields get skipped by `gemini-2.5-flash` regardless of prompt wording.

### 4.3 Template Mutation with `docxmlater`
`backend/src/services/template-mutator.service.ts` owns **all** location logic and derives the mutation from the variable itself:

- Every paragraph (body or table cell) containing `sample_text` is a hit. Matching tolerates NBSP/run-on whitespace, `-`/`−`/`–` and straight/curly quote variants, and stripped `- `/`• ` list markers; bare-word samples match whole words only.
- `category: paragraph` → the hit paragraph becomes `{tag}`; following siblings in the same list (`numId`) or listed in the multi-line `sample_text` are pruned. Formatting is kept only when the paragraph is uniformly formatted.
- `condition_flag` set → value replaced **and** the row wrapped with `{#flag}` in cell 0 / `{/flag}` in the last cell (easy-template-x row loop). On a `paragraph` variable the paragraph becomes `{#flag}{tag}{/flag}` and is dropped when the flag is false.
- Otherwise → text replaced in place at every hit, preserving run formatting via `replaceTextCrossRun`.
- A bare number (`5`, `42`) without `context_text` only replaces inside table cells when any table hit exists (a `5` in "within 5 business days" is not the variable).
- **Ordering:** variables are applied longest `sample_text` first, and a context-narrowed variable before an equal-length global one — this is what makes `Growth Package — 12 months × $3,000/mo` survive `$3,000/mo`, and lets `$60.00` (managed devices, with context) and `$60.00` (adjusted rate, global) coexist.
- **Loop collapse:** table located by `header_texts` (position-wise), loop rows by `row_labels`; the first loop row gets `{column_tags}` and `{#loop}…{/loop}`, the rest are removed. Header, base-fee, subtotal, discount and total rows are untouched because they are not in `row_labels`.
- Every variable yields a `details[]` entry (`applied`, `info`) surfaced in the Template Checkpoint, including `N other occurrence(s) skipped by context_text` and `"…" not found in document` — the review deck is where model variance gets caught.
- **Tier comparison matrix** (columns = tiers, rows = features): easy-template-x has no column loops and the "recommended" highlight is cell shading the engine never touches, so the matrix is tagged **positionally** and the selected tier is *rotated into the highlighted column* at hydration. Detection: the table whose header row names ≥2 of the selector's `enum_options` including its `sample_text`. Every tier column's cells become `{tierN_name}` (header text outside the name, e.g. ` — Recommended`, stays) and `{tierN_rM}`; label columns stay static. The captured grid + `recommended_index` are returned as `tier_matrix` and persisted in `template_stats`; `buildTierMatrixPayload(matrix, selectedTier)` produces the flat tag values with the selected tier in the highlighted column and the others in their original order (Local → `Growth | Local — Recommended | Authority`). Runs before the global replacements so `{selected_tier}` / `{selected_tier_rate}` do not touch the matrix.

Golden test: `backend/src/tests/template-mutator.test.ts` + `tests/fixtures/*.variables.json` (an ideal Gemini response per company) must reproduce the tag layout of `Mock Data/templated_markdown/*.md`, plus the matrix rotation, conditional-paragraph and "a miss is reported, never dropped" cases. Live extraction quality is measured by `npm run test:live` (`tests/gemini.live.ts`, needs `GEMINI_API_KEY`, not part of `npm test`) as "every `sample_text` is verbatim in the quotation markdown".

### 4.4 Proposal Hydration with `easy-template-x`
- Ingests the templated `.docx` binary and a hydrated JSON data payload.
- Expands table loops dynamically to match the lead's exact line items.
- Payload keys equal `variable_name`; conditionals need boolean `has_*` keys; loops need arrays keyed by `loop_tag`; the tier matrix values come from `buildTierMatrixPayload(template_stats.tier_matrix, selected_tier)`.
- Outputs the finalized proposal document ready for download and browser preview.

---

## 5. Pricing Engine Architecture: Rule Cards & Deterministic Math

```
[Natural Language Spec]
       │ (Gemini Rule Compiler)
       ▼
[Structured Rule Schema (JSON)]
       ├── Tiers: [{ id, name, monthly_price, location_cap, sla }]
       ├── Volume Breakpoints: [{ min_seats, max_seats, adjustment_per_unit }]
       ├── Addons: [{ id, name, unit_price, is_stackable }]
       ├── Discounts: [{ type, rate, condition }]
       └── Tax: [{ state, rate, applies_to_recurring_only }]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Interactive Visual Rule Cards]    [Deterministic Math Interpreter (JS)]
- Change prices & multipliers      - Evaluates conditions
- Toggle discount rules            - Applies volume adjustments
- Add / remove conditions          - Calculates subtotals, taxes, totals
- Reviewer JSON Inspector Dropdown - Guarantees 100% mathematical precision
```

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
| **Phase 3** | **Categorized Variable Review Chip-Deck** | Review dynamic variables in 3 buckets | Gemini variable extraction, 3-bucket chip-deck (Customer Inputs, Pricing Placeholders, Paragraphs), AST-verified custom chip modal, dropdown bucket switcher, [Fixed \| AI] paragraph toggle. |
| **Phase 4** | **docxmlater Mutation & Minimal Checkpoint** | Mutate .docx AST & confirm template | `docxmlater` replacement pipeline, smart table row collapse, compact inline checkpoint card with tag stats and optional `docx-preview` modal. |
| **Phase 5** | **Pricing Compiler & Rule Cards** | Compile spec to visual & executable rules | Gemini rule compiler using Prompt + Variables + Sample Quote Values, interactive rule cards UI, collapsible JSON editor, deterministic JS math engine. |
| **Phase 6** | **Lead Simulator & Proposal Verification** | Generate proposal from lead message & verify math | Inbound email textarea + sample load button, lead parameter extraction, narrative copy generator, `easy-template-x` proposal generation, math verification against benchmarks. |
| **Auxiliary** | **Ambient Shell Enhancements** | Independent settings & developer tools | Slide-Over Configuration Drawer (AI tone slider, clarification thresholds, email toggles) and Bottom Developer Dock (AnyDoc MD, Variables JSON, Rule Schema JSON, logs). |
