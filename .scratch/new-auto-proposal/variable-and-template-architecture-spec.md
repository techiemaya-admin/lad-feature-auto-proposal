<!-- labels: ready-for-agent -->
# Specification — Gemini Variable Extraction, Categorized Review Deck, and docXMLater Mutation Architecture

**Specification Version:** 1.0.0  
**Context:** `prototypes/new-auto-proposal`  
**Related Epics & Specifications:**
- Master Prototype Spec: [spec.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/spec.md)
- Blueprint & Pipeline Plan: [docs/plan.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/plan.md)
- Design Specifications: [docs/design.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/docs/design.md)
- Linked Issues:
  - [Issue 03: Gemini Variable Extraction and Categorized Review Chip-Deck](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/03-gemini-variable-extraction-and-interactive-review-table.md)
  - [Issue 04: docXMLater Word Template Mutation and Minimal Checkpoint Preview](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/04-docxmlater-word-template-mutation-and-in-browser-preview.md)
  - [Issue 05: Pricing Compiler, Visual Rule Cards, and Deterministic Math](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/05-pricing-compiler-visual-rule-cards-and-deterministic-math.md)
  - [Issue 06: Lead Simulator, Proposal Generation, and Verification](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/06-lead-simulator-proposal-generation-and-verification.md)

---

## Problem Statement

When service-based agencies (MSP, SEO, dev studios) run AI lead campaigns, incoming prospective clients reply asking for pricing. While lead generation is automated, quoting remains an exhausting manual chore: someone must manually interpret the lead's email, calculate custom rates, open a prior Word proposal, hunt for customer-specific names and quantities, overwrite text without corrupting formatting, and email it back.

Automating this quoting pipeline requires solving three brittle, interconnected engineering problems that existing systems fail to handle:
1. **Dynamic Variable Discovery Without Rigidity:** A static quotation `.docx` contains customer inputs (`Whitfield & Associates`, `42 seats`), pricing calculations (`$60.00/mo`, `$2,520.00 subtotal`), narrative prose (risk summaries), and structural tables. Manually defining hundreds of template tags or expecting non-technical agency owners to code Mustache tags (`{{var}}`) into Microsoft Word is completely non-viable.
2. **Lossless Word Template Mutation (AST Safety):** Naive string replacement or regex searching on `.docx` packages corrupts Word OpenXML formatting because text runs (`<w:r><w:t>`) are arbitrarily split across XML elements by Word (due to spellcheck, revisions, and XML escaping). Furthermore, repeating milestone tables and conditional pricing rows (like state tax or volume discounts) must be transformed into `easy-template-x` loop syntax (`{#items}...{/items}` and `{#condition}...{/condition}`) without stripping row shading, borders, and bold typography.
3. **Cognitive Overwhelm for Tenants:** Presenting tenants with an undifferentiated spreadsheet of 30+ raw variables (mixing boolean template flags like `has_tax` with business inputs like `seat_count` and multi-column comparison tables) creates confusion, leading to erroneous deletions and broken templates.

---

## Solution

A cohesive, AI-assisted variable discovery and lossless AST template mutation pipeline:
1. **Structured Gemini Extraction:** Backend service prompts Google Gemini with the quotation Markdown (from `@firecrawl/anydoc`) and natural `pricing_engine_spec` to extract a standardized JSON schema containing:
   - **Atomic Variables:** Categorized strictly into `customer_input`, `pricing` (including a first-class `selected_tier` enum), and `paragraph` (with `[Fixed]` vs `[AI-Generated]` modes).
   - **Derived Visibility Rules:** Boolean template conditions (such as `{#has_tax}` and `{#has_volume_discount}`) are modeled as derived properties attached to business line items, keeping technical plumbing out of the tenant's primary view.
   - **Compound Group Entities:** Structural document elements like the **3-Tier Comparison Matrix** and **Dynamic Repeating Tables (Loops)** are extracted as cohesive grouped entities rather than scattered individual chips.
   - **Deterministic Mutation Commands:** Concrete OpenXML mutation instructions (`replace_text_run`, `replace_table_cell`, `wrap_conditional_row`, `collapse_repeating_table`) with semantic locators (context anchors and table coordinate labels) that eliminate naive text replacement guessing.
2. **Categorized Variable Review Chip-Deck (`VariableReviewDeck.tsx`):** A tactile, modular interface displaying variables in 3 semantic buckets (Electric Sky, Mint/Emerald, and Amethyst/Violet) alongside dedicated Compound Cards for Tiers and Repeating Tables. Tenants can rename variables inline, switch categories, adjust enum defaults, toggle prompt tips, and add custom verified chips.
3. **Non-Destructive docXMLater Template Generation:** When confirmed, `docxmlater` mutates `original_quotation.docx` directly in memory:
   - Preserves cell shading, borders, and bold typography.
   - Wraps optional calculation rows in conditional row tags.
   - Collapses repeating sample rows into a single loop row while strictly preserving headers (Row 0) and summary footers.
   - Saves the clean template to `backend/storage/<company_id>/template.docx`.
