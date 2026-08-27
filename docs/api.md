# Backend API Reference

Comprehensive reference for all backend endpoints mounted in `src/app.js`.

> **Base URL:** `http://localhost:3000`  
> **Tenant Header:** Endpoints requiring tenant scoping must include `X-Tenant-Id: <tenant-uuid>`.  
> **Auth Header:** Protected endpoints require `Authorization: Bearer <jwt-token>`.

---

## 1. System Health

### `GET /health`
Returns service availability status and current server timestamp.

```bash
curl -i http://localhost:3000/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T18:00:00.000Z"
}
```

---

## 2. Tenants (Global Root)

### `POST /api/tenants`
Creates a new tenant organization.

```bash
curl -i -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme",
    "metadata": { "plan": "pro" }
  }'
```

**Response (201 Created):**
```json
{
  "id": "tenant-uuid-v4",
  "name": "Acme Corp",
  "slug": "acme",
  "metadata": { "plan": "pro" },
  "created_at": "2026-02-24T18:00:00.000Z",
  "updated_at": "2026-02-24T18:00:00.000Z"
}
```

### `GET /api/tenants`
List all tenant organizations.

```bash
curl -i http://localhost:3000/api/tenants
```

### `GET /api/tenants/:id`
Fetch tenant details by ID.

```bash
curl -i http://localhost:3000/api/tenants/<tenant-id>
```

---

## 3. Locations

### `POST /api/locations`
Create a location for a tenant. Requires `X-Tenant-Id` header.

```bash
curl -i -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "Mumbai Office",
    "code": "BOM",
    "timezone": "Asia/Kolkata",
    "metadata": { "address": "BKC, Mumbai" }
  }'
```

### `GET /api/locations`
List locations for the tenant.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/api/locations?limit=20&offset=0"
```

### `GET /api/locations/:id`
Get location by ID.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/locations/<location-id>
```

---

## 4. Concepts (Catalog Tiers)

### `POST /api/concepts`
Create a concept tier (e.g., LITE, IMPACT).

```bash
curl -i -X POST http://localhost:3000/api/concepts \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "IMPACT",
    "description": "Full-service impact tier",
    "minimum_cost": 5000,
    "requirement_config_ids": ["<config-id-1>", "<config-id-2>"]
  }'
```

### `GET /api/concepts/:tenant_id`
List all concepts configured for a tenant. Requires `X-Tenant-Id` header.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/concepts/<tenant-id>
```

### `PUT /api/concepts/:id`
Update an existing concept. Requires `X-Tenant-Id` header.

```bash
curl -i -X PUT http://localhost:3000/api/concepts/<concept-id> \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "IMPACT Premium",
    "code": "IMP-02",
    "description": "Updated tier description"
  }'
```

### `DELETE /api/concepts/:id`
Delete a concept. Requires `X-Tenant-Id` header.

```bash
curl -i -X DELETE http://localhost:3000/api/concepts/<concept-id> \
  -H "X-Tenant-Id: <tenant-id>"
```

---

## 5. Concept Pricing Matrix

### `POST /api/concept-pricing-matrix`
Configure unit rates and multipliers for a concept.

```bash
curl -i -X POST http://localhost:3000/api/concept-pricing-matrix \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "tenant_id": "<tenant-id>",
    "concept_id": "<concept-id>",
    "base_price": 5000.00,
    "min_quantity": 1,
    "unit": "month",
    "location_multiplier": 1.15
  }'
```

### `GET /api/concept-pricing-matrix/:tenant_id`
List all pricing matrix rows for a tenant.

```bash
curl -i http://localhost:3000/api/concept-pricing-matrix/<tenant-id>
```

### `GET /api/concept-pricing-matrix/concept/:conceptId`
Get pricing matrix for a specific concept.

```bash
curl -i http://localhost:3000/api/concept-pricing-matrix/concept/<concept-id>
```

### `PUT /api/concept-pricing-matrix/:id`
Update pricing matrix row.

```bash
curl -i -X PUT http://localhost:3000/api/concept-pricing-matrix/<matrix-id> \
  -H "Content-Type: application/json" \
  -d '{ "base_price": 5500.00, "location_multiplier": 1.20 }'
