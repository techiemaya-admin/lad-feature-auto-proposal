# Codebase & Documentation Verification Report

**Project:** `lad-feature-auto-proposal` (Rush Away Auto-Proposal Engine)  
**Date:** August 24, 2026  
**Auditor:** Senior Software Engineer (Antigravity Senior Engineering Audit)  
**Status:** ❌ **NOT PRODUCTION READY** (Critical Blockers Identified)

---

## 1. Executive Summary & Readiness Verdict

| Audit Dimension | Status | Summary |
| :--- | :---: | :--- |
| **Documentation vs. Code Alignment** | 🔴 **Major Drift** | Severe discrepancies across API endpoints, payloads, database column mappings, architectural patterns, and missing route groups. |
| **Codebase Completion Status** | 🔴 **Incomplete** | Orphaned files, non-existent services (`values.service.js`, `tenantProfileService`), unmapped functions in AI & Gmail services, unmounted routes. |
| **Runtime & Critical Errors** | 🔴 **Critical Bugs** | Fatal `ReferenceError`s, `TypeError`s (calling `.push()` on strings, non-existent functions), inverted function parameters causing 100% failure rates on Lead/Quotation queries. |
| **Multi-Tenancy & Security** | 🔴 **Vulnerable** | Authentication middleware uses `jwt.decode` (forgery vulnerability), missing `tenantContext` middleware across concept/pricing routes, cross-tenant deletion leaks. |
| **Production Readiness** | ❌ **NOT READY** | **Cannot be deployed.** Requires remediation of blocking runtime exceptions and architectural alignment. |

---

## 2. In-Depth Documentation vs. Codebase Discrepancies

### 2.1 Architectural & ADR Mismatches

