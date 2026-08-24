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
    "code": "IMP-01",
    "description": "Full-service impact tier"
  }'
```

### `GET /api/concepts/:tenant_id`
List all concepts configured for a tenant.

```bash
curl -i http://localhost:3000/api/concepts/<tenant-id>
```

### `PUT /api/concepts/:id`
Update an existing concept.

```bash
curl -i -X PUT http://localhost:3000/api/concepts/<concept-id> \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IMPACT Premium",
    "code": "IMP-02",
    "description": "Updated tier description"
  }'
```

### `DELETE /api/concepts/:id`
Delete a concept.

```bash
curl -i -X DELETE http://localhost:3000/api/concepts/<concept-id>
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
Create an evaluation rule attached to a pricing model.

```bash
curl -i -X POST http://localhost:3000/api/pricing-rules \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant-id>",
    "pricing_model_id": "<model-id>",
    "name": "Volume Discount > 100 units",
    "rule_type": "percentage_discount",
    "parameters": { "discount_percentage": 10 },
    "evaluation_order": 1,
    "is_active": true
  }'
```

### `GET /api/pricing-rules/:tenant_id`
List dynamic pricing rules for a tenant.

```bash
curl -i http://localhost:3000/api/pricing-rules/<tenant-id>
```

---

## 9. Quotations & Proposals

### `POST /api/quotations`
Generate a structured quotation.

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
Approve an AI proposal draft and finalize client quotation.

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

---

## 11. Gmail Integration & Webhooks

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

## 12. Omnichannel Conversations & AI Summaries

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

## 13. AI Response Suggestions

### `GET /api/ai-response/suggest-concepts/:tenantId`
Suggest optimal concepts for a given requirement prompt.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-concepts/<tenant-id>?prompt=office+cleaning+5000+sqft"
```

### `GET /api/ai-response/suggest-pricing-rule/:tenantId`
AI suggestion for applicable pricing rules.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-pricing-rule/<tenant-id>?prompt=rush+weekend+service"
```

### `GET /api/ai-response/suggest-email-templates/:tenantId`
AI recommendation for the most relevant email template.

```bash
curl -i "http://localhost:3000/api/ai-response/suggest-email-templates/<tenant-id>?prompt=enterprise+quote"
```
