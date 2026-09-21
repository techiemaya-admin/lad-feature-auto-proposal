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
5. **Lead Simulator & Verification:** Paste an inbound lead message, confirm the facts read from it (a missing one drafts a clarification email), and get a mathematically verified `.docx` + PDF proposal previewed in the browser — or a "Declined to auto-quote" panel when a review rule matches.
6. **Ambient Controls:** Persistent slide-over drawer for proposal voice notes and a mock inbox link, and a bottom developer dock for raw Markdown, JSON schemas, and pipeline logs.

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
19. As a tenant adjusting peripheral settings, I want a slide-over sheet where I describe how my proposals should sound, paste a proposal I'm proud of, say how clarification emails should read, and link my inbox, so that secondary options remain easily accessible without cluttering the generative workflow.
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
- Gemini returns only verbatim `sample_text` (plus category / condition flag / rare `context_text`); it never emits table indexes, row identifiers or mutation actions. The engine locates every occurrence itself, applies longest-sample-first ordering, and narrows by `context_text` only when the same text appears with a different meaning (see `prototypes/new-auto-proposal/docs/plan.md` §4.2–4.3).
- For repeating tables, row 0 (headers) and footer summary rows (subtotal, tax, grand total) are strictly preserved; intermediate sample item rows are pruned and collapsed into a single `{#items}...{/items}` loop row.
- The tier comparison matrix is tagged positionally (`{tierN_name}`, `{tierN_rM}`) and its grid captured as `tier_matrix`; at render time the selected tier is rotated into the column the sample document highlighted, so the tenant's cell shading never has to move.

### 3. Document Rendering Seam: `easy-template-x`
- Final proposal generation takes the templated `.docx` and a hydrated data payload, executing via `easy-template-x`.
- Handles dynamic table row replication, conditional block rendering, and scalar variable substitution in-memory.

### 4. Pricing Engine Architecture: Spreadsheet Rules & Deterministic Execution
Design detail: [`prototypes/new-auto-proposal/docs/plans/05-pricing-engine.md`](../../prototypes/new-auto-proposal/docs/plans/05-pricing-engine.md).

- **The rules are a spreadsheet whose cells are the Stage 2 variables.** There is no separate internal key vocabulary or bindings map: every Stage 2 `pricing` variable gets a *definition* written in terms of other variables, and the calculator emits values under those same names. Pricing-only helpers (lead inputs such as `location_count`, constants such as `minimum_seat_commitment`, intermediates such as `stackable_addon_count`) live inside the rules JSON with `in_document: false`; they are never written to `company_variables`.
- The LLM compiles `pricing_spec` + the sample quotation markdown + the Stage 2 variables (names, sample values, condition flags, enum options, loop tags/columns, covered values) into `PricingRules`. It never computes a number the tables and definitions can derive.
- Shape (persisted in `working_state_json.pricing_rules`; no new table):

```typescript
interface PricingRules {
  version: 1;
  tables: Array<{ id; label; kind: "packages" | "bands" | "addons" | "taxes" | "splits" | "other";
                  columns: Array<{ key; label; unit: "money" | "percent" | "integer" | "text" | "boolean" }>;
                  rows: Array<Record<string, string | number | boolean | null>> }>;   // null integer = unbounded
  variables: Array<{ name; label; in_document: boolean; unit; condition_flag: string } & (
    | { kind: "input"; input_type: "integer" | "choice" | "multi_choice" | "boolean" | "us_state"; options_table?; options_column?; options?; required }
    | { kind: "constant"; value }                                                    // percent stored as fraction
    | { kind: "lookup"; table; where: Where[]; take }                                // first row in table order
    | { kind: "formula"; op: "add" | "sub" | "mul" | "div" | "min" | "max"; args: Array<string | number> }  // one flat op; nest via helpers
    | { kind: "condition"; all: Cond[] }
    | { kind: "aggregate"; fn: "sum" | "count"; table; rows: "selected" | "all"; selected_var?; key_column; column?; where? }
    | { kind: "rows"; table; rows: "selected" | "all"; selected_var?; key_column; where?; map: Record<loopColumnTag, columnKey | Formula> } )>;
  review_rules: Array<{ when: Cond[]; reason: string }>;      // explicit "decline to auto-quote"
  assumptions: Array<{ text: string; resolved_as: string }>;  // what the owner's notes left open
  sample_inputs: Record<string, unknown>;                      // the lead facts behind the sample quotation
}
// Where = { column; op: eq|neq|gte|lte|gt|lt|in; value_var? | value? | values? }, Cond = same with `var` instead of `column`.
```

