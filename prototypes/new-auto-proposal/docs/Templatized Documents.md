## Proposal Fieldstone RosewoodHomeGoods

### Parsed Docx
```md
**Project Proposal**

**Prepared for Rosewood Home Goods**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Fieldstone Studio | September 21, 2026 (14 days) |

**From Kickoff to Launch**

You reached out about moving Rosewood Home Goods into e-commerce — roughly 60 products, wanting product copy written for you and basic SEO set up rather than handling both in-house. That's a clean fit for our E-commerce template, with two add-ons layered in below. Here's exactly what happens, phase by phase, and what it costs.

**Project Scope: E-Commerce Build**

Base template: up to 100 products, Shopify or custom cart, typical delivery in 4–6 weeks.

| **Phase** | **Milestone** | **Deliverable** |
| --- | --- | --- |
| 1 | Discovery | Requirements confirmed: product catalog structure, cart provider, copy & SEO inputs gathered |
| 2 | Design | Homepage, category, and product page design delivered for review |
| 3 | Build | Store built, up to 60 products loaded, copywriting integrated, checkout configured |
| 4 | QA | Cross-device testing, checkout/payment flow verification, basic SEO setup applied |
| 5 | Launch | Store goes live; one round of post-launch revisions included |

**Add-On Menu — Selected for This Project**

**✓** Copywriting — product & category page copy written for you ($600)

**✓** Basic SEO Setup — metadata, sitemap, on-page basics ($450)

**○** *CMS Integration — not needed, Shopify's built-in CMS covers this*

**○** *Extra Revision Round — not selected, 1 round already included*

**○** *Rush Delivery — not selected, standard 4–6 week timeline confirmed*

*Selecting 2 or more add-ons automatically qualifies a project for our bundle discount, applied below.*

**Your Investment**

| **Line Item** | **Amount** |
| --- | --- |
| E-Commerce Build (base template, up to 100 products) | $9,500.00 |
| Copywriting add-on | $600.00 |
| Basic SEO Setup add-on | $450.00 |
| Add-on subtotal | $1,050.00 |
| Bundle discount (10% off add-ons, 2+ selected) | −$105.00 |
| **Total Project Investment** | **$10,445.00** |

*No sales tax applies to this engagement under our standard services treatment.*

**Payment Schedule**

| **Milestone** | **Trigger** | **Amount** |
| --- | --- | --- |
| Deposit (50%) | On signing | $5,222.50 |
| Final payment (50%) | At delivery / launch | $5,222.50 |

**Next Steps**

Reply to confirm and we'll invoice the deposit — kickoff call happens within 2 business days of payment, and we'll walk through the Discovery checklist together on that call.

*This document is a proposal, not a signed contract — it's an estimate based on what you've shared, confirmed once you accept and the deposit is received.*
```