4. **Hydration Bridge:** Generated templates use standard `easy-template-x` single-brace syntax, allowing the downstream deterministic JavaScript pricing engine and Gemini narrative drafter to hydrate finalized proposal documents with zero template impedance mismatch.

---

## User Stories

### Persona Definitions
- **Agency Tenant:** Agency owner, sales lead, or account manager configuring their quoting workflow.
- **Reviewer / Developer:** Engineering team member inspecting AST logs, schemas, and mutation integrity.
- **Lead Simulator Agent:** Background AI pipeline ingesting inbound lead emails to generate hydrated proposals.

### Extraction & Discovery Stories
1. As an agency tenant, I want Gemini to automatically scan my uploaded quotation and identify all customer-specific placeholders, so that I don't have to manually write template tags in Microsoft Word.
2. As an agency tenant, I want extracted variables to be organized into three distinct, scannable buckets (Customer Inputs, Pricing Placeholders, Narrative Paragraphs), so that I can immediately understand what parts of my document will vary per client.
3. As an agency tenant, I want the system to identify the service tiers in my quotation as an explicit `selected_tier` enum variable, so that I can see the available package options (e.g. Essential, Standard, Premium) and set the default recommendation.
4. As an agency tenant, I want multi-column package comparison tables to be grouped into a single visual Tier Matrix card, so that I am not overwhelmed by 10+ individual disconnected rate and feature chips.
5. As an agency tenant, I want repeating line-item tables (such as milestone phases) to be represented as a unified Compound Repeating Table card, so that I understand which columns repeat dynamically.
6. As an agency tenant, I do not want to see technical templating booleans (such as `has_tax` or `has_volume_discount`) as standalone chips, so that my review space remains focused on business variables.
7. As an agency tenant, I want conditional pricing rows to show a subtle `[Conditional: Hidden if $0]` indicator on the primary line item, so that I know the row will automatically hide when not applicable.

### Review Deck UI & Interaction Stories
8. As an agency tenant, I want to edit a variable's natural name inline on its chip, so that my team recognizes familiar business terminology.
9. As an agency tenant, I want to move a variable to a different category bucket via a dropdown selector, so that I can correct any AI misclassifications.
10. As an agency tenant, I want moving a variable to the "Paragraph" category to default its mode to `[Fixed Boilerplate]`, so that text is never sent to the AI unless I explicitly request it.
11. As an agency tenant, I want to toggle narrative paragraph chips between `[Fixed Boilerplate]` (verbatim quote text) and `[AI-Generated]` (with prompt guidance and tone instructions), so that standard legal language remains exact while pitch narratives adapt to leads.
12. As an agency tenant, I want to delete false-positive variable chips, with the guarantee that the original text in the Word document will remain as static text, so that deleting a chip never leaves a blank hole or breaks layout.
13. As an agency tenant, I want to add a custom variable chip by providing an exact snippet of text from the quotation, validated against the document AST, so that I can capture any niche placeholders the AI missed.
14. As an agency tenant, I want clean category filter pills (`All`, `Customer Inputs`, `Pricing`, `Paragraphs`) at the top of the deck without noisy counter badges, so that I can focus on one category bucket cleanly without cognitive clutter.
15. As an agency tenant, I want changes made in the Review Deck to persist across company tab switches and browser reloads via SQLite, so that I never lose my curation progress.

### docXMLater Mutation & Template Generation Stories
16. As an agency tenant, I want to click `[Generate Template ➔]` to automatically inject template tags into my Word document without opening Microsoft Word.
17. As a reviewer inspecting Word mutations, I want `docxmlater` to use semantic locators (context anchors and table coordinate identifiers) rather than global string search, so that duplicate numbers (like `$60.00` appearing in multiple sections) do not overwrite the wrong section.
18. As a reviewer inspecting Word mutations, I want `docxmlater` to wrap conditional calculation rows across cells (`{#has_tax}` in Cell 0, `{/has_tax}` in Cell 1), so that `easy-template-x` can prune the entire row if tax is zero without corrupting table grid geometry.
19. As a reviewer inspecting Word mutations, I want table cell background colors, borders, and bold font styling to remain 100% intact when cell text is replaced, so that the agency's branded Word styling is preserved.
20. As a reviewer inspecting Word mutations, I want repeating line-item tables to retain their header row (Row 0) and collapse the first sample row into a loop row (`{#items}...{/items}`) while deleting redundant sample rows, so that the template is ready for variable-length items.
21. As an agency tenant, I want the generated template saved to disk and a minimal checkpoint card displayed showing placed tag counts and loop status, so that I have clear feedback before proceeding to pricing.
22. As an agency tenant, I want an optional "Quick Preview (.docx)" modal using `docx-preview` and a "Download Template .docx" button, so that I can visually verify the mutated Word template on demand.

