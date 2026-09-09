# 03: Gemini Variable Extraction and Categorized Review Deck

**What to build:** A full-stack AI variable discovery and interactive review deck (`VariableReviewDeck.tsx`). When a company's briefing is locked, the backend prompts Google Gemini (`@google/generative-ai` with native structured outputs) using the AnyDoc quotation markdown, pricing engine spec, and agency profile context (with a strict agency identity collision guard). Discovered variables, tiers, and compound tables are persisted in SQLite (`company_variables`). In the frontend, an ambient top-edge shimmer bar and skeleton buckets display during the ~2-4s extraction, resolving into an elevated `Variables` card deck organized into clean, unbloated filter pills (`All`, `Customer Inputs`, `Pricing`, `Paragraphs`). The tenant can edit natural names inline borderless, re-categorize variables via dropdown, toggle paragraph cards between `[Fixed Boilerplate]` and `[AI Drafted]` with guidance text, delete false positives (which retains the original text as static Word content), and add custom snippet chips verified against markdown. At the bottom, a primary theme-blue button `[ Generate Template ➔ ]` advances to template mutation.

**Specification:** [variable-and-template-architecture-spec.md](../variable-and-template-architecture-spec.md)  
**Master Spec:** [spec.md](../spec.md)  
**Design Guide:** [docs/design.md](../../prototypes/new-auto-proposal/docs/design.md)  
**Blocked by:** 02: Compound Briefing Capsule and Quotation Ingestion Pipeline (Completed)  

**Status:** completed

---

## 1. Problem Statement & Background

When service agencies (MSP, SEO, dev studios) run quoting campaigns, extracting dynamic placeholders from existing proposals is painful:
1. **Manual Tagging is Non-Viable:** Expecting non-technical agency owners to write Mustache tags (`{{var}}`) or code XML in Microsoft Word breaks onboarding.
2. **Cognitive Overwhelm:** Presenting tenants with an undifferentiated spreadsheet of 30+ raw variables (mixing technical boolean flags like `has_tax` with business inputs like `seat_count`) creates confusion and leads to erroneous deletions.
3. **Agency Identity Collision Risk:** Standard LLM prompts frequently mistake the quoting agency's own details (company name, address, staff email in the proposal header) for customer placeholders, contaminating the template.

---

## 2. Architectural Decisions & Alternatives Evaluated

### Decision A: 3 Semantic Buckets + Compound Cards (vs. 4 Flat Buckets or Generic "Other")
- **Selected Approach:** 3 primary category buckets (`customer_input`, `pricing`, `paragraph`) plus dedicated visual Compound Cards for structural elements (3-Tier Comparison Matrix and Repeating Table Loops).
- **Alternatives Evaluated:**
  - *4 Flat Buckets (`Customer Inputs`, `Pricing`, `Paragraphs`, `Tables`):* Rejected because a table is a layout container, not a data type. Inside a table, rows contain customer inputs, pricing values, and narrative descriptions.
  - *Generic "Other" or "Conditions" Bucket:* Rejected because exposing raw flags like `has_tax` confuses business owners.
- **Rationale:** Aligns with human mental models. Technical flags are attached as *derived visibility rules* directly on line items.

### Decision B: Derived Visibility Flags (vs. User-Facing Boolean Chips)
- **Selected Approach:** Conditional rows (sales tax, volume discounts) are represented by their primary monetary variable (`tax_amount`). Metadata specifies `visibility_rule: { condition_flag: "has_tax", show_when: "value > 0" }`.
- **Alternative Evaluated:** Create explicit user-facing boolean chips (`has_tax: boolean`).
- **Why Rejected:** Forces reviewing two chips for every conditional row. If deleted or renamed, the template loop breaks.

### Decision C: Hybrid Relational Database Storage (`company_variables`)
- **Selected Approach:** Dedicated SQLite table `company_variables` with queryable relational columns (`id`, `company_id`, `variable_name`, `natural_name`, `category`, `data_type`, `is_deleted`, `sort_order`) and a `descriptor_json` TEXT column for polymorphic attributes (`mutation`, `paragraph_config`, `enum_options`, `visibility_rule`).
- **Alternatives Evaluated:**
  - *Pure JSON column in `company_sessions`:* Modifying single variables risks race conditions and loses SQL indexing.
  - *Fully normalized 15+ column table:* High schema rigidity requiring frequent migrations for new metadata.

