# 07: Ambient Shell — Slide-Over Configuration Drawer and Bottom Dev Dock

**What to build:** The two persistent ambient shell components that decouple peripheral settings and developer diagnostics from the primary generative pipeline:
1. **Slide-Over Configuration Drawer (`ConfigurationSheet.tsx`, "Voice & inbox"):** A slide-over sheet opened from the company context strip (the header is developer-only). Holds the per-company drafter preferences (free-text, not sliders — see decisions below) and a mock inbox link. Persisted per company in SQLite, untouched by pipeline resets and by "Import Settings".
2. **Bottom Developer Dock (`DevDock.tsx`):** Floating corner pill → bottom tray with Profile JSON, Quotation Markdown, Variables JSON, Rule Schema (editable) and **Pipeline Logs** (state snapshot, docxmlater mutation records, on-disk run artifacts).

**Blocked by:** 01: Foundation and Multi-Company Shell

**Status:** completed (2026-09-16)

## Decisions taken during grilling (supersede the original ticket text)

- **Tone sliders dropped.** A formality enum is strictly less expressive than free text and nothing produces a confidence score for a numeric "clarification threshold". The drawer holds three textareas the Stage 5 drafter reads verbatim: `style_notes`, `reference_proposal_text` (a real proposal to learn voice from — few-shot beats sliders), `clarification_notes` (how the clarification email should sound). Empty ⇒ the drafter's built-in default (backend concern, ticket 06).
- **Separate `company_configurations` table with typed columns**, not a JSON column — maps 1:1 onto a `tenant_proposal_settings` table in the real build. FK `ON DELETE CASCADE`; reseed is an upsert so it never fires.
- **Email integration is a mock.** `POST /email/connect` links the profile address, `/disconnect` clears it; the UI shows Connected / Not connected. No SMTP, no webhooks (spec out-of-scope). `ponytail:` comment names the OAuth upgrade path.
- **Explicit Save / Cancel** (not autosave) because the controls are long-form text. Connect/Disconnect act immediately, outside the form. Cancel, Esc and backdrop discard the draft.
- **AI provider/model picker stays in the header** — it is a developer control for testing, not a tenant setting.
- **Logs tab reads the artifacts `pipeline-log.ts` already writes to disk** (`GET /:id/logs`, `/:id/logs/:file`, last 20, path-traversal guarded). Prototype-only; the real build ships structured logs to an observability sink. Token counts deliberately not captured.
- **Text fields capped at 6,000 chars** in the route (they are interpolated into a prompt).

## Checklist

- [x] `npx shadcn add sheet` (base-ui Dialog underneath; focus trap / Esc / scroll-lock for free).
- [x] `company_configurations` table in `database.ts`; `company-config.service.ts` (get / validated patch / mock email link).
- [x] `GET|PUT /api/companies/:id/configurations`, `POST /api/companies/:id/email/connect|disconnect` (`routes/configurations.ts`).
- [x] `GET /api/companies/:id/logs`, `GET /api/companies/:id/logs/:file` (`routes/logs.ts`).
- [x] `ConfigurationSheet.tsx` — three textareas with real placeholders, inbox link card, Save/Cancel footer, per-company reload.
- [x] Entrypoint in the company strip (`CompanyProfileCard.tsx`): solid `Set up voice & inbox` until linked, then outline `Voice & inbox`; the header stays developer-only.
- [x] DevDock: "Pipeline State" → "Pipeline Logs" (compact snapshot + mutation table from `template_stats.details[]` + expandable artifact list); dropped the Raw/Preview toggle that rendered the same `<pre>` twice.
- [x] `configurations.test.ts`: defaults, partial PUT, cross-company isolation, 400 on oversize/wrong type, 404 on unknown company, connect/disconnect, survives `/import`, logs newest-first + traversal refused. `npm test` 61/61.
- [x] Browser smoke (headless Chromium): drawer opens, Save enables on edit, toast, value persists on reopen, Connect → Connected, Logs tab expands an artifact, zero console errors.

## Docs

`docs/design.md` §4.1/§4.2, `docs/plan.md`, `AGENTS.md`/`CLAUDE.md` §2/§4 and `spec.md` updated to the free-text drawer, strip entrypoint and artifact-backed logs tab (approved 2026-09-16).