### Downstream Integration & Simulation Stories
23. As a lead simulator agent, I want narrative variables to carry explicit `generation_contract` guidelines (purpose, tone, length constraints, sample references), so that drafted paragraphs strictly match the agency's brand voice.
24. As a lead simulator agent, I want the deterministic JavaScript math engine to supply both numeric calculation values and pre-formatted currency strings (with correct negative signs like `−$105.00`), so that template rendering is free of formatting anomalies like `$-105.00`.
25. As a reviewer verifying system accuracy, I want the generated template and compiled rules to hydrate finalized `.docx` proposals matching our three ground-truth benchmarks ($35,073.00, $2,734.80 + $3,150.00, and $10,445.00), so that the entire pipeline is verified end-to-end.

---

## Implementation Decisions

### 1. Architectural Decisions & Alternatives Evaluated

#### Decision A: 3 Semantic Buckets + Compound Groups (vs. 4 Flat Buckets or Generic "Other")
- **Selected Approach:** 3 primary category buckets (`customer_input`, `pricing`, `paragraph`) plus dedicated **Compound Group Cards** for structural elements (Tier Comparison Matrix and Repeating Table Loops).
- **Alternatives Evaluated:**
  - *Alternative 1: 4 Flat Buckets (`Customer Inputs`, `Pricing`, `Paragraphs`, `Tables`).*
    - **Why Rejected:** A table is a layout container, not a data type. Inside a table, rows contain customer inputs (seats: 42), pricing values ($60.00/mo), and narrative descriptions. Treating tables as flat chips forced nested sub-editors inside chips, creating visual clutter and violating the flat, tactile chip deck design.
  - *Alternative 2: A generic "Other" or "System / Conditions" Bucket.*
    - **Why Rejected:** Exposing raw templating flags like `has_tax`, `has_volume_discount`, and `show_subtotal` confuses tenants. Tenants think in terms of business line items ("Ohio Sales Tax"), not boolean template conditionals.
- **Rationale for Selected Approach:** Placing business variables into 3 intuitive buckets while modeling repeating tables and tier matrices as visual Compound Cards matches human mental models. Technical conditional flags are attached as *derived visibility metadata* directly on the line items.

#### Decision B: Derived Visibility Flags (vs. User-Facing Boolean Chips)
- **Selected Approach:** Any conditional row in a table (e.g., volume discounts, extra devices, sales tax) is represented by its primary business variable (`tax_amount`). In the metadata, a `visibility_rule` specifies `flag_tag: "has_tax"`, `show_when: "value > 0"`.
- **Alternatives Evaluated:**
  - *Alternative: Create explicit user-facing boolean chips (`has_tax: boolean`).*
    - **Why Rejected:** Forces the user to review two chips for every conditional row (`tax_amount` AND `has_tax`). If the user deletes or misnames the boolean chip, the row loop breaks.
- **Rationale for Selected Approach:** The calculation engine automatically derives `has_tax = tax_amount > 0` during proposal calculation. The tenant sees a simple `[Conditional: Hidden if $0]` indicator on the `Ohio State Tax` card, keeping the review interface clean and idiot-proof.

#### Decision C: Hybrid Relational Database Storage (`company_variables`)
- **Selected Approach:** Store variables in a dedicated SQLite table `company_variables` with queryable relational columns (`id`, `company_id`, `variable_name`, `natural_name`, `category`, `data_type`, `is_deleted`, `sort_order`) and a `descriptor_json` TEXT column for polymorphic attributes (`mutation`, `generation_contract`, `enum_options`, `visibility_rule`).
- **Alternatives Evaluated:**
  - *Alternative 1: Pure JSON Column in `company_sessions` (`variables_json TEXT`).*
    - **Why Rejected:** Adding custom variables or performing single-variable updates requires reading, parsing, mutating, and writing back large JSON payloads, risking race conditions and losing SQL querying capabilities.
  - *Alternative 2: Fully Normalized Relational Table (15+ SQL columns).*
    - **Why Rejected:** High schema rigidity. Adding metadata attributes (like prompt tips, table column mappings, or AST locator coordinates) would require frequent database schema migrations.
- **Rationale for Selected Approach:** Combines the speed and querying power of relational SQL with the flexibility of JSON for complex document mutation descriptors.

#### Decision D: Standardized 4-Action Mutation Schema for `docxmlater`
- **Selected Approach:** Gemini outputs one of 4 strict mutation action types: `replace_text_run`, `replace_table_cell`, `wrap_conditional_row`, and `collapse_repeating_table`.
- **Alternatives Evaluated:**
  - *Alternative 1: Naive Global Search and Replace on Word text.*
    - **Why Rejected:** OpenXML text run splitting breaks phrases like `"Whitfield & Associates"`. In addition, identical numbers (e.g. `"$60.00"`) appear in multiple places (tier card, calculation table, narrative parenthetical), causing catastrophic text substitution collisions.
  - *Alternative 2: Raw XPath / XML Node Manipulation.*
    - **Why Rejected:** Extremely fragile; exposes internal WordprocessingML quirks (`w:r`, `w:t`, `w:rPr`) and easily causes schema corruption ("Unreadable content" error in Word).