### Decision D: First-Class `selected_tier` Enum Variable
- **Selected Approach:** Model package tier as an explicit `enum` variable under `pricing` (e.g. `options: ["Essential", "Standard", "Premium"]`, `default_value: "Standard"`).
- **Rationale:** Single source of truth that powers the UI dropdown, instructs Gemini on valid tier classifications, and controls downstream deterministic pricing lookups.

### Decision G: Agency Identity Collision Guard (Seller vs. Buyer Distinction)
- **Selected Approach:** Inject agency basics (`company_name`, address, email, phone) into the Gemini prompt under a strict negative constraint: the agency is the SELLER, and its details must NEVER be extracted as customer placeholders; they must remain static Word text.
- **Rationale:** Completely eliminates false positives where the quoting agency is confused with the prospective client.

### Decision I: Minimalist Review Deck Copywriting & Unbloated Filter Tabs
- **Selected Approach:** Strip chatty marketing counts (e.g. "22 dynamic fields detected"). Use quiet, unbloated filter tabs (`All`, `Customer Inputs`, `Pricing`, `Paragraphs`) and a punchy advance button: `[ Generate Template ➔ ]`.
- **Rationale:** Respects the clean, quiet design system established in `PromptDocCapsule.tsx` and `CompanyProfileCard.tsx`.

---

## 3. Gemini Integration & Prompt Engineering

### Isolated Backend Configuration (`backend/.env`):
```env
PORT=3001
STORAGE_DIR=./storage
DB_PATH=./storage/database.sqlite
GEMINI_API_KEY=<key>
GEMINI_MODEL=gemini-2.5-flash
```

### Direct Gemini Service (`backend/src/services/gemini.service.ts`):
- Uses `@google/generative-ai` with native structured output (`responseMimeType: "application/json"`, `responseSchema: extractionResponseSchema`).
- **Schema Flattening Guard:** Avoids complex discriminated unions or `anyOf` in Gemini's `responseSchema` (which trigger a 400 error). Flattens the mutation descriptor into an object with `action: SchemaType.STRING` (enum) and optional locator properties, safely cast into `MutationAction` in TypeScript:
```typescript
import { SchemaType, type ResponseSchema } from "@google/generative-ai";

export const extractionResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    document_summary: { type: SchemaType.STRING },
    variables: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          variable_name: { type: SchemaType.STRING },
          natural_name: { type: SchemaType.STRING },
          category: { 
            type: SchemaType.STRING, 
            enum: ["customer_input", "pricing", "paragraph"] 
          },
          data_type: { 
            type: SchemaType.STRING, 
            enum: ["string", "number", "currency", "enum", "paragraph"] 
          },
          sample_value: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          enum_options: { 
            type: SchemaType.ARRAY, 
            items: { type: SchemaType.STRING } 
          },
          default_value: { type: SchemaType.STRING },
          visibility_rule: {
            type: SchemaType.OBJECT,
            properties: {
              condition_flag: { type: SchemaType.STRING },
              show_when: { type: SchemaType.STRING },
            },
          },
          paragraph_config: {
            type: SchemaType.OBJECT,
            properties: {
              mode: { type: SchemaType.STRING, enum: ["fixed", "ai_generated"] },
              purpose: { type: SchemaType.STRING },
              tone: { type: SchemaType.STRING },
              length_guideline: { type: SchemaType.STRING },
            },
          },
          mutation: {
            type: SchemaType.OBJECT,
            properties: {
              action: {
                type: SchemaType.STRING,
                enum: [
                  "replace_text_run",
                  "replace_table_cell",
                  "wrap_conditional_row",
                  "collapse_repeating_table",
                ],
              },
              sample_text: { type: SchemaType.STRING },
              context_anchor: { type: SchemaType.STRING },
              template_tag: { type: SchemaType.STRING },
              table_index: { type: SchemaType.NUMBER },
              row_identifier: { type: SchemaType.STRING },
              col_index: { type: SchemaType.NUMBER },
              condition_tag: { type: SchemaType.STRING },
              loop_tag: { type: SchemaType.STRING },
              template_row_index: { type: SchemaType.NUMBER },
              delete_sample_rows_from: { type: SchemaType.NUMBER },
            },
            required: ["action"],
          },
        },
        required: [
          "variable_name",
          "natural_name",
          "category",
          "data_type",
          "sample_value",
          "description",
          "mutation",
        ],
      },
    },
    compound_tables: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          table_id: { type: SchemaType.STRING },
          natural_name: { type: SchemaType.STRING },
          table_index: { type: SchemaType.NUMBER },
          type: { type: SchemaType.STRING, enum: ["comparison_matrix", "repeating_loop"] },
          loop_tag: { type: SchemaType.STRING },
        },
        required: ["table_id", "natural_name", "table_index", "type"],
      },
    },
  },
  required: ["document_summary", "variables", "compound_tables"],
};
```
- Zero regex markdown stripping, zero JSON repair libraries.


