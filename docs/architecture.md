# Architecture Guidelines

Design standards, layering rules, and multi-tenancy principles for the `lad-feature-auto-proposal` backend.

---

## 1. System Overview

Rush Away is a multi-tenant Node.js + Express backend powering dynamic price calculation, automated quotation generation, and AI-driven client proposal workflows.

### Technology Foundation

- **Runtime:** Node.js (CommonJS modules)
- **Framework:** Express.js 4.x
- **Database & Data Access:** PostgreSQL via Node.js CommonJS and Parameterized SQL executed via `AppDataSource.query()` and `pg` (per ADR-0001)
- **AI Integrations:** Google Generative AI (Gemini) & OpenAI API
- **Document Processing:** `docxtemplater`, `pizzip`, `mammoth`, `libreoffice-convert`, `pdfkit`, `puppeteer`
- **Cloud Storage:** Google Cloud Storage (`@google-cloud/storage`)
- **Messaging / Ingestion:** Google Cloud Pub/Sub & Gmail REST API

---

## 2. Multi-Tenancy (LAD Standard)

Multi-tenancy isolation is enforced at every boundary:

1. **Header Scoping:**
   - Every tenant-scoped request must supply `X-Tenant-Id: <tenant-uuid>` (or have it resolved from JWT credentials).
   - Global entities (`Tenant`) do not require tenant scoping; all child entities (`Location`, `Concept`, `Lead`, `Quotation`, etc.) belong strictly to a Tenant.

2. **Query Layer Isolation:**
   - Every database query executed through a repository must explicitly filter on `tenant_id` using parameterized SQL placeholders (e.g., `WHERE tenant_id = $1`).
   - Cross-tenant data leakage is prevented at the repository layer.

3. **No Schema Hardcoding:**
   - Database schema names are never hardcoded in queries; connection parameters use `process.env.DB_NAME`.

---

## 3. Clean Layering Architecture

Code execution flows through four distinct layers:

```
HTTP Request ──► [ Middleware ]
                        │ (Auth & X-Tenant-Id)
                        ▼
                 [ Controller ]  ── HTTP Parsing, Input Validation, Status Codes
                        │
                        ▼
                 [ Service ]     ── Business Logic, Pricing Math, AI Pipelines
                        │
                        ▼
                 [ Repository ]  ── Parameterized SQL & Tenant Scoping (ADR-0001)
                        │
                        ▼
                 [ PostgreSQL ]
```

### Layer Responsibilities

- **Controllers (`src/features/auto-proposal/controllers/`):**
  - Parse HTTP request parameters, body, headers, and query strings.
  - Validate payloads against schema rules.
  - Dispatch calls to the service layer.
  - Return standardized HTTP responses (`200`, `201`, `400`, `404`, `500`).
  - *Constraint:* Never execute direct SQL queries or database operations in controllers.

- **Services (`src/features/auto-proposal/services/`):**
  - Implement core business logic, formula evaluations, and orchestration.
  - Call external AI APIs (Gemini/OpenAI) and document rendering tools.
  - Orchestrate repository operations across multiple tables.
  - *Constraint:* Never handle raw HTTP `req` / `res` objects or return HTTP response objects.

- **Repositories (`src/features/auto-proposal/repositories/`):**
  - Interface directly with PostgreSQL using raw parameterized SQL queries via `AppDataSource.query()` and `pg` (ADR-0001 standard).
  - Enforce `tenant_id` filtering in all queries to guarantee multi-tenant boundary isolation.
  - *Constraint:* Contain only data access logic, no business rules or external network calls.

- **DTOs & Validators (`dtos/`, `validators/`, `middleware/validate.js`):**
  - Enforce field types, required fields, and boundary constraints before service invocation.

---

## 4. Key Subsystems

### Dynamic Pricing & Calculation Engine
1. **Concept Pricing Matrix:** Stores baseline rates, unit dimensions (e.g., per square foot, per hour), and location multipliers.
2. **Pricing Rule Evaluation:** Evaluates dynamic rules in order of `evaluation_order` (percentage discounts, surcharges, fixed overrides).
3. **Proposal Tier Generation:** Automatically calculates paired tiers (e.g., *LITE* base vs. *IMPACT* comprehensive) for comparison quotes.

### AI Auto-Proposal Pipeline
1. **Inquiry Parsing:** Ingests email or chat content from `Conversation` threads.
2. **Requirement Extraction:** Maps freeform text to structured `LeadRequirementValues`.
3. **Concept & Rule Matching:** AI services evaluate optimal catalog concepts and pricing rules for the lead requirements.
4. **Draft Generation:** Populates `.docx` proposal templates with computed line items and merges them into previewable PDF/HTML formats.

### Communication & Webhooks
- **Gmail Watch:** Registers a Pub/Sub topic subscription to trigger real-time inbox synchronization.
- **Webhook Ingestion:** Ingests webhook payloads at `/api/gmail/webhook` and links message threads to customer contact records.

---

## 5. Centralized Logging & Error Handling

- **Logger Utility:** All log output is channeled through `src/utils/logger.js` (`logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()`).
- **No Console Statements:** Direct `console.log()` statements in production paths are prohibited.
- **Global Error Handler:** Centralized Express error handler catches unhandled exceptions and formats clean `{ error: "<message>" }` JSON responses.
