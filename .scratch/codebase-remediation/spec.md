# Status: ready-for-agent

# Codebase Remediation, Security Hardening & AI Engine Specification

## Problem Statement

The Rush Away Auto-Proposal backend currently has critical production blockers across security, reliability, data integrity, and documentation:
1. **Security Vulnerability**: The authentication middleware uses unverified `jwt.decode()`, allowing any caller to forge arbitrary tenant IDs and impersonate accounts without cryptographic verification. Multiple route groups (concepts, pricing rules) lack tenant context enforcement.
2. **Fatal Runtime Errors**: 
   - Lead lookup parameters are inverted (`WHERE id = '<tenantId>' AND tenant_id = '<leadId>'`), causing 100% of single lead queries to fail with 404.
   - Lead creation DTO drops required contact fields (`email`, `phone`), causing all lead creation requests to fail validation.
   - Email sending throws fatal `TypeError`s when processing attachments due to calling `.push()` on a string variable.
   - Quotation email templates and Gmail webhook pipelines throw fatal `ReferenceError`s due to undefined service imports (`tenantProfileService`, `PlaceHolderBuilder`).
   - Server crashes on startup if `GEMINI_API_KEY` is not present in the environment.
3. **Incomplete AI Features**: AI suggestion endpoints (`/api/ai-response/suggest-*`) are exposed on the controller and routes but call non-existent methods on the AI service, returning 500 runtime exceptions.
4. **Documentation & Architecture Drift**: Documentation references non-existent TypeORM `EntitySchema` patterns, omitted route groups, and obsolete pricing rule schemas.

## Solution

Deliver a hardened, production-ready backend engine by:
1. **Hardening Security & Multi-Tenancy**: Enforcing cryptographic JWT signature verification (`jwt.verify`) and mounting `tenantContext` middleware uniformly across all tenant-scoped routes.
2. **Eliminating Runtime & Logic Defects**: Correcting parameter orders, expanding Lead DTO schemas to preserve all inbound contact fields, fixing MIME email attachment assembly, and correctly wiring tenant profile repository lookups.
3. **Implementing Gemini AI Suggestions**: Adding non-crashing graceful initialization and implementing structured JSON suggestion methods for concepts, dynamic pricing rules, and email templates in `ai-response.service.js`.
4. **Formalizing Architecture & Documenting Standards**: Annotating legacy quotation services as deprecated (ADR-0004), formalizing Parameterized SQL (ADR-0001), and synchronizing API documentation and database schemas.

## User Stories

1. As a tenant administrator, I want all API requests to be cryptographically verified against our JWT secret, so that malicious actors cannot forge access to our tenant data.
2. As a tenant user, I want concept and pricing rule endpoints to automatically resolve my tenant context, so that my catalog queries never fail with undefined tenant identifiers.
3. As a developer, I want delete operations on pricing rules to explicitly enforce tenant boundaries, so that one tenant cannot delete another tenant's rules.
4. As an API client, I want `POST /api/leads` to accept complete contact details (name, email, phone, company, metadata), so that new leads can be registered without premature validation failures.
5. As an API client, I want `GET /api/leads/:id` to correctly query the database by Lead ID and Tenant ID, so that I receive valid lead details instead of false 404 errors.
6. As a sales agent, I want quotation email templates to resolve company profile information (official email, phone, branding) without throwing reference errors, so that I can preview and send client proposals.
7. As an automated email listener, I want Gmail webhooks to process incoming customer inquiries and generate proposal drafts without crashing on class imports or missing profile services.
8. As a sales agent, I want outbound quotation emails with PDF and file attachments to be constructed and delivered reliably without MIME packaging runtime crashes.
9. As a system administrator, I want the backend server to boot cleanly even if optional AI API keys are not immediately configured in development or test environments.
10. As a tenant onboarding specialist, I want to call `/api/ai-response/suggest-concepts/:tenantId` to receive structured AI-suggested service tiers tailored to the tenant's business profile.
11. As a pricing administrator, I want to call `/api/ai-response/suggest-pricing-rule/:tenantId` to receive intelligent dynamic pricing rule recommendations based on existing catalog concepts and requirement configurations.
12. As a marketing manager, I want to call `/api/ai-response/suggest-email-templates/:tenantId` to generate personalized quotation email templates populated with token placeholders (`[lead_name]`, `[company_name]`, `[final_price]`).
13. As a database administrator, I want tenant creation queries to match the PostgreSQL schema definition, storing unstructured configuration safely in JSONB metadata.
14. As a developer, I want the codebase to have clear architectural documentation distinguishing the active Proposal Draft pipeline from deprecated legacy quotation services.

## Implementation Decisions

