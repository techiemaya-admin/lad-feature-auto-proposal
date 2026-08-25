# 02: Lead Ingestion & Single Lead Retrieval Flow

**What to build:**
End-to-end working lead creation and retrieval pipelines. When creating a lead via `POST /api/leads`, client contact information (name, email, phone, company, tags, metadata) is preserved through the DTO transformation and persisted into the database without premature validation failure. Single lead lookups via `GET /api/leads/:id` correctly match the Lead ID and Tenant ID in the query parameters so prospects are returned successfully instead of returning false 404 errors.

**Blocked by:** 01: Authentication Signature Verification & Tenant Context Enforcement

**Status:** ready-for-agent

- [ ] `createLeadDto` retains all valid lead properties including `email`, `phone`, `first_name`, `last_name`, `company_name`, `tags`, `custom_fields`, and `metadata`.
- [ ] `POST /api/leads` successfully creates a lead when valid `email` or `phone` is provided in the request payload.
- [ ] `lead.controller.js` `getById` passes parameters in the correct order `(req.params.id, req.tenantId)` to `leadService.getLeadById`.
- [ ] `GET /api/leads/:id` returns `200 OK` with complete lead details when the lead exists within the authenticated tenant.
- [ ] `GET /api/leads/:id` returns `404 Not Found` only when the lead does not exist or belongs to a different tenant.
- [ ] `toLeadResponse` formats the complete lead entity including timestamps and contact details.