```

### `DELETE /api/concept-pricing-matrix/:id`
Delete pricing matrix entry.

```bash
curl -i -X DELETE http://localhost:3000/api/concept-pricing-matrix/<matrix-id>
```

---

## 6. Leads & Requirements

### `POST /api/leads`
Create a new lead inquiry.

```bash
curl -i -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "location_id": "<location-id>",
    "status": "draft",
    "metadata": { "customer_name": "Jane Doe", "email": "jane@example.com" }
  }'
```

### `GET /api/leads`
List leads for the tenant.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/api/leads?limit=50&offset=0"
```

### `GET /api/leads/:id`
Get lead details with requirements.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/leads/<lead-id>
```

---

## 7. Dynamic Lead Requirement Schema

### `POST /api/lead-requirement-config`
Create schema definitions for custom lead intake questions.

```bash
curl -i -X POST http://localhost:3000/api/lead-requirement-config \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant-id>",
    "field_name": "square_footage",
    "field_type": "number",
    "is_required": true
  }'
```

### `GET /api/lead-requirement-config/:tenant_id`
Fetch lead requirement config schema for a tenant.

```bash
curl -i http://localhost:3000/api/lead-requirement-config/<tenant-id>
```

---

## 8. Pricing Models & Rules

### `POST /api/pricing-models`
Define a pricing model container for a tenant.

```bash
curl -i -X POST http://localhost:3000/api/pricing-models \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant-id>",
    "name": "Standard Tier Dynamic Model",
    "description": "Evaluates base pricing with seasonal and volume rules"
  }'
```

### `GET /api/pricing-models/:tenant_id`
List pricing models for a tenant.

```bash
curl -i http://localhost:3000/api/pricing-models/<tenant-id>
```

### `POST /api/pricing-rules`
Create an evaluation rule. Supports both `service` and `package` target types. Requires `X-Tenant-Id` header.

**Service Target Rule:**
```bash
curl -i -X POST http://localhost:3000/api/pricing-rules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "Large Gathering Discount",
    "target_type": "service",
    "condition_field": "guest_count",
    "condition_operator": ">=",
    "condition_value": 200,
    "action_type": "discount",
    "action_mode": "percentage",
    "action_value": 10,
    "priority": 1,
    "is_active": true
  }'
```

**Package Target Rule:**
```bash
curl -i -X POST http://localhost:3000/api/pricing-rules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "Luxury Package Surcharge",
    "target_type": "package",
    "concept_id": "<concept-uuid>",
    "action_type": "surcharge",
    "action_mode": "fixed",
    "action_value": 500,
    "priority": 2,
    "is_active": true
  }'
```

### `GET /api/pricing-rules`
List dynamic pricing rules for the tenant (requires `X-Tenant-Id` header).

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/pricing-rules
```

### `GET /api/pricing-rules/detail/:id`
Get a specific pricing rule by ID.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/pricing-rules/detail/<rule-id>
```

### `PUT /api/pricing-rules/:id`
Update an existing pricing rule.

```bash
curl -i -X PUT http://localhost:3000/api/pricing-rules/<rule-id> \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "name": "Updated Gathering Discount",
    "action_value": 15
  }'
```

### `DELETE /api/pricing-rules/:id`
Soft-delete a pricing rule.

```bash
curl -i -X DELETE http://localhost:3000/api/pricing-rules/<rule-id> \
  -H "X-Tenant-Id: <tenant-id>"
```

---

## 9. Quotations & Proposals

### `POST /api/quotations`
Generate a structured quotation (legacy engine; refer to ADR-0004).

```bash
curl -i -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{
    "lead_requirement_id": "<lead-requirement-id>",
    "concept_id": "<concept-id>",
    "quantity": 2,
    "quotation_template_metadata_id": "<template-id>"
  }'
```

### `GET /api/quotations/:id`
Get quotation by ID.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotations/<quotation-id>
```

### `GET /api/quotations/lead/:leadId`
List all quotations generated for a specific lead.

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotations/lead/<lead-id>
```

### `PATCH /api/proposal-draft/approve/:id`
Approve an AI proposal draft and finalize client quotation (Active Proposal Draft Pipeline per ADR-0004).

```bash
curl -i -X PATCH http://localhost:3000/api/proposal-draft/approve/<proposal-id>
```

---

## 10. Document & Email Templates

### `POST /api/quotation-templates/upload/:tenantId`
Upload a `.docx` proposal template (multipart file upload).

```bash
curl -i -X POST http://localhost:3000/api/quotation-templates/upload/<tenant-id> \
  -F "file=@template.docx"
