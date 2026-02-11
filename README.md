# Rush Away – Quotation & Pricing System

Node.js + Express backend. Multi-tenant quotation and pricing system with PostgreSQL and TypeORM.

## Tech stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** TypeORM (plain JavaScript, EntitySchema)
- **Language:** JavaScript only (no TypeScript)

## Setup

1. Copy env and set DB credentials:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start PostgreSQL and ensure DB `lad_dev` exists (or set `DB_NAME` in `.env`).
4. Run the app:
   ```bash
   npm run dev
   ```
   In development, TypeORM will create/update tables (`synchronize: true`). For production, use migrations and set `synchronize: false`.

5. Run tests (optional):
   ```bash
   npm test
   ```
   Tests use Jest and mocks for repositories (no DB required for unit tests).

## API

All tenant-scoped APIs require header: `X-Tenant-Id: <tenant-uuid>` (except tenants).

- **Health:** `GET /health`
- **Tenants:** `POST /api/tenants`, `GET /api/tenants`, `GET /api/tenants/:id`
- **Locations:** `POST /api/locations`, `GET /api/locations`, `GET /api/locations/:id` (X-Tenant-Id)
- **Concepts:** `POST /api/concepts`, `GET /api/concepts`, `GET /api/concepts?location_id=...`, `GET /api/concepts/:id`, `POST /api/concepts/:conceptId/locations/:locationId`, `POST /api/concepts/:id/pricing` (body: `base_price`, optional `min_quantity`, `unit`, `location_multiplier`) (X-Tenant-Id)
- **Leads:** `POST /api/leads`, `GET /api/leads`, `GET /api/leads/:id` (X-Tenant-Id)
- **Pricing:** `POST /api/pricing/calculate` (body: `concept_id`, optional `location_id`, `quantity`, `lead_requirement_id`), `POST /api/pricing/rules` (body: `name`, `rule_type`, optional `parameters`, `evaluation_order`, `is_active`) (X-Tenant-Id)
- **Quotations:** `POST /api/quotations/generate` (body: `lead_requirement_id`, `concept_id`, optional `quantity`, `quotation_template_metadata_id`), `GET /api/quotations/lead/:leadId`, `GET /api/quotations/:id` (X-Tenant-Id)
- **Quotation templates:** `POST /api/quotation-templates` (body: `name`, optional `template_key`, `structure`, `is_default`), `GET /api/quotation-templates`, `GET /api/quotation-templates/:id`, `PATCH /api/quotation-templates/:id/default` (X-Tenant-Id)

## Example flows

1. **Create lead:** Create tenant → create location → create lead with `location_id`.
2. **Generate quotation:** Create concept, link to location (ConceptLocation), add ConceptPricingMatrix row, optionally add PricingRule. Then `POST /api/quotations/generate` with `lead_requirement_id` and `concept_id`.
3. **Calculate pricing only:** `POST /api/pricing/calculate` with `concept_id`, `location_id`, `quantity`.

## Project structure

- `src/config/` – DataSource, base columns
- `src/middleware/` – Tenant context (X-Tenant-Id)
- `src/features/**/entities/` – TypeORM EntitySchema (Tenant, Location, Concept, etc.)
- `src/features/**/repositories/` – DB access only
- `src/features/**/services/` – Business logic (including `pricing-engine.service.js`)
- `src/features/**/controllers/` – HTTP handlers
- `src/features/**/dtos/` – Request/response shapes
- `src/features/**/modules/` – Feature routers
