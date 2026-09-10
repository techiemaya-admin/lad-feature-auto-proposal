# Template Architecture Audit & Verification Analysis

**Context:** `prototypes/new-auto-proposal`  
**Documents Audited:**
1. [variable-and-template-architecture-spec.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/variable-and-template-architecture-spec.md)
2. [Issue 03: Gemini Variable Extraction and Review Deck](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/03-gemini-variable-extraction-and-interactive-review-table.md)
3. [Issue 04: docXMLater Word Template Mutation & Preview](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/.scratch/new-auto-proposal/issues/04-docxmlater-word-template-mutation-and-in-browser-preview.md)
4. Source Markdown: [Mock Data/markdown/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/markdown/)
5. Templated Output: [Mock Data/templated_markdown/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/templated_markdown/)

---

## Executive Summary

The templating architecture specified in `variable-and-template-architecture-spec.md`, `Issue 03`, and `Issue 04` provides a sound foundation: single-brace `{variable}` tags for `easy-template-x`, cross-cell conditional tags `{#condition}...{/condition}` for pruning optional rows, and repeating table loops `{#items}...{/items}` for variable-length milestone tables.

However, an exhaustive line-by-line audit of how the 3 sample proposals actually template exposes **4 Major Architectural Gaps** and **2 Critical Implementation Bugs** in the current plan. Without addressing these, downstream proposal hydration will fail or produce contradictory quotes for real leads.

---

## 1. Major Architectural Gaps Discovered

### Gap 1: The "Pruning vs. Synthesis" Trap in Add-ons & Conditional Rows (CRITICAL)
- **The Spec's Assumption:** The spec models optional rows (such as add-ons, volume adjustments, and taxes) using `wrap_conditional_row`, which places `{#condition}` in Cell 0 and `{/condition}` in the last cell of an existing row in `original_quotation.docx`.
- **The Failure Mode:** `easy-template-x` conditional tags can only **prune (remove)** an XML table row (`<w:tr>`) when its flag is falsy. They **CANNOT synthesize a new row** that does not already exist in the Word document.
- **Concrete Example (Fieldstone Studio):**
  - Fieldstone's catalog offers 5 add-ons: Copywriting ($600), SEO Setup ($450), CMS Integration ($800), Extra Revision Round ($300), and Rush Delivery (+20%).
  - But Rosewood Home Goods' sample quotation (`Proposal_Fieldstone_RosewoodHomeGoods.docx`) **only selected 2 add-ons** (Copywriting and SEO Setup).
  - Consequently, the Word document physically contains rows only for Copywriting and SEO Setup.
  - If a new inbound lead requests **CMS Integration ($800)** and **Extra Revision ($300)**, the template has no table rows for them! `easy-template-x` cannot magically inject those rows.
- **Required Plan Fix:**
  - **Option A (Repeating Table Loop — Strongly Recommended):** Model the add-on line items in the investment table as a repeating table loop:
    `| {#addon_items}{addon_name} | {addon_amount}{/addon_items} |`
    This allows 0, 1, 2, or 5 add-ons to be dynamically rendered with 100% ECMA-376 safety.
  - **Option B (Full Catalog Template Mutation):** When mutating the Word document, `docxmlater` must ensure rows for *all catalog add-ons* are present in the table, each wrapped in its respective `{#has_<addon>}` conditional tag so unselected ones are pruned.

---

### Gap 2: Scope Inclusions Contradicting Dynamic Tier Selection (CRITICAL)
- **The Spec's Assumption:** In `Issue 03`, paragraph extraction defaults to `[Fixed Boilerplate]` unless explicitly flagged as `[AI-Generated]`.
- **The Failure Mode:** Service proposals contain scope-inclusion lists that are directly tied to the *recommended tier* or *client environment*:
  - In **Northstar (`co1_seo`)**:
    The section `**Included vs. Not Included — Growth Tier**` explicitly lists:
    - *"Included: 4 content pieces/month"* (Local only gets 1; Authority gets weekly)
    - *"Not included: A dedicated 1:1 strategist — that begins at the Authority tier"*
    If a new lead selects the **Local** or **Authority** tier, leaving this section static renders the proposal completely contradictory!
  - In **Fortress IT (`co2_msp`)**:
    Section 04 lists:
    - *"Onboarding of all 42 endpoints and 5 servers into 24/7 monitoring within weeks 1–2"*
    - *"4-hour response SLA during business hours"*
    If a new lead has 15 seats, 0 servers, and chooses Essential (next-day SLA), leaving this static creates a legally erroneous promise of 42 endpoints and a 4-hour SLA.
- **Required Plan Fix:**
  - The extraction schema must identify scope-inclusion bullet lists as **Tier-Dependent Inclusions**, categorizing them as `paragraph` with `mode: "ai_generated"` and explicit prompt guidance:
    `paragraph_config: { mode: "ai_generated", purpose: "Draft scope inclusions and SLA commitments strictly matching the selected_tier and lead device count" }`.

---

### Gap 3: Embedded Calculation Expressions Inside Label Cells
- **The Problem:** In B2B proposals, table labels frequently embed arithmetic explanations:
  - Fortress IT: `Seat subtotal (42 seats × $60.00)`
  - Fortress IT: `Managed devices beyond 1:1 (5 servers × $12.00)`
  - Fortress IT: `One-time setup & onboarding (42 seats × $75.00)`
  - Northstar: `Growth Package — 12 months × $3,000/mo`
