<!-- labels: ready-for-agent -->
# Specification — Zero-Config Auto-Proposal Prototype

**Detailed Variable & Template Spec:** [variable-and-template-architecture-spec.md](variable-and-template-architecture-spec.md)  

## Problem Statement

When service-based agencies (digital marketing, IT MSPs, dev shops) run automated inbound/outbound campaigns, leads frequently reply asking for quotes or pricing. At that exact moment, campaign automation stops: an account manager or sales rep must manually read the lead's email, deduce their requirements, look up or calculate prices against mental models or spreadsheets, manually edit an existing Word proposal document, and email it back.

This manual quoting workflow is slow (taking hours or days), error-prone, and inconsistent across sales reps. High-volume, moderate-value inbound leads leak out of the sales funnel because competitors respond faster. Configuring an automated quoting system today requires weeks of manual template coding, field mapping, and rule definition that agencies do not have the time or technical expertise to perform.

## Solution

A zero-configuration, AI-assisted auto-proposal prototype that enables an agency tenant to onboard their quoting process in an intuitive, agentic workflow:
1. **Compound Briefing Capsule:** Type pricing guidelines in natural language into a clean prompt area, with a docked quotation dropzone directly beneath it (prompt + quotation submitted together with `[Send ➔]`).
2. **Categorized Variable Review Chip-Deck:** Review extracted dynamic variables organized into three clear buckets (`Customer Inputs`, `Pricing Placeholders`, and `Narrative Paragraphs`) as modular interactive chips rather than a dense administrative table.
3. **Minimal Template Checkpoint:** Confirm XML-safe dynamic template tags and repeating line-item loops with an inline status card and optional quick preview before moving to pricing.
4. **Interactive Pricing Engine:** Review and fine-tune compiled visual rule cards powered by a 100% deterministic JavaScript math engine.
5. **Lead Simulator & Verification:** Simulate inbound lead emails to produce mathematically verified `.docx` proposals previewable directly in the browser.
6. **Ambient Controls:** Persistent slide-over drawer for tone/email configurations, and a bottom developer dock for raw Markdown, JSON schemas, and pipeline logs.

## User Stories

