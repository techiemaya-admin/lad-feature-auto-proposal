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
[STAGE 2: CATEGORIZED VARIABLE CHIP-DECK]
  Interactive cards in 3 buckets: [Customer Inputs] [Pricing Placeholders] [Paragraphs]
  ├── Inline rename, type/bucket dropdown, AST-verified custom chip injection
  ├── Paragraph mode toggle: [Fixed Boilerplate] vs [AI-Generated + Prompt Tip]
  └── [Confirm Variables & Generate Template ➔]
            │
            ▼
[STAGE 3: MINIMAL TEMPLATE CHECKPOINT]
  docxmlater performs AST text-run replacements & line-item loop collapsing
  ├── Inline status card: tag replacement count + loop collapse verification
  ├── Optional "Quick Preview (.docx)" modal via docx-preview
  └── [Proceed to Pricing Engine ➔]
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

### 4.2 Template Mutation with `docxmlater`
- Operates on the underlying OpenXML DOM AST without corrupting styling, typography, colors, or page margins.
- **Anchor Replacement:** Locates specific text runs using sample text and context anchors, replacing them with `{variable_name}` tags.
- **Smart Table Loop Collapse:**
  - Identifies repeating line-item rows (e.g., Row 1 to Row N-K).
  - Converts Row 1 into a template loop row: `{#line_items} {item_name} | {item_price} {/line_items}`.
  - Deletes redundant static sample rows (Row 2 through Row N-K).
  - Preserves table header (Row 0) and summary footer rows (Subtotal, Tax, Total, Terms).

### 4.3 Proposal Hydration with `easy-template-x`
- Ingests the templated `.docx` binary and a hydrated JSON data payload.
- Expands table loops dynamically to match the lead's exact line items.
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
