# Backend API List

This document lists backend APIs for the `lad-feature-auto-proposal` project, with example requests and responses derived from controller DTOs.

> Note: All tenant-scoped endpoints require the `X-Tenant-Id` header (except Tenant management endpoints).

---

## Health

- GET /health

Response (200):
```json
{ "status": "ok", "timestamp": "2026-02-13T00:00:00.000Z" }
```

---

## Tenants

- POST /api/tenants

Headers: none

Request body:
```json
{
  "name": "Acme Corp",
  "slug": "acme",
  "metadata": { "plan": "pro" }
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "name": "Acme Corp",
  "slug": "acme",
  "metadata": { "plan": "pro" },
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

- GET /api/tenants

Response (200): array of tenant objects (same shape as above)

- GET /api/tenants/:id

Response (200): tenant object

---

## Locations

All endpoints require header: `X-Tenant-Id: <tenant-id>`

- POST /api/locations

Request body:
```json
{
  "name": "Mumbai Office",
  "code": "BOM",
  "timezone": "Asia/Kolkata",
  "metadata": { "address": "..." }
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "name": "Mumbai Office",
  "code": "BOM",
  "timezone": "Asia/Kolkata",
  "metadata": { "address": "..." },
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

- GET /api/locations

Query params: `limit`, `offset`

Response (200): array of location objects

- GET /api/locations/:id

Response (200): location object

---

## Concepts

All endpoints require header: `X-Tenant-Id: <tenant-id>`

- POST /api/concepts

Request body:
```json
{
  "name": "Premium Cleaning",
  "code": "PC-1",
  "description": "Full office cleaning",
  "metadata": { "category": "cleaning" }
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "name": "Premium Cleaning",
  "code": "PC-1",
  "description": "Full office cleaning",
  "metadata": { "category": "cleaning" },
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

- GET /api/concepts

Query params: `limit`, `offset`, `location_id`

Response (200): array of concept objects

- GET /api/concepts/:id

Response (200): concept object

- POST /api/concepts/:conceptId/locations/:locationId

Description: Link a concept to a location (request body optional).

Response (201):
```json
{
  "id": "uuid-v4",
  "concept_id": "concept-uuid",
  "location_id": "location-uuid",
  "is_available": true
}
```

- POST /api/concepts/:id/pricing

Request body:
```json
{
  "base_price": 1500.0,
  "min_quantity": 1,
  "unit": "hour",
  "location_multiplier": 1.2
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "concept_id": "concept-uuid",
  "base_price": 1500.0,
  "min_quantity": 1,
  "unit": "hour",
  "location_multiplier": 1.2
}
```

---

## Leads

All endpoints require header: `X-Tenant-Id: <tenant-id>`

- POST /api/leads

Request body:
```json
{
  "location_id": "location-uuid",
  "status": "draft",
  "metadata": { "customer_name": "John Doe" }
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "location_id": "location-uuid",
  "status": "draft",
  "metadata": { "customer_name": "John Doe" },
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

- GET /api/leads

Query params: `limit`, `offset`

Response (200): array of lead objects

- GET /api/leads/:id

Response (200): lead object

---

## Quotations

All endpoints require header: `X-Tenant-Id: <tenant-id>`

- POST /api/quotations

Request body (required fields enforced in controller):
```json
{
  "lead_requirement_id": "lead-requirement-uuid",
  "concept_id": "concept-uuid",
  "quantity": 2,
  "quotation_template_metadata_id": "template-uuid"
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "lead_requirement_id": "lead-requirement-uuid",
  "price_calculation_id": "price-calculation-uuid",
  "quotation_template_metadata_id": "template-uuid",
  "status": "draft",
  "quotation_number": "Q-0001",
  "body": { /* rendered quotation body */ },
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

- GET /api/quotations/:id

Response (200): quotation object

- GET /api/quotations/lead/:leadId

Response (200): array of quotation objects for given lead

---

## Pricing

- The `/api/pricing` route file is a placeholder. However the pricing controller exposes two logical actions:

1. Calculate price (controller: `pricing.calculate`)

- POST /api/pricing/calculate  (if wired)

Request body:
```json
{
  "concept_id": "concept-uuid",
  "location_id": "location-uuid",
  "quantity": 3,
  "lead_requirement_id": "lead-requirement-uuid"
}
```

Response (200):
```json
{
  "total": 4500.0,
  "currency": "INR",
  "breakdown": { /* pricing breakdown object from pricing engine */ }
}
```

2. Create pricing rule (controller: `pricing.createRule`)

- POST /api/pricing/rules  (if wired)

Request body:
```json
{
  "name": "Weekend surcharge",
  "rule_type": "multiplier",
  "parameters": { "multiplier": 1.1 },
  "evaluation_order": 10,
  "is_active": true
}
```

Response (201):
```json
{
  "id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "name": "Weekend surcharge",
  "rule_type": "multiplier",
  "parameters": { "multiplier": 1.1 },
  "evaluation_order": 10,
  "is_active": true
}
```

> Note: confirm wiring of `pricing-routes.js` to expose these endpoints.

---

## Quotation Templates

- The `/api/quotation-templates` route file is a placeholder; the template service/controllers exist but routes are not yet wired.

---

## Common Notes

- Pagination: `limit` (max 100) and `offset` are supported on list endpoints.
- Tenant header: pass `X-Tenant-Id` for tenant-scoped routes (locations, concepts, leads, quotations, pricing).
- Error format: controllers generally forward errors; typical validation error response:
```json
{ "error": "<message>" }
```

---

Generated on 2026-02-13
