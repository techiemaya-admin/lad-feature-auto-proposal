# Security Audit — `lad-feature-auto-proposal` (`develop`)

**Date:** 2026-10-26 · **Branch audited:** `develop` @ `8771b99` · **Scope:** the whole backend on `develop` (~10k lines of non-test JS: Express routes, middleware, controllers, services, raw-SQL repositories, config, utils, scripts, docs), the Gmail / Google OAuth / Pub/Sub, Google Cloud Storage and Gemini/OpenAI integrations, git history of **all** branches for secrets, and `npm audit` of the production dependencies.

**Method:** Manual read of every route, middleware, controller and repository, plus the services on the email, OAuth, PDF and upload paths. A pattern scan of all repositories for dynamic SQL. A secret scan of every blob on every branch. Runtime tests of the Express app (no database) to confirm route protection.

**Not covered:** The React frontend lives on the separate `Auto-proposal-frontend` branch, not on `develop`, so it is out of scope here. The earlier audit of `main` (commit `9d83c29`) covers older code that `develop` has replaced.

> Secrets are shown as their first 6 characters only. Line numbers refer to `develop` @ `8771b99` (before the fixes).

---

## Summary

| Severity | Count | Fixed on this branch |
|---|---|---|
| **Critical** | 4 | 4 (code); password rotation still required |
| **High** | 4 | 4 (residual items noted under #6 and #8) |
| **Medium** | 6 | 6 |
| **Low** | 4 | 4 |
| **Total** | **18** | |

| # | Severity | Title | Status |
|---|---|---|---|
| 1 | Critical | Most API routes have no authentication; tenant taken from a spoofable header, URL or body | **Fixed** |
| 2 | Critical | Anyone can list and create tenants | **Fixed** |
| 3 | Critical | Gmail OAuth account-link hijack (unsigned `state`, trusted `X-User-Id`, default user) | **Fixed** |
| 4 | Critical | Hardcoded database password fallback | **Fixed in code — rotate the password** |
| 5 | High | Unauthenticated Pub/Sub webhook can replay mailbox history, which auto-sends proposals | **Fixed** — set the Pub/Sub env vars |
| 6 | High | HTML injection into headless Chrome (`--no-sandbox`) and server-side fetch of tenant-supplied URLs (SSRF) | **Fixed** (Chrome still runs without its sandbox) |
| 7 | High | Unrestricted file uploads (no type/size limits, raw filenames, 1-year public links) | **Fixed** (1-year logo links kept) |
| 8 | High | Vulnerable production dependencies reachable from request paths (multer, body-parser, xmldom) | **Fixed** (Puppeteer 25 needs Node 22) |
| 9 | Medium | Cross-tenant access by record ID (templates, lead requirement values) | **Fixed** |
| 10 | Medium | Internal error messages returned to clients | **Fixed** |
| 11 | Medium | Customer emails and personal data written to logs | **Fixed** |
| 12 | Medium | Gmail OAuth tokens stored in plaintext | **Fixed** — set key, run migration |
| 13 | Medium | OAuth `state` not bound to the browser session (login-CSRF) | **Fixed** — needs frontend change |
| 14 | Medium | No rate limiting; 50 MB body limit; AI endpoints can run up cost | **Fixed** (per-process limits) |
| 15 | Low | JWT verification did not pin algorithms or check issuer/audience | **Fixed** |
| 16 | Low | OAuth popup `postMessage` falls back to `*` target origin | **Fixed** |
| 17 | Low | Missing security headers; CORS origin hardcoded to `localhost` | **Fixed** |
| 18 | Low | Hardcoded fallback lead/tenant UUIDs in code and scripts | **Fixed** |

---

## Critical

### Finding #1: Most API routes have no authentication; tenant taken from a spoofable header, URL or body

* **Severity:** Critical · **Status:** Fixed
* **OWASP:** A01:2021 – Broken Access Control (also A07:2021 – Identification and Authentication Failures)
* **Location:** `src/middleware/tenant-context.js`, line 8; `src/app.js`, lines 39–66; route files including `src/features/auto-proposal/routes/tenant-profile.routes.js`, lines 8–18, and `quotation-email-template.routes.js`, lines 7–12
* **Evidence:**
  * Only `/api/email-conversations/*` and one email-template route verified a JWT.
  * About 15 routers relied on `tenantContext`, which reads `const tenantId = req.headers['x-tenant-id'] || req.tenantId;`. The client header **takes priority** even over a verified token.
  * Six routers (`tenant-profile`, `quotation-email-template`, `quotation-templates`, `email-templates`, `template-placeholder`, `ai-response`) had **no check at all** and took the tenant straight from the URL (`/:tenantId`).
  * Controllers also fell back to `req.body.tenant_id` and `req.query.tenant_id`.
  * ADR `docs/adr/0002-header-based-multitenancy.md` made this the documented design.
* **Impact:** An anonymous attacker who knows or obtains a tenant UUID (see #2) could:
  * read and change that tenant's leads, pricing, concepts, templates and company profile;
  * upload files to its storage;
  * spend the AI budget (`/api/ai-response/*`, `/api/gmail/test-prompt`);
  * approve proposal drafts via `/api/proposal-draft/approve/:id`, which **emails quotations to the tenant's customers from the tenant's Gmail**;
  * disconnect the tenant's Gmail integration.
* **Fix (applied):**
  * `src/app.js` requires a verified JWT on every `/api/*` route. The only exceptions are the two endpoints Google calls: `POST /api/gmail/webhook` and `GET /api/social-integration/email/google/callback`.
  * `tenantContext` now uses only the token's `tenantId`. A different `X-Tenant-Id` gets `403`.
  * The new `enforceTenantParams` checks every `:tenantId` / `:tenant_id` URL segment against the token on all affected routers.
  * ADR 0002 is marked superseded.
  * Tests: `src/__tests__/app.auth.test.js` probes 17 previously open routes plus header and URL spoofing.

### Finding #2: Anyone can list and create tenants

* **Severity:** Critical · **Status:** Fixed
* **OWASP:** A01:2021 – Broken Access Control
* **Location:** `src/features/auto-proposal/routes/tenant-route.js`, lines 8–10
* **Evidence:** `POST /`, `GET /` and `GET /:id` had no middleware at all. `GET /api/tenants` returns every tenant's `id`, `name`, `slug` and `metadata`.
* **Impact:** This hands out the full client list and every tenant UUID, which is all #1 needed for complete cross-tenant access. Anyone could also create unlimited tenants.
* **Fix (applied):** Creating and listing tenants now requires the `platform_admin` role (`roles` or `role` claim). `GET /:id` is limited to platform admins or the caller's own tenant.

### Finding #3: Gmail OAuth account-link hijack

* **Severity:** Critical · **Status:** Fixed
* **OWASP:** A01:2021 – Broken Access Control / A07:2021 – Identification and Authentication Failures
* **Location:**
  * `src/features/auto-proposal/services/google-auth.service.js`, lines 21–34
  * `src/features/auto-proposal/controllers/social-integration.controller.js`, lines 5–19 and 268–290
  * `src/features/auto-proposal/repositories/user-identity.repository.js`, line 147
* **Evidence:**
  * The OAuth `state` was plain `base64(JSON.stringify({ tenantId, userId }))`. Nothing signed it.
  * The public callback decoded whatever state it received and called `handleGoogleCallback(code, userId, tenantId)`.
  * That function upserts `user_identities` `ON CONFLICT (user_id, provider)` and starts a Gmail watch for the tenant.
  * Separately, `resolveUserId` trusted an `X-User-Id` header (also in production). Outside production it also trusted `?userId=` and body `userId`, and fell back to a hardcoded default user (`b8c1ff...`).
* **Impact:** An attacker could:
  * build a consent URL with `state = base64({tenantId: victimTenant, userId: victimUser})`;
  * approve it with **their own** Google account, which **replaces the victim's Gmail link with the attacker's**.

  The victim's bulk emails and quotations (`getGoogleClientForUser`) then go out through the attacker's mailbox, so the attacker receives copies of client correspondence and pricing. The attacker's inbox is also wired into the victim tenant, so inbound mail they control creates leads and auto-proposals there. Through `X-User-Id`, anyone could also read whether any user has Gmail connected (and its address), or revoke and disconnect it.
* **Fix (applied):**
  * `state` is now a signed, 10-minute token (HMAC key derived from `OAUTH_STATE_SECRET` or `JWT_SECRET`, so it can't double as an API token) carrying the tenant and user from the caller's JWT.
  * The callback rejects missing, forged or expired state.
  * `resolveUserId` now only uses `req.userId` from the verified JWT. The header, query, body and default-user fallbacks are removed.
  * Tests cover forged base64 state, the wrong signing key, expiry, and the state token failing as a bearer token.

### Finding #4: Hardcoded database password fallback

* **Severity:** Critical · **Status:** Fixed in code — **rotation still required**
* **OWASP:** A07:2021 – Identification and Authentication Failures (CWE-798)
* **Location:** `src/config/data-source.js`, line 20; `.env.example`, line 15. Also present at the tips of `auto-proposal-backend`, `google-connect`, `fix-pricing-rule-engine`, `feature/multiple-templates` and `email-templete-drag-and-drop`.
* **Evidence:** `password: process.env.DB_PASSWORD || 'lad_de...'` together with `username: ... || 'lad_dev'`. The same value is published as the example in `.env.example`. It replaced the earlier fallback `l98378...` (removed in `1d68988`), which is still in history.
* **Impact:** Any database using this password (or the earlier one) is open to anyone with repo access. The silent fallback means a deployment with no `DB_PASSWORD` connects using it instead of failing.
* **Fix (applied):**
  * The fallback is removed, and `.env.example` now has an empty `DB_PASSWORD=`.
  * `src/index.js` refuses to start without `DB_PASSWORD`, and without a `JWT_SECRET` of 32+ characters.

  **Still to do:** change this password on every database that uses it, and fix the other branches listed above (or retire them).

---

## High

### Finding #5: Unauthenticated Pub/Sub webhook can replay mailbox history, which auto-sends proposals

* **Severity:** High · **Status:** Fixed
* **OWASP:** A07:2021 – Identification and Authentication Failures
* **Location:**
  * `src/features/auto-proposal/routes/gmail-routes.js`, line 8
  * `src/features/auto-proposal/controllers/gmail-read-email.controller.js`, lines 37–55
  * `src/features/auto-proposal/services/gmail-read-email.service.js`, lines 351–358 and 163
* **Evidence:**
  * `POST /api/gmail/webhook` accepts any body. It base64-decodes `message.data` and calls `fetchNewEmails(emailAddress, historyId)`. There is no check of Google's signed OIDC push token.
  * When no history ID is stored for that mailbox, the **caller-supplied `historyId`** becomes the starting point.
  * Each new inbound message runs lead creation, AI extraction and `processAndSendDefaultEmailFromDragDrop`, which **emails a quotation to the sender**.
* **Impact:** Anyone who knows a connected Gmail address can trigger mailbox processing at will, running up Gemini/OpenAI costs. For a mailbox with no stored history, they can push the start back so that old emails are processed again, which can **send automated quotations to past contacts**.
* **Fix:**
  * Configure the Pub/Sub push subscription with an OIDC service account, and verify the `Authorization: Bearer` token in the webhook (issuer `accounts.google.com`, audience = the webhook URL, expected service-account email) with `google-auth-library`'s `OAuth2Client.verifyIdToken`.
  * Never use the webhook's `historyId` as a starting point; on first sync, start from `users.getProfile().historyId`.
* **Fix (applied):**
  * New `src/middleware/pubsub-auth.middleware.js` verifies the OIDC token on every push: Google signature, `PUBSUB_PUSH_AUDIENCE`, issuer `accounts.google.com`, and a verified email equal to `PUBSUB_PUSH_SERVICE_ACCOUNT`.
  * It fails closed when unconfigured. `PUBSUB_SKIP_VERIFY=true` bypasses it for local development only and is ignored in production.
  * `fetchNewEmails` no longer uses the webhook's `historyId` as a starting point; with nothing stored it starts from the mailbox's current `historyId`.
  * **Deploy step:** enable authentication on the push subscription (`gcloud pubsub subscriptions update <sub> --push-auth-service-account=<sa> --push-auth-token-audience=<webhook-url>`) and set the two env vars, or Gmail notifications will be rejected.

### Finding #6: HTML injection into headless Chrome (`--no-sandbox`) and server-side fetch of tenant-supplied URLs (SSRF)

* **Severity:** High · **Status:** Fixed (residual: Chrome sandbox still disabled)
* **OWASP:** A10:2021 – Server-Side Request Forgery (also A03:2021 – Injection)
* **Location:**
  * `src/features/auto-proposal/services/proposal-draft.service.js`, lines 197 and 216
  * `src/features/auto-proposal/services/ai-response.service.js`, lines 660–669 and 712
* **Evidence:**
  * `generateProposalForLeadHtml` puts `lead_name`, `lead_email`, `company_logo`, `company_tagline` and other values into HTML **without escaping**. Puppeteer then renders it with `--no-sandbox` and `waitUntil: 'networkidle0'`.
  * `lead_name` comes from the display name of **any inbound email**, so a stranger controls it.
  * The `.docx` path calls `fetch(tagValue)` on the tenant's `company_logo` URL, which tenants set through `/api/tenant-profile/:id/update-field` (anonymous before #1).
* **Impact:** A crafted sender name (e.g. `<iframe src="http://internal-host/...">`) makes the server's Chrome load internal URLs and print the result into a PDF that is **emailed back to the attacker**. The logo URL gives a direct server-side fetch of arbitrary URLs. Running Chrome without its sandbox makes any renderer bug far more serious.
* **Fix:**
  * HTML-escape every value inserted into the template.
  * Block network requests from Puppeteer (`page.setRequestInterception(true)`, allowing only `data:` and an allowlisted CDN), and drop `--no-sandbox` (run as a non-root user).
  * Validate `company_logo` (and the other URL fields) as `https:` URLs on an allowlist of hosts, and refuse private/link-local IPs when fetching.
* **Fix (applied):**
  * Every value in `generateProposalForLeadHtml` is HTML-escaped (`src/utils/html.js`). The logo renders only if it is an allowlisted `https` URL.
  * Puppeteer now runs with JavaScript off and request interception on. Only `data:` URLs, allowlisted image hosts and Google Fonts load; everything else is aborted and logged. The browser now always closes, even when rendering fails.
  * The `.docx` image fetch goes through `fetchAllowedImage` (`src/utils/safe-url.js`): https, host allowlist (`storage.googleapis.com`, `cdn-icons-png.flaticon.com`, plus `ALLOWED_IMAGE_HOSTS`), no redirects, 10 s timeout, 5 MB cap, `image/*` only.
  * `PATCH /api/tenant-profile/:id/update-field` rejects a non-allowlisted `company_logo_url`, and any `*_url` link that isn't http(s).
  * Verified with a real Chromium: an injected `<img>`/`<iframe>` to a local server and a `<script>` caused zero requests and no script ran, and the PDF still rendered.
  * **Residual:** `--no-sandbox` is kept, because removing it breaks Chrome when it runs as root in containers. Run the service as a non-root user and drop the flag.

### Finding #7: Unrestricted file uploads

* **Severity:** High · **Status:** Fixed (residual: 1-year signed logo URLs)
* **OWASP:** A04:2021 – Insecure Design
* **Location:**
  * `src/features/auto-proposal/routes/quotation-template-routes.js`, line 5
  * `email-template.routes.js` and `tenant-profile.routes.js` (same `multer({ storage: memoryStorage() })`)
  * `src/utils/gcsUploader.js`, lines 41 and 51
* **Evidence:**
  * Template and logo uploads have no `limits` and no `fileFilter`, so any type and any size is buffered in memory.
  * The original filename goes into the object path unchanged.
  * Logos and templates get 1-year signed URLs.
  * Uploaded `.docx` files are parsed by mammoth, docxtemplater and LibreOffice.
* **Impact:** Memory exhaustion (DoS); storage abuse; hostile files sitting in GCS with long-lived public links; and an attack surface on the document parsers (see #8).
* **Fix:**
  * Set `limits: { fileSize }` and a MIME/extension allowlist (`.docx` for templates; `png`/`jpeg`/`webp` for logos).
  * Name objects with server-generated IDs.
  * Shorten signed URL lifetimes, or serve files through an authenticated endpoint.
* **Fix (applied):**
  * New `src/utils/upload.js`:
    * templates must be `.docx` (DOCX MIME or `application/octet-stream`), at most 10 MB, one file;
    * logos must be PNG/JPEG/WebP/GIF (no SVG), at most 2 MB;
    * conversation attachments keep their 50 MB limit, now with one file per request.
  * Every client filename is reduced to `[A-Za-z0-9._-]` (max 100 characters, no directories) before it becomes part of a GCS object path.
  * Limit and type violations return `400` instead of `500`.
  * **Residual:** logo URLs keep their 1-year signed lifetime because they are embedded in outgoing emails; consider a public, non-guessable logo bucket instead.

### Finding #8: Vulnerable production dependencies reachable from request paths

* **Severity:** High · **Status:** Fixed (residual: Puppeteer chain)
* **OWASP:** A06:2021 – Vulnerable and Outdated Components
* **Location:** `package.json` / `package-lock.json`
* **Evidence:** `npm audit --omit=dev` reports 25 advisories: 2 critical, 14 high, 9 moderate. The ones reachable from requests:

  | Package | Advisory | Reachable via |
  |---|---|---|
  | `multer` (direct) | GHSA-wc9g-mqfw-jrwm, GHSA-qfvm-cv95-jqjf (DoS) | every upload route |
  | `body-parser` | GHSA-27r3-jxmh-p828 (DoS on compressed bodies) | `express.json()` / `urlencoded()` |
  | `xmldom` 0.1.31 (via `docxtemplater-image-module-free`, unmaintained since 2022) | GHSA-crh6-fp67-6883 (critical) | rendering tenant `.docx` templates with images |

  Also flagged: `proxy-addr` (critical-rated, only matters with `trust proxy`, which is unset); the `puppeteer` chain (`extract-zip`, `basic-ftp`, `get-uri`; mostly install-time); `js-yaml`; `zod`.
* **Impact:** Unauthenticated (now authenticated) denial of service, and misparsing of uploaded documents.
* **Fix:** `npm audit fix`; upgrade `multer`, `express`, `mammoth` and `puppeteer` to patched versions; add an `npm audit --omit=dev --audit-level=high` gate in CI.
* **Fix (applied):**
  * `npm audit fix` upgraded `multer` to 2.5.0, `express` to 4.22.3 (with `body-parser` 1.20.9 and `proxy-addr` 2.0.8), and the patched `js-yaml`, `brace-expansion` and `qs`. `package.json` now requires `express ^4.22.3` and `multer ^2.5.0`.
  * An npm `overrides` entry replaces the image module's `xmldom` 0.1.31 with the maintained `@xmldom/xmldom` 0.8.x. Rendering the repo's quotation template with an image produced identical output before and after.
  * Result: 25 advisories (2 critical, 14 high) down to 15 (**0 critical**, 10 high, 5 moderate).
  * **Residual:** all 10 remaining highs are in `puppeteer` 24's browser-download and proxy code (`extract-zip`, `basic-ftp`, `get-uri`, `proxy-agent`, `zod` via `chromium-bidi`), which requests never reach. The fix is `puppeteer` 25, which requires Node ≥ 22.12 (this project declares Node ≥ 18). Upgrade both together. The moderates need `@google-cloud/storage` 8 (a major upgrade).

---

## Medium

### Finding #9: Cross-tenant access by record ID

* **Severity:** Medium · **Status:** Fixed
* **OWASP:** A01:2021 – Broken Access Control (IDOR)
* **Location:**
  * `src/features/auto-proposal/services/quotation-template.service.js`, lines 28–29 and 60
  * `src/features/auto-proposal/repositories/lead_requirement_values.repository.js`, lines 96, 109 and 164
* **Evidence:** These queries filter by record ID only, with no `tenant_id`:
  * quotation-template preview `findById(id)` and `deleteTemplate(templateId)`;
  * `lead_requirement_values` `findByRequirementId`, `update` and `delete`.
* **Impact:** Even with #1 fixed, any logged-in user of **any** tenant who knows a record's UUID can download or delete another tenant's quotation templates, and read, change or delete their lead requirement values.
* **Fix:** Add `AND tenant_id = $n` (joining through `lead_requirement` for values) and pass `req.tenantId` from the controllers.
* **Fix (applied):**
  * Quotation template `findById` / `deleteTemplate` now require the tenant. Preview and delete return `404` for another tenant's template.
  * `lead_requirement_values` reads, updates and deletes are scoped through `lead_requirement.tenant_id`.
  * `create` first checks that the lead requirement (and the field, for single values) belongs to the caller's tenant.
  * **Also found and fixed:**
    * `lead_requirement_config.update` (`PUT /api/lead-requirement-config/:id`) also updated by ID only; it is now scoped to the tenant.
    * `quotation.service.js` called `findById(tenantId, templateId)` with the arguments reversed. It now passes them in the right order.

### Finding #10: Internal error messages returned to clients

* **Severity:** Medium · **Status:** Fixed
* **OWASP:** A05:2021 – Security Misconfiguration (CWE-209)
* **Location:** `src/app.js`, line 71, and about 40 controller `catch` blocks (e.g. `ai.response.controller.js`, `quotation-template.controller.js`, `social-integration.controller.js`)
* **Evidence:** `res.status(500).json({ error: error.message })` everywhere.
* **Impact:** Postgres, Google API and GCS error text (table and column names, bucket names, token errors) is sent to clients.
* **Fix:** Return a generic message for 5xx responses and log the details server-side with a correlation ID.
* **Fix (applied):**
  * New `src/utils/http-errors.js`. `clientMessage(err)` returns an error's message only when it was deliberately marked as a client error (`clientError(...)` / a 4xx `statusCode`); anything else becomes `"Internal Server Error"`. All ~40 controller responses use it.
  * Intentional errors ("Template not found", "Invalid field name", "Proposal not found…", "Subject line is required") are now thrown with a 4xx status, so users still see them.
  * The global handler logs 5xx details server-side and never echoes them.
  * Proposal approval now returns `404` / `500` instead of `400` for everything.
  * **Not done:** correlation IDs (no request-ID infrastructure exists yet).

### Finding #11: Customer emails and personal data written to logs

* **Severity:** Medium · **Status:** Fixed
* **OWASP:** A09:2021 – Security Logging and Monitoring Failures
* **Location:**
  * `src/features/auto-proposal/services/gmail-send-email.service.js`, line 219
  * `conversation.controller.js`, lines 10–120
  * `concept.controller.js`, `pricing-rule.controller.js`, `gmail-read-email.service.js` (debug dumps of tenant and lead JSON)
* **Evidence:** An unconditional `console.log` prints the lead's email address, the proposal link, the price and the **full email content** for every outbound quotation. The repo's own rules (`lad-agent.agent.md`) forbid `console.*` in production code.
* **Impact:** Customer correspondence and personal data pile up in log storage, where far more people and systems can read them than can read the database.
* **Fix:** Route everything through `logger`, log IDs instead of content, and redact email and phone values.
* **Fix (applied):**
  * All server-side `console.*` calls (~125) now go through `logger`; routine ones are `debug`, which only prints when `DEBUG` is set.
  * The logger now redacts: errors are logged as name / message / code / status / stack only. HTTP-client errors such as `GaxiosError` used to carry the request config, **including `Authorization: Bearer` access tokens**.
  * Keys like `access_token`, `refresh_token`, `authorization`, `password`, `secret` and `api-key` are masked at any depth, and buffers are summarised.
  * The lines that dumped email content, prompts, sender and recipient addresses, lead data or Gmail responses now log IDs and counts only, even with `DEBUG` on.

### Finding #12: Gmail OAuth tokens stored in plaintext

* **Severity:** Medium · **Status:** Fixed — deploy steps required
* **OWASP:** A02:2021 – Cryptographic Failures
* **Location:** `src/features/auto-proposal/repositories/user-identity.repository.js`, lines 138–167
* **Evidence:** `access_token` and `refresh_token` are written as plain columns.
* **Impact:** Anyone who can read the database, a backup or the logs gains long-lived read and send access to every connected Gmail account.
* **Fix:** Encrypt the tokens at the application level (KMS envelope encryption) and restrict database access. Verify whether the database or disk is already encrypted.
* **Fix (applied):**
  * `src/utils/token-crypto.js` encrypts access and refresh tokens with AES-256-GCM (random IV, authenticated) using `TOKEN_ENCRYPTION_KEY`.
  * `user-identity.repository.js` encrypts on every write and decrypts on every read, so callers are unchanged. Legacy plaintext rows still read correctly.
  * The server refuses to start in production without the key. Outside production it warns and stores plaintext.
  * **Deploy steps:**
    1. Generate the key and keep it in a secret manager.
    2. Set `TOKEN_ENCRYPTION_KEY`.
    3. Run `node scripts/maintenance/encrypt-existing-tokens.js` once.

    Losing the key means every user must reconnect Gmail.
  * **Residual:** a KMS-managed key (envelope encryption, rotation) would be stronger than a static key in an environment variable.

### Finding #13: OAuth `state` not bound to the browser session

* **Severity:** Medium · **Status:** Fixed — requires a frontend change
* **OWASP:** A07:2021 – Identification and Authentication Failures
* **Location:** `src/features/auto-proposal/services/google-auth.service.js` (`createState` / `verifyState`)
* **Evidence:** The signed state proves which user *started* the flow, but not that the same browser *finishes* it.
* **Impact:** An attacker can start a flow for their own user and trick a victim into completing consent, which links the **victim's** Gmail to the attacker's user for up to 10 minutes after the state is issued.
* **Fix:** Set an `HttpOnly`, `SameSite=Lax` nonce cookie when the popup opens, put its hash in the state, and compare the two in the callback. Track used nonces so each state works only once.
* **Fix (applied):** The callback no longer links anything.
  * It posts `{ type: 'GOOGLE_AUTH_CODE', code, state }` to the opener, only ever to the `FRONTEND_URL` origin (it refuses if that is unset), with `Referrer-Policy: no-referrer`.
  * The frontend finishes with the new authenticated `POST /api/social-integration/email/google/complete`. That endpoint links the account only if the signed state was issued to the **same user and tenant as the caller's JWT**, otherwise `403`.
  * In the attack, the code stays in the victim's browser, and the victim's own session doesn't match the attacker's state.
  * Why not the cookie approach: this API authenticates with bearer tokens, not cookies. A nonce cookie set during the flow would be set in the victim's browser just as easily, because the attacker can hand the victim the flow link.
  * **Deploy step:** update the frontend to handle `GOOGLE_AUTH_CODE` by POSTing `code` and `state` to `/complete`, and set `FRONTEND_URL`. `GOOGLE_OAUTH_LEGACY_CALLBACK=true` restores the old single-step behaviour as a temporary rollout switch; remove it once the frontend is updated.

### Finding #14: No rate limiting; 50 MB body limit; AI endpoints can run up cost

* **Severity:** Medium · **Status:** Fixed (residual: per-process limits)
* **OWASP:** A04:2021 – Insecure Design
* **Location:** `src/app.js`, line 38; the AI routes (`/api/ai-response/*`, `/api/gmail/test-prompt`, `/api/email-conversations/email-ai-*`)
* **Evidence:** `express.urlencoded({ limit: '50mb' })`, and no rate limiting anywhere.
* **Impact:** Easy memory pressure, plus unbounded Gemini/OpenAI spend by any logged-in user.
* **Fix:** Add `express-rate-limit` keyed per tenant/user, with tighter limits on AI routes; reduce body limits to what is actually needed.
* **Fix (applied):**
  * `express-rate-limit` runs after authentication and is keyed per tenant and user, or per IP when unauthenticated.
  * `/api/*` defaults to 300 requests/minute (`RATE_LIMIT_PER_MINUTE`); the AI endpoints default to 20/minute (`AI_RATE_LIMIT_PER_MINUTE`). Excess requests get `429`.
  * The verified Pub/Sub webhook is exempt, because Google delivers from shared IPs.
  * `urlencoded` bodies are capped at 1 MB (was 50 MB).
  * `TRUST_PROXY` sets Express's `trust proxy` so IP keys are real client IPs behind a load balancer.
  * **Residual:** the in-memory store applies limits per process; with several instances, use a shared store (e.g. Redis).

---

## Low

### Finding #15: JWT verification did not pin algorithms or check issuer/audience

* **Severity:** Low · **Status:** Fixed
* **OWASP:** A07:2021 – Identification and Authentication Failures
* **Location:** `src/middleware/auth.middleware.js`, line 16
* **Evidence:** `jwt.verify(token, secret)` with no `algorithms` option, and no startup check on the secret.
* **Fix (applied):** HS256/384/512 are pinned; optional `JWT_ISSUER` / `JWT_AUDIENCE` checks were added; startup fails if `JWT_SECRET` is missing or shorter than 32 characters.

### Finding #16: OAuth popup `postMessage` falls back to `*` target origin

* **Severity:** Low · **Status:** Fixed
* **OWASP:** A05:2021 – Security Misconfiguration
* **Location:** `src/features/auto-proposal/controllers/social-integration.controller.js` (`renderPopupHtml`)
* **Evidence:** When `FRONTEND_URL` is unset, `targetOrigin = '*'`. The payload only says success or failure, so little is exposed.
* **Fix:** Require `FRONTEND_URL` in production and drop the wildcard fallback.
* **Fix (applied):** The wildcard fallback is gone. Without `FRONTEND_URL` the popup posts nothing, and the authorization code was already refused in that case.

### Finding #17: Missing security headers; CORS origin hardcoded to `localhost`

* **Severity:** Low · **Status:** Fixed
* **OWASP:** A05:2021 – Security Misconfiguration
* **Location:** `src/app.js`, lines 5–11
* **Evidence:** There is no `helmet` and `X-Powered-By` is on. CORS is fixed to `http://localhost:3000` with `credentials: true`, so production needs a code change, which tends to end with a wildcard.
* **Fix:** `app.disable('x-powered-by')`; `helmet()`; read allowed CORS origins from an environment allowlist.
* **Fix (applied):**
  * `X-Powered-By` is disabled and `helmet` sets HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, a default CSP and related headers.
  * Two defaults are deliberately relaxed: `Cross-Origin-Opener-Policy: unsafe-none`, so the OAuth popup keeps its opener, and `Cross-Origin-Resource-Policy: cross-origin`, so the separately hosted frontend can load API responses.
  * The OAuth popup page gets its own strict policy: `default-src 'none'`, a per-response nonce on its single script, `frame-ancestors 'none'`. Its inline `onclick` was replaced so it runs under that policy.
  * CORS origins come from `CORS_ORIGINS` (comma-separated), else `FRONTEND_URL`, else the local dev frontend.
  * Verified in a real Chromium: the popup still delivers `GOOGLE_AUTH_CODE` to the frontend window, with no CSP violations.

### Finding #18: Hardcoded fallback lead/tenant UUIDs in code and scripts

* **Severity:** Low · **Status:** Fixed
* **OWASP:** A04:2021 – Insecure Design
* **Location:** `src/features/auto-proposal/controllers/gmail-read-email.controller.js`, line 112 (`7cb095...`); `scripts/dev/smoke-test.js`, line 27, and `.env.example`, line 65 (`e0a3e9...`)
* **Evidence:** If creating the test lead fails, the AI test endpoint quietly reuses a fixed lead ID. Scripts default to a real tenant ID.
* **Impact:** Test data can attach to a real lead or tenant.
* **Fix:** Fail instead of falling back. Require these IDs to come from environment variables in scripts.
* **Fix (applied):**
  * `test-prompt` now returns an error when it can't create its test lead.
  * A caller-supplied `leadId` must belong to the caller's tenant (otherwise `404`); previously any ID was accepted.
  * `smoke-test.js` requires `DEV_TEST_TENANT_ID`, and the real tenant ID is removed from `.env.example`.
  * No hardcoded tenant, lead or user IDs remain outside tests.

---

## Reviewed with no finding

* **SQL injection:** none. All repositories use parameterised `db.query(sql, params)`. The three places that build column names dynamically (`tenant-profile.repository.js` line 27, `tenant.repository.js` line 111, `pricingRule.repository.js` line 161) pick them from fixed allowlists.
* **Command injection:** `docxToPdf.js` uses `execFile` with fixed arguments and server-generated temporary paths.
* **Committed secrets:** no API keys, OAuth client secrets, refresh tokens, service-account keys or private keys appear in any blob on any branch. A `.env` file committed on `Auto-proposal-frontend` (`3de0392`) held only non-secret Vite settings. The only credential leaks are the database password fallbacks in #4.
* **XSS in the OAuth popup:** error text is HTML-escaped and the JSON payload has `<`/`>` neutralised.

## Breaking change: clients must send a JWT

All `/api/*` calls (except the two Google endpoints) now need `Authorization: Bearer <JWT>` with `tenantId` and `userId` claims. That is the token `/api/email-conversations` already required. Clients that send only `X-Tenant-Id` will get `401`. Tenant administration needs `roles: ["platform_admin"]`.

## Recommended order

1. **Now:** deploy this branch together with the client change to send the JWT; rotate the database password(s) from #4; fix or retire the other branches that still have the fallback.
2. **Next:** #5 (verify Pub/Sub tokens), #6 (escape the HTML, sandbox Puppeteer), #7 and #8 (upload limits, dependency upgrades), #9 (tenant filters on ID lookups).
3. **Then:** #10–#14 and the Low findings.
