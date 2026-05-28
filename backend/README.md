# Backend - LAD Multi-Tenant Architecture

## Overview
The backend handles all API requests, business logic, and database operations following LAD (multi-tenant architecture) standards.

## Folder Structure

```
backend/
├── src/
│   ├── config/              # Configuration files (database, environment)
│   │   ├── data-source.js   # TypeORM DataSource configuration
│   │   └── base-columns.js  # Shared column definitions for all tables
│   │
│   ├── features/            # Feature-scoped modules (multi-tenant features)
│   │   ├── concept/
│   │   │   ├── controllers/      # HTTP request handlers - validation + orchestration only
│   │   │   ├── services/         # Business logic - NEVER contains SQL
│   │   │   ├── repositories/     # Data access layer - SQL queries only
│   │   │   ├── dtos/             # Data Transfer Objects - request/response mapping
│   │   │   ├── entities/         # TypeORM entity schemas
│   │   │   ├── validators/       # Input validation functions
│   │   │   ├── constants/        # Enums and static values
│   │   │   ├── utils/            # Feature-specific utilities
│   │   │   ├── middleware/       # Feature-specific middleware
│   │   │   ├── routes/           # Route definitions
│   │   │   ├── modules/          # Feature module exports
│   │   │   └── README.md
│   │   │
│   │   ├── lead/            # Lead management feature
│   │   ├── location/        # Location management feature
│   │   ├── pricing/         # Pricing calculation feature
│   │   ├── quotation/       # Quotation generation feature
│   │   ├── quotation-template/  # Quotation templates feature
│   │   └── tenant/          # Tenant management feature (root aggregate)
│   │
│   ├── migrations/          # Database migration files (TypeORM)
│   │   └── *.js            # Migration scripts
│   │
│   ├── middleware/          # Global middleware (cross-feature)
│   │   ├── tenant-context.js    # Tenant extraction from request headers
│   │   ├── validate.js          # Global request validation
│   │   └── __tests__/           # Middleware tests
│   │
│   ├── core/                # Shared infrastructure (NOT feature-specific)
│   │   └── shared/          # Shared across all features
│   │       ├── logger.js        # Centralized logging (no console.log)
│   │       ├── auth.js          # RBAC, capability checking
│   │       ├── db-helpers.js    # Database utility functions
│   │       └── error-handler.js # Error handling patterns
│   │
│   ├── utils/               # Shared utilities
│   │   └── logger.js        # Centralized logger
│   │
│   ├── app.js               # Express app setup
│   └── index.js             # Server entry point
│
├── package.json             # Node.js dependencies
└── README.md                # This file
```

## Architecture Principles

### 1. **Multi-Tenancy (HARD REQUIREMENT)**
- Every feature table MUST be scoped by `tenant_id`
- Every query MUST include `WHERE tenant_id = $1`
- Tenant context comes from JWT/session (never trust client input)

### 2. **Clean Layering**
- **Controllers:** HTTP parsing, validation, orchestration ONLY
- **Services:** Business logic (NO SQL, NO HTTP)
- **Repositories:** Data access (SQL queries only)
- **DTOs:** Request/response field mapping

### 3. **No Hardcoded Dependencies**
- Database schema resolved dynamically from environment
- Configuration from `.env` or environment variables
- No hardcoded `lad_dev.*` schema names

### 4. **Centralized Logging**
- All logs through `logger.info()`, `logger.warn()`, `logger.error()`
- NO `console.log()`, `console.error()` in production code
- Never log secrets (tokens, passwords, etc.)

### 5. **RBAC + Feature Gating**
- Capabilities: what a user can do (e.g., `billing.view`)
- Tenant features: what the tenant's plan enables (e.g., `voice_agent`)
- Both enforced server-side

## How to Use

### Starting the backend:
```bash
cd backend
npm install
npm run dev
```

### Running migrations:
```bash
npm run migration:run
```

### Feature Structure Example
Each feature follows this pattern:
- **Entity Definition** → `entities/*.js` (TypeORM schema)
- **Repository** → `repositories/*.js` (SQL queries)
- **Service** → `services/*.js` (business logic)
- **DTO** → `dtos/*.js` (request/response mapping)
- **Controller** → `controllers/*.js` (HTTP handlers)
- **Routes** → `routes/index.js` (endpoint definitions)
- **Module** → `modules/*.js` (feature initialization)

## Key Files

- [src/config/data-source.js](src/config/data-source.js) - Database configuration
- [src/middleware/tenant-context.js](src/middleware/tenant-context.js) - Tenant extraction
- [src/utils/logger.js](src/utils/logger.js) - Logging utility
- [src/app.js](src/app.js) - Express app setup

## Testing

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
```

## Deployment

1. Ensure all migrations are run
2. Set environment variables in production (.env or via platform)
3. Use `NODE_ENV=production` to disable `synchronize` and enable migrations
4. Use centralized logging system suitable for production

## Compliance

✅ LAD Multi-Tenant Architecture Compliant
✅ Clean Separation of Concerns
✅ No Hardcoded Dependencies
✅ Centralized Logging
✅ RBAC + Feature Gating Ready