### Expected Result
(Doesn't need to be exact but similar)
```md
**Project Proposal**

**Prepared for {client_name}**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| {proposal_date} | Fieldstone Studio | {proposal_valid_until} |

**From Kickoff to Launch**

{project_intro_narrative}

**Project Scope: {project_template_name}**

Base template: {template_scope_summary}, typical delivery in {typical_delivery_timeline}.

| **Phase** | **Milestone** | **Deliverable** |
| --- | --- | --- |
| {#milestones}{phase_number} | {milestone_title} | {deliverable_summary}{/milestones} |

**Add-On Menu — Selected for This Project**

{addon_menu_narrative}

**Your Investment**

| **Line Item** | **Amount** |
| --- | --- |
| {project_template_name} ({template_scope_summary}) | {base_template_fee} |
| {#has_copywriting}Copywriting add-on | {copywriting_fee}{/has_copywriting} |
| {#has_seo_setup}Basic SEO Setup add-on | {seo_setup_fee}{/has_seo_setup} |
| {#has_cms_integration}CMS Integration add-on | {cms_integration_fee}{/has_cms_integration} |
| {#has_extra_revisions}Extra Revision Round | {extra_revisions_fee}{/has_extra_revisions} |
| {#has_rush_delivery}Rush Delivery ({rush_delivery_percentage}%) | {rush_delivery_fee}{/has_rush_delivery} |
| {#has_addons}Add-on subtotal | {addon_subtotal}{/has_addons} |
| {#has_bundle_discount}Bundle discount ({bundle_discount_percentage}% off add-ons, 2+ selected) | −{bundle_discount_amount}{/has_bundle_discount} |
| **Total Project Investment** | **{total_project_investment}** |

*{tax_treatment_disclaimer}*

**Payment Schedule**

| **Milestone** | **Trigger** | **Amount** |
| --- | --- | --- |
| {#payment_milestones}{milestone_name} | {trigger_description} | {payment_amount}{/payment_milestones} |

**Next Steps**

Reply to confirm and we'll invoice the deposit — kickoff call happens within 2 business days of payment, and we'll walk through the Discovery checklist together on that call.

*This document is a proposal, not a signed contract — it's an estimate based on what you've shared, confirmed once you accept and the deposit is received.*
```

### Output from AI
```json
{
  "variables": [
    {
      "id": "0d6cd99a-ea27-4808-a0a2-efbd895b677f",
      "company_id": "co3_dev",
      "variable_name": "client_name",
      "natural_name": "Client Name",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 0,
      "descriptor": {
        "sample_value": "Rosewood Home Goods",
        "description": "The name of the prospective client company.",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Rosewood Home Goods",
          "template_tag": "{client_name}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "807e67ab-0f8e-4493-8285-031a75d0bbcd",
      "company_id": "co3_dev",
      "variable_name": "proposal_date",
      "natural_name": "Proposal Date",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 1,
      "descriptor": {
        "sample_value": "September 7, 2026",
        "description": "The date the proposal was issued.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_row_index": 1,
          "template_tag": "{proposal_date}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "7bbbc337-6352-4a10-9fb3-728a735c1ac8",
      "company_id": "co3_dev",
      "variable_name": "valid_until_date",
      "natural_name": "Valid Until Date",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 2,
      "descriptor": {
        "sample_value": "September 21, 2026 (14 days)",
        "description": "The expiration date and validity window of the proposal.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_row_index": 1,
          "template_tag": "{valid_until_date}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "aa9f02be-cd7f-42c1-bb98-13b2cbe87ece",
      "company_id": "co3_dev",
      "variable_name": "selected_tier",
      "natural_name": "Selected Tier",
      "category": "customer_input",
      "data_type": "enum",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 3,
      "descriptor": {
        "sample_value": "E-commerce",
        "description": "The primary service package selected for the project.",
        "enum_options": [
          "Landing Page",
          "Business Website",
          "E-commerce",
          "Custom Web App"
        ],
        "default_value": "E-commerce",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "E-Commerce",
          "template_tag": "{selected_tier}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "765b2ef4-0304-488d-b24e-e8496a0f9567",
      "company_id": "co3_dev",
      "variable_name": "product_count",
      "natural_name": "Product Count",
      "category": "customer_input",
      "data_type": "number",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 4,
      "descriptor": {
        "sample_value": "60",
        "description": "The number of products to be loaded into the store.",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "60",
          "template_tag": "{product_count}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "5a3ecaf6-7600-4356-82fc-a6205fb3506f",
      "company_id": "co3_dev",
      "variable_name": "tier_base_investment",
      "natural_name": "Tier Base Investment",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 5,
      "descriptor": {
        "sample_value": "$9,500.00",
        "description": "The base price for the selected tier.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_row_index": 1,
          "template_tag": "{tier_base_investment}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "792f8627-e6e1-4282-a4c3-56f83177528a",
      "company_id": "co3_dev",
      "variable_name": "addon_subtotal",
      "natural_name": "Add-on Subtotal",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 6,
      "descriptor": {
        "sample_value": "$1,050.00",
        "description": "The combined subtotal of all selected add-ons.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_row_index": 4,
          "template_tag": "{addon_subtotal}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "33a64638-1c9c-4cfe-a068-2930022f87f2",
      "company_id": "co3_dev",
      "variable_name": "bundle_discount_amount",
      "natural_name": "Bundle Discount Amount",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 7,
      "descriptor": {
        "sample_value": "−$105.00",
        "description": "The discount applied when 2 or more add-ons are selected.",
        "visibility_rule": {
          "condition_flag": "has_bundle_discount",
          "show_when": "value > 0"
        },
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_row_index": 5,
          "template_tag": "{bundle_discount_amount}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    },
    {
      "id": "ee47e624-0c37-49bf-8eb0-284c53d8cec5",
      "company_id": "co3_dev",
      "variable_name": "total_project_investment",
      "natural_name": "Total Project Investment",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 8,
      "descriptor": {
        "sample_value": "$10,445.00",
        "description": "The final total cost for the project including add-ons and discounts.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_row_index": 6,
          "template_tag": "{total_project_investment}"
        }
      },
      "created_at": "2026-09-10T03:55:58.433Z",
      "updated_at": "2026-09-10T03:55:58.433Z"
    }
  ],
  "compound_tables": [
    {
      "id": "3ca66b6d-6499-4cc0-b318-2f2d9f45312c",
      "table_id": "metadata_table",
      "natural_name": "Proposal Metadata",
      "table_index": 0,
      "type": "comparison_matrix",
      "columns": [],
      "enum_options": [],
      "is_deleted": false
    },
    {
      "id": "57ad0162-fb02-4023-a09d-73832556dc35",
      "table_id": "project_scope_table",
      "natural_name": "Project Scope Phases",
      "table_index": 1,
      "type": "repeating_loop",
      "loop_tag": "project_phases",
      "columns": [],
      "enum_options": [],
      "is_deleted": false
    },
    {
      "id": "7e103e8e-dc6f-4cab-8a93-4753de92514c",
      "table_id": "investment_summary_table",
      "natural_name": "Investment Line Items",
      "table_index": 2,
      "type": "repeating_loop",
      "loop_tag": "addon_items",
      "columns": [],
      "enum_options": [],
      "is_deleted": false
    },
    {
      "id": "8fd27e3e-22dd-4dd0-8779-f22a3b23be50",
      "table_id": "payment_schedule_table",
      "natural_name": "Payment Schedule Milestones",
      "table_index": 3,
      "type": "repeating_loop",
      "loop_tag": "payment_milestones",
      "columns": [],
      "enum_options": [],
      "is_deleted": false
    }
  ]
}
```

### Templatized Docx
(Converted to markdown using anydoc)

```md
**Project Proposal**

**Prepared for {client\_name}**

| **Date** | {valid_until_date} | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Fieldstone Studio | September 21, 2026 (14 days) |

**From Kickoff to Launch**

You reached out about moving Rosewood Home Goods into {selected_tier} — roughly {product_count} products, wanting product copy written for you and basic SEO set up rather than handling both in-house. That's a clean fit for our {selected_tier} template, with two add-ons layered in below. Here's exactly what happens, phase by phase, and what it costs.

**Project Scope: E-Commerce Build**

Base template: up to 100 products, Shopify or custom cart, typical delivery in 4–6 weeks.

| **Phase** | **Milestone** | **Deliverable** |
| --- | --- | --- |
| {#project_phases} 1 | Discovery | Requirements confirmed: product catalog structure, cart provider, copy & SEO inputs gathered {/project_phases} |

**Add-On Menu — Selected for This Project**

**✓** Copywriting — product & category page copy written for you ($600)

**✓** Basic SEO Setup — metadata, sitemap, on-page basics ($450)

**○** *CMS Integration — not needed, Shopify's built-in CMS covers this*

**○** *Extra Revision Round — not selected, 1 round already included*

**○** *Rush Delivery — not selected, standard 4–6 week timeline confirmed*

*Selecting 2 or more add-ons automatically qualifies a project for our bundle discount, applied below.*

**Your Investment**

| **Line Item** | {total_project_investment} |
| --- | --- |
| {#addon_items} E-Commerce Build (base template, up to 100 products) | $9,500.00 {/addon_items} |
| Add-on subtotal | $1,050.00 |
| Bundle discount (10% off add-ons, 2+ selected) | −$105.00 |
| **Total Project Investment** | **$10,445.00** |

*No sales tax applies to this engagement under our standard services treatment.*

**Payment Schedule**

| **Milestone** | **Trigger** | **Amount** |
| --- | --- | --- |
| {#payment_milestones} Deposit (50%) | On signing | $5,222.50 {/payment_milestones} |

**Next Steps**

Reply to confirm and we'll invoice the deposit — kickoff call happens within 2 business days of payment, and we'll walk through the Discovery checklist together on that call.

*This document is a proposal, not a signed contract — it's an estimate based on what you've shared, confirmed once you accept and the deposit is received.*
```
## Proposal FortressIT WhitfieldAssociates

### Parsed Docx
```md
**Managed IT Services Proposal**

**Prepared for Whitfield & Associates**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Fortress IT Group — Sales Engineering | September 21, 2026 (14 days) |

**01  Current Environment Risk Profile**

You noted Whitfield & Associates has grown to 42 employees across two offices with no dedicated IT support in place. At that headcount, informal or single-contractor IT support is statistically where firms start seeing recurring downtime, delayed patching, and no documented backup posture — all of which compound quietly until an outage or incident forces the issue. The scope below is sized specifically to your headcount and device footprint.

**02  Recommended Tier: Standard**

Standard is built for firms your size that need faster-than-business-hours coverage and managed backups, without paying for the 24/7 / vCIO layer that Premium adds — appropriate once you're running compliance-sensitive client data with real recovery-time expectations.

| **Essential** | **Standard — Recommended** | **Premium** |
| --- | --- | --- |
| $45/seat/mo base | **$65/seat/mo base** | $85/seat/mo base |
| Business hours, next-day | 4-hr response + after-hours line | 1-hr priority, 24/7 |
| — | Managed backup included | + Quarterly vCIO review |

**03  Headcount & Device Calculation**

Shown in full so the math is auditable against your invoice every month — no black-box pricing.

| **Total employees / seats** | 42 |
| --- | --- |
| Standard tier base rate | $65.00 / seat / mo |
| Volume adjustment (25–49 seat band) | −$5.00 / seat / mo |
| **Adjusted rate** | **$60.00 / seat / mo** |
| **Seat subtotal (42 seats × $60.00)** | **$2,520.00** |
| Managed devices beyond 1:1 (5 servers × $12.00) | $60.00 |
| **Monthly Recurring Subtotal** | **$2,580.00** |
| Ohio state tax (6%, on recurring only) | $154.80 |
| **Total Monthly Recurring** | **$2,734.80** |

Plus a one-time onboarding fee, invoiced separately at signing (not subject to the recurring tax above):

|  |  |
| --- | --- |
| **One-time setup & onboarding (42 seats × $75.00)** | **$3,150.00** |

*Minimum billable commitment is 10 seats — your 42-seat count is well above the floor, so no minimum-commit adjustment applies.*

**04  What's Included This Cycle**

- Onboarding of all 42 endpoints and 5 servers into 24/7 monitoring within weeks 1–2
- Managed backup configuration for both office locations
- 4-hour response SLA during business hours; after-hours emergency line for critical outages
- Named account engineer — not a rotating helpdesk queue

**05  Next Steps**

Confirm by reply or call (614) 555-0193 — we'll schedule your network & security assessment within 5 business days of sign-off, with a 30-day check-in to confirm SLA response times are being met.

*This document is a proposal, not a signed services agreement — it reflects our best pricing based on the environment details you've shared, confirmed once you accept. A brief services agreement follows separately at signing.*
```

### Expected Result
(Doesn't need to be exact but similar)

```md
**Managed IT Services Proposal**

**Prepared for {client_name}**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| {proposal_date} | Fortress IT Group — Sales Engineering | {proposal_valid_until} |

**01  Current Environment Risk Profile**

{current_environment_risk_narrative}

**02  Recommended Tier: {selected_tier}**

{recommended_tier_justification_narrative}

| **{tier_left_name}** | **{selected_tier}{selected_tier_badge}** | **{tier_right_name}** |
| --- | --- | --- |
| {tier_left_rate} | **{selected_tier_rate}** | {tier_right_rate} |
| {tier_left_sla} | {selected_tier_sla} | {tier_right_sla} |
| {tier_left_features} | {selected_tier_features} | {tier_right_features} |

**03  Headcount & Device Calculation**

Shown in full so the math is auditable against your invoice every month — no black-box pricing.

| **Total employees / seats** | {seat_count} |
| --- | --- |
| {selected_tier} tier base rate | {base_rate_per_seat} / seat / mo |
| {#has_volume_adjustment}Volume adjustment ({volume_tier_band}) | −{volume_discount_per_seat} / seat / mo{/has_volume_adjustment} |
| **Adjusted rate** | **{adjusted_seat_rate} / seat / mo** |
| **Seat subtotal ({seat_count} seats × {adjusted_seat_rate})** | **{seat_subtotal}** |
| {#has_extra_devices}Managed devices beyond 1:1 ({extra_device_count} servers × {extra_device_rate}) | {extra_device_subtotal}{/has_extra_devices} |
| **Monthly Recurring Subtotal** | **{monthly_recurring_subtotal}** |
| {#has_tax}{tax_jurisdiction} state tax ({tax_rate}, on recurring only) | {tax_amount}{/has_tax} |
| **Total Monthly Recurring** | **{total_monthly_recurring}** |

Plus a one-time onboarding fee, invoiced separately at signing (not subject to the recurring tax above):

|  |  |
| --- | --- |
| **One-time setup & onboarding ({seat_count} seats × {onboarding_rate_per_seat})** | **{setup_fee_total}** |

*{minimum_commitment_note}*

**04  What's Included This Cycle**

{scope_inclusions_narrative}

**05  Next Steps**

Confirm by reply or call (614) 555-0193 — we'll schedule your network & security assessment within 5 business days of sign-off, with a 30-day check-in to confirm SLA response times are being met.

*This document is a proposal, not a signed services agreement — it reflects our best pricing based on the environment details you've shared, confirmed once you accept. A brief services agreement follows separately at signing.*
```

### Output from AI
```json
{
  "variables": [
    {
      "id": "4bc3f210-165b-4644-8de0-3a2c5c9a3af9",
      "company_id": "co2_msp",
      "variable_name": "client_name",
      "natural_name": "Client Name",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 0,
      "descriptor": {
        "sample_value": "Whitfield & Associates",
        "description": "The name of the prospective client company receiving the proposal.",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Whitfield & Associates",
          "template_tag": "{client_name}"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "41a3dbf8-158c-4518-9af4-9afc361bfe0b",
      "company_id": "co2_msp",
      "variable_name": "proposal_date",
      "natural_name": "Proposal Date",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 1,
      "descriptor": {
        "sample_value": "September 7, 2026",
        "description": "The date when the proposal was issued.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_tag": "{proposal_date}",
          "col_index": 0,
          "row_identifier": "September 7, 2026",
          "sample_text": "September 7, 2026"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "7bea0025-d925-4f4e-aa2f-1807aaffd96c",
      "company_id": "co2_msp",
      "variable_name": "proposal_valid_until",
      "natural_name": "Proposal Valid Until",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 2,
      "descriptor": {
        "sample_value": "September 21, 2026 (14 days)",
        "description": "The expiration date or validity period of the proposal.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_tag": "{proposal_valid_until}",
          "col_index": 2,
          "row_identifier": "September 7, 2026",
          "sample_text": "September 21, 2026 (14 days)"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "b312ec9f-e19a-4537-a083-7a68cf803c5d",
      "company_id": "co2_msp",
      "variable_name": "selected_tier",
      "natural_name": "Selected Support Tier",
      "category": "pricing",
      "data_type": "enum",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 3,
      "descriptor": {
        "sample_value": "Standard",
        "description": "The chosen managed IT support tier for the client.",
        "enum_options": [
          "Essential",
          "Standard",
          "Premium"
        ],
        "default_value": "Standard",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Standard",
          "template_tag": "{selected_tier}"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "1583ea0d-f4cd-4edc-a751-f026caac45b1",
      "company_id": "co2_msp",
      "variable_name": "seat_count",
      "natural_name": "Total Employees / Seats",
      "category": "customer_input",
      "data_type": "number",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 4,
      "descriptor": {
        "sample_value": "42",
        "description": "Total number of employee seats included in the support calculation.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{seat_count}",
          "col_index": 1,
          "row_identifier": "Total employees / seats",
          "sample_text": "42"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "660a9868-d7c1-4014-8503-3878710e9439",
      "company_id": "co2_msp",
      "variable_name": "selected_tier_rate",
      "natural_name": "Selected Tier Base Rate",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 5,
      "descriptor": {
        "sample_value": "$65.00 / seat / mo",
        "description": "Base rate per seat per month for the selected tier.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{selected_tier_rate}",
          "col_index": 1,
          "row_identifier": "Standard tier base rate",
          "sample_text": "$65.00 / seat / mo"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "41bc390d-d516-478c-9432-013a2fbac2e7",
      "company_id": "co2_msp",
      "variable_name": "volume_adjustment",
      "natural_name": "Volume Adjustment",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 6,
      "descriptor": {
        "sample_value": "−$5.00 / seat / mo",
        "description": "Per-seat volume discount based on total employee headcount band.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{volume_adjustment}",
          "col_index": 1,
          "row_identifier": "Volume adjustment (25–49 seat band)",
          "sample_text": "−$5.00 / seat / mo"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "5a56accc-b9e2-4e09-8888-f1dd90bf9bd7",
      "company_id": "co2_msp",
      "variable_name": "adjusted_seat_rate",
      "natural_name": "Adjusted Rate",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 7,
      "descriptor": {
        "sample_value": "$60.00 / seat / mo",
        "description": "Adjusted rate per seat per month after volume discount.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{adjusted_seat_rate}",
          "col_index": 1,
          "row_identifier": "Adjusted rate",
          "sample_text": "$60.00 / seat / mo"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "f4389837-7add-4212-83e0-0a79fa9e7699",
      "company_id": "co2_msp",
      "variable_name": "seat_subtotal",
      "natural_name": "Seat Subtotal",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 8,
      "descriptor": {
        "sample_value": "$2,520.00",
        "description": "Total recurring monthly fee for all employee seats.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{seat_subtotal}",
          "col_index": 1,
          "row_identifier": "Seat subtotal (42 seats × $60.00)",
          "sample_text": "$2,520.00"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "5764780c-360a-4215-849c-258c03239c82",
      "company_id": "co2_msp",
      "variable_name": "managed_devices_fee",
      "natural_name": "Managed Devices Beyond 1:1 Fee",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 9,
      "descriptor": {
        "sample_value": "$60.00",
        "description": "Additional monthly fee for managed devices beyond the 1:1 seat ratio.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{managed_devices_fee}",
          "col_index": 1,
          "row_identifier": "Adjusted rate",
          "sample_text": "$60.00"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "7272612c-978d-4ff9-be20-a2f778c08527",
      "company_id": "co2_msp",
      "variable_name": "monthly_recurring_subtotal",
      "natural_name": "Monthly Recurring Subtotal",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 10,
      "descriptor": {
        "sample_value": "$2,580.00",
        "description": "Combined monthly subtotal before taxes.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{monthly_recurring_subtotal}",
          "col_index": 1,
          "row_identifier": "Monthly Recurring Subtotal",
          "sample_text": "$2,580.00"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "1363fc59-c828-47c3-8269-d3461777bf0f",
      "company_id": "co2_msp",
      "variable_name": "sales_tax_amount",
      "natural_name": "State Tax Amount",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 11,
      "descriptor": {
        "sample_value": "$154.80",
        "description": "Applicable state sales tax applied to recurring monthly services.",
        "visibility_rule": {
          "condition_flag": "has_tax",
          "show_when": "value > 0"
        },
        "mutation": {
          "action": "wrap_conditional_row",
          "condition_tag": "has_tax",
          "table_index": 2,
          "template_tag": "{sales_tax_amount}",
          "col_index": 1,
          "row_identifier": "Ohio state tax (6%, on recurring only)",
          "sample_text": "$154.80"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "45cb37e2-7f8a-4d66-a846-ddcbf2b30ee6",
      "company_id": "co2_msp",
      "variable_name": "total_monthly_recurring",
      "natural_name": "Total Monthly Recurring",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 12,
      "descriptor": {
        "sample_value": "$2,734.80",
        "description": "Total monthly recurring cost including tax and extra devices.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{total_monthly_recurring}",
          "col_index": 1,
          "row_identifier": "Total Monthly Recurring",
          "sample_text": "$2,734.80"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "89c690e5-5fc9-4151-befc-4eaca207dc47",
      "company_id": "co2_msp",
      "variable_name": "one_time_setup_fee",
      "natural_name": "One-Time Setup & Onboarding Fee",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 13,
      "descriptor": {
        "sample_value": "$3,150.00",
        "description": "One-time initial onboarding and setup fee.",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 3,
          "template_tag": "{one_time_setup_fee}",
          "col_index": 1,
          "row_identifier": "One-time setup & onboarding (42 seats × $75.00)",
          "sample_text": "$3,150.00"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    },
    {
      "id": "12777e65-efd4-49ca-84cf-5940b573c0af",
      "company_id": "co2_msp",
      "variable_name": "scope_deliverables_summary",
      "natural_name": "Scope Deliverables Summary",
      "category": "paragraph",
      "data_type": "paragraph",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 14,
      "descriptor": {
        "sample_value": "Onboarding of all 42 endpoints and 5 servers into 24/7 monitoring within weeks 1–2...",
        "description": "Scope deliverables, SLA commitments, and location coverage strictly aligned with selected tier and headcount.",
        "paragraph_config": {
          "mode": "ai_generated",
          "purpose": "Draft scope deliverables, SLA commitments, and location coverage strictly aligned with {selected_tier} and the lead's device/headcount footprint.",
          "tone": "Professional and direct"
        },
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Onboarding of all 42 endpoints and 5 servers into 24/7 monitoring within weeks 1–2",
          "template_tag": "{scope_deliverables_summary}"
        }
      },
      "created_at": "2026-09-10T07:23:43.415Z",
      "updated_at": "2026-09-10T07:23:43.415Z"
    }
  ],
  "compound_tables": [
    {
      "id": "2e12a47d-df4a-4f76-90d8-9b9e133241f9",
      "table_id": "tier_comparison_matrix",
      "natural_name": "Tier Comparison Matrix",
      "table_index": 1,
      "type": "comparison_matrix",
      "columns": [
        "Essential",
        "Standard",
        "Premium"
      ],
      "enum_options": [],
      "is_deleted": false
    }
  ]
}
```

### Templatized Docx
(Converted to markdown using anydoc)

```md
**Managed IT Services Proposal**

**{client\_company\_name}**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Fortress IT Group — Sales Engineering | September 21, 2026 (14 days) |

**01  Current Environment Risk Profile**

{risk_profile_narrative} At that headcount, informal or single-contractor IT support is statistically where firms start seeing recurring downtime, delayed patching, and no documented backup posture — all of which compound quietly until an outage or incident forces the issue. The scope below is sized specifically to your headcount and device footprint.

**02  Recommended Tier: Standard**

Standard is built for firms your size that need faster-than-business-hours coverage and managed backups, without paying for the 24/7 / vCIO layer that Premium adds — appropriate once you're running compliance-sensitive client data with real recovery-time expectations.

| **Essential** | {proposal_valid_until} | **Premium** |
| --- | --- | --- |
| $45/seat/mo base | **$65/seat/mo base** | $85/seat/mo base |
| Business hours, next-day | 4-hr response + after-hours line | 1-hr priority, 24/7 |
| — | Managed backup included | + Quarterly vCIO review |

**03  Headcount & Device Calculation**

Shown in full so the math is auditable against your invoice every month — no black-box pricing.

| **Total employees / seats** | {selected_tier} |
| --- | --- |
| Standard tier base rate | $65.00 / seat / mo |
| Volume adjustment (25–49 seat band) | −$5.00 / seat / mo |
| **Adjusted rate** | **$60.00 / seat / mo** |
| **Seat subtotal (42 seats × $60.00)** | **$2,520.00** |
| Managed devices beyond 1:1 (5 servers × $12.00) | $60.00 |
| **Monthly Recurring Subtotal** | **$2,580.00** |
| Ohio state tax (6%, on recurring only) | $154.80 |
| **Total Monthly Recurring** | **$2,734.80** |

Plus a one-time onboarding fee, invoiced separately at signing (not subject to the recurring tax above):

|  |  |
| --- | --- |
| **One-time setup & onboarding ({employee\_count} seats × $7{server\_count}.00)** | **$3,150.00** |

*Minimum billable commitment is 10 seats — your 42-seat count is well above the floor, so no minimum-commit adjustment applies.*

**04  What's Included This Cycle**

- Onboarding of all 42 endpoints and 5 servers into 24/7 monitoring within weeks 1–2
- Managed backup configuration for both office locations
- 4-hour response SLA during business hours; after-hours emergency line for critical outages
- Named account engineer — not a rotating helpdesk queue

**05  Next Steps**

Confirm by reply or call (614) 555-0193 — we'll schedule your network & security assessment within 5 business days of sign-off, with a 30-day check-in to confirm SLA response times are being met.

*This document is a proposal, not a signed services agreement — it reflects our best pricing based on the environment details you've shared, confirmed once you accept. A brief services agreement follows separately at signing.*
```

## Proposal Northstar BloomAndCo

### Parsed Docx
```md
**SEO & Local Visibility Proposal**

**Prepared for Bloom & Co Dental Group**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Northstar Digital Strategy Team | September 21, 2026 (14 days) |

**Where You Stand Today**

Thanks for reaching out through our outreach campaign — you mentioned Bloom & Co now has two active clinic locations and isn't showing up when local patients search on Google. That's a common gap at your stage: single-location SEO tactics stop working once a second location enters the picture, because you're now competing for local pack visibility in two separate map areas at once. Below is the package built for exactly that situation, along with what it costs and what's included.

**Recommended Package: Growth**

Based on your two locations, Growth is the right fit — Local only supports a single location, and Authority is built for franchise-scale accounts. Growth covers both of your clinics under one plan with room to add a third location later without changing tiers.

| **Local** | **Growth  — Recommended** | **Authority** |
| --- | --- | --- |
| $1,000/mo | **$3,000/mo** | $8,000/mo |
| 1 location | Up to 3 locations | Unlimited locations |
| 1 blog post/mo | 4 content pieces/mo | Weekly content |
| — | Citation building | Dedicated strategist |

**Included vs. Not Included — Growth Tier**

- Included: Google Business Profile management for both clinic locations
- Included: On-page SEO across your site, citation building across major directories
- Included: 4 content pieces/month, quarterly strategy call, monthly performance report
- Not included: Paid ad management (Google/Meta ads) — available as a separate engagement
- Not included: A dedicated 1:1 strategist — that begins at the Authority tier

**Your Investment**

You mentioned you'd rather pay annually than track a monthly invoice — that qualifies for our annual prepay discount, applied below.

| **Line Item** | **Amount** |
| --- | --- |
| Growth Package — 12 months × $3,000/mo | $36,000.00 |
| Annual prepay discount (10%) | −$3,600.00 |
| **Subtotal** | **$32,400.00** |
| Texas sales tax (8.25%) | $2,673.00 |
| **Total Annual Investment** | **$35,073.00** |

Equivalent to $2,922.75/month, billed as a single annual payment. Minimum initial engagement is 3 months; month-to-month thereafter.

**Room to Grow: Your Upgrade Path**

If you open a third clinic mid-year, Growth already covers it at no change in price. A fourth location would move you into Authority ($8,000/mo), which adds a dedicated strategist and weekly content — we'd re-quote at that point, not before.

**Next Steps**

Reply to this email or call (512) 555-0148 to confirm — we'll schedule your kickoff call within 3 business days of sign-off, starting with a full Google Business Profile and site audit for both locations.

*This document is a proposal, not a signed contract — it's our best estimate based on what you've shared, and pricing is confirmed once you accept. Happy to walk through any of it on a call first.*
```

### Expected Result
(Doesn't need to be exact but similar)

```md
**SEO & Local Visibility Proposal**

**Prepared for {client_name}**

| **Date** | **Prepared By** | **Proposal Valid Until** |
| --- | --- | --- |
| {proposal_date} | Northstar Digital Strategy Team | {proposal_valid_until} |

**Where You Stand Today**

{client_current_situation_narrative}

**Recommended Package: {selected_tier}**

{recommended_package_justification_narrative}

| **{tier_left_name}** | **{selected_tier}{selected_tier_badge}** | **{tier_right_name}** |
| --- | --- | --- |
| {tier_left_rate} | **{selected_tier_rate}** | {tier_right_rate} |
| {tier_left_locations} | {selected_tier_locations} | {tier_right_locations} |
| {tier_left_content} | {selected_tier_content} | {tier_right_content} |
| {tier_left_features} | {selected_tier_features} | {tier_right_features} |

**Included vs. Not Included — {selected_tier} Tier**

{scope_inclusions_narrative}

**Your Investment**

{payment_preference_narrative}

| **Line Item** | **Amount** |
| --- | --- |
| {selected_tier} Package — {billing_period_description} | {base_investment_amount} |
| {#has_annual_discount}Annual prepay discount ({annual_discount_percentage}) | −{annual_discount_amount}{/has_annual_discount} |
| **Subtotal** | **{subtotal_amount}** |
| {#has_tax}{tax_jurisdiction} sales tax ({tax_rate}) | {tax_amount}{/has_tax} |
| **{total_investment_label}** | **{total_investment_amount}** |

{billing_schedule_narrative}

**Room to Grow: Your Upgrade Path**

{upgrade_path_narrative}

**Next Steps**

Reply to this email or call (512) 555-0148 to confirm — we'll schedule your kickoff call within 3 business days of sign-off, starting with a full Google Business Profile and site audit for both locations.

*This document is a proposal, not a signed contract — it's our best estimate based on what you've shared, and pricing is confirmed once you accept. Happy to walk through any of it on a call first.*
```

### Output from AI
```json
{
  "variables": [
    {
      "id": "56f9a5bd-e221-49e8-946f-4e71d2e6f1fe",
      "company_id": "co1_seo",
      "variable_name": "client_company_name",
      "natural_name": "Client Company Name",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 0,
      "descriptor": {
        "sample_value": "Bloom & Co Dental Group",
        "description": "The name of the prospective client company receiving the proposal.",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Bloom & Co Dental Group",
          "template_tag": "{client_company_name}"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "925e52e8-5e4c-46c2-8143-d2fe7f3c009f",
      "company_id": "co1_seo",
      "variable_name": "proposal_date",
      "natural_name": "Proposal Date",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 1,
      "descriptor": {
        "sample_value": "September 7, 2026",
        "description": "The date the proposal was issued.",
        "default_value": "September 7, 2026",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_tag": "{proposal_date}",
          "col_index": 0,
          "row_identifier": "September 7, 2026",
          "sample_text": "September 7, 2026"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "e6d52963-4b3d-4bfc-bb16-c4bd06aa445f",
      "company_id": "co1_seo",
      "variable_name": "proposal_valid_until",
      "natural_name": "Proposal Valid Until Date",
      "category": "customer_input",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 2,
      "descriptor": {
        "sample_value": "September 21, 2026 (14 days)",
        "description": "Expiration date and validity duration for the proposal.",
        "default_value": "September 21, 2026 (14 days)",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 0,
          "template_tag": "{proposal_valid_until}",
          "col_index": 2,
          "row_identifier": "September 7, 2026",
          "sample_text": "September 21, 2026 (14 days)"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "8b29ce29-911b-46a7-aa73-c25211be347c",
      "company_id": "co1_seo",
      "variable_name": "client_location_count",
      "natural_name": "Client Location Count",
      "category": "customer_input",
      "data_type": "number",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 3,
      "descriptor": {
        "sample_value": "2",
        "description": "Number of active clinic locations owned by the client.",
        "default_value": "2",
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "two active clinic locations",
          "template_tag": "{client_location_count}"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "e0a182e8-2819-4a3a-9624-f60890c52af5",
      "company_id": "co1_seo",
      "variable_name": "selected_tier",
      "natural_name": "Selected Package Tier",
      "category": "pricing",
      "data_type": "enum",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 4,
      "descriptor": {
        "sample_value": "Growth",
        "description": "The selected package tier for the proposal.",
        "enum_options": [
          "Local",
          "Growth",
          "Authority"
        ],
        "visibility_rule": {
          "show_when": "true"
        },
        "paragraph_config": {
          "mode": "fixed"
        },
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Growth",
          "template_tag": "{selected_tier}"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "e77fd3de-918b-4c6d-b498-16c0fd7fa3a8",
      "company_id": "co1_seo",
      "variable_name": "selected_tier_rate",
      "natural_name": "Selected Tier Monthly Rate",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 5,
      "descriptor": {
        "sample_value": "$3,000.00",
        "description": "Monthly rate for the selected package tier.",
        "default_value": "3000.00",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{selected_tier_rate}",
          "col_index": 1,
          "row_identifier": "Selected Tier Monthly Rate",
          "sample_text": "$3,000.00"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "554c275e-6f0a-4ad0-8adb-be36206ded52",
      "company_id": "co1_seo",
      "variable_name": "billing_period_description",
      "natural_name": "Billing Period Description",
      "category": "pricing",
      "data_type": "string",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 6,
      "descriptor": {
        "sample_value": "12 months × $3,000/mo",
        "description": "Description of the billing duration and rate for the line item.",
        "default_value": "12 months × $3,000/mo",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{billing_period_description}",
          "col_index": 0,
          "row_identifier": "Growth Package — 12 months × $3,000/mo",
          "sample_text": "12 months × $3,000/mo"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "2e8cf06b-e53a-4f72-af83-12b511a41b89",
      "company_id": "co1_seo",
      "variable_name": "subtotal_amount",
      "natural_name": "Subtotal Amount",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 7,
      "descriptor": {
        "sample_value": "$32,400.00",
        "description": "Subtotal before taxes.",
        "default_value": "32400.00",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{subtotal_amount}",
          "col_index": 1,
          "row_identifier": "Subtotal",
          "sample_text": "$32,400.00"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "179c8be8-7bde-4735-96c1-386010413398",
      "company_id": "co1_seo",
      "variable_name": "annual_discount_amount",
      "natural_name": "Annual Prepay Discount Amount",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 8,
      "descriptor": {
        "sample_value": "−$3,600.00",
        "description": "Discount applied for annual prepay.",
        "visibility_rule": {
          "condition_flag": "has_annual_discount",
          "show_when": "value > 0"
        },
        "mutation": {
          "action": "wrap_conditional_row",
          "condition_tag": "has_annual_discount",
          "table_index": 2,
          "template_tag": "{annual_discount_amount}",
          "col_index": 1,
          "row_identifier": "Annual prepay discount (10%)",
          "sample_text": "−$3,600.00"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "f350a567-3c4e-4d23-9d08-a0533b72f43c",
      "company_id": "co1_seo",
      "variable_name": "sales_tax_amount",
      "natural_name": "Sales Tax Amount",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 9,
      "descriptor": {
        "sample_value": "$2,673.00",
        "description": "Applicable sales tax for the region.",
        "visibility_rule": {
          "condition_flag": "has_tax",
          "show_when": "value > 0"
        },
        "mutation": {
          "action": "wrap_conditional_row",
          "condition_tag": "has_tax",
          "table_index": 2,
          "template_tag": "{sales_tax_amount}",
          "col_index": 1,
          "row_identifier": "Texas sales tax (8.25%)",
          "sample_text": "$2,673.00"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "b391da11-4ecf-4c4c-914a-fdc3ca941a99",
      "company_id": "co1_seo",
      "variable_name": "total_investment",
      "natural_name": "Total Annual Investment",
      "category": "pricing",
      "data_type": "currency",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 10,
      "descriptor": {
        "sample_value": "$35,073.00",
        "description": "Final total annual investment including discounts and taxes.",
        "default_value": "35073.00",
        "mutation": {
          "action": "replace_table_cell",
          "table_index": 2,
          "template_tag": "{total_investment}",
          "col_index": 1,
          "row_identifier": "Total Annual Investment",
          "sample_text": "$35,073.00"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    },
    {
      "id": "36ff343a-9e17-49f4-bcce-ea1e6ead0914",
      "company_id": "co1_seo",
      "variable_name": "tier_scope_deliverables",
      "natural_name": "Tier Scope Deliverables",
      "category": "paragraph",
      "data_type": "paragraph",
      "is_custom": false,
      "is_deleted": false,
      "sort_order": 11,
      "descriptor": {
        "sample_value": "- Included: Google Business Profile management for both clinic locations\n- Included: On-page SEO across your site, citation building across major directories\n- Included: 4 content pieces/month, quarterly strategy call, monthly performance report",
        "description": "Detailed deliverables and scope included for the chosen tier and location footprint.",
        "paragraph_config": {
          "mode": "ai_generated",
          "purpose": "Draft scope deliverables, SLA commitments, and location coverage strictly aligned with {selected_tier} and the lead's device/headcount footprint.",
          "tone": "Professional and descriptive"
        },
        "mutation": {
          "action": "replace_text_run",
          "sample_text": "Included: Google Business Profile management for both clinic locations",
          "template_tag": "{tier_scope_deliverables}"
        }
      },
      "created_at": "2026-09-10T07:22:34.933Z",
      "updated_at": "2026-09-10T07:22:34.933Z"
    }
  ],
  "compound_tables": [
    {
      "id": "9ef61c0a-1ac1-46d4-8c3f-b459cadf95dd",
      "table_id": "package_comparison_matrix",
      "natural_name": "Package Comparison Matrix",
      "table_index": 1,
      "type": "comparison_matrix",
      "columns": [
        "Local",
        "Growth",
        "Authority"
      ],
      "enum_options": [],
      "is_deleted": false
    }
  ]
}
```

### Templatized Docx
(Converted to markdown using anydoc)

```md
**SEO & Local Visibility Proposal**

**Prepared for {client\_company\_name}**

| **Date** | {proposal_valid_until} | **Proposal Valid Until** |
| --- | --- | --- |
| September 7, 2026 | Northstar Digital Strategy Team | September 21, 2026 (14 days) |

**Where You Stand Today**

Thanks for reaching out through our outreach campaign — you mentioned Bloom & Co now has two active clinic locations and isn't showing up when local patients search on Google. That's a common gap at your stage: single-location SEO tactics stop working once a second location enters the picture, because you're now competing for local pack visibility in two separate map areas at once. Below is the package built for exactly that situation, along with what it costs and what's included.

**Recommended Package: {selected\_tier}**

Based on your two locations, Growth is the right fit — Local only supports a single location, and Authority is built for franchise-scale accounts. Growth covers both of your clinics under one plan with room to add a third location later without changing tiers.

| **Local** | {selected_tier_rate} | **Authority** |
| --- | --- | --- |
| $1,000/mo | **$3,000/mo** | $8,000/mo |
| 1 location | Up to 3 locations | Unlimited locations |
| 1 blog post/mo | 4 content pieces/mo | Weekly content |
| — | Citation building | Dedicated strategist |

**Included vs. Not Included — Growth Tier**

- Included: Google Business Profile management for both clinic locations
- Included: On-page SEO across your site, citation building across major directories
- Included: 4 content pieces/month, quarterly strategy call, monthly performance report
- Not included: Paid ad management (Google/Meta ads) — available as a separate engagement
- Not included: A dedicated 1:1 strategist — that begins at the Authority tier

**Your Investment**

You mentioned you'd rather pay annually than track a monthly invoice — that qualifies for our annual prepay discount, applied below.

| **Line Item** | {total_investment} |
| --- | --- |
| Growth Package — 12 months × $3,000/mo | $36,000.00 |
| Annual prepay discount (10%) | −$3,600.00 |
| **Subtotal** | **$32,400.00** |
| Texas sales tax (8.25%) | $2,673.00 |
| **Total Annual Investment** | **$35,073.00** |

Equivalent to $2,922.75/month, billed as a single annual payment. Minimum initial engagement is 3 months; month-to-month thereafter.

**Room to Grow: Your Upgrade Path**

If you open a third clinic mid-year, Growth already covers it at no change in price. A fourth location would move you into Authority ($8,000/mo), which adds a dedicated strategist and weekly content — we'd re-quote at that point, not before.

**Next Steps**

Reply to this email or call (512) 555-0148 to confirm — we'll schedule your kickoff call within 3 business days of sign-off, starting with a full Google Business Profile and site audit for both locations.

*This document is a proposal, not a signed contract — it's our best estimate based on what you've shared, and pricing is confirmed once you accept. Happy to walk through any of it on a call first.*
```