- **Rationale for Selected Approach:** `docxmlater` maintains an in-memory DOM. Semantic locators (`context_anchor` for text runs, `table_index` + `row_identifier` for table cells) ensure 100% deterministic tag placement without XML corruption.

#### Decision E: Static Word Shading with Dynamic Recommended Badges (Tier Comparison Matrix)
- **Selected Approach:** In the 3-tier comparison matrix, the middle column retains Word's pre-styled background shading and borders. Dynamic variables template the tier names, rates, SLAs, and a dynamic recommendation badge (`{tier_2_badge}`).
- **Alternatives Evaluated:**
  - *Alternative: Dynamically shifting cell background colors in OpenXML based on the recommended tier.*
    - **Why Rejected:** Neither `easy-template-x` nor standard Word template substitution engines can dynamically move `<w:shd w:fill="...">` XML tags between table columns based on data booleans without custom low-level XML rewriting.
- **Rationale for Selected Approach:** B2B service agencies design their rate cards with the middle tier as the core/anchor package (Decoy / Goldilocks pricing). If a lead selects a different tier, the narrative explicitly states the selected tier, and the `{tier_x_badge}` attaches `" — Recommended"` to the selected package, preserving the polished Word visual design.

#### Decision F: First-Class `selected_tier` Enum Variable
- **Selected Approach:** The tier choice is modeled as an explicit `enum` variable under the `pricing` category (e.g. `options: ["Essential", "Standard", "Premium"]`, `default_value: "Standard"`).
- **Rationale:** Provides a clean single source of truth that powers the UI dropdown, instructs Gemini on valid tier classifications during lead extraction, controls narrative headings (`**02 Recommended Tier: {selected_tier}**`), and serves as the deterministic lookup key in the pricing calculator.

#### Decision G: Agency Identity Collision Guard (Seller vs. Buyer Distinction)
- **Selected Approach:** Inject the agency's `company_basics` (name, address, email, phone) into the Gemini system prompt as a strict negative constraint. The prompt explicitly instructs Gemini that the agency is the SELLER/SENDER and must never have its identity, address, or staff details extracted as customer variables; all agency mentions must remain static Word text.
- **Rationale:** Eliminates a catastrophic false-positive failure mode where the LLM confuses the quoting agency (e.g., "Fortress IT", "Northstar") with the prospective customer (e.g., "Whitfield & Associates", "Bloom & Co.").

#### Decision H: docXMLater Table Loop ECMA-376 Structural Invariants
- **Selected Approach:** When collapsing repeating tables, `docxmlater` strictly preserves Row 0 as the static column header, transforms Row 1 into the loop row (`{#items} ... {/items}`), prunes redundant sample rows (Row 2+), and strictly preserves all trailing summary footers (Subtotal, Tax, Total, Payment Terms).
- **Rationale:** Under ECMA-376 OpenXML rules, tables must contain at least one row, and pruning headers or summary rows breaks table geometry and layout integrity.

#### Decision I: Minimalist Review Deck Copywriting & Unbloated Filter Tabs
- **Selected Approach:** Eliminate artificial counter numbers from category tabs (displaying simple, unbloated filter pills: `All`, `Customer Inputs`, `Pricing`, `Paragraphs`) and strip out chatty subtitle stats (e.g. "22 dynamic fields and 2 structured sections detected"). Use a clean, punchy theme-blue CTA: `[ Generate Template ➔ ]`.
- **Rationale:** Aligns with the core design vision of Rush Away Auto-Proposal: minimal, fluid, and anti-AI-slop. Reduces cognitive clutter and keeps the user focused on high-value business verification.

---

### 2. Modules & System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND SERVICES                                │
│                                                                             │
│  [AnyDoc Markdown] + [Company Profile]                                      │
│        │                                                                    │
│        ▼                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ variable-extractor.ts                                                 │  │
│  │ - Prompts Gemini with Structured Output JSON Schema                   │  │
│  │ - Validates extraction conforms to Unified Variable Schema            │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ SQLite Database (company_variables table)                             │  │
│  │ - Persists atomic variables, compound tables, and mutation actions    │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ template-mutator.ts (docxmlater engine)                               │  │
│  │ - Loads original_quotation.docx                                       │  │
│  │ - Executes: replace_text_run, replace_table_cell                      │  │
│  │ - Executes: wrap_conditional_row, collapse_repeating_table            │  │
│  │ - Saves storage/<company_id>/template.docx                            │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Downstream Consumers                                                  │  │
│  │ - pricing-calculator.ts: uses confirmed pricing variables & tier enum │  │
│  │ - lead-simulator.ts: uses prompt tips & easy-template-x to hydrate    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Database Schema (`backend/src/db/database.ts`)

