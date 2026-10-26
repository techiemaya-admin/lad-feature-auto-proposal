# Security Audit — `lad-feature-auto-proposal`

**Date:** 2026-10-26 · **Commit audited:** `16e21ef` · **Scope:** entire repository (94 files, Node/Express + TypeORM/PostgreSQL backend), git history, `package-lock.json`.

**Method:** Full manual read of every source file (routes, middleware, controllers, services, repositories, DTOs, entities, config, logger), git history review for secrets, `npm audit` against the lockfile (production deps), and local runtime probes of the Express app (no database attached) to confirm header, error-handling, and routing behaviour.

**Layers with nothing to audit:** This repository contains **no frontend code** and **no outbound third-party API integrations** (no HTTP clients, SDKs, webhooks, or API keys). Those layers were checked and are empty; if a frontend or integration service exists elsewhere it needs its own review.

> Secrets are truncated to the first 6 characters per policy.

---

## Summary

| Severity | Count |
|---|---|
| **Critical** | 3 |
| **High** | 2 |
| **Medium** | 6 |
| **Low** | 4 |
| **Total** | **15** |

**Exploitable today, by anyone who can reach the API:** Findings #1 + #2 together let an anonymous attacker list every tenant and then read and write every tenant's leads, concepts, locations, pricing and quotations. Fix these first.

| # | Severity | Title | Status |
|---|---|---|---|
| 1 | Critical | No authentication; tenant identity taken from a client-supplied header | **Fixed in code** |
| 2 | Critical | Unauthenticated tenant listing/creation leaks every tenant ID | **Fixed in code** |
| 3 | Critical | Hardcoded database password in source and git history | **Fixed in code — rotation still required** |
| 4 | High | DB schema auto-sync enabled unless `NODE_ENV` is exactly `production` | Confirmed (runtime); prod value Needs verification |
| 5 | High | Reachable vulnerable dependency: `body-parser` DoS (GHSA-27r3-jxmh-p828) | Needs verification |
| 6 | Medium | Raw internal error messages returned to clients | Confirmed (runtime) |
| 7 | Medium | Cross-tenant object references accepted (ownership lookups ignored) | Confirmed (code) |
| 8 | Medium | Placeholder routers hang every request to two API prefixes | Confirmed (runtime) |
| 9 | Medium | No rate limiting or abuse controls on unauthenticated write endpoints | Confirmed (code) |
| 10 | Medium | No security/audit logging; dev query logging captures client data | Confirmed (code) |
| 11 | Medium | Database connection has no TLS configured | Needs verification |
| 12 | Low | Missing security headers; `X-Powered-By` exposed; no explicit CORS policy | Confirmed (runtime) |
| 13 | Low | Input validation gaps (IDs, status, JSONB, quantity) | Confirmed (code) |
| 14 | Low | Latent mass-assignment via object spread in repositories | Confirmed (code), not exploitable today |
| 15 | Low | Other dependency advisories not currently reachable | Confirmed (audit) |

---

## Critical

> **Remediation status:** Findings #1–#3 are fixed in code on this branch. All `/api/*` routes now require a verified JWT (`src/middleware/auth.js`). The tenant comes only from the token's `tenant_id` claim (`src/middleware/tenant-context.js`), and a mismatched `X-Tenant-Id` gets `403`. Creating and listing tenants requires `platform_admin`. The DB password fallback is removed, and the app refuses to start without `DB_PASSWORD` and a strong `JWT_SECRET`. **Still open (operational):** rotate the leaked DB password, and make sure the token issuer sets the `sub`, `tenant_id` and `roles` claims. Note that #7 (ownership checks) still needs its own fix.

### Finding #1: No authentication; tenant identity taken from a client-supplied header

