# Template Library & Email Routing

Paths relative to repo root. UI entry: `frontend/src/components/templates/TemplateLibraryView.tsx`; workspace: `frontend/src/App.tsx`. Backend: `backend/src/routes/templates.ts`, `backend/src/services/template-ideas.service.ts`, `email-routing.service.ts`, `template-storage.ts`.

## 1. What it is

The company-scoped entry point that sits in front of the 5-stage pipeline ([architecture.md](../architecture.md)). A company owns up to **seven** saved templates; each template is a named record (name + description + pricing brief) that later gains a quotation, variables, a generated Word template, pricing rules, and proposals. Creating a record generates no document — the existing workflow inside the workspace does that.

```
Company (profile in company_sessions; voice/inbox in company_configurations)
├── Template A (proposal_templates row: name, description, pricing_spec, quotation_*, briefing_locked, working_state_json)
│   ├── company_variables WHERE company_id + template_id
│   └── backend/storage/<company>/<template>/ (original_quotation.docx, template.docx, proposal.docx/pdf)
└── Template B … (max 7 via these APIs)
```

One editable lead email per company is persisted in `mock_email_routes` with an optional assignment to one owned template. Routing chooses relevance, not readiness — assigning an email never completes template setup.

## 2. User journey

- **Startup:** company tabs load; the first company's template list loads; the library opens (no auto-open of a remembered template). Loading and error states are explicit; errors offer retry and the list is reloaded (the server may have committed before the response was lost).
- **Empty library:** welcome panel with the company name + large **Import ICP data**. While generating: three pulsing skeleton cards + status text. On success: three cards (name + description). On failure: error + retry.
- **Import ICP data:** the server loads that company's profile from `Mock Data/companies_dataset.json` plus dev pricing context from `Mock Data/test_seeds.json`, asks the configured AI for exactly three distinct briefs (name + one-sentence description ≤160 chars ideally + actionable pricing brief), validates (three entries, distinct names, length limits), and commits transactionally. Requires an empty library; concurrent duplicate imports are rejected (409). Not append/regenerate.
- **Open a card:** opens the keyed workspace with the saved brief prefilled; normal upload/generate flow follows. **All templates** returns (unsaved edits confirmed via shared `ConfirmDialog`; saved work is kept). Company switching from a workspace warns the same way.
- **Custom template:** dialog for name (1–100) + description (1–1000) + pricing brief (1–20,000), all required; creates the row, refreshes, opens its workspace. No AI call.
- **Rename:** name-only `PATCH` exists at the API; the card UI does not expose it.
- **Delete:** per-card labeled button + destructive `ConfirmDialog`. Removes `original_quotation.docx`, `template.docx`, `proposal.docx/pdf` and the row; variables cascade; the assigned email is retained but unassigned with a re-routing notice; logs are kept. Frees a capacity slot. Deleting all cards returns to the import-only state.
- **Capacity:** `N of 7` counter; creation disabled/rejected at seven (409). The limit is enforced in service code, not a DB CHECK — direct SQL can bypass it. Pre-existing rows above the limit are not trimmed.

## 3. Saved-email routing and editing

- **Check a lead email** panel (below the grid, once templates exist) starts from the saved company email. **Check** saves pending edits first, then routes the saved text against all company templates (id + name + description + brief). The AI returns one exact candidate ID + short reason, or null (no fit / equal fits). The backend validates the ID against the candidate set and caps the reason at 500 chars. Success is a real SQLite assignment; the card highlights; **Open template** jumps in. Re-check may replace the assignment; a no-match result clears it; provider failure keeps the last good assignment.
- **Editable message:** textarea up to 12,000 chars. Saving changed text clears the assignment and bumps `version`; saving unchanged text preserves it. Stale `version` → 409. No history — one message per company; browser edits are not auto-persisted.
- **Manual override:** closed disclosure to pick a template without AI. No-match/progress states are explicit (no stuck spinners).
- **Stage 5 prefill** order for the opened template: assigned email for that company+template → dev `sample_lead_text` → empty. Editing the Stage 5 textarea does not write back to the routing record.
- **Mock inbox vs mock lead data:** Connect/Disconnect persists only the company profile address + flag + timestamp in `company_configurations`. No Gmail/Outlook auth, no mailbox reads, no sending. The three default messages (Bloom & Co / Whitfield / Rosewood) come from `test_seeds.json`, independent of the flag.