```sql
CREATE TABLE IF NOT EXISTS company_variables (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  natural_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('customer_input', 'pricing', 'paragraph', 'table_loop', 'comparison_matrix', 'compound_table')),
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'currency', 'enum', 'paragraph', 'table')),
  is_custom INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  descriptor_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES company_sessions(company_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_variables_lookup 
ON company_variables (company_id, category, is_deleted);
```

*Note on Compound Entities:* Compound tables (`repeating_loop` or `comparison_matrix`) can be persisted in `company_variables` with `category IN ('table_loop', 'comparison_matrix', 'compound_table')` and `data_type = 'table'`, storing their column mappings and table metadata in `descriptor_json`.


#### Descriptor JSON Shape (`descriptor_json`):
```typescript
interface VariableDescriptor {
  sample_value?: string;
  description?: string;
  enum_options?: string[];
  default_value?: string;
  visibility_rule?: {
    conditional: boolean;
    condition_flag: string;
    show_when: string; // e.g. "value > 0"
  };
  paragraph_config?: {
    mode: "fixed" | "ai_generated";
    purpose: string;
    tone: string;
    length_guideline: string;
    sample_reference?: string;
  };
  mutation: MutationAction;
}
```

---

### 4. System Implementation Details

#### 4.1 UI/UX Architecture & Transient States (`VariableReviewDeck.tsx`)
Following the design principles established in `PromptDocCapsule.tsx` and `DESIGN.md`:
- **Surface Elevation & Container:** Elevated card surface (`bg-card rounded-2xl border border-border/80 shadow-xs`) positioned directly beneath the locked briefing capsule.
- **Minimalist, Unbloated Header:** Clean title `Variables` with zero chatty marketing statistics or artificial counts.
- **Unbloated Category Filter Pills:** Segmented pill tray matching the app header (`bg-muted/60 p-0.5 border border-border/40 rounded-lg text-xs`):
  - `[ All ]`
  - `[ Customer Inputs ]`
  - `[ Pricing ]`
  - `[ Paragraphs ]`
  - A subtle `[+ Add]` ghost button on the far right for custom user chips.
- **Tactile Variable Chip Anatomy:** Directly inspired by the document status chip in `PromptDocCapsule`:
  - Enclosed in an elevated card or row (`bg-muted/40 hover:bg-muted/60 border border-border/40 rounded-lg p-3 transition-all hover:-translate-y-0.5`).
  - Top row: Semantic color dot (`size-1.5 rounded-full bg-sky-500` / `bg-emerald-500` / `bg-violet-500`) + category label (`Customer Input` / `Pricing` / `Paragraph`), borderless inline editable natural name, category dropdown selector, and a subtle `[×]` remove icon (retains static Word text).
  - Bottom row: Monospace template tag (`{client_name}` in `font-mono text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/40`) alongside the verbatim sample snippet (`"Whitfield & Associates"`) in subdued text.
- **Paragraph Card Anatomy:** Uses the recessed inner well pattern (`rounded-xl bg-muted/30 border border-border/30 p-3`):
  - Segmented mode toggle: `[ Fixed ]` vs `( AI Drafted )`.
  - When `Fixed`: Displays original quote text read-only in the well.
  - When `AI Drafted`: The well reveals a borderless, auto-resizing guidance textarea (`text-xs bg-transparent border-0 focus-visible:ring-0 resize-none`) labeled `"Guidance for AI"`.
- **Compound Cards:**
  - *Tier Comparison Matrix Card:* Compact horizontal preview showing the detected service packages (e.g., `Essential • Standard • Premium`) with an interactive default tier selector (`[ Standard ▾ ]`).
  - *Repeating Table Card:* Displays detected line-item loops (e.g., `Project Milestones`) with the loop tag (`{#items}...{/items}`) and detected columns.
- **Primary CTA:** Standard theme-blue advance button positioned at the bottom right: `[ Generate Template ➔ ]` (`h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`).
- **Transient Loading Experience:**
  - While Gemini runs extraction (~2–4s), an ambient 2px gradient shimmer bar (`h-0.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-violet-500 animate-pulse`) runs across the top border.
  - 3 pulsating skeleton cards (`animate-pulse h-16 rounded-xl bg-muted/60`) represent loading categories.
  - Quiet, conversational status label: *"Scanning quotation structure and placeholders..."*
  - Non-destructive error state with an `[ Retry Analysis ↻ ]` button if the network or API fails.

#### 4.2 Simple Gemini Integration Architecture
Direct, isolated integration without complex key rotation or heavyweight dependencies:
- **Package:** `@google/generative-ai` installed in `prototypes/new-auto-proposal/backend/package.json`.
- **Environment Isolation (`backend/.env`):**
  ```env
  PORT=3001
  STORAGE_DIR=./storage
  DB_PATH=./storage/database.sqlite
  GEMINI_API_KEY=<key>
  GEMINI_MODEL=gemini-2.5-flash
  ```