* **Severity:** Critical
* **OWASP:** A01:2021 – Broken Access Control (also A07:2021 – Identification and Authentication Failures)
* **Location:** `src/middleware/tenant-context.js`, lines 8–17; `src/app.js`, lines 18–24
* **Evidence:** There is no authentication middleware anywhere in the app. The only gate on tenant data is:
  ```js
  const tenantId = req.headers['x-tenant-id'];   // line 8
  const tenant = await tenantRepository.findById(tenantId); // line 13
  req.tenantId = tenantId;                       // line 17
  ```
  Any caller who sends a valid tenant UUID in `X-Tenant-Id` is treated as that tenant. All routers (`/api/leads`, `/api/concepts`, `/api/locations`, `/api/quotations`) rely only on this. The project's own guideline (`.github/agents/lad-agent.agent.md`, line 24) states: *"Never trust client input for tenant_id. Tenant must come from auth context (JWT/session)."*
* **Impact:** Complete loss of tenant isolation. Anyone who knows or obtains a tenant ID can read all of that client's leads, locations, concepts, pricing and quotations, and can create records in their account. Tenant IDs are not secrets: they appear in every API response (`tenant_id` field), URLs and logs, and Finding #2 hands them out freely.
* **Fix:** Add an authentication middleware (JWT/session validated server-side) in front of every `/api/*` router. Derive `req.tenantId` **only** from the verified token or session, never from a header. Check that the authenticated user belongs to that tenant and has the capability for the action (RBAC). Until auth ships, do not expose this service beyond a trusted internal network.

### Finding #2: Unauthenticated tenant listing/creation leaks every tenant ID

* **Severity:** Critical
* **OWASP:** A01:2021 – Broken Access Control
* **Location:** `src/features/tenant/routes/index.js`, lines 8–10 (mounted at `src/app.js`, line 18)
* **Evidence:**
  ```js
  router.post('/', validateBody(createTenantSchema), tenantController.create); // line 8
  router.get('/', tenantController.list);                                       // line 9
  router.get('/:id', tenantController.getById);                                 // line 10
  ```
  Unlike the other routers, this one has no `tenantContext` and no other guard. `GET /api/tenants?limit=100&offset=N` returns every tenant's `id`, `name`, `slug` and `metadata`.
* **Impact:** An anonymous attacker gets the full client list (a business-confidentiality leak in itself) plus each tenant's UUID. Plugging those UUIDs into `X-Tenant-Id` (Finding #1) gives full read/write access to every client's data. `POST /api/tenants` also lets anyone create unlimited tenants.
* **Fix:** Restrict all tenant endpoints to an authenticated platform-admin role. Remove the public list endpoint, or scope it to the caller's own tenant. Take `metadata` out of tenant responses unless it is explicitly meant to be public.

### Finding #3: Hardcoded database password in source and git history

* **Severity:** Critical
* **OWASP:** A07:2021 – Identification and Authentication Failures (CWE-798, hardcoded credentials)
* **Location:** `src/config/data-source.js`, line 18; introduced in commit `16e21ef`
* **Evidence:**
  ```js
  password: process.env.DB_PASSWORD || 'l98378...',
  ```
  The value is a real-looking password, not a placeholder. The runtime probe confirmed it becomes the active DB password whenever `DB_PASSWORD` is unset. It is now permanent in git history, together with the default user `postgres`.
* **Impact:** Anyone with repo read access (current or former staff, contractors, a leaked clone, a CI log) has the Postgres superuser password. If the same password is used on any reachable database, or reused by the author elsewhere, it gives direct access to all client data and bypasses the API entirely. The silent fallback also means a misconfigured deployment connects using this password instead of failing.
* **Fix:**
  1. **Rotate now:** change this password on every database (and any other account) where it is used.
  2. Remove the fallback. Fail fast if `DB_PASSWORD` is missing:
     `if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required');`
  3. Load credentials from a secret manager in deployed environments. Use a least-privilege app role, not `postgres`.
  4. Add secret scanning (e.g. gitleaks or GitHub secret scanning with push protection) to CI and a pre-commit hook.
  5. Consider purging the commit from history (`git filter-repo`). Rotation is still mandatory, because existing clones keep the old commit.

