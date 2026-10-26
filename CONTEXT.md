# Rush Away Auto-Proposal

Multi-tenant quotation, dynamic pricing calculation, and automated proposal generation engine.

## Language

### Core Tenancy & Structure

**Tenant**:
The top-level organization or account boundary that owns all locations, concepts, pricing rules, leads, and proposal data.
_Avoid_: Account, client, company

**Location**:
A specific physical branch or geographic operating market belonging to a Tenant.
_Avoid_: Branch, office, zone

### Catalog & Pricing

**Concept**:
A standardized product or service offering tier (such as LITE or IMPACT) defining catalog capabilities and deliverables.
_Avoid_: Service, package, product, item

**Concept Pricing Matrix**:
The unit pricing configuration for a Concept, defining base rates, minimum quantities, unit measurements, and location multipliers.
_Avoid_: Price list, rate card, tariff

**Pricing Model**:
A named container for dynamic pricing logic and formula sets assigned to a Tenant.
_Avoid_: Pricing plan, billing schema

**Pricing Rule**:
A discrete evaluation rule with order precedence, conditions, and operations (multiplier, fixed amount, discount, override) applied during price calculation.
_Avoid_: Price modifier, discount rule, surcharge

### Sales & Proposals

**Lead**:
An inbound customer inquiry or prospect engagement associated with a specific Tenant and Location.
_Avoid_: Opportunity, deal, prospect

**Lead Requirement Config**:
Tenant-level dynamic schema definitions specifying required client input attributes and dimensional parameters.
_Avoid_: Custom fields, requirement schema

**Lead Requirement Values**:
The concrete customer requirements and input data captured for a specific Lead.
_Avoid_: Requirements, client specs

**Quotation Template**:
A customizable `.docx` document template populated with dynamic placeholder tokens to produce client-facing proposals.
_Avoid_: Document template, contract template

**Proposal Draft**:
A generated multi-concept comparison document with itemized cost breakdowns, markups, and discounts pending review and approval.
_Avoid_: Estimate, quote, draft proposal

### Communication & AI

**Conversation**:
An omnichannel customer communication thread tracking inbound and outbound messages, attachments, and timestamps across integrations.
_Avoid_: Chat, thread, message log

**AI Auto-Proposal Engine**:
The multi-model AI pipeline (OpenAI and Google Gemini) that parses unstructured inquiries, matches concepts, calculates pricing, and drafts proposal content.
_Avoid_: AI bot, auto responder, quotation assistant
