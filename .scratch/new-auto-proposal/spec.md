<!-- labels: ready-for-agent -->
# Specification — Zero-Config Auto-Proposal Prototype

## Problem Statement

When service-based agencies (digital marketing, IT MSPs, dev shops) run automated inbound/outbound campaigns, leads frequently reply asking for quotes or pricing. At that exact moment, campaign automation stops: an account manager or sales rep must manually read the lead's email, deduce their requirements, look up or calculate prices against mental models or spreadsheets, manually edit an existing Word proposal document, and email it back.

This manual quoting workflow is slow (taking hours or days), error-prone, and inconsistent across sales reps. High-volume, moderate-value inbound leads leak out of the sales funnel because competitors respond faster. Configuring an automated quoting system today requires weeks of manual template coding, field mapping, and rule definition that agencies do not have the time or technical expertise to perform.

## Solution

A zero-configuration, AI-assisted auto-proposal prototype that enables an agency tenant to onboard their quoting process in three simple steps:
1. Import their basic company information and type their pricing guidelines in everyday natural language.
2. Upload an existing, real Word (`.docx`) proposal they have previously sent to a client.
3. Review an automatically extracted variable table and visual pricing rule cards.

The system automatically converts the uploaded Word document into an XML-safe dynamic template using `@firecrawl/anydoc` and `docxmlater`, compiles natural pricing notes into visual rule cards and deterministic JSON calculation logic, and provides an end-to-end simulation harness where inbound emails immediately produce finished, mathematically verified `.docx` proposals previewable in the browser.

## User Stories

1. As a tenant configuring auto-proposal, I want to switch between different company testing profiles, so that I can validate how the system handles different service business models (SEO, MSP, Web Dev).
2. As a tenant configuring auto-proposal, I want to click an "Import Settings" button, so that my company profile, contact details, and value proposition are pre-filled without manual typing.
3. As a tenant configuring auto-proposal, I want to enter and edit my pricing logic in an open natural-language text box, so that I can describe my packages, discounts, and taxes using plain English just as I would explain them to a new salesperson.
4. As a tenant configuring auto-proposal, I want to upload a real Microsoft Word (`.docx`) quotation previously sent to a client, so that I don't have to redesign a new proposal template from scratch.
5. As a reviewer inspecting document parsing, I want to expand a collapsible dropdown to view the Markdown extracted from my Word document, so that I can confirm headings, tables, and paragraphs were captured accurately.
6. As a tenant reviewing detected variables, I want to see a clean table displaying each variable's natural name, system variable name, category, description, and sample snippet from the quotation, so that I understand exactly what parts of my document will become dynamic.
7. As a tenant reviewing detected variables, I want to edit the natural name, change the variable identifier, or delete unnecessary detected variables, so that the final template only contains accurate placeholders.
8. As a tenant reviewing paragraph variables, I want to toggle between "Fixed" and "AI-Generated" modes, so that static clauses remain verbatim while personalized sections are tailored for each deal.
9. As a tenant configuring an AI-generated paragraph, I want to provide an optional prompt tip, so that the AI knows what key sales points or tone to emphasize when drafting that section.
10. As a tenant configuring a fixed paragraph, I want to view and edit the prefilled quotation text, so that the static boilerplate text in the proposal matches my exact desired wording.
11. As a tenant reviewing detected variables, I want to add a custom variable by highlighting or typing a quotation text snippet, so that any missed placeholders can be categorized and bound by AI.
12. As a tenant ready to build a template, I want to click a button to generate the Word template, so that the system replaces target text with placeholder tags without breaking Word fonts, styling, or formatting.
13. As a tenant with itemized line items in my proposal, I want the system to preserve table headers and summary rows (subtotal, tax, total) while collapsing repeating item rows into a dynamic loop, so that future proposals can have any number of line items without breaking table layout.
14. As a tenant reviewing the generated template, I want to preview the rendered `.docx` layout directly in my browser using `docx-preview`, so that I can verify its appearance without opening Microsoft Word.
15. As a tenant reviewing the generated template, I want to download the templated `.docx` file to my computer, so that I can inspect its XML tags or store it locally.
16. As a tenant configuring pricing, I want to view my pricing rules displayed as visual cards (packages, volume breakpoints, add-ons, taxes), so that I can understand how my natural-language notes were interpreted.
17. As a tenant tuning pricing, I want to edit prices, adjust volume multipliers, and add or remove conditional rules directly on the visual cards, so that I can refine my pricing logic without rewriting prompts.
18. As a reviewer inspecting pricing rules, I want to expand a collapsible dropdown to inspect the compiled JSON rule schema, so that I can verify the mathematical structure and debug edge cases.
19. As a tenant testing the system, I want to paste an unstructured lead inquiry email into a text area, so that I can simulate how an inbound lead is handled in real life.
20. As a tenant testing the system, I want to click a "Load Sample Lead Message" button, so that I can immediately run a test inquiry matched to the active company without copying and pasting manually.
21. As a tenant generating a proposal, I want the AI to extract key requirements (seat count, location count, requested add-ons, state) from the lead email, so that pricing inputs are populated accurately.
22. As an agency owner, I want all proposal calculations (subtotals, volume discounts, taxes, setup fees, payment splits) to be executed by a deterministic math engine rather than an LLM, so that dollar figures are mathematically exact with zero rounding or arithmetic hallucinations.
23. As a tenant generating a proposal, I want the AI to draft customized narrative sections based on the lead's unique pain points and my prompt tips, so that the generated proposal feels personal and persuasive.
24. As a tenant generating a proposal, I want to download the completed, personalized `.docx` proposal, so that I can inspect the final deliverable.
25. As a reviewer verifying system accuracy, I want to compare the calculated figures against established ground-truth benchmarks, so that I can be certain the math is 100% correct before considering the concept proven.