---

## High

### Finding #4: DB schema auto-sync enabled unless `NODE_ENV` is exactly `production`

* **Severity:** High
* **OWASP:** A05:2021 – Security Misconfiguration
* **Location:** `src/config/data-source.js`, lines 6–10
* **Evidence:**
  ```js
  const isProd = process.env.NODE_ENV === 'production';
  const synchronize = !isProd;
  ```
  The runtime probe with `NODE_ENV` unset printed `synchronize: true`. The previous code (commit `0dab6fc`) enabled sync only for `test`/`development`; the latest commit turned it into a default-on setting.
* **Impact:** If any shared, staging or production environment runs with `NODE_ENV` unset or misspelled (`prod`, `Production`), TypeORM changes the live schema on every startup to match the entity files. A renamed or removed entity column is **dropped along with its client data**. A code change becomes a destructive DDL operation with no review and no rollback.
* **Fix:** Invert the default so sync is only enabled when explicitly requested: `const synchronize = process.env.DB_SYNCHRONIZE === 'true' && !isProd;`. Use migrations (`npm run migration:run`) everywhere else. **Needs verification:** confirm the `NODE_ENV` value in every deployed environment.

### Finding #5: Reachable vulnerable dependency: `body-parser` DoS

* **Severity:** High
* **OWASP:** A06:2021 – Vulnerable and Outdated Components
* **Location:** `package-lock.json` → `node_modules/body-parser` **1.20.4** (via `express` 4.22.1); reached through `express.json()` at `src/app.js`, line 12
* **Evidence:** `npm audit` reports GHSA-27r3-jxmh-p828, *"Denial of Service via trailing bytes after a compressed request body"* (CVSS 7.5, affected `<1.20.9`). `express.json()` inflates `Content-Encoding: gzip/deflate` bodies by default, and every POST endpoint is unauthenticated.
* **Impact:** An anonymous attacker may be able to crash the process or degrade availability with a crafted compressed request body.
* **Fix:** Run `npm update express body-parser` (or `npm audit fix`) to get `body-parser >= 1.20.9`, then commit the lockfile. Add `npm audit --omit=dev --audit-level=high` as a CI gate. **Needs verification:** reproduce against a staging instance to confirm a crash rather than a handled error.

---

## Medium

### Finding #6: Raw internal error messages returned to clients

* **Severity:** Medium
* **OWASP:** A05:2021 – Security Misconfiguration (CWE-209)
* **Location:** `src/app.js`, lines 26–30
* **Evidence:**
  ```js
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
  ```
  Every unexpected exception's message goes back to the caller verbatim. The runtime probe returned `500 {"error":"No metadata for \"Tenant\" was found."}`, an ORM internal. With a DB attached, a non-UUID `X-Tenant-Id` or `:id` produces Postgres errors such as `invalid input syntax for type uuid: "..."`. FK and constraint violations also leak table, column and constraint names.
* **Impact:** Internal schema, ORM and infrastructure details are disclosed, which helps an attacker map the system. Connection errors can expose DB host names.
* **Fix:** Return `err.message` only for errors you raise on purpose (those with `err.statusCode` set and `< 500`). For everything else return a generic `{"error":"Internal Server Error"}` with a correlation ID, and log the full error server-side.

### Finding #7: Cross-tenant object references accepted (ownership lookups ignored)

* **Severity:** Medium
* **OWASP:** A01:2021 – Broken Access Control (IDOR)
* **Location:** `src/features/concept/services/concept.service.js`, lines 31, 38–39, 55; `src/features/pricing/services/pricing-engine.service.js`, line 11; `src/features/quotation/services/quotation.service.js`, line 65
* **Evidence:** The tenant-scoped ownership checks are called, but their results are discarded:
  ```js
  await conceptRepository.findById(tenantId, conceptId);    // returns null for another tenant's concept — ignored
  await locationRepository.findById(tenantId, locationId);  // ignored
  return conceptLocationRepository.create(tenantId, conceptId, locationId, options);
  ```
  The same pattern appears in `addPricing`, `listConceptsByLocation`, `calculatePrice` and `listQuotationsByLead`.