### 3-Layer Context Assembly in Prompt:
1. **Layer 1:** Quotation Markdown from AnyDoc (`company_sessions.quotation_markdown`).
2. **Layer 2:** Natural Pricing Spec (`company_sessions.pricing_spec`).
3. **Layer 3:** Agency Identity Context (`company_basics`: name, address, email, phone).

---

## 4. UI/UX Architecture (`VariableReviewDeck.tsx`)

Following `DESIGN.md` and `PromptDocCapsule.tsx`:
- **Surface Elevation:** Elevated card (`bg-card rounded-2xl border border-border/80 shadow-xs`).
- **Minimal Header:** Title `Variables` with zero marketing clutter.
- **Segmented Filter Tray:** `[ All ]`, `[ Customer Inputs ]`, `[ Pricing ]`, `[ Paragraphs ]` with `[+ Add]` ghost button (`bg-muted/60 p-0.5 border border-border/40 rounded-lg text-xs`).
- **Tactile Chip Anatomy:** Elevated row (`bg-muted/40 hover:bg-muted/60 border border-border/40 rounded-lg p-3 transition-all hover:-translate-y-0.5`):
  - Top: Semantic color dot (`bg-sky-500` / `bg-emerald-500` / `bg-violet-500`), category label, borderless inline editable natural name, category dropdown selector, subtle `[×]` remove button.
  - Bottom: Monospace template tag (`{client_name}`) and verbatim sample quotation snippet (`"Whitfield & Associates"`).
- **Paragraph Card Well Pattern:** Recessed well (`rounded-xl bg-muted/30 border border-border/30 p-3`) with mode toggle `[ Fixed ]` vs `( AI Drafted )`. AI mode reveals an auto-resizing guidance textarea (`text-xs bg-transparent border-0 focus-visible:ring-0 resize-none`).
- **Compound Cards:** Compact Tier Matrix card with default tier selector (`[ Standard ▾ ]`), and Repeating Table loop preview (`{#items}...{/items}`).
- **Primary CTA:** `[ Generate Template ➔ ]` (`h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile`).
- **Transient Loading State:** Ambient 2px top gradient shimmer bar (`h-0.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-violet-500 animate-pulse`), 3 pulsating skeleton cards, quiet status label (*"Scanning quotation structure and placeholders..."*), and retry banner on failure.

---

## 5. Database Schema & API Contracts

### SQLite Schema (`backend/src/db/database.ts`):
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


### Endpoints (`backend/src/routes/variables.ts`):
- `POST /api/companies/:id/variables/extract` — Prompts Gemini, parses structured JSON, stores variables in SQLite with atomic re-scan idempotency.
- `GET /api/companies/:id/variables` — Returns all persisted variables and compound tables for company.
- `PUT /api/companies/:id/variables` — Updates natural names, category changes, paragraph modes, and deleted flags.
- `POST /api/companies/:id/variables/custom` — Validates exact quotation snippet exists in markdown and binds custom variable.

