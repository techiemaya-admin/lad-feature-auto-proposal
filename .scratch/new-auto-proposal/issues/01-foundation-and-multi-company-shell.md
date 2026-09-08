# 01: Foundation and Multi-Company Shell

**What to build:** A self-contained full-stack prototype workspace featuring an Express + TypeScript backend with SQLite persistence, and a React + Vite + Shadcn UI frontend shell. The tenant can switch between three company profile tabs (`co1_seo` Northstar Digital, `co2_msp` Fortress IT Group, and `co3_dev` Fieldstone Studio), click an "Import Settings" button that pre-populates company details and pre-fills an editable natural-language `pricing_engine_spec` textarea, view the raw company JSON in a collapsible reviewer dropdown, and have all profile and spec modifications persist per company across tab switches and server restarts.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Initialize Express + TypeScript backend in `prototypes/new-auto-proposal/backend` with `tsx watch`, CORS, JSON body parser, and health check route.
- [x] Set up SQLite database (using `node:sqlite`) and create company sessions schema to persist profile data, pricing specs, and working state per company ID.
- [x] Implement backend API endpoints: `GET /api/companies` (list all tabs), `POST /api/companies/:id/import` (re-seed from `companies_dataset.json`), and `PUT /api/companies/:id/profile` (persist user edits to profile and pricing spec).
- [x] Build multi-tab company switcher in `prototypes/new-auto-proposal/frontend` (Tabs for Northstar, Fortress, Fieldstone).
- [x] Build company profile card with an "Import Settings" button that pre-fills company basics and an editable `pricing_engine_spec` textarea.
- [x] Add collapsible Reviewer Dropdown accordion displaying the raw JSON of the active company profile.
- [x] Verify tab switching preserves edits in SQLite without losing state, and an explicit "Reset to Default" button re-seeds that company.