* **Impact:** Even after Finding #1 is fixed, a tenant can create concept-location links and pricing rows that point at **another tenant's** concept or location IDs, corrupting the integrity of shared relations. The success-vs-FK-error response also works as an oracle for whether a foreign ID exists. This bug will survive the auth fix unless corrected.
* **Fix:** Use the throwing service-level getters (`getConceptById`, `getLocationById`, `getLeadById`), or check for `null` and return 404. Add composite FKs `(tenant_id, concept_id) → concept(tenant_id, id)` so the database enforces tenant consistency. Consider Postgres Row-Level Security on `tenant_id` as defence in depth.

### Finding #8: Placeholder routers hang every request to two API prefixes

* **Severity:** Medium
* **OWASP:** A04:2021 – Insecure Design (resource exhaustion)
* **Location:** `src/features/pricing/routes/index.js`, line 2; `src/features/quotation-template/routes/index.js`, line 2; mounted at `src/app.js`, lines 22 and 24
* **Evidence:** Both modules export `function(router) { /* attach ... here */ }`. Express mounts this as middleware that never responds or calls `next()`. The runtime probe confirmed that `GET /api/pricing/anything` and `GET /api/quotation-templates` **hang until the client times out**.
* **Impact:** Any anonymous client can open many requests that each hold a socket and file descriptor until Node's request timeout (300 s by default), exhausting connections with very little traffic. As a side effect, the pricing and quotation-template controllers (`calculate`, `createRule`, template CRUD) are unreachable dead code.
* **Fix:** Turn these into real `express.Router()` instances that use `tenantContext` (plus auth), as the other features do. Until they are ready, stop mounting them. Set `server.requestTimeout` and `server.headersTimeout` explicitly, and put a reverse proxy with connection limits in front of the app.

### Finding #9: No rate limiting or abuse controls on unauthenticated write endpoints

* **Severity:** Medium
* **OWASP:** A04:2021 – Insecure Design
* **Location:** `src/app.js`, lines 10–24 (no rate-limit middleware); for example `src/features/quotation/routes/index.js`, line 9, and `src/features/tenant/routes/index.js`, line 8
* **Evidence:** No rate-limiting, throttling or quota middleware exists. `POST /api/quotations` writes two rows (`price_calculation` + `quotation`) per call, and `POST /api/tenants` creates tenants, all without authentication.
* **Impact:** An attacker can enumerate tenants and IDs at high speed, flood the database with junk rows (storage and cost growth, polluting client data), and degrade availability.
* **Fix:** Add `express-rate-limit` (global, plus stricter limits on write endpoints), keyed on the authenticated principal once auth exists and on IP before that. Set an explicit `express.json({ limit: '100kb' })`.

### Finding #10: No security/audit logging; dev query logging captures client data