- **Service Implementation (`backend/src/services/gemini.service.ts`):**
  - Direct initialization via `new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)`.
  - Native Structured Outputs via `generationConfig: { responseMimeType: "application/json", responseSchema: extractionResponseSchema }`.
  - **Schema Flattening Guard:** Gemini's `responseSchema` parser strictly rejects complex discriminated unions or `anyOf` with a 400 error. The `mutation` descriptor in `responseSchema` is flattened into an object with `action: SchemaType.STRING` (enum) and optional locator properties, which backend TypeScript types safely cast into `MutationAction`.
  - Eliminates markdown code-fence parsing (` ```json `), regex JSON stripping, and JSON repair libraries.

#### 4.3 Prompt Engineering & Context Assembly
The backend extraction service assembles three distinct data layers from SQLite into a structured prompt:
1. **Layer 1: Quotation Markdown:** The semantic markdown parsed by AnyDoc (`company_sessions.quotation_markdown`).
2. **Layer 2: Natural Pricing Spec:** The agency's natural pricing context (`company_sessions.pricing_spec`).
3. **Layer 3: Agency Identity Context (`company_basics`):** Agency name, location, contact email, and phone.

**Prompt Directive & Extraction Guidelines:**
```markdown
You are an expert document analysis and quotation templating engine.
Analyze the quotation markdown and pricing specification to extract all dynamic variables,
table structures, and mutation instructions needed to convert this document into a reusable Word template.

### 1. AGENCY IDENTITY GUARD (CRITICAL NEGATIVE CONSTRAINT):
The quotation was authored by the service agency: "{company_name}".
- DO NOT extract variables for "{company_name}" or its staff, email, address, or phone numbers.
- Any mention of "{company_name}" and its company details must remain STATIC original text.
- ONLY extract variables for the PROSPECTIVE CLIENT / BUYER (e.g. client company name, contact person, seat count).

### 2. TAXONOMY CATEGORIES:
- "customer_input": Values that vary per prospective client inquiry (client name, locations, seats, state).
- "pricing": Computed financial line items, unit rates, setup fees, subtotals, taxes, and totals.
  - Multi-tier offerings must extract an explicit "selected_tier" enum variable with available options (e.g. ["Essential", "Standard", "Premium"]) and default recommendation.
- "paragraph": Multi-sentence clauses or narrative statements.
  - Mode defaults to "fixed" (verbatim quote text).
  - Set mode to "ai_generated" with a prompt guideline if the clause contains dynamic pitch content.

### 3. DERIVED VISIBILITY RULES (CONDITIONAL ROWS):
Do NOT extract standalone technical booleans like "has_tax" or "has_volume_discount".
Instead, attach visibility metadata directly to the monetary variable:
e.g. For sales tax ($154.80): variable_name="sales_tax_amount", visibility_rule={ condition_flag: "has_tax", show_when: "value > 0" }.

### 4. COMPOUND TABLES & REPEATING LOOPS:
- Classify multi-tier package comparison tables as compound_table type "comparison_matrix".
- Classify repeating sample deliverable or milestone tables as compound_table type "repeating_loop" with loop_tag="items".

### 5. DETERMINISTIC MUTATION LOCATORS (FOR DOCXMLATER):
For every variable, provide an exact mutation action:
- Text run in body: action="replace_text_run", sample_text="...", context_anchor="..."
- Table cell: action="replace_table_cell", table_index=N, row_identifier="...", col_index=N, sample_text="..."
- Conditional table row: action="wrap_conditional_row", table_index=N, row_identifier="...", condition_tag="..."
- Repeating table: action="collapse_repeating_table", table_index=N, loop_tag="items", template_row_index=1, delete_sample_rows_from=2
```

#### 4.4 TypeScript Types & Structured Output Contract
Gemini extraction uses `@google/generative-ai` with native structured output (`generationConfig: { responseMimeType: "application/json", responseSchema: extractionResponseSchema }`), returning a structured JSON payload conforming to:

```typescript
type MutationAction =
  | {
      action: "replace_text_run";
      sample_text: string;
      context_anchor: string;
      template_tag: string;
    }
  | {
      action: "replace_table_cell";
      table_index: number;
      row_identifier: string;
      col_index: number;
      sample_text: string;
      template_tag: string;
    }
  | {
      action: "wrap_conditional_row";
      table_index: number;
      row_identifier: string;
      condition_tag: string;
      cells: Array<{
        col_index: number;
        preserve_existing_label?: boolean;
        template_tag: string;
      }>;
    }
  | {
      action: "collapse_repeating_table";
      table_index: number;
      loop_tag: string;
      template_row_index: number;
      column_tags: Array<{
        col_index: number;
        replacement_tag: string;
      }>;
      delete_sample_rows_from: number;
    };

interface ExtractionResponse {
  document_summary: string;
  variables: Array<{
    variable_name: string;
    natural_name: string;
    category: "customer_input" | "pricing" | "paragraph";
    data_type: "string" | "number" | "currency" | "enum" | "paragraph";
    sample_value: string;
    description: string;
    enum_options?: string[];
    default_value?: string;
    visibility_rule?: {
      condition_flag: string;
      show_when: string;
    };
    paragraph_config?: {
      mode: "fixed" | "ai_generated";
      purpose: string;
      tone: string;
      length_guideline: string;
    };
    mutation: MutationAction;
  }>;
  compound_tables: Array<{
    table_id: string;
    natural_name: string;
    table_index: number;
    type: "comparison_matrix" | "repeating_loop";
    loop_tag?: string;
    columns: any[];
    mutation?: MutationAction;
  }>;
}
```

---

### 5. API Contracts

#### 1. `POST /api/companies/:id/variables/extract`
- **Trigger:** Initiated automatically or via UI upon advancing from the Briefing stage.
- **Request Body:** `{}` (reads `quotation_markdown` and `pricing_spec` from `company_sessions`).
- **Response (200 OK):**
  ```json
  {
    "company_id": "co2_msp",
    "extracted_count": 18,
    "variables": [ ... ],
    "compound_tables": [ ... ]
  }
  ```

#### 2. `GET /api/companies/:id/variables`
- **Response (200 OK):** Returns all persisted variables and compound tables for the company.

#### 3. `PUT /api/companies/:id/variables`
- **Request Body:** `{ "variables": [ ... ], "compound_tables": [ ... ] }`
- **Behavior:** Updates natural names, category moves, paragraph modes, and deleted flags in SQLite.
- **Response (200 OK):** `{ "success": true, "updated_count": 18 }`

#### 4. `POST /api/companies/:id/variables/custom`
- **Request Body:**
  ```json
  {
    "natural_name": "Emergency Phone Number",
    "category": "customer_input",
    "exact_quotation_snippet": "(614) 555-0193",
    "context_anchor": "Confirm by reply or call (614) 555-0193"
  }
  ```
- **Validation:** Verifies that `exact_quotation_snippet` exists inside the company's `quotation_markdown`.
- **Response (201 Created):** Returns the newly bound custom variable record.

#### 5. `POST /api/companies/:id/template/generate`
- **Trigger:** Tenant clicks `[Generate Template ➔]`.
- **Behavior:** Loads `original_quotation.docx`, executes confirmed `mutations` via `docxmlater`, and saves `storage/<company_id>/template.docx`.
- **Response (200 OK):**
  ```json
  {
    "template_path": "storage/co2_msp/template.docx",
    "tags_placed_count": 22,
    "loops_collapsed_count": 1,
    "conditional_rows_wrapped_count": 3
  }
  ```

#### 6. `GET /api/companies/:id/template/download`
- **Response:** Streams the binary `.docx` file with header `Content-Disposition: attachment; filename="template.docx"`.

---

## Testing Decisions

### What Makes a Good Test
- **External Behavior Only:** Tests must assert public API contracts, database persistence, and ECMA-376 OpenXML file integrity—never private class methods.
- **Zero Arithmetic Hallucination:** Math calculations in downstream pricing must reproduce ground-truth benchmarks to the exact penny.
- **Non-Destructive Word Processing:** Every mutated `template.docx` must open cleanly in Microsoft Word and `docx-preview` without triggering Word's "unreadable content / repair" warning.

### Key Testing Modules
1. **Extraction Service Tests (`variable-extractor.test.ts`):**
   - Mock Gemini responses with mock quotation markdown.
   - Assert structured JSON conforms to `ExtractionResponse` schema.
   - Assert `selected_tier` enum is present for tiered companies (`co1_seo`, `co2_msp`).
2. **Database Persistence Tests (`variables-db.test.ts`):**
   - Assert CRUD operations in `company_variables` table.
   - Assert custom variables insert with `is_custom = 1`.
   - Assert soft deletion retains static text intent (`is_deleted = 1`).
   - Assert session isolation (variables for `co1_seo` do not leak into `co2_msp`).
3. **docXMLater Mutation Service Tests (`template-mutator.test.ts`):**
   - Load actual `.docx` files from `Mock Data/docx/`.
   - Execute all 4 mutation types (`replace_text_run`, `replace_table_cell`, `wrap_conditional_row`, `collapse_repeating_table`).
   - Assert generated `.docx` buffers contain single-brace tags (`{tag}`) and loop tags (`{#loop}`).
   - Verify table row count decreases when sample rows are pruned.
   - Verify cell background shading `<w:shd>` is preserved after text replacement.
4. **End-to-End Benchmark Verifications:**
   - Verify calculations match `verification_guide.md`:
     - Northstar (`co1_seo`): **$35,073.00**
     - Fortress IT (`co2_msp`): **$2,734.80/mo recurring + $3,150.00 setup**
     - Fieldstone (`co3_dev`): **$10,445.00**

---

## Out of Scope

- Client authentication, JWT tokens, and organization row-level isolation (prototype uses company tabs `co1_seo`, `co2_msp`, `co3_dev`).
- Dynamic real-time XML recoloring of Word table cells (OpenXML cell shading remains static as designed in the agency template).
- PDF conversion or LibreOffice server rendering (Word `.docx` is the canonical format, previewed via `docx-preview`).
- Direct SMTP/Gmail sending or email webhook dispatchers.

---

## Further Notes & Edge Case Ledger

### Identified Edge Cases & Solutions
1. **Embedded Variables Inside Table Label Cells:**
   - *Scenario:* Fortress IT Table 3 Row 5 has label: `Seat subtotal (42 seats × $60.00)`.
   - *Solution:* The mutation schema allows `cells[0]` to specify a template pattern: `Seat subtotal ({seat_count} seats × ${adjusted_seat_rate})`.
2. **Negative Currency Formatting:**
   - *Scenario:* Bundle and volume discounts appear as `−$105.00` or `−$5.00`.
   - *Solution:* The pricing calculation engine formats display currency strings explicitly with the minus sign (`−$105.00`), avoiding ugly template artifacts like `$-105.00`.
3. **OpenXML Single-Row & Header/Footer Structural Invariants:**
   - *Scenario:* ECMA-376 requires every table to have at least one row (`table.removeRow(0)` on a 1-row table returns `false`), and arbitrary row pruning can corrupt column headers or destroy financial summary rows.
   - *Solution:* Repeating table collapse strictly preserves Row 0 as the static column header and keeps Row 1 intact as the dynamic loop row (`{#items}...{/items}`). Only redundant sample rows (Row 2+) are pruned. To avoid shifting index collisions where removing a row shifts higher rows into its position, deletions must execute in reverse order (`for (let i = summaryStartIndex - 1; i >= delete_sample_rows_from; i--) table.removeRow(i);`). Any trailing summary rows (Subtotal, Tax, Total, Payment Terms) are strictly preserved with zero row deletion.
4. **Zero-Item Add-ons:**
   - *Scenario:* A client selects zero add-ons.
   - *Solution:* `has_addons` resolves to `false`, causing `{#has_addons}...{/has_addons}` to drop the add-on subtotal rows cleanly without rendering empty table space.
5. **Hybrid Table Locator Resolution (Off-by-One Index Guard):**
   - *Scenario:* AnyDoc markdown can occasionally omit layout callouts or header boxes, causing Gemini's estimated `table_index` in markdown to be offset from Word's physical table index in OpenXML.
   - *Solution:* `template-mutator.service.ts` implements hybrid locator resolution: it tests `table_index` first as a fast-path; if `row_identifier` is not found in that table, it automatically scans all tables (`doc.getTables()`) to locate the row matching `row_identifier` semantically, preventing off-by-one indexing failures.
6. **Database Re-Scan Idempotency:**
   - *Scenario:* A user re-extracts variables after adjusting their pricing prompt, risking primary key collisions or accumulating duplicate rows.
   - *Solution:* In `POST /api/companies/:id/variables/extract`, execute atomic re-extraction: `DELETE FROM company_variables WHERE company_id = ? AND is_custom = 0` removes previous AI-discovered variables before inserting fresh ones, while strictly preserving any user-added custom variables (`WHERE is_custom = 1`).
7. **`easy-template-x` Table Row Loop Syntax Alignment:**
   - *Scenario:* Row duplication requires exact placement of loop boundaries across table cells.
   - *Solution:* In Row 1 of repeating tables, `{#items}` is injected into Cell 0, and `{/items}` is injected into the last Cell, with `{field}` tags in intermediate cells, ensuring clean ECMA-376 `<tr>` cloning without stripping cell shading `<w:shd>`, borders, or font properties.
8. **Cascading Hard Reset on Briefing Unlock:**
   - *Scenario:* A user unlocks the briefing to adjust quote text or upload a new file, but downstream variable rows or mutated templates remain active.
   - *Solution:* Under Unidirectional State Discipline (Hard Reset Policy), `POST /api/companies/:id/briefing/unlock` executes `DELETE FROM company_variables WHERE company_id = ?` and cleans up `storage/<company_id>/template.docx`, ensuring downstream state is cleanly reset.


### Items Pending Future Exploration
- **Custom Variable Fuzzy Matching:** If a tenant provides a quotation snippet with slight whitespace differences (e.g. non-breaking space `\u00A0` in Word vs standard space `\u0020` in Markdown), AST validation should normalize Unicode whitespace before matching.
- **Nested Sub-tables:** Future iterations may explore nested tables inside table cells, currently out of scope for standard quotation formats.