## 4. API

Base: `/api/companies/:companyId/templates`. Management paths mount before generic `:templateId` workflow routes (otherwise `import-icp` reads as a template ID).

| Method / path | Request | Response |
|---|---|---|
| `GET /` | — | 200 `{ success, templates }` (`template_id`, `name`, `description`, `pricing_spec`, `updated_at`; creation order) |
| `POST /import-icp` | — | 201 `{ success, templates }` (exactly 3) |
| `POST /` | `{ name, description, pricing_spec }` | 201 (created + formatted workflow) |
| `GET /:templateId` | — | 200 combined workflow (`formatCompanyResponse`) |
| `PATCH /:templateId` | `{ name }` | 200 (name + timestamp only) |
| `DELETE /:templateId` | — | 200 `{ success: true }` |
| `POST /:templateId/reset` | — | 200 (mock pricing restored; quotation kept; downstream cleared; unlocked) |
| `GET /mock-email` | — | `{ success, email, routing }` (lazily seeds from `test_seeds.json`) |
| `PUT /mock-email` | `{ email, version }` | `{ success, routing }` |
| `POST /route-email` | — | `{ success, routing }` (AI routes saved email) |
| `PUT /route-email` | `{ template_id }` | `{ success, routing }` (manual assign) |

`routing` = `{ company_id, email_id, email, template_id|null, reason, source: unassigned|ai|manual, routed_at, version }`. Errors: 400 validation, 404 unknown company/template/email, 409 busy / not-empty / stale / capacity / empty candidates, 502 model/provider or invalid AI output, 500 unexpected.

## 5. Persistence

- `proposal_templates`: `template_id` (UUID; legacy migrated rows `default-<company_id>`), `company_id` FK cascade, `name`, `description TEXT DEFAULT ''`, `pricing_spec`, `quotation_filename/filesize/markdown/parsed_at`, `briefing_locked`, `working_state_json` (`stage`, `template_stats` incl. tier matrix, `pricing_rules`, `sample_review_notes`), timestamps. Fresh databases seed companies with an **empty** library (no default templates); legacy databases migrate one `Default template` per company once (`templates-migration.ts`).
- `company_variables`: `template_id` FK cascade + ownership triggers (`Variable requires a template belonging to its company`); all workflow queries scope `WHERE company_id + template_id`.
- `mock_email_routes`: one row per company (`company_id` PK), `email_id` (`mock-<company>`), `email`, nullable `template_id` FK (cross-company rejected by triggers; delete sets NULL + notice), `reason`, `source`, `routed_at`, `version`. No history table.
- Files: `backend/storage/<company>/<template>/`; logs: `backend/logs/<company>/<template>/`. Write serialization is a per-template in-process guard (409 when busy), not a distributed lock.

## 6. Verification

- Backend: `npm test` in `backend/` (includes `template-ideas.test.ts`, `email-routing.test.ts`, `templates.test.ts`); `npm run typecheck`; live AI quality is `npm run test:live` only.
- Manual: fresh company → empty welcome → Import (3 skeletons → 3 cards) → reload persists → open card (brief prefilled) → All templates → custom create → fill to 7 (blocked) → delete one (slot frees) → edit email, Check, open assigned template (Stage 5 prefilled) → reassign manually → delete assigned template (email kept, unassigned) → switch companies (isolation).
- Limitations: import empty-library-only; no import-progress job (reload loses skeleton state; 409 until import finishes); process-local import lock; no description edit UI; no inbox integration; no per-lead proposal archive (Stage 5 files overwritten per generate); a template can be assigned before it is configured, but generation still requires the configured workflow.