1. As a tenant configuring auto-proposal, I want to switch between different company testing profiles, so that I can validate how the system handles different service business models (SEO, MSP, Web Dev).
2. As a tenant configuring auto-proposal, I want to click an "Import Settings" button, so that my company profile, contact details, and value proposition are pre-filled without manual typing.
3. As a tenant configuring auto-proposal, I want to enter and edit my pricing logic in a spacious natural-language prompt area with realistic placeholders and natural multi-line Enter support, so that I can describe my packages, discounts, and taxes calmly without accidental submission.
4. As a tenant configuring auto-proposal, I want to attach a real Microsoft Word (`.docx`) quotation via a docked dropzone directly beneath the prompt, so that my prompt and document are coupled in a single unified briefing capsule.
5. As a tenant submitting my briefing, I want the "Send" button to be enabled only when both prompt text and quotation file are present, so that I cannot initiate an incomplete pipeline.
6. As a tenant who has submitted my briefing, I want the briefing capsule to transition into a clean read-only locked state, so that I do not accidentally modify my prompt or lose my place while reviewing downstream stages.
7. As a tenant wanting to revise my pricing prompt or quotation, I want an explicit "Edit / Reset" action with a confirmation warning that downstream stages will be reset, while preserving my typed prompt text in the input box.
8. As a reviewer inspecting document parsing, I want to open the bottom developer dock to view the Markdown extracted from my Word document, so that I can confirm headings, tables, and paragraphs were captured accurately without cluttering the primary tenant view.
9. As a tenant reviewing detected variables, I want to see modular, categorized chips grouped into three buckets (Customer Inputs, Pricing Placeholders, Narrative Paragraphs), so that I understand what parts of my document become dynamic without scrolling through a dense table.
10. As a tenant reviewing detected variables, I want to edit a chip's natural name, change its category bucket via a dropdown, or delete false positives, so that the final template only contains accurate placeholders.
11. As a tenant deleting a variable chip, I want the underlying Word template to keep the original text as static Word content, so that removing a chip never breaks document layout or wording.
12. As a tenant reviewing narrative paragraph variables, I want to toggle between "Fixed Boilerplate" (editable quote text) and "AI-Generated" (with a prompt tip input), so that static clauses remain verbatim while personalized sections are tailored for each deal.
13. As a tenant reviewing detected variables, I want to add a custom variable chip by providing an exact text snippet from the quotation, verified against the document AST, so that any missed placeholders can be bound accurately.
14. As a tenant ready to build a template, I want to click "Confirm Variables & Generate Template", so that docxmlater replaces target text with placeholder tags and collapses repeating line-item rows into a dynamic loop.
15. As a tenant reviewing the generated template, I want to see a minimal, inline confirmation checkpoint with tag counts and an optional "Quick Preview" modal using docx-preview, so that I can verify its appearance without an onerous multi-step detour.
16. As a tenant configuring pricing, I want to view my pricing rules displayed as visual cards (packages, volume breakpoints, add-ons, taxes) compiled from my prompt, variables, and sample quotation values.
17. As a tenant tuning pricing, I want to edit prices, adjust volume multipliers, and add or remove conditional rules directly on the visual cards, so that I can refine my pricing logic without rewriting prompts.
18. As a reviewer inspecting pricing rules, I want to inspect and edit the compiled JSON rule schema in the bottom developer dock, so that I can verify mathematical structures and debug edge cases.
19. As a tenant adjusting peripheral settings, I want a slide-over configuration sheet for AI tone/style, customer clarification triggers, and email integration settings, so that secondary options remain easily accessible without cluttering the generative workflow.
20. As a tenant testing the system, I want to paste an unstructured lead inquiry email or click "Load Sample Lead Message" in the simulation stage, so that I can simulate how an inbound lead is handled in real life.
21. As a tenant generating a proposal, I want the AI to extract key requirements (seat count, location count, requested add-ons, state) from the lead email, so that pricing inputs are populated accurately.
22. As an agency owner, I want all proposal calculations to be executed by a deterministic JavaScript math engine rather than an LLM, so that dollar figures are mathematically exact with zero rounding or arithmetic hallucinations.
23. As a tenant generating a proposal, I want the AI to draft customized narrative sections based on the lead's unique pain points and my prompt tips, so that the generated proposal feels personal and persuasive.
24. As a tenant generating a proposal, I want to download the completed, personalized `.docx` proposal and preview it in-browser, so that I can inspect the final deliverable.
25. As a reviewer verifying system accuracy, I want to compare calculated figures against established ground-truth benchmarks, so that I can be certain the math is 100% correct before considering the concept proven.

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
- The LLM parses natural language text, confirmed variables, and sample quotation values into a declarative JSON schema.
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

### 5. UI Architecture: Agentic Briefing & Ambient Controls
- **Compound Briefing Capsule:** Unified prompt area + docked dropzone. `Enter` creates new lines; submission via explicit `[Send ➔]` button when both inputs are present. Transitions to read-only locked state with edit/reset modal.
- **Categorized Variable Review Chip-Deck:** Replaces dense tables with 3 modular card buckets (`Customer Inputs`, `Pricing Placeholders`, `Narrative Paragraphs`). Supports AST-verified custom chips, dropdown bucket movement, and paragraph mode toggling.
- **Minimal Template Checkpoint:** Low-profile status banner with tag stats and optional `docx-preview` modal, acting as a lightweight confirmation step before pricing.
- **Slide-Over Configuration Drawer:** Persistent sheet for AI tone sliders, clarification thresholds, and email toggles.
- **Bottom Developer Dock (HUD):** Collapsible drawer housing AnyDoc Markdown, raw Variables JSON, Rule Schema JSON, and pipeline logs.

### 6. State Lifecycle & Unidirectional Hard Reset Policy
- Workflow progresses strictly unidirectionally: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Lead Simulation.
- Editing an earlier stage safely rewinds downstream progress with an explicit confirmation dialog, clearing downstream database records to prevent bidirectional synchronization bugs.
- User input text in the prompt box and uploaded files are preserved during rewinds.

### 7. Storage & State Isolation
- Three mock companies (`co1_seo`, `co2_msp`, `co3_dev`).
- Binary files stored per company under `backend/storage/<company_id>/`.
- Working state (variable tables, pricing specs, extracted rules, configurations) persisted in SQLite so switching company tabs maintains progress.
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