- Engine guarantees: topological evaluation; money rounded to cents immediately after each money variable; percent kept as a fraction; text compares whitespace-normalised and case-insensitive; `null` cell = unbounded in `gte`/`gt`; `condition_flag` on a rules variable is an optional *skip guard* (value zeroed, no review fired) while row presence in the payload comes from the Stage 2 flag; split rows receive the rounding remainder on the last row; amounts are unsigned (templates hard-code `−`); missing required input / no matching lookup row / division by zero / matching `review_rules` → `needs_review[]`, never a silent 0.
- Pure module `backend/src/services/pricing-calculator.ts`: `evaluate(rules, inputs)`, `validate(rules, stage2)` (domain-level errors: unknown name, cycle, Stage 2 pricing variable without definition, flag without condition, loop map ≠ columns), `formatLike(sample_value, value)` (`$3,000/mo`, `8.25%`, `10%`), `sampleCheck` (per-variable ✓/✗ against the sample quotation), `buildProposalPayload` (keys = `variable_name`, `has_*` booleans, loops by `loop_tag`, tier matrix via `buildTierMatrixPayload`).
- Compile validates, evaluates with `sample_inputs`, runs the sample check, and **retries once** with the error list (structural errors and sample mismatches) before persisting; both attempts are logged to `logs/<company>/*-rules-raw.json` / `*-rules-repair.json`. Gemini receives a flat wire shape (table rows as `cells[]`, every kind's fields present) because its response schema has no unions or dynamic keys; DeepSeek gets the same shape in the prompt; `fromWire()` types cells by column unit.
- API (`/api/companies/:id/rules`): `POST /compile`, `GET`, `PUT` (400 with `errors[{path,message}]` on structural errors, nothing persisted), `POST /calculate` (`{inputs}` → evaluation + payload for an arbitrary lead; Stage 5's entry point — the deck's live check goes through `PUT`, which re-runs the sample), `POST /proceed` (`stage: "lead_simulation"`, 409 while validation errors exist). Any template regeneration or briefing unlock clears `pricing_rules`.
- Stage 5 API (`/api/companies/:id`): `POST /lead/extract` (`{lead_text}` → `{fields, inputs, missing, assumptions}`; 400 empty / > 12,000 chars, 409 before Stage 5), `POST /lead/clarify` (`{lead_text, inputs, missing}` → `{subject, body}`, never sent), `POST /proposal/generate` (`{inputs, lead_text}` — structured facts, never re-extracted → `{evaluation, payload, narrative, files: {docx, pdf | null}, pdf_error?}` or `{success: false, declined: true, needs_review}`; 400 on a missing required fact), `GET /proposal/download?format=docx|pdf[&download=1]` (the PDF serves `inline` for the preview iframe; `download=1` or a `.docx` returns an attachment). Nothing is persisted; `storage/<id>/proposal.docx|pdf` are overwritten per run and cleared by every earlier-stage reset. Contracts: `prototypes/new-auto-proposal/docs/plans/06-lead-simulator.md` §1.
- UI (`PricingEngineDeck.tsx`): assumptions strip → one editable grid card per `tables[]` entry (icon by `kind`) → "What we ask the lead" (inputs) → Calculation ledger (each variable: readable definition, computed sample value, quote sample value, ✓/✗; tap → tray to change kind/operator/operands/conditions; `[+ Add variable]` for helpers marked "not in document") → review rules → footer with "N of M match", `Regenerate`, `Proceed to Lead Simulation`. Dev Dock tab edits the raw `PricingRules` JSON with validation.

### 5. UI Architecture: Agentic Briefing & Ambient Controls
- **Compound Briefing Capsule:** Unified prompt area + docked dropzone. `Enter` creates new lines; submission via explicit `[Send ➔]` button when both inputs are present. Transitions to read-only locked state with edit/reset modal.
- **Categorized Variable Review Chip-Deck:** Replaces dense tables with 3 modular card buckets (`Customer Inputs`, `Pricing Placeholders`, `Narrative Paragraphs`). Supports AST-verified custom chips, dropdown bucket movement, and paragraph mode toggling.
- **Minimal Template Checkpoint:** Low-profile status banner with tag stats and optional `docx-preview` modal, acting as a lightweight confirmation step before pricing.
- **Slide-Over Configuration Drawer:** Persistent per-company sheet for free-text voice notes, a reference proposal, clarification-email notes, and a mock inbox link.
- **Bottom Developer Dock (HUD):** Collapsible drawer housing AnyDoc Markdown, raw Variables JSON, Rule Schema JSON, and pipeline logs.

### 6. State Lifecycle & Unidirectional Hard Reset Policy
- Workflow progresses strictly unidirectionally: Briefing Capsule ➔ Variable Review ➔ Template Checkpoint ➔ Pricing Engine ➔ Lead Simulation.
- Editing an earlier stage safely rewinds downstream progress with an explicit confirmation dialog, clearing downstream database records to prevent bidirectional synchronization bugs.
- User input text in the prompt box and uploaded files are preserved during rewinds.

### 7. Storage & State Isolation
- Three mock companies (`co1_seo`, `co2_msp`, `co3_dev`).
- Binary files stored per company under `backend/storage/<company_id>/`.
- Working state (variable tables, pricing specs, extracted rules, configurations) persisted in SQLite so switching company tabs maintains progress.
- An explicit "Reset to Mock Default" action re-initializes a company's state from the baseline dataset plus the dev-only seeds (`Mock Data/test_seeds.json`: `pricing_spec`, `sample_lead_text`).

## Testing Decisions

### What Makes a Good Test
- Tests must verify observable external behavior and calculation accuracy, never internal LLM prompt strings or private helper functions.
- Pricing math verification must run against the three ground-truth worked examples documented in `verification_guide.md`:
  1. **Northstar Digital (SEO)**: 2 locations, Texas, annual prepay = **$35,073.00** total.
  2. **Fortress IT Group (MSP)**: 42 seats, Standard tier, 5 extra devices, Ohio = **$2,734.80/mo recurring + $3,150.00 setup fee**.
  3. **Fieldstone Studio (Dev)**: E-commerce build + Copywriting + SEO setup, 10% addon bundle discount = **$10,445.00** ($5,222.50 deposit / $5,222.50 delivery).

### Tested Modules
- **Pricing Calculation Engine**: `backend/src/tests/pricing-calculator.test.ts` runs the hand-written ideal rules `tests/fixtures/<company>.rules.json` (names aligned to `<company>.variables.json`) through the pure calculator: the three benchmarks to the cent, every boundary in `verification_guide.md` §4.1–4.3 (cap `≥`, unlimited cap, 25/50 band edges, 7-seat floor, non-stacking bands, absent rows not `$0.00`, one add-on no bundle, rush excluded from the bundle count, non-TX no tax, setup fee untaxed, missing state / over-cap / Custom Web App → `needs_review`), validator errors, `formatLike`, an all-green sample check per fixture, and payload-key ⟷ template-tag parity against `applyTemplate` output (never against `Mock Data/templated_markdown/*.md`). Route tests stub the model call via `setRulesModelCall` so `npm test` stays offline.
- **Template Generation Bridge**: Integration tests asserting `docxmlater` output contains valid `{tags}` and loop rows while preserving footer rows.
- **Proposal Rendering Pipeline**: End-to-end integration tests verifying `easy-template-x` generates valid `.docx` binaries with correct hydrated values.

### Prior Art
- Existing test suites in `lad-feature-auto-proposal/src/features/auto-proposal/services/__tests__/` (specifically `ai-response.service.test.js` and `proposal-draft.service.test.js`).
- Prototypes in `prototypes/test-docXMLater/backend/src/tests/api.test.ts`.

## Out of Scope

- User authentication, JWT tokens, and multi-tenant database row isolation.
- Production schema migrations or integrations with legacy TypeORM entities.
- Direct email sending (SMTP, Gmail API) or inbound webhook receivers.
- Hosted PDF conversion services (Gotenberg or similar); Stage 5 uses a local headless LibreOffice and degrades to `.docx`-only when it is absent.
- Billing, Stripe integrations, or electronic signature workflows.

## Further Notes

- The prototype runs completely self-contained in `prototypes/new-auto-proposal`.
- AI capabilities leverage Google Gemini via `GEMINI_API_KEY` defined in `backend/.env`.
- All mock assets, documents, and verification guides originate from `prototypes/new-auto-proposal/Mock Data/`.