---

## 6. Edge Cases & Mitigations

1. **Agency Identity Collision:** Agency's own name, email, or address mistakenly extracted as client variables.
   - *Mitigation:* Explicit negative constraint in prompt naming `{company_name}` as seller.
2. **AI Rate Limit or Service Outage:**
   - *Mitigation:* Non-destructive error state with an inline `[ Retry Analysis ↻ ]` button; does not block company tab switching.
3. **Database Re-Scan Idempotency:**
   - *Mitigation:* Re-extraction executes `DELETE FROM company_variables WHERE company_id = ? AND is_custom = 0` before inserting fresh items, preserving user-created custom variables (`WHERE is_custom = 1`).
4. **Quotation Markdown Guard:**
   - *Mitigation:* `POST /api/companies/:id/variables/extract` verifies `quotation_markdown` is present, returning HTTP 400 if briefing was not submitted.
5. **Soft Deletion Semantics:** Deleting a chip marks `is_deleted = 1` in SQLite.
   - *Mitigation:* The mutation engine ignores deleted variables, guaranteeing the original text in Word remains static.
6. **Custom Snippet AST Verification:**
   - *Mitigation:* Endpoint checks if `exact_quotation_snippet` exists in `quotation_markdown` (with whitespace normalization) before persisting.
7. **Cascading Hard Reset on Briefing Unlock:**
   - *Mitigation:* In accordance with Unidirectional State Discipline (Hard Reset Policy), unlocking the briefing via `POST /api/companies/:id/briefing/unlock` executes `DELETE FROM company_variables WHERE company_id = ?` and cleans up downstream template state, preventing stale variables from polluting the workspace if briefing notes or uploaded quotes change.


---

## 7. Acceptance Criteria

- [x] Install `@google/generative-ai` in `backend/package.json` and isolate `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash` in `backend/.env`.
- [x] Implement `gemini.service.ts` using flattened native `responseSchema` (preventing 400 union errors) and structured output mode.
- [x] Create SQLite migration for `company_variables` table with indexes and cascade deletion on `company_id`.
- [x] Implement backend routes:
  - [x] `POST /api/companies/:id/variables/extract` (validates quotation exists, executes idempotent re-scan, returns structured response).
  - [x] `GET /api/companies/:id/variables` (fetches active variables and compound tables).
  - [x] `PUT /api/companies/:id/variables` (persists edits, moves, deletions).
  - [x] `POST /api/companies/:id/variables/custom` (verifies snippet against quotation markdown).
- [x] Build `VariableReviewDeck.tsx` with:
  - [x] Ambient 2px top gradient shimmer line and 3 pulsating skeleton cards during extraction.
  - [x] Minimal unbloated header (`Variables`).
  - [x] Segmented filter pill tray (`All`, `Customer Inputs`, `Pricing`, `Paragraphs`) and `[+ Add]` ghost button.
  - [x] Tactile variable chips with semantic dots (Sky, Emerald, Violet), inline borderless renaming, category dropdown, and subtle remove button.
  - [x] Paragraph card mode toggle (`Fixed` vs `AI Drafted` with auto-resizing guidance textarea).
  - [x] Compound Cards: Tier Comparison Matrix card (with default tier selector) and Repeating Table card.
  - [x] Primary CTA `[ Generate Template ➔ ]` with theme-blue styling.
- [x] Build `AddCustomChipModal` validating exact quotation snippet before submission.
- [x] Hook raw variables JSON into Bottom Dev Dock Tab 3 (`Variables JSON`).
- [x] Ensure `POST /api/companies/:id/briefing/unlock` executes cascading deletion on `company_variables` and resets downstream template state.
- [x] Verify that variable edits, deletions, and additions persist per company in SQLite across tab switches and page reloads.
- [x] Verify that Fortress IT (`co2_msp`), Northstar (`co1_seo`), and Fieldstone (`co3_dev`) extract clean customer placeholders without agency identity contamination.