#### 1. Ghost TypeORM EntitySchema Pattern ([docs/architecture.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md) & [ADR-0001](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/adr/0001-commonjs-typeorm-entity-schema.md))
* **Documentation Claim:**
  > "We use Node.js CommonJS modules and TypeORM `EntitySchema` definitions instead of TypeScript decorator classes or Prisma/Knex." ([ADR-0001](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/adr/0001-commonjs-typeorm-entity-schema.md))  
  > "Repositories: Interface directly with PostgreSQL using TypeORM `DataSource` and `EntitySchema`." ([docs/architecture.md §3](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md#L75-L79))
* **Codebase Reality:**
  * **Zero `EntitySchema` definitions exist** anywhere in `src/`.
  * [src/config/data-source.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/config/data-source.js) initializes TypeORM without registered entities (`entities: []`).
  * Repositories calling `dataSource.getRepository('Location')`, `'Tenant'`, `'Quotation'`, `'ConceptLocation'`, or `'PriceCalculation'` crash with `EntityMetadataNotFoundError: No metadata for "..." was found.`
  * The actual working repositories bypass TypeORM ORM mappings completely and execute raw SQL string queries via `db.query(...)`.

#### 2. Logging Policy Drift ([docs/architecture.md §5](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md#L104-L109))
* **Documentation Claim:**
  > "No Console Statements: Direct `console.log()` statements in production paths are prohibited. All log output is channeled through `src/utils/logger.js`."
* **Codebase Reality:**
  * Raw `console.log` and `console.error` calls are pervasive across controllers, services, and repositories (e.g., [concept.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/concept.controller.js), [pricingRule.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/pricingRule.repository.js), [ai-response.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/ai-response.service.js)).
  * [src/utils/logger.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/utils/logger.js) is ignored in >90% of the codebase.

#### 3. Layering Violations ([docs/architecture.md §3](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md#L42-L83))
* **Documentation Claim:**
  > Strict layering: `HTTP Request -> Controller -> Service -> Repository -> PostgreSQL`.
* **Codebase Reality:**
  * [lead_requirement_config.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/lead_requirement_config.controller.js), [pricing-model.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/pricing-model.controller.js), and [pricing-rule.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/pricing-rule.controller.js) bypass the service layer completely and interact directly with repositories.

---

### 2.2 API Endpoint & Payload Discrepancies ([docs/api.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/api.md))

| Documented Endpoint | Documented Specification | Codebase Reality | Impact / Failure Mode |
| :--- | :--- | :--- | :--- |
| **`POST /api/leads`** | Body: `{ location_id, status, metadata: { customer_name, email } }` | [lead.dto.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/dtos/lead.dto.js) drops all fields except `location_id`, `status`, `metadata`. [lead.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/lead.service.js) enforces top-level `email` or `phone`. | 🔴 **100% Failure Rate**: All documented curl calls fail with error `"Either Email or Phone is required to create a lead"`. |
| **`POST /api/concepts` & `PUT /api/concepts/:id`** | DTO includes `"code": "IMP-01"` | Table `concept` in [migrations/init_db.sql](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/migrations/init_db.sql#L213-L226) and [concept.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/concept.repository.js) has no `code` column. | `code` is dropped on write. `PUT` also enforces `createConceptSchema` making `name` mandatory on partial updates. |
| **`POST /api/pricing-rules`** | Schema: `{ pricing_model_id, rule_type, parameters, evaluation_order }` | [pricingRule.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/pricingRule.repository.js) expects `{ target_type, concept_id, requirement_config_id, priority, condition_field, condition_operator, condition_value, action_type, action_mode, action_value, action_value_type }`. | 🔴 **Schema Incompatibility**: API doc specifies a legacy rule format completely incompatible with the active database table. |
| **`GET /api/ai-response/suggest-*`** | `GET /api/ai-response/suggest-concepts/:tenantId?prompt=...` | [ai.response.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/ai.response.controller.js) ignores `prompt` query param and calls methods not present on the service. | 🔴 **500 TypeError**: Functions (`suggestConcepts`, `suggestPricingRules`, `suggestEmailTemplete`) do not exist. |
| **`POST /api/gmail/watch`** | Starts watch dynamically for authenticated tenant/user | [gmail-read-email.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail-read-email.controller.js#L7-L8) hardcodes `tenantId = "e0a3e9ca-..."` and `email = "shweta.goel1711@gmail.com"`. | Ignores request context and caller authentication. |
| **`GET /api/gmail/test-prompt`** | Returns simulated test output | [gmail-read-email.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail-read-email.controller.js#L57-L73) never sends an HTTP response. | 🔴 **Hangs Request**: Client socket hangs until timeout. |
| **Missing Documented Endpoints** | Undocumented in [docs/api.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/api.md) | Mounted in [src/app.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/app.js):<br>- `/api/tenant-profile`<br>- `/api/email-templates`<br>- `/api/quotation-email-template`<br>- `/api/social-integration`<br>- `/api/email-conversations/send-bulk` | Docs are missing ~30% of the active API surface. |

---

### 2.3 Dual Competing Proposal & Calculation Engines ([CONTEXT.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/CONTEXT.md))

The codebase contains two competing, incompatible quotation subsystems:
1. **Engine A (Legacy / Mock Architecture):**
   * [quotation.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/quotation.service.js) + [quotation.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/quotation.repository.js) + [pricing-engine.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/pricing-engine.service.js) + [pricing-rules.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/pricing-rules.repository.js).
   * Attempts to use `dataSource.getRepository('Quotation')` and `dataSource.getRepository('PriceCalculation')` (no SQL tables exist in [migrations/init_db.sql](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/migrations/init_db.sql)).
2. **Engine B (Active SQL & AI Pipeline):**
   * [proposal-draft.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/proposal-draft.service.js) + [proposal-draft.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/proposal-draft.repository.js) + [final-price-calculation.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/final-price-calculation.repository.js) + [pricingRule.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/pricingRule.repository.js).
   * Directly queries active tables `proposal_draft`, `proposal_draft_items`, and `pricing_rules`.

---

## 3. Critical Runtime Errors & Bug Inventory

### 🔴 Critical Bug 1: Missing Services & Broken Imports
1. **Missing `values.service.js` & `values.controller.js`**:
   * [lead_requirement_values.controller.js:1](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/lead_requirement_values.controller.js#L1): `require('../services/values.service')` -> File does not exist.
   * [lead_requirement_values-routes.js:3](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/lead_requirement_values-routes.js#L3): `require('../controllers/values.controller')` -> File does not exist. Route is unmounted in [src/app.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/app.js).
2. **Missing `tenantProfileService`**:
   * [quotation-email-template.controller.js:37](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/quotation-email-template.controller.js#L37): Calls `tenantProfileService.getProfile(tenantId)`. `tenantProfileService` is never required or defined. Throws fatal `ReferenceError`.
   * [gmail-read-email.service.js:84](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-read-email.service.js#L84): Calls `tenantProfileService.getProfile(...)`. Never required or defined. Throws fatal `ReferenceError`.
3. **Identifier Case Mismatch**:
   * [gmail-read-email.service.js:25](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-read-email.service.js#L25): Imported as `const placeHolderBuilder = require(...)`.
   * [gmail-read-email.service.js:94](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-read-email.service.js#L94): Instantiated as `new PlaceHolderBuilder()`. Throws `ReferenceError: PlaceHolderBuilder is not defined`.
4. **Missing Service Methods**:
   * [ai.response.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/ai.response.controller.js): Calls `service.suggestConcepts()`, `service.suggestPricingRules()`, `service.suggestEmailTemplete()`. None exist in [ai-response.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/ai-response.service.js).
   * [gmail.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail.controller.js): Calls `gmailService.sendEmail()`, `gmailService.readEmails()`, `gmailService.handleWebhook()`. None exist on [gmail-send-email.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-send-email.service.js).

---

### 🔴 Critical Bug 2: Fatal Parameter Inversion Bugs

```
// lead.controller.js Line 16:
const lead = await leadService.getLeadById(req.tenantId, req.params.id);

// lead.service.js Line 55:
async getLeadById(id, tenantId) {
  const lead = await leadRepository.findById(id, tenantId);
}

// SQL Execution:
SELECT * FROM leads WHERE id = '<tenantId>' AND tenant_id = '<leadId>';
// Result: ALWAYS returns 404
```

1. **Lead Retrieval Inversion ([lead.controller.js:16](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/lead.controller.js#L16))**: Passes `(req.tenantId, req.params.id)` to `getLeadById(id, tenantId)`. Inverts parameters; lookups fail 100% of the time.
2. **Quotation Lead Lookup Inversion ([quotation.service.js:9](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/quotation.service.js#L9))**: Calls `leadRepository.findById(tenantId, lead_requirement_id)`. Inverts parameters and queries `leads` table with a requirement ID.

---

### 🔴 Critical Bug 3: Fatal TypeError in Attachment Handling

In [gmail-send-email.service.js:590-625](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-send-email.service.js#L590-L625):
```javascript
let attachmentPart = (attachmentBase64 && attachmentBase64 !== undefined) ? [...] : ""; // Declared as String
if (attachments && attachments.length > 0) {
  for (const file of attachments) {
    attachmentPart.push(...); // CRASH: TypeError: attachmentPart.push is not a function
  }
}
```
* **Result:** Any email sending attempt with attachments throws a fatal runtime exception.

---

### 🔴 Critical Bug 4: Startup Crash on Missing AI API Key

In [ai-response.service.js:37,81](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/ai-response.service.js#L37-L81):
```javascript
constructor() {
  this.setupGeminiAPI(); // Throws "No valid Gemini API keys found." if process.env.GEMINI_API_KEY is not set
}
```
* **Result:** Instantiated synchronously during module export (`module.exports = new AIService()`). If `GEMINI_API_KEY` is not present, the Node process crashes immediately on startup.

---

### 🔴 Critical Bug 5: Database Schema Incompatibilities

* **Tenant Insertion Column Mismatch ([tenant.repository.js:27](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/tenant.repository.js#L27))**:
  * SQL executes `INSERT INTO tenants (id, name, slug, logo_url, settings, ...)`
  * Table `tenants` in [migrations/init_db.sql:5-19](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/migrations/init_db.sql#L5-L19) does not have `logo_url` or `settings` columns.
  * **Result:** PostgreSQL throws `column "logo_url" of relation "tenants" does not exist`.

---

## 4. Security & Multi-Tenancy Flaws

```
                      TENANT CONTEXT ENFORCEMENT AUDIT
                      
  Endpoint Route Group             Middleware Applied         Tenant ID Origin
  ─────────────────────────────────────────────────────────────────────────────
  /api/locations                   tenantContext              X-Tenant-Id Header
  /api/leads                       tenantContext              X-Tenant-Id Header
  /api/quotations                  tenantContext              X-Tenant-Id Header
  /api/concepts                    NONE                       req.tenantId (UNDEFINED) 🔴
  /api/concept-pricing-matrix      NONE                       req.body / params.tenant_id 🔴
  /api/lead-requirement-config     NONE                       req.body.tenant_id 🔴
  /api/pricing-models              NONE                       params.tenant_id 🔴
  /api/pricing-rules               NONE                       params.tenant_id 🔴
  /api/email-conversations         authenticateJWT            jwt.decode() (UNVERIFIED) 🔴
```

### 1. JWT Signature Bypass ([src/middleware/auth.middleware.js:8-10](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/middleware/auth.middleware.js#L8-L10))
```javascript
// CRITICAL VULNERABILITY:
const decoded = jwt.decode(token); // Does NOT verify signature!
if (decoded && decoded.tenantId) {
    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId;
    return next();
}
```
* **Vulnerability:** Callers can forge arbitrary JWT tokens without a valid signature, allowing complete impersonation across any tenant account.

### 2. Missing `tenantContext` in Core Routes
* [concept-routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/concept-routes.js), [concept-pricing.routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/concept-pricing.routes.js), [pricingModel.routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/pricingModel.routes.js), and [pricingRule.routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/pricingRule.routes.js) do not mount `tenantContext`.
* In [concept.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/concept.controller.js), `req.tenantId` is `undefined`, breaking concept creation, listing, updating, and deletion.

### 3. Cross-Tenant Data Deletion & Leakage
* **Unscoped Delete ([pricingRule.repository.js:218](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/pricingRule.repository.js#L218))**: Executes `DELETE FROM pricing_rules WHERE id = $1` without `tenant_id = $2`. Allows cross-tenant deletion.
* **Global Identity Query ([user-identity.repository.js:53](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/user-identity.repository.js#L53))**: Executes `SELECT * FROM user_identities WHERE provider = $1 LIMIT 1` without tenant filtering.

---

## 5. Prioritized Actionable Remediation Matrix

| Priority | Component / File | Root Cause | Required Remediation |
| :---: | :--- | :--- | :--- |
| **P0** | [auth.middleware.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/middleware/auth.middleware.js) | `jwt.decode` used instead of verification | Replace `jwt.decode` with `jwt.verify(token, process.env.JWT_SECRET)`. |
| **P0** | [lead.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/lead.controller.js) | Inverted params in `getById` & field stripping in `createLeadDto` | Correct parameter order `leadService.getLeadById(req.params.id, req.tenantId)` and preserve `email`/`phone` in [lead.dto.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/dtos/lead.dto.js). |
| **P0** | [gmail-read-email.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-read-email.service.js) | `tenantProfileService` and `PlaceHolderBuilder` undefined | Import `PlaceHolderBuilder` properly (`const PlaceHolderBuilder = require(...)`) and import/use `tenantProfileRepository`. |
| **P0** | [quotation-email-template.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/quotation-email-template.controller.js) | Undefined `tenantProfileService` | Import and delegate to `tenantProfileRepository` or create `tenantProfileService`. |
| **P0** | [gmail-send-email.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/gmail-send-email.service.js) | Calling `.push()` on a string in `sendGmailRaw` | Initialize `attachmentParts = []` as an array and join with CRLF at payload compilation. |
| **P0** | [concept-routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/concept-routes.js) & Pricing Routes | Missing `tenantContext` middleware | Add `router.use(tenantContext)` to enforce header-based tenant resolution and set `req.tenantId`. |
| **P1** | [lead_requirement_values.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/lead_requirement_values.controller.js) & routes | Dangling references to `values.service.js` and `values.controller.js` | Create missing service layer or remove orphaned files and route properly. |
| **P1** | [ai.response.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/ai.response.controller.js) | Missing methods in `ai-response.service.js` | Implement `suggestConcepts`, `suggestPricingRules`, `suggestEmailTemplates` or prune unused endpoints. |
| **P1** | [docs/api.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/api.md) | Obsolete pricing rule schemas, lead payloads, and missing route groups | Synchronize documentation with current PostgreSQL database schemas and active endpoints. |
| **P1** | [docs/adr/0001-commonjs-typeorm-entity-schema.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/adr/0001-commonjs-typeorm-entity-schema.md) & [docs/architecture.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md) | Documentation states TypeORM EntitySchemas | Update ADR to reflect actual data access pattern (raw SQL queries with `pg` / TypeORM query runner) or implement the missing EntitySchemas. |
| **P2** | Logging & ESLint | No `eslint.config.js` and uncontrolled `console.log` | Add ESLint 9 configuration and route logging through [src/utils/logger.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/utils/logger.js). |

---
*Report generated and placed in workspace root at [CODEBASE_VERIFICATION_REPORT.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/CODEBASE_VERIFICATION_REPORT.md).*
