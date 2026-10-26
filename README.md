# Rush Away – Auto-Proposal & Dynamic Pricing Backend

Multi-tenant Node.js + Express backend powering dynamic price calculation, automated quotation generation, and AI-driven client proposal workflows following LAD architecture standards.

---

## Quick Start

### 1. Configure Environment
Copy the example environment file and configure your database and service credentials:
```bash
cp .env.example .env
```

### 2. Install Dependencies
Requires **Node.js 22.12 or newer** (see `.nvmrc`); Puppeteer 25 is ESM-only and is loaded with `require()`, which older Node versions do not support.
```bash
npm install
```

**Run the service as a non-root user.** Proposal PDFs are rendered in headless Chrome with its sandbox enabled, and Chrome cannot sandbox itself as root: as root, PDF rendering fails with a clear error. In containers, add a non-root `USER` (and keep the default seccomp profile, which allows the user namespaces Chrome needs). `PUPPETEER_DISABLE_SANDBOX=true` is a logged, last-resort opt-out.

### 3. Database Setup
Ensure PostgreSQL is running with the database specified in `.env` (default: `lad_dev`).

`DB_PASSWORD` and `JWT_SECRET` (32+ characters) are required; the server refuses to start without them.

### Authentication

Every `/api/*` route requires `Authorization: Bearer <JWT>`, except the two endpoints Google calls (`POST /api/gmail/webhook`, `GET /api/social-integration/email/google/callback`). The token must carry `tenantId` and `userId` (or `id`). The tenant is taken only from the token: `X-Tenant-Id` and any `:tenantId` in a URL must match it or the request gets `403`. Creating and listing tenants requires `roles: ["platform_admin"]`. See `docs/api.md`.

```bash
# Run database migrations
npm run migration:run
```

### 4. Start the Application
```bash
# Development mode (with nodemon):
npm run dev

# Production mode:
npm start
```

### 5. Running Tests & Quality Checks
```bash
npm test         # Run unit tests
npm run lint     # Lint source code
```

---

## Project Structure

```
lad-feature-auto-proposal/
├── CONTEXT.md               # Canonical domain glossary
├── docs/                    # Central project documentation
│   ├── adr/                 # Architecture Decision Records
│   ├── agents/              # Agent guidelines & triage roles
│   ├── api.md               # Complete API reference & curl examples
│   ├── architecture.md      # LAD architecture & multi-tenancy rules
│   └── frontend-sdk.md      # Client SDK-first integration guide
├── migrations/              # TypeORM database migrations
├── src/
│   ├── config/              # Database & service configurations
│   ├── middleware/          # Auth, tenant context & validation middleware
│   ├── utils/               # Centralized logger & helper utilities
│   ├── features/
│   │   └── auto-proposal/   # Auto-proposal core feature module
│   │       ├── controllers/ # HTTP parsing & orchestration
│   │       ├── services/    # Business logic & AI pipelines
│   │       ├── repositories/# TypeORM data access & tenant scoping
│   │       ├── routes/      # Express route definitions
│   │       └── dtos/        # Request & response data transfer shapes
│   ├── app.js               # Express application initialization
│   └── index.js             # Application entry point
├── package.json             # Root dependencies & scripts
└── README.md                # This file
```

---

## Documentation Index

- 📖 **[Domain Glossary](CONTEXT.md)**: Canonical domain terms and vocabulary boundaries.
- 🚀 **[API Reference](docs/api.md)**: All 20 mounted endpoint groups with request/response payloads and `curl` examples.
- 🏗️ **[Architecture Guidelines](docs/architecture.md)**: Multi-tenancy enforcement, clean layering, database schema rules, and AI pipelines.
- 💻 **[Frontend SDK Guide](docs/frontend-sdk.md)**: SDK-first integration guide for web applications and client consumers.
- 📋 **[Architecture Decision Records](docs/adr/)**: Architectural decisions on data access, tenancy scoping, and module packaging.
- 🤖 **[Agent Guidelines](docs/agents/)**: Agent conventions, issue tracking, and triage labels.
