# Rush Away – Quotation & Pricing System

Node.js + Express backend. Multi-tenant quotation and pricing system with PostgreSQL and TypeORM following LAD architecture guidelines.

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** TypeORM (plain JavaScript, EntitySchema)
- **Language:** JavaScript only (CommonJS)

---

## Setup & Running

### 1. Configure Environment
Copy the example environment file and configure your database & service credentials:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
Start PostgreSQL and ensure the database `lad_dev` exists (or matches `DB_NAME` in `.env`).

### 4. Run the Application
```bash
# Development mode with hot-reloading:
npm run dev

# Production mode:
npm start
```
> **Note:** In development, TypeORM will auto-synchronize schemas (`synchronize: true`). For production, run migrations and set `synchronize: false`.

### 5. Running Migrations
```bash
npm run migration:run
```

### 6. Running Tests & Linting
```bash
npm test              # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint codebase
```

---

## Architecture Principles (LAD Multi-Tenant Standards)

1. **Multi-Tenancy (Strict Requirement):**
   - Every feature table is scoped by `tenant_id`.
   - Every database query must include `WHERE tenant_id = $1`.
   - Tenant context is passed via `X-Tenant-Id: <tenant-uuid>` header (or extracted from auth token).

2. **Clean Layering:**
   - **Controllers:** HTTP parsing, validation, orchestration only (no business logic, no SQL).
   - **Services:** Pure business logic (no direct SQL, no HTTP response handling).
   - **Repositories:** Data access layer only (SQL queries & entity persistence).
   - **DTOs:** Request and response field mapping.

3. **Centralized Logging:**
   - All logs use `src/utils/logger.js` (`logger.info()`, `logger.warn()`, `logger.error()`).
   - No direct `console.log()` in production code.

---

## Project Structure

```
├── .env                     # Environment variables (git-ignored)
├── package.json             # Root dependencies & scripts
├── jest.config.js           # Jest test runner configuration
├── API_LIST.md              # Complete API reference
├── API_CURL_EXAMPLES.md     # Example curl requests
├── migrations/              # TypeORM database migrations
└── src/
    ├── config/              # Database & service configurations
    ├── middleware/          # Global middleware (auth, tenant context, validator)
    ├── utils/               # Shared utilities (logger, pdf generator, gcs uploader)
    ├── features/            # Feature-scoped modules
    │   ├── auto-proposal/   # AI-powered quotation & proposal generation
    │   ├── concept/         # Concept catalog & pricing matrix
    │   ├── lead/            # Lead capture & requirements
    │   ├── location/        # Multi-location management
    │   ├── pricing/         # Pricing rules engine
    │   ├── quotation/       # Quotation generation & templates
    │   └── tenant/          # Multi-tenant root management
    ├── app.js               # Express application initialization
    └── index.js             # Server startup entry point
```

---

## API Overview

All tenant-scoped APIs require the header: `X-Tenant-Id: <tenant-uuid>` (except global tenant registration).

- **Health:** `GET /health`
- **Tenants:** `POST /api/tenants`, `GET /api/tenants`, `GET /api/tenants/:id`
- **Locations:** `POST /api/locations`, `GET /api/locations`, `GET /api/locations/:id`
- **Concepts:** `POST /api/concepts`, `GET /api/concepts`, `GET /api/concepts/:id`, `POST /api/concepts/:id/pricing`
- **Leads:** `POST /api/leads`, `GET /api/leads`, `GET /api/leads/:id`
- **Pricing:** `POST /api/pricing/calculate`, `POST /api/pricing/rules`
- **Quotations:** `POST /api/quotations/generate`, `GET /api/quotations/lead/:leadId`, `GET /api/quotations/:id`
- **Quotation Templates:** `POST /api/quotation-templates`, `GET /api/quotation-templates`, `GET /api/quotation-templates/:id`

For full request/response documentation and curl examples, refer to [API_LIST.md](API_LIST.md) and [API_CURL_EXAMPLES.md](API_CURL_EXAMPLES.md).