- **The Failure Mode:** If the mutation engine only replaces the numeric cell (Col 1), a new quote for 18 seats at $65.00 will show `$1,170.00` next to the label `Seat subtotal (42 seats × $60.00)`.
- **Status in Plan:** Edge Case 1 of the spec correctly flagged this, but the extraction schema in `gemini.service.ts` did not enforce composite label replacements.
- **Required Plan Fix:**
  - Label cells must be templated with composite tags:
    `Seat subtotal ({seat_count} seats × {adjusted_seat_rate})`
    `Managed devices beyond 1:1 ({extra_device_count} servers × {extra_device_rate})`
    `One-time setup & onboarding ({seat_count} seats × {onboarding_rate_per_seat})`
    `{selected_tier} Package — {billing_period_description}`

---

### Gap 4: Payment Schedule Rigidity (50/50 vs. Thirds)
- **The Problem:** In Fieldstone Studio, the payment schedule for Rosewood Home Goods has 2 rows:
  - Deposit (50%): $5,222.50
  - Final payment (50%): $5,222.50
- The pricing engine spec states: *"Payment split is usually 50% deposit / 50% at delivery, sometimes thirds for Business Website and E-commerce if the client wants that."*
- If a client requests a 3-way milestone split (Deposit 33%, Milestone 33%, Delivery 34%), a static 2-row table cannot render 3 milestones.
- **Required Plan Fix:**
  - The Payment Schedule table must be registered as a `repeating_loop` compound table:
    `| {#payment_milestones}{milestone_name} | {trigger_description} | {payment_amount}{/payment_milestones} |`

---

## 2. Critical Implementation Bugs Observed in Backend Execution

During analysis of `storage/co1_seo/template.docx` generated by `template-mutator.service.ts`:

1. **Header Row Overwrite Bug:**
   - In Table 0, `table.setCell(0, col)` replaced the column header cell ("Prepared By") with `{proposal_valid_until}` instead of replacing data values in Row 1.
   - **Fix:** In `findTableAndRow`, when a table contains headers, semantic targeting must ignore Row 0 unless explicitly configured.
2. **Comparison Matrix Header Corruption:**
   - In Table 1, `growth_package_monthly_rate` replaced the header cell `Growth — Recommended` instead of targeting Row 1 Col 1 (`$3,000/mo`).
3. **Table Row 0 Conditional Wrap Bug:**
   - In Table 2, `wrap_conditional_row` wrapped Row 0 (`Line Item | Amount`) with `{#condition}...{/condition}` instead of the discount or tax data rows.
   - **Fix:** `wrap_conditional_row` must verify that the matched row is not Row 0.

---

## 3. Templated File Cross-Reference

| File | Template Highlights | Key Variables Placed |
|---|---|---|
| [Proposal_Northstar_BloomAndCo.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/templated_markdown/Proposal_Northstar_BloomAndCo.md) | Center-anchored arrangeable tier columns (`{tier_left_*}` / `{selected_tier}` / `{tier_right_*}`), conditional annual discount `{#has_annual_discount}`, conditional tax `{#has_tax}`. | `{client_name}`, `{selected_tier}`, `{selected_tier_badge}`, `{billing_period_description}`, `{annual_discount_amount}`, `{tax_amount}`. |
| [Proposal_FortressIT_WhitfieldAssociates.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/templated_markdown/Proposal_FortressIT_WhitfieldAssociates.md) | Center-anchored arrangeable tier columns, composite label tags, conditional volume adjustment `{#has_volume_adjustment}`, conditional extra devices `{#has_extra_devices}`, conditional recurring tax `{#has_tax}`. | `{client_name}`, `{selected_tier}`, `{seat_count}`, `{adjusted_seat_rate}`, `{extra_device_count}`, `{setup_fee_total}`, `{tax_amount}`. |
| [Proposal_Fieldstone_RosewoodHomeGoods.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/Mock%20Data/templated_markdown/Proposal_Fieldstone_RosewoodHomeGoods.md) | Collapsed milestone loop `{#milestones}...{/milestones}`, conditional add-on rows `{#has_<addon>}`, collapsed payment schedule loop `{#payment_milestones}`. | `{client_name}`, `{project_template_name}`, `{phase_number}`, `{milestone_title}`, `{bundle_discount_amount}`. |

---

## 4. Recommendations for Next Issues

1. **Update `Issue 05` (Pricing Compiler):**
   - Ensure the compiler outputs both numeric floats and display strings (with negative symbols like `−$105.00`).
   - Emit boolean visibility flags (`has_tax`, `has_volume_adjustment`, `has_bundle_discount`, `has_extra_devices`, `has_annual_discount`) directly in the calculated payload.
2. **Update `Issue 06` (Lead Simulator & Hydration):**
   - Provide array data for `milestones: [...]`, `payment_milestones: [...]`, and optionally `addon_items: [...]` to hydrate `easy-template-x` loops.
   - Instruct Gemini to synthesize `scope_inclusions_narrative` dynamically matching the extracted `selected_tier`.