## Implementation Decisions

### 1. Document Parsing Seam: `@firecrawl/anydoc`
- Document conversion from `.docx` to Markdown occurs via `@firecrawl/anydoc` running locally in the Node.js backend.
- Markdown is chosen as the document intermediate representation because it retains heading hierarchies, list items, and table structures in a compact text format optimal for LLM prompt ingestion.

### 2. Document Mutation Seam: `docxmlater`
- Word template creation is handled via `docxmlater` on the backend, mutating the OpenXML DOM tree.
- Text replacements are performed on individual paragraph runs using context anchors to prevent accidental replacement of duplicate numbers across unrelated sections.
- For repeating tables, row 0 (headers) and footer summary rows (subtotal, tax, grand total) are strictly preserved; intermediate sample item rows are pruned and collapsed into a single `{#items}...{/items}` loop row.

### 3. Document Rendering Seam: `easy-template-x`
- Final proposal generation takes the templated `.docx` and a hydrated data payload, executing via `easy-template-x`.
- Handles dynamic table row replication, conditional block rendering, and scalar variable substitution in-memory.

### 4. Pricing Engine Architecture: Rule Schema & Deterministic Execution
- The LLM parses natural language text into a declarative JSON schema.
- The prototype uses a shared rule schema shape:

```typescript
interface PricingRuleSchema {
  mechanism: "tiered_package" | "per_unit_formula" | "fixed_template" | "hybrid";
  packages?: Array<{ id: string; name: string; monthly_price: number; location_cap?: number; sla?: string }>;
  unit_rates?: { base_unit_name: string; base_rates: Record<string, number>; minimum_commit?: number };
  volume_adjustments?: Array<{ min_units: number; max_units: number; rate_adjustment: number }>;
  addons?: Array<{ id: string; name: string; price: number; is_stackable: boolean }>;
  discounts?: Array<{ name: string; percentage?: number; flat_amount?: number; condition: string; basis: "subtotal" | "addons_only" | "total" }>;
  taxes?: Array<{ state: string; rate_percent: number; basis: "recurring_only" | "post_discount_subtotal" | "all" }>;
  one_time_fees?: Array<{ name: string; amount_per_unit?: number; flat_amount?: number; is_taxable: boolean }>;
  payment_splits?: Array<{ milestone: string; percentage: number; due_condition: string }>;
}
```

- A deterministic JavaScript calculation module accepts lead parameters and executes the rule schema, returning exact numerical subtotals, discounts, taxes, and totals.

### 5. UI Architecture: Two-Tier Information Disclosure
- Frontend built with React, Vite, TailwindCSS, and Shadcn UI.
- Primary visual interface displays customer-friendly controls: company tabs, clean variable tables, interactive pricing cards, and document preview via `docx-preview`.
- Secondary reviewer dropdowns (collapsible accordions) expose low-level technical state: AnyDoc Markdown preview, raw JSON rule editor, and replacement logs.

### 6. Storage & State Isolation
- Three mock companies (`co1_seo`, `co2_msp`, `co3_dev`).
- Binary files stored per company under `backend/storage/<company_id>/`.
- Working state (variable tables, pricing specs, extracted rules) persisted in SQLite so switching company tabs maintains progress.
- An explicit "Reset to Mock Default" action re-initializes a company's state from the baseline dataset.

## Testing Decisions

### What Makes a Good Test
- Tests must verify observable external behavior and calculation accuracy, never internal LLM prompt strings or private helper functions.
- Pricing math verification must run against the three ground-truth worked examples documented in `verification_guide.md`:
  1. **Northstar Digital (SEO)**: 2 locations, Texas, annual prepay = **$35,073.00** total.
  2. **Fortress IT Group (MSP)**: 42 seats, Standard tier, 5 extra devices, Ohio = **$2,734.80/mo recurring + $3,150.00 setup fee**.
  3. **Fieldstone Studio (Dev)**: E-commerce build + Copywriting + SEO setup, 10% addon bundle discount = **$10,445.00** ($5,222.50 deposit / $5,222.50 delivery).

### Tested Modules
- **Pricing Calculation Engine**: Automated unit tests asserting exact output figures for all 3 company rule sets against varied inputs and edge cases (boundary seat counts, tax exemptions, discount toggles).
- **Template Generation Bridge**: Integration tests asserting `docxmlater` output contains valid `{tags}` and loop rows while preserving footer rows.
- **Proposal Rendering Pipeline**: End-to-end integration tests verifying `easy-template-x` generates valid `.docx` binaries with correct hydrated values.

### Prior Art
- Existing test suites in `lad-feature-auto-proposal/src/features/auto-proposal/services/__tests__/` (specifically `ai-response.service.test.js` and `proposal-draft.service.test.js`).
- Prototypes in `prototypes/test-docXMLater/backend/src/tests/api.test.ts`.

## Out of Scope

- User authentication, JWT tokens, and multi-tenant database row isolation.
- Production schema migrations or integrations with legacy TypeORM entities.
- Direct email sending (SMTP, Gmail API) or inbound webhook receivers.
- PDF generation or conversion engines (LibreOffice / Gotenberg).
- Billing, Stripe integrations, or electronic signature workflows.

## Further Notes

- The prototype runs completely self-contained in `prototypes/new-auto-proposal`.
- AI capabilities leverage Google Gemini via `GEMINI_API_KEY` defined in `backend/.env`.
- All mock assets, documents, and verification guides originate from `prototypes/new-auto-proposal/Mock Data/`.
