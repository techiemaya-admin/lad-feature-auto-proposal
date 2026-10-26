# Remediation Plan: Eliminating Hardcoded Fallback IDs & Hardening Multi-Tenancy Isolation

**Document Version:** 2.0 (Senior Engineer Reviewed & Hardened)  
**Status:** Approved for Implementation  
**Target Codebase:** `lad-feature-auto-proposal`  
**Governing Standards:** [ADR-0002 (Header-Based Multi-Tenancy)](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/adr/0002-header-based-multitenancy.md) & [AGENTS.md Guardrails](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/AGENTS.md)

---

## 1. Problem Statement & Motivation

During our architectural audit of `lad-feature-auto-proposal`, we identified multiple occurrences where **hardcoded fallback tenant IDs, user IDs, and personal email addresses** were embedded directly into repositories, controllers, and route handlers.

### The "Apartment 101" Danger (Cross-Tenant Leakage)
Lines such as:
```javascript
const tenantId = req.headers['x-tenant-id'] || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
```
silently default any unauthenticated or malformed request to **Alpha Corp** (`e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5`).

If a customer from **TechieMaya** or another organization sends a request that lacks an `X-Tenant-Id` header (due to network glitch, misconfigured proxy, or client bug), instead of the server failing safely with **HTTP 400 Bad Request**, the system will silently create, read, or overwrite proposal records inside **Alpha Corp's** private database rows.

### Why Moving to `.env` is NOT the Solution
Moving `e0a3e9ca...` to `DEFAULT_TENANT_ID` in `.env` does not fix the security flaw; it merely hides it. In a true multi-tenant system, **a default tenant ID must never exist in production code paths**. Every request must explicitly state which tenant it belongs to, or be rejected at the boundary.

---

## 2. Audit of Existing Hardcoded Fallbacks & Route Gaps

The following hardcoded values and isolation gaps were identified across the codebase:

