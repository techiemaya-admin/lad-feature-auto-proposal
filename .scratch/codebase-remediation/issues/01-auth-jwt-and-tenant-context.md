# 01: Authentication Signature Verification & Tenant Context Enforcement

**What to build:**
Secure token authentication and tenant boundary resolution across the entire HTTP API surface. Inbound requests with Bearer tokens are cryptographically verified against the server's secret, preventing unauthorized access and token forgery. Standard tenant-scoped routes automatically resolve and enforce the tenant identifier from request context so that catalog, pricing, and configuration queries operate in their isolated tenant environment.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] `auth.middleware.js` verifies JWT signatures using `jwt.verify` and `process.env.JWT_SECRET` (or default fallback in dev/test) instead of `jwt.decode`.
- [x] Forged, malformed, or expired tokens receive a `401 Unauthorized` response with `{ "error": "Invalid or expired token" }`.
- [x] Valid tokens successfully populate `req.tenantId` and `req.userId` for downstream handlers.
- [x] `tenantContext` middleware is mounted across concept, pricing rule, pricing model, and lead requirement config route groups.
- [x] Concept operations (`POST /api/concepts`, `GET /api/concepts/:tenant_id`, `PUT /api/concepts/:id`, `DELETE /api/concepts/:id`) have access to resolved `req.tenantId`.
- [x] Pricing rule delete queries enforce tenant boundaries (`WHERE id = $1 AND tenant_id = $2`) preventing cross-tenant deletion leaks.