```

### `GET /api/quotation-templates/:tenantId`
List uploaded quotation templates.

```bash
curl -i http://localhost:3000/api/quotation-templates/<tenant-id>
```

### `PATCH /api/quotation-templates/:tenantId/set-default/:id`
Set the default proposal template.

```bash
curl -i -X PATCH http://localhost:3000/api/quotation-templates/<tenant-id>/set-default/<template-id>
```

### `GET /api/template-placeholder/:tenantId`
Get available merge placeholders for document generation.

```bash
curl -i http://localhost:3000/api/template-placeholder/<tenant-id>
```

### `POST /api/email-templates/upload/:tenantId`
Upload an email template `.docx` file for conversion and merge formatting.

```bash
curl -i -X POST http://localhost:3000/api/email-templates/upload/<tenant-id> \
  -F "file=@email-template.docx"
```

### `GET /api/email-templates/:id/preview`
Generate an HTML preview of an email template.

```bash
curl -i http://localhost:3000/api/email-templates/<template-id>/preview
```

### `PATCH /api/email-templates/:tenantId/set-default/:id`
Mark an email template as default for a tenant.

```bash
curl -i -X PATCH http://localhost:3000/api/email-templates/<tenant-id>/set-default/<template-id>
```

### `GET /api/email-templates/:contact_id`
List email templates available for a given contact thread (requires JWT auth).

```bash
curl -i http://localhost:3000/api/email-templates/<contact-id> \
  -H "Authorization: Bearer <jwt-token>"
```

### `POST /api/quotation-email-template/create`
Create a structured quotation email template.

```bash
curl -i -X POST http://localhost:3000/api/quotation-email-template/create \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant-id>",
    "name": "Formal Proposal Delivery",
    "subject": "Proposal for {{company_name}}",
    "body_html": "<p>Dear {{lead_name}}, please find attached your proposal.</p>",
    "body_text": "Dear {{lead_name}}, please find attached your proposal."
  }'
```

### `GET /api/quotation-email-template/tenant/:tenant_id`
Fetch all quotation email templates for a tenant.

```bash
curl -i http://localhost:3000/api/quotation-email-template/tenant/<tenant-id>
```

---

## 11. Tenant Profile

### `GET /api/tenant-profile/:tenantId`
Retrieve full branding and configuration profile for a tenant.

```bash
curl -i http://localhost:3000/api/tenant-profile/<tenant-id>
```

**Response (200 OK):**
```json
{
  "id": "tenant-uuid-v4",
  "tenant_id": "tenant-uuid-v4",
  "company_name": "Studio Pro",
  "official_email": "contact@studiopro.com",
  "phone_number": "+1-555-0199",
  "website_url": "https://studiopro.com",
  "company_logo_url": "https://storage.googleapis.com/.../logo.png",
  "tagline": "Capturing Timeless Moments",
  "instagram_url": "https://instagram.com/studiopro",
  "linkedin_url": "https://linkedin.com/company/studiopro",
  "whatsapp_url": "https://wa.me/15550199"
}
```

### `PATCH /api/tenant-profile/:tenantId/update-field`
Update a specific field in the tenant profile.

```bash
curl -i -X PATCH http://localhost:3000/api/tenant-profile/<tenant-id>/update-field \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "tagline",
    "fieldValue": "Excellence in Every Frame"
  }'
```

### `POST /api/tenant-profile/:tenantId/logo`
Upload and update the tenant company logo.

```bash
curl -i -X POST http://localhost:3000/api/tenant-profile/<tenant-id>/logo \
  -F "logo=@logo.png"
```

### `GET /api/tenant-profile/:tenantId/logo/preview`
Get current company logo preview URL.

```bash
curl -i http://localhost:3000/api/tenant-profile/<tenant-id>/logo/preview
```

---

## 12. Gmail Integration & Webhooks

### `POST /api/gmail/watch`
Start Gmail push notification watch via Google Cloud Pub/Sub.

```bash
curl -i -X POST http://localhost:3000/api/gmail/watch
```

### `POST /api/gmail/webhook`
Receives push notifications from Google Pub/Sub for incoming emails.

```bash
curl -i -X POST http://localhost:3000/api/gmail/webhook \
  -H "Content-Type: application/json" \
  -d '{ "message": { "data": "<base64-encoded-pubsub-data>" } }'