### 1. Security & Authentication Layer
- Replace `jwt.decode` in the authentication middleware with `jwt.verify(token, process.env.JWT_SECRET)` wrapped in error handling returning `401 Unauthorized`.
- Mount `tenantContext` middleware on all standard CRUD routers (`concept-routes.js`, `concept-pricing.routes.js`, `pricingModel.routes.js`, `pricingRule.routes.js`, `lead_requirement_config-routes.js`).
- Enforce tenant isolation in repository deletion queries (`WHERE id = $1 AND tenant_id = $2`).

### 2. Lead Management & DTO Layer
- Fix `getById` parameter mapping in the lead controller to supply `(id, tenantId)` to the service layer.
- Expand `createLeadDto` to retain all valid lead attributes (`email`, `phone`, `first_name`, `last_name`, `company_name`, `company_domain`, `title`, `linkedin_url`, `location`, `status`, `stage`, `priority`, `tags`, `custom_fields`, `notes`, `raw_data`, `source`, `source_id`, `estimated_value`, `currency`, `country_code`, `base_number`).
- Expand `toLeadResponse` to format complete entity attributes.

### 3. Communication & Email Pipelines
- Refactor MIME message generation in the Gmail send service to use array-based accumulator buffers for attachments before joining with standard CRLF line breaks.
- Replace undefined `tenantProfileService` calls with `tenantProfileRepository.findByTenantId(tenantId)`.
- Correct class identifier casing when instantiating placeholder builders (`const PlaceHolderBuilder = require(...)`).
- Ensure test prompt endpoints return structured HTTP JSON responses instead of hanging open request sockets.

### 4. AI Engine & Gemini Integration
- Soft-initialize Gemini API in `AIService`: if API keys are absent at boot time, log a non-fatal warning and set `isConfigured = false` instead of terminating the process.
- Return HTTP 503 with a descriptive error payload if AI endpoints are invoked while unconfigured.
- Implement `suggestConcepts(tenantId)`: Query tenant context and prompt Gemini 2.5 Flash for structured JSON catalog tiers.
- Implement `suggestPricingRules(tenantId)`: Query tenant concepts and requirement configs, prompting Gemini for schema-compatible dynamic pricing rules.
- Implement `suggestEmailTemplates(tenantId)` (with `suggestEmailTemplete` alias): Generate tokenized HTML quotation email templates.

### 5. Architecture, Persistence & Documentation
- Document raw parameterized SQL data access standard in `docs/adr/0001-commonjs-typeorm-entity-schema.md` and `docs/architecture.md`.
- Mark legacy quotation services (`quotation.service.js`, `pricing-engine.service.js`) with `@deprecated` annotations per ADR-0004.
- Update `tenant.repository.js` `create` method to align with PostgreSQL table schemas, embedding `logo_url` and `settings` within `metadata`.
- Synchronize `docs/api.md` with active routes, schemas, and payloads.

## Testing Decisions

### Seams & Scope
- Primary Testing Seam: **HTTP Controller & Route Integration Layer**.
- Testing will verify external HTTP request/response contracts, header resolution, status codes, and error responses without coupling tests to private internal method implementations.

### Target Test Areas
1. **Authentication Middleware**: Test valid signature acceptance, forged token rejection (401), expired token rejection (401), and `req.tenantId` extraction.
2. **Tenant Context Middleware**: Test `X-Tenant-Id` header resolution, missing header (400), and non-existent tenant (404).
3. **Lead Controller & DTO**: Test payload field retention, creation validation, parameter passing to repository, and 404 response on missing leads.
4. **Gmail Attachment Assembly**: Test MIME string construction with single and multiple binary attachments.
5. **AI Service Boot & Suggestions**: Test clean startup without `GEMINI_API_KEY`, 503 response on unconfigured invocation, and structured JSON output parsing.

### Prior Art
- Unit tests in `src/features/auto-proposal/controllers/__tests__/` (e.g., `concept.controller.test.js`, `lead.controller.test.js`).

## Out of Scope

- Migrating the codebase persistence layer to TypeORM decorator classes or full `EntitySchema` mapping (CommonJS + Parameterized SQL is formalized per ADR-0001).
- Outright file deletion of legacy quotation engines (annotated as `@deprecated` per ADR-0004 and user directive).
- Frontend UI interface development or styling changes.

## Further Notes

- Cross-references:
  - Verification Report: `CODEBASE_VERIFICATION_REPORT.md`
  - Domain Glossary: `CONTEXT.md`
  - Architecture ADRs: `docs/adr/0001-commonjs-typeorm-entity-schema.md`, `docs/adr/0002-header-based-multitenancy.md`, `docs/adr/0003-unified-feature-module-packaging.md`, `docs/adr/0004-proposal-draft-engine-consolidation.md`.