* **Severity:** Medium
* **OWASP:** A09:2021 – Security Logging and Monitoring Failures
* **Location:** `src/app.js`, lines 26–30; `src/config/data-source.js`, line 11; `src/index.js`, line 15
* **Evidence:** The global error handler never logs, so 500s and suspicious input leave no trace. No request or access log exists, and nothing records who created or read which tenant's data. Meanwhile `logging: isDev || isTest` enables TypeORM query logging, which writes full SQL **with parameter values** (lead metadata, pricing, quotation bodies) to stdout. `logger.error('Failed to start:', err)` dumps the full error object, including connection details.
* **Impact:** Attacks such as cross-tenant enumeration (Findings #1 and #2) cannot be detected or investigated after the fact. In any environment running with `NODE_ENV=development`, client data ends up in log aggregation.
* **Fix:** Log every 5xx with stack trace and correlation ID through `logger`. Add structured access logs (method, path, status, tenant, principal, IP), and once auth exists, audit logs for data access and changes. Restrict ORM logging to `['error','warn']` outside local development, and redact parameters.

### Finding #11: Database connection has no TLS configured

* **Severity:** Medium
* **OWASP:** A02:2021 – Cryptographic Failures
* **Location:** `src/config/data-source.js`, lines 13–20
* **Evidence:** The `DataSource` options have no `ssl` setting. The runtime probe printed `ssl: undefined`, so `pg` connects in plaintext.
* **Impact:** If the database is on another host or a managed service, DB credentials and all client data cross the network unencrypted and can be intercepted.
* **Fix:** Add `ssl: { rejectUnauthorized: true, ca: process.env.DB_CA_CERT }` (or the provider's equivalent), driven by environment. Enforce `hostssl` / `require_secure_transport` on the server side. **Needs verification:** confirm the DB topology and whether the provider enforces TLS on its side.

---

## Low

### Finding #12: Missing security headers; `X-Powered-By` exposed; no explicit CORS policy

* **Severity:** Low
* **OWASP:** A05:2021 – Security Misconfiguration
* **Location:** `src/app.js`, lines 10–12
* **Evidence:** The runtime probe of `/health` showed `x-powered-by: Express`, and no `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy` or `Referrer-Policy` headers. There is no CORS middleware. No `Access-Control-Allow-Origin` header is sent, which is currently safe because browsers block cross-origin reads, but the policy is implicit rather than defined.
* **Impact:** Framework fingerprinting, no HSTS protection against downgrade, and a risk that someone later "fixes" CORS with a wildcard.
* **Fix:** `app.disable('x-powered-by'); app.use(helmet());`. If a browser frontend needs access, add `cors({ origin: [<explicit allow-list>], credentials: true })` and never use `*` together with credentials. Enforce HTTPS at the load balancer.

### Finding #13: Input validation gaps (IDs, status, JSONB, quantity)

* **Severity:** Low
* **OWASP:** A03:2021 – Injection (input validation; **no SQL injection found**)
* **Location:** `src/middleware/tenant-context.js`, line 8; `src/features/lead/routes/index.js`, line 10; `src/features/lead/dtos/lead.dto.js`, line 4; `src/features/quotation/routes/index.js`, line 9; `src/features/pricing/services/pricing-engine.service.js`, line 38
* **Evidence:**
  * `X-Tenant-Id` and all `:id` path params go to the DB without a UUID check (this triggers the error leaks in Finding #6).
  * `location_id` is validated as `string`, not `uuid`.
  * A client can set lead `status` to any value at creation (`status: body.status || 'draft'`).
  * `metadata` and template `structure` accept arbitrary unbounded JSON.
  * `POST /api/quotations` has no `validateBody`. `quantity` can be a string, which makes `Math.max` return `NaN` and causes a DB error, or an extreme number.

  All DB access uses TypeORM `find`/`findOne`/`save`/`update` with object criteria, which are parameterized, so no SQL injection vector exists.
* **Impact:** Workflow-state tampering (leads created directly in a later status), oversized JSON stored per row, noisy 500s, and edge cases in price calculation.
* **Fix:** Validate `X-Tenant-Id` and every path ID with `isUuid` before any DB call. Use `type: 'uuid'` for `location_id`. Restrict `status` to an enum the server controls. Cap JSONB size and depth. Add a `validateBody` schema to quotations with `quantity: { type: 'number', min: 1, max: <business max> }`.

### Finding #14: Latent mass-assignment via object spread in repositories

* **Severity:** Low
* **OWASP:** A08:2021 – Software and Data Integrity Failures (CWE-915)
* **Location:** `src/features/concept/repositories/concept.repository.js`, lines 11–15; `src/features/tenant/repositories/tenant.repository.js`, lines 10–13
* **Evidence:**
  ```js
  repo.create({ id: uuidv4(), tenant_id: tenantId, ...data })
  ```
  Because `...data` comes **after** `tenant_id`, any `tenant_id`, `id` or `is_deleted` key in `data` would override the server-set values. Today the DTOs (`createConceptDto`, `createTenantDto`) whitelist fields, so this is **not exploitable now**.
* **Impact:** A future refactor that passes `req.body` straight through would let callers write into other tenants or forge IDs.
* **Fix:** Map fields explicitly, as the other repositories do, or put the spread first: `{ ...data, id: uuidv4(), tenant_id: tenantId }`.

### Finding #15: Other dependency advisories not currently reachable

* **Severity:** Low
* **OWASP:** A06:2021 – Vulnerable and Outdated Components
* **Location:** `package-lock.json`
* **Evidence:** `npm audit --omit=dev` reports 9 production advisories (1 critical, 4 high, 4 moderate). Apart from Finding #5, none is reachable in the current code:

  | Package (version) | Advisory | Why not reachable today |
  |---|---|---|
  | `proxy-addr` (npm rates it critical) | GHSA-jqcg-44mw-7w3h, IP spoofing via a trusted subnet | `app.set('trust proxy')` is not used |
  | `path-to-regexp` 0.1.12 | GHSA-37ch-88jc-xwx2, ReDoS | Needs several params in one path segment; none of the routes have that |
  | `qs` 6.14.1 | GHSA-4mjr-xmp4-gh2g and others, DoS | Query strings are parsed (extended parser), but only `limit`, `offset` and `location_id` are read. Upgrade anyway |
  | `typeorm` 0.3.28 | GHSA-9ggv-8w38-r7pm (SQLi, MySQL only); GHSA-2rp8-mm9q-fp49 (`migration:generate`) | The app uses Postgres; the CLI issue only affects development |
  | `uuid` 10.0.0 | GHSA-w5hq-g745-h8pq | Only `v4()` without a `buf` argument is used |
  | `brace-expansion` / `minimatch` (under typeorm) | Multiple ReDoS/DoS | Only expand the static entity glob paths |
* **Impact:** Low today, but the critical-rated `proxy-addr` issue becomes live as soon as `trust proxy` is enabled behind a load balancer, which is a common next step.
* **Fix:** `npm audit fix`; upgrade `typeorm` to `>= 0.3.31` and `uuid` to a current major. Enable Dependabot/Renovate and a CI `npm audit` gate.

---

## Reviewed with no finding

* **Secrets in env files:** `.env` is git-ignored and was never committed. The deleted `.env.example` (in history) only had the placeholder `testpa...`.
* **SQL injection:** none. No raw SQL or `query()` calls exist; all access goes through parameterized TypeORM repository methods.
* **Sensitive fields in responses:** DTOs return whitelisted fields only. There are no passwords, tokens or PII columns in the schema. `tenant_id` and `metadata` are echoed back (see #1 and #2 for why the exposed IDs matter).
* **Frontend bundle / third-party integrations:** none in this repo.

## Note on existing documentation

`ARCHITECTURE_COMPLIANCE_REVIEW.md` reports security items as PASS but does not cover authentication or tenant trust. Treat it as superseded by this audit for security purposes.

## Recommended fix order

1. **Today:** rotate the DB password (#3); take the API off any public network until auth exists (#1, #2).
2. **This sprint:** build auth and tenant-from-token (#1, #2); fix the ownership checks (#7); set `synchronize` to opt-in (#4); upgrade express/body-parser (#5); make the error handler generic (#6); fix the hanging routers (#8).
3. **Next:** rate limiting (#9), logging/audit (#10), DB TLS (#11), helmet (#12), validation hardening (#13), cleanups (#14, #15).
