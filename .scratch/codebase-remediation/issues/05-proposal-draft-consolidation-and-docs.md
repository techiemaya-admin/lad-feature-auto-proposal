# 05: Proposal Draft Consolidation & Documentation Synchronization

**What to build:**
Architectural hygiene and complete documentation alignment across the repository. The legacy quotation calculation engines are formally annotated with `@deprecated` headers designating Proposal Draft as the sole active pipeline (per ADR-0004). Database repository queries match the active PostgreSQL schemas, and API documentation is updated with accurate request/response examples and mounted route groups.

**Blocked by:** 02: Lead Ingestion & Single Lead Retrieval Flow, 03: Outbound Email Attachments & Tenant Profile Resolution, 04: Non-Crashing AI Service Boot & Gemini Suggestions

**Status:** ready-for-agent

- [ ] `quotation.service.js` and `pricing-engine.service.js` contain `@deprecated` JSDoc annotations referencing ADR-0004 and `proposal-draft.service.js`.
- [ ] `tenant.repository.js` `create` method matches the PostgreSQL `tenants` table schema in `migrations/init_db.sql`, storing custom attributes (`logo_url`, `settings`) in the `metadata` JSONB column.
- [ ] Orphaned route and controller files (`lead_requirement_values-routes.js`, `lead_requirement_values.controller.js`) are aligned with `lead_requirement_values.repository.js` or safely retired.
- [ ] `docs/architecture.md` documents Node.js CommonJS + Parameterized SQL as the data access standard (aligning with ADR-0001).
- [ ] `docs/api.md` includes accurate documentation for all mounted route groups (`/api/tenant-profile`, `/api/email-templates`, `/api/ai-response`, `/api/social-integration`) and active pricing rule schemas.
- [ ] Full test suite (`npm test`) passes with clean exit code and zero regressions.
