# AGENTS.md

## Repository Context

**Rush Away Auto-Proposal** (`lad-feature-auto-proposal`) is a multi-tenant Node.js + Express backend powering dynamic price calculation, automated quotation generation, and AI-driven client proposal workflows.

- **Runtime & Modules:** Node.js (CommonJS `require`/`module.exports`)
- **Web Framework:** Express.js 4.x (`src/app.js`, `src/index.js`)
- **Data Access:** PostgreSQL with parameterized SQL via `AppDataSource.query()` and `pg` pools (ADR-0001)
- **AI & Document Pipelines:** Google Gemini, OpenAI, `docxtemplater`, `pizzip`, `puppeteer`, `@google-cloud/storage`
- **Test Suite:** Jest (`npm test`, `npm run test:watch`, `npm run test:coverage`)

---

## Non-Negotiable Architecture Guardrails

1. **Multi-Tenancy Isolation:**
   - Every request must resolve `tenant_id` via auth context or `X-Tenant-Id` header.
   - Every database query executed in repositories must be tenant-scoped using parameterized placeholders (`WHERE tenant_id = $1`).
   - Use `tenant_id` as the canonical tenant identifier (avoid `organization_id` in new code).
   - Dynamic schema names must use server-side resolution (`${getSchema(req)}` or validated allow-list); never hardcode schema names (e.g., `lad_dev.*`).

2. **Clean 4-Tier Layering:**
   - **Controllers (`src/features/auto-proposal/controllers/`):** HTTP parsing, input validation orchestration, status codes. No SQL or business logic.
   - **Services (`src/features/auto-proposal/services/`):** Pure business logic, pricing math, AI pipelines, repository orchestration. No raw HTTP `req`/`res`.
   - **Repositories (`src/features/auto-proposal/repositories/`):** Data access layer. Parameterized SQL queries only. No business logic or external network calls.
   - **DTOs & Validators (`dtos/`, `validators/`, `middleware/`):** Schema validation, input sanitization, payload transformation.

3. **Centralized Logging & Production Hygiene:**
   - Channel all application logging through `src/utils/logger.js` (`logger.info`, `logger.warn`, `logger.error`, `logger.debug`).
   - Prohibit `console.log` / `console.error` in production code paths.
   - Never log sensitive data (tokens, secrets, credentials, PII).

4. **Testing & Verification:**
   - Run tests via `npm test` to verify changes.
   - Ensure new services, repositories, and controllers have corresponding test coverage in `tests/`.

5. **Context-Rich Commits:**
   - Format: `<type>(<scope>): <imperative summary>` followed by a blank line.
   - Body must explain **WHY** (problem, failure mode, or motivation) before **HOW** (approach, trade-offs, and fallbacks).
   - Reference related issues, plans, or ADRs (`REFS:`) if any.

---

## Documentation & Synchronous Maintenance Policy

Documentation and `AGENTS.md` must stay continuously aligned with codebase realities.

- **No Silent Updates:** Never modify documentation (`docs/`, `CONTEXT.md`, `AGENTS.md`) silently or automatically during feature implementation.
- **Drift Detection & User Approval:** When code modifications alter architecture, API endpoints, schemas, or conventions, explicitly flag the doc drift to the user, present the proposed diff, and ask for user confirmation before applying updates.

---

## Context Pointers (Progressive Disclosure)

- **Domain Model & Terminology:** [CONTEXT.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/CONTEXT.md) and [docs/agents/domain.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/agents/domain.md)
- **Architecture Guidelines & Compliance:** [docs/architecture.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/architecture.md)
- **Architectural Decision Records (ADRs):** [docs/adr/](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/adr/)
- **API Endpoint Documentation:** [docs/api.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/api.md)
- **Frontend SDK Client Standards:** [docs/frontend-sdk.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/frontend-sdk.md)
- **Issue Tracking & Scratch Notes:** `.scratch/` (see [docs/agents/issue-tracker.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/agents/issue-tracker.md))
- **Triage & Label Vocabulary:** [docs/agents/triage-labels.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/docs/agents/triage-labels.md)
- **Prototype Workspace (`prototypes/new-auto-proposal`):** [prototypes/new-auto-proposal/AGENTS.md](file:///c:/Users/syedm/Desktop/Muneer%20Work/TechieMaya%20AI%20Fullstack%20Developer%20Intern/lad-feature-auto-proposal/prototypes/new-auto-proposal/AGENTS.md) — consult when working in `prototypes/new-auto-proposal/` for its dedicated architecture, guardrails, and roadmap.