| Location | File & Line | Item / Risk | Recommended Remediation |
| :--- | :--- | :--- | :--- |
| **Repository** | [`src/.../proposal-draft.repository.js:42, 61`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/proposal-draft.repository.js#L42) | `"e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5"` in `create()` | Throw an error if `data.tenant_id` is missing. Remove Alpha Corp fallback. |
| **Repository** | [`src/.../proposal-draft.repository.js:5, 79, 96, 111`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/proposal-draft.repository.js#L5) | Unscoped queries in `findDraftById`, `approveProposalDraft`, etc. | Add `tenant_id` parameter to queries to enforce cross-tenant data isolation. |
| **Routes** | [`src/.../proposal-draft.routes.js:5`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/proposal-draft.routes.js#L5) | `PATCH /approve/:id` lacks `tenantContext` | Mount `tenantContext` middleware on router and pass `req.tenantId` to controller and service. |
| **Controller** | [`src/.../gmail-read-email.controller.js:7`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail-read-email.controller.js#L7) | `"e0a3e9ca..."` & `"shweta.goel1711@gmail.com"` in `startWatch` | Make `email` and `tenantId` dynamic from request headers and body; reject if missing. |
| **Controller** | [`src/.../gmail-read-email.controller.js:60, 62, 65`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail-read-email.controller.js#L60) | Hardcoded tenant, lead ID, and personal email in `testprompt` | Require `prompt` and `X-Tenant-Id`. Use dynamic lead payload or generic non-PII test defaults. |
| **Routes** | [`src/.../gmail-routes.js:16, 19, 30, 33`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/gmail-routes.js#L16) | Unprotected endpoints (`/watch`, `/send-email`, `/read-emails`) | Mount `tenantContext` (keeping `/webhook` unauthenticated). Deprecate broken `/send-email` and `/read-emails` with HTTP 410. |
| **Controller** | [`src/.../social-integration.controller.js:5`](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/social-integration.controller.js#L5) | `"b8c1ffa5..."` in `DEFAULT_DEV_USER_ID` | **No change needed.** Strictly guarded by `if (process.env.NODE_ENV !== 'production')` for local DX. |

---

## 3. Architectural Rules for the Remediation

1. **Zero Silent Fallbacks in Production Paths:** No repository or controller may guess or default a `tenant_id`. If `tenant_id` is missing in database operations or request payloads, throw or respond with 400 Bad Request immediately.
2. **Boundary Validation via Middleware:** Enforce `tenantContext` middleware on all API route files that access tenant data. Requests missing `X-Tenant-Id` receive `400 Bad Request` before ever executing controller or service logic.
3. **Webhook Exemption & Dynamic Resolution:** The Google Pub/Sub push webhook (`POST /api/gmail/webhook`) must remain unauthenticated, resolving tenant context dynamically from the database via `user_identities` and `gmail_watch` tables rather than HTTP headers.
4. **Clean Retirement of Broken Legacy Routes:** Broken legacy routes calling non-existent service methods (`/api/gmail/send-email`, `/api/gmail/read-emails`) must return `HTTP 410 Gone` to avoid silent crashes or confusion.
5. **Log Hygiene:** Remove lingering `console.log` / `console.error` calls in modified code paths in favor of `logger` ([AGENTS.md Guardrail 3](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/AGENTS.md)).

---

## 4. Proposed Changes

### Component 1: Proposal Draft Layer (Repository, Service, Controller & Routes)

#### [MODIFY] [src/features/auto-proposal/repositories/proposal-draft.repository.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/repositories/proposal-draft.repository.js)
- Require `data.tenant_id` upon draft creation. Throw `Error` if `tenant_id` is missing.
- Add optional `tenantId` parameter to `findDraftById` and `approveProposalDraft` to allow tenant scoping.
- Replace `console.log` with `logger`.

```diff
   async create(data) {
+    if (!data.tenant_id) {
+      throw new Error("tenant_id is strictly required to create a proposal draft");
+    }
+
     const sql = `
       INSERT INTO proposal_draft (
         tenant_id,
@@ -41,7 +45,7 @@
     `;

     const values = [
-      data.tenant_id || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5",
+      data.tenant_id,
       data.lead_requirement_id || null,
       data.final_price,
       data.gcsUrl || null,
@@ -53,8 +57,7 @@
     const result = await AppDataSource.query(sql, values);
     const proposalDraftId = result[0].id;
-    console.log("Proposal Draft created: {} ", proposalDraftId);
-    console.log("data.calculation_snapshot: {} ", data.calculation_snapshot);
+    logger.info("Proposal Draft created successfully", { proposalDraftId, tenantId: data.tenant_id });

     const concept = data.calculation_snapshot;
     if (!concept || !concept.breakdown) {
       return result[0];
     }

     const itemsForBulkCreate = concept.breakdown.map(item => ({
-      tenant_id: data.tenant_id || "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5",
+      tenant_id: data.tenant_id,
       proposal_draft_id: proposalDraftId,
```

#### [MODIFY] [src/features/auto-proposal/routes/proposal-draft.routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/proposal-draft.routes.js)
- Mount `tenantContext` middleware to protect `/approve/:id`.

```diff
 const express = require("express");
 const router = express.Router();
 const controller = require("../controllers/proposal-draft.controller");
+const { tenantContext } = require("../../../middleware/tenant-context");

+router.use(tenantContext);
 router.patch("/approve/:id", controller.approveProposalDraft);

 module.exports = router;
```

#### [MODIFY] [src/features/auto-proposal/controllers/proposal-draft.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/proposal-draft.controller.js)
- Pass `req.tenantId` to `proposalDraftService.approveProposal`.

```diff
 exports.approveProposalDraft = async (req, res) => {
   try {
     const { id } = req.params;
+    const tenantId = req.tenantId;

-    const approved = await proposalDraftService.approveProposal(id);
+    const approved = await proposalDraftService.approveProposal(id, null, tenantId);
```

#### [MODIFY] [src/features/auto-proposal/services/proposal-draft.service.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/services/proposal-draft.service.js)
- Accept `tenantId` in `approveProposal(proposalId, oAuth2Client, tenantId)` and pass to repository calls.

---

### Component 2: Gmail Route & Controller Layer

#### [MODIFY] [src/features/auto-proposal/routes/gmail-routes.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/routes/gmail-routes.js)
- Keep `/webhook` unauthenticated.
- Protect all other endpoints with `tenantContext`.
- Deprecate `/send-email` and `/read-emails`.

```diff
+const { tenantContext } = require("../../../middleware/tenant-context");

 // Webhook called by Google Pub/Sub (unauthenticated)
 router.post("/webhook", gmailReadController.webhook);

+// Protect all remaining tenant-scoped Gmail routes
+router.use(tenantContext);
+router.get("/send-email", gmailController.sendEmail);
+router.get("/read-emails", gmailController.readEmails);
 router.get("/test-prompt", gmailReadController.testprompt);
+router.post("/test-prompt", gmailReadController.testprompt);
 router.post("/watch", gmailReadController.startWatch);
```

#### [MODIFY] [src/features/auto-proposal/controllers/gmail.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail.controller.js)
- Return 410 Gone for `/send-email` and `/read-emails` instead of calling non-existent methods.

#### [MODIFY] [src/features/auto-proposal/controllers/gmail-read-email.controller.js](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/src/features/auto-proposal/controllers/gmail-read-email.controller.js)
- Make `startWatch` dynamic, requiring `tenantId` and `email`.
- Make `testprompt` require `tenantId` and `prompt`, and use non-PII test lead data.

```diff
 async function startWatch(req, res) {
-  logger.info("Testing start watch>>");
-  let tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
-  const email = "shweta.goel1711@gmail.com";
-  const result = await gmailService.startWatch(email, tenantId);
-  logger.debug(result);
-  res.json(result.data);
+  try {
+    const tenantId = req.tenantId || req.headers?.['x-tenant-id'];
+    const email = req.body?.email || req.query?.email;
+    if (!tenantId || !email) {
+      return res.status(400).json({ error: "Both X-Tenant-Id header and email parameter are required to start a watch" });
+    }
+    logger.info("Initiating Gmail watch subscription", { tenantId, email });
+    const result = await gmailService.startWatch(email, tenantId);
+    logger.debug("Gmail watch initialized", { result });
+    return res.json(result.data);
+  } catch (err) {
+    logger.error("Error starting Gmail watch:", err);
+    return res.status(500).json({ error: err.message });
+  }
 }
```

---

## 5. Verification Plan

### Automated Tests
1. **Repository Unit Test (`src/features/auto-proposal/repositories/__tests__/proposal-draft.repository.test.js`):**
   - Verify that calling `create()` without `tenant_id` throws an Error.
   - Verify that passing `tenant_id` correctly binds in SQL.
   - Verify `findDraftById` and `approveProposalDraft` scope by `tenant_id`.
2. **Controller Unit Test Updates (`src/features/auto-proposal/controllers/__tests__/gmail-read-email.controller.test.js`):**
   - Update `testprompt` tests with `req.tenantId` context.
   - Assert missing `tenantId` returns `HTTP 400 Bad Request`.
   - Add unit tests for `startWatch` validating 400 when missing `tenantId` or `email`.
3. **Full Regression Suite:**
   - Execute `npm test` across all 33 test suites to ensure 100% pass rate.