```

### `GET /api/gmail/test-prompt`
Test AI proposal generation path with sample text.

```bash
curl -i http://localhost:3000/api/gmail/test-prompt
```

---

## 13. Omnichannel Conversations & AI Summaries

> All conversation endpoints require `Authorization: Bearer <jwt-token>`.

### `GET /api/email-conversations/contacts`
Fetch conversation threads list.

```bash
curl -i http://localhost:3000/api/email-conversations/contacts \
  -H "Authorization: Bearer <jwt-token>"
```

### `GET /api/email-conversations/messages`
Fetch messages in a thread.

```bash
curl -i "http://localhost:3000/api/email-conversations/messages?contact_id=<contact-id>" \
  -H "Authorization: Bearer <jwt-token>"
```

### `POST /api/email-conversations/upload`
Upload an attachment file to a conversation.

```bash
curl -i -X POST http://localhost:3000/api/email-conversations/upload \
  -H "Authorization: Bearer <jwt-token>" \
  -F "file=@proposal.pdf"
```

### `GET /api/email-conversations/email-ai-followup/:contactId`
Generate AI-suggested follow-up email copy.

```bash
curl -i http://localhost:3000/api/email-conversations/email-ai-followup/<contact-id> \
  -H "Authorization: Bearer <jwt-token>"
```

### `GET /api/email-conversations/email-ai-crux/:contactId`
Extract an AI executive summary/crux of the entire customer conversation thread.

```bash
curl -i http://localhost:3000/api/email-conversations/email-ai-crux/<contact-id> \
  -H "Authorization: Bearer <jwt-token>"
```

---

## 14. AI Response Suggestions

### `GET /api/ai-response/suggest-concepts/:tenantId`
Suggest optimal catalog concepts for a given requirement prompt.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-concepts/<tenant-id>?prompt=luxury+wedding+reception+300+guests"
```

**Response Example:**
```json
{
  "suggestions": [
    {
      "name": "Luxury Experience",
      "description": "Full-service luxury production with media and catering",
      "minimum_cost": 5000,
      "requirement_configs": [
        { "id": "cfg-1", "name": "Photography" },
        { "id": "cfg-2", "name": "Catering" }
      ]
    }
  ]
}
```

### `GET /api/ai-response/suggest-pricing-rule/:tenantId`
AI suggestion for applicable pricing rules based on current requirement configuration and concept catalog.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-pricing-rule/<tenant-id>?prompt=large+gathering+discount"
```

**Response Example:**
```json
{
  "suggestions": [
    {
      "name": "Large Gathering Discount",
      "target_type": "service",
      "condition_field": "guest_count",
      "condition_name": "Guest Count",
      "condition_operator": ">=",
      "condition_value": 200,
      "action_type": "discount",
      "action_mode": "percentage",
      "action_value": 10,
      "description": "Apply 10% discount when guest count exceeds 200"
    }
  ]
}
```

### `GET /api/ai-response/suggest-email-templates/:tenantId`
AI recommendation for the most relevant email template with merge tokens.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-email-templates/<tenant-id>?prompt=formal+quotation+delivery"
```

---

## 15. Social & Google Integration

### `GET /api/social-integration/email/google/callback`
OAuth2 callback endpoint receiving authorization code from Google OAuth flow.

```bash
curl -i "http://localhost:3000/api/social-integration/email/google/callback?code=<auth-code>&state=<state>"
```

### `POST /api/social-integration/email/google/start`
Initiate Google OAuth flow (requires `Authorization: Bearer <jwt-token>`).

```bash
curl -i -X POST http://localhost:3000/api/social-integration/email/google/start \
  -H "Authorization: Bearer <jwt-token>"
```

### `POST /api/social-integration/email/google/status`
Check connection status and active email address for Google integration (requires `Authorization: Bearer <jwt-token>`).

```bash
curl -i -X POST http://localhost:3000/api/social-integration/email/google/status \
  -H "Authorization: Bearer <jwt-token>"
```

### `POST /api/social-integration/email/google/disconnect`
Disconnect active Google OAuth integration (requires `Authorization: Bearer <jwt-token>`).

```bash
curl -i -X POST http://localhost:3000/api/social-integration/email/google/disconnect \
  -H "Authorization: Bearer <jwt-token>"
```

