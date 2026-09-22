# Multiple templates: feature and implementation guide

Reviewed against the working-tree implementation on **20 September 2026**.

This document explains the multiple-template feature in `prototypes/new-auto-proposal`: its purpose, user behavior, database and file changes, migration, routes, services, frontend integration, tests, and current limitations. Paths below are relative to the prototype unless stated otherwise. Links point to the implementation, not external documentation.

This is a description of the code that exists, including its transitional behavior. It does not assume that every capability described in the older product plans is implemented.

## Contents

1. [Purpose and terminology](#1-purpose-and-terminology)
2. [User workflow](#2-user-workflow)
3. [Ownership and persistence](#3-ownership-and-persistence)
4. [Database schema](#4-database-schema)
5. [Migration and startup](#5-migration-and-startup)
6. [Document and log storage](#6-document-and-log-storage)
7. [Routing and request isolation](#7-routing-and-request-isolation)
8. [API reference](#8-api-reference)
9. [Backend implementation](#9-backend-implementation)
10. [Frontend implementation](#10-frontend-implementation)
11. [State transitions and invalidation](#11-state-transitions-and-invalidation)
12. [Complete change inventory](#12-complete-change-inventory)
13. [Testing and verification](#13-testing-and-verification)
14. [Running and inspecting the feature](#14-running-and-inspecting-the-feature)
15. [Compatibility and known limitations](#15-compatibility-and-known-limitations)

## 1. Purpose and terminology

Previously, a company had one active proposal setup. Its briefing, quotation metadata, and pipeline progress were stored directly in `company_sessions`; its variables were identified only by `company_id`; its documents used fixed filenames in a company directory. Uploading a different proposal and restarting the workflow replaced that setup.

The feature adds a saved **template record** between the company and its workflow:

```text
Company
├── Shared profile and voice/inbox configuration
├── Managed IT template
│   ├── Pricing briefing and original quotation
│   ├── Variables and generated Word template
│   └── Pricing rules and pipeline progress
└── Security audit template
    ├── Pricing briefing and original quotation
    ├── Variables and generated Word template
    └── Pricing rules and pipeline progress
```

Here, “template” has two related meanings:

| Term | Meaning |
| --- | --- |
| Saved proposal template | A named database record containing the complete reusable setup for one kind of proposal. |
| Generated Word template | The `template.docx` file produced by replacing text in an uploaded sample with placeholders. It is one artifact owned by the saved template record. |
| Original quotation | The `.docx` uploaded as the example from which variables and formatting are derived. |
| Company | The shared business profile that can own several template records. |
| Default template | The template created by migration to retain a company's pre-feature setup. |

Creating a saved template does not immediately generate a Word document. The record exists first; uploading a quotation and completing the existing workflow produces the document later.

Downloading two Word files was already possible by replacing the old setup repeatedly. The new capability is retaining both setups inside the application, including the variables and pricing rules needed to reuse them.

The feature uses **manual template selection** and **independent pricing per template**. It does not add automatic lead-to-template matching, shared pricing libraries, template cloning, version history, or the unfinished end-to-end lead simulator.

## 2. User workflow

### 2.1 Initial load

The application loads company summaries, selects the first returned company, and fetches that company's templates. It restores the last explicitly selected template for that company from browser storage if that ID still exists; otherwise it selects the first returned template.

Existing companies receive a `Default template` during the one-time migration. A company with no templates displays an empty workspace with company selection and a New template action.

### 2.2 Create

1. Click **New template**.
2. If a template is already selected, confirm the switch warning about unsaved form edits.
3. Enter a name, such as `Managed IT support`.
4. Click **Create**.
5. The server generates a UUID and inserts an empty template record.
6. The frontend refreshes the list and selects the new record.
7. Enter pricing notes and upload a sample `.docx` for that template.
8. Review variables, generate the Word template, and configure pricing using the existing stages.

Names are trimmed and must be 1–100 characters long. The UI also sets `maxLength={100}`. Names are not unique identifiers; duplicate names are currently allowed. Creating a template does not copy the currently selected template or its pricing.

### 2.3 Select and return later

The selector restores the selected template's persisted workflow. A switch asks for confirmation whenever a template is selected, rather than tracking whether the form is actually dirty.

Saved work persists in SQLite and on disk. Unsaved form contents do not. Switching does not abort an already-started backend request; that operation remains tied to its original template.

### 2.4 Rename

**Rename** opens the name form with the current name. Saving changes the database name and `updated_at`, refreshes the list, and leaves the template ID unchanged. Files and pricing configuration remain attached to the same ID.

### 2.5 Delete

**Delete** requires confirmation. It removes the selected template's two known Word files and deletes its database record. Variable records are deleted through the template foreign key where that constraint is present. Other templates are unaffected.

The frontend selects the first remaining template, or shows the empty state if none remain. Deleting the last template is allowed; it is not automatically recreated on the next restart after migration has completed.

Log artifacts, legacy migration source copies, and the empty template directory are not removed by this action.

### 2.6 Import, Reset, and Edit/Reset are different operations

| Action in the workspace | Pricing briefing afterward | Uploaded quotation afterward | Downstream work afterward |
| --- | --- | --- | --- |
| Briefing Edit/Reset (unlock) | Retained as entered | Retained, including metadata | Variables, generated file, and pricing rules cleared; stage becomes `briefing`. |
| Import | Replaced with the company's mock pricing text | Retained, including metadata | Cleared for this template; briefing unlocked; working state becomes `NULL`. |
| Reset | Same behavior as Import | Retained, including metadata | Same behavior as Import. |
| Delete template | Record removed | The nested original Word file is deleted | Record, generated Word file, and associated variables removed. |

Both Import and Reset now call the selected template's reset endpoint. Both require confirmation in the UI. Their mock pricing comes from the company's entry in `Mock Data/companies_dataset.json`; it is not inferred from the template's name or uploaded document. If the company is absent from that dataset, the reset pricing text is empty.

The company-level profile Import/Reset API still exists separately. It is no longer what these workspace buttons call.

## 3. Ownership and persistence

| Information | Owner and authoritative location |
| --- | --- |
| Name, industry, location, email, website, phone | Company; `company_sessions`. |
| Full business profile, ideal customer, offer details | Company; `company_sessions.data_json`. |
| Voice notes, reference proposal text, clarification notes, mock inbox connection | Company; `company_configurations`. |
| AI provider and model | Application; `app_settings`. Switching templates does not change the model. |
| Template name | Template; `proposal_templates.name`. |
| Pricing briefing | Template; `proposal_templates.pricing_spec`. |
| Quotation filename, byte count, Markdown, parsing time | Template; `proposal_templates.quotation_*`. |
| Briefing lock | Template; `proposal_templates.briefing_locked`. |
| Workflow progress, generated-document statistics, pricing rules | Template; `proposal_templates.working_state_json`. |
| Extracted/custom variables and table-loop descriptors | Template; `company_variables`, filtered by both IDs. |
| Original and generated Word files | Template directory under backend storage. |
| Pipeline debug artifacts | Template directory under the prototype's separate `logs` root. |
| Last selected template | Browser; `localStorage['proposal-template:<companyId>']`. |

The old workflow columns in `company_sessions` have **not** been dropped. They remain for migration and compatibility with the old company API. After migration, workflow routes use `proposal_templates`; they do not keep the old company workflow columns synchronized.

Likewise, the shared `data_json.pricing_engine_spec.pricing_context` may still contain mock or legacy pricing. It is not the selected template's current pricing source. Briefing submission no longer rewrites that shared JSON.

## 4. Database schema

Source: [database.ts](../backend/src/db/database.ts).

### 4.1 `proposal_templates`

```sql
CREATE TABLE IF NOT EXISTS proposal_templates (
  template_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pricing_spec TEXT NOT NULL DEFAULT '',
  quotation_filename TEXT,
  quotation_filesize INTEGER,
  quotation_markdown TEXT,
  quotation_parsed_at TEXT,
  briefing_locked INTEGER NOT NULL DEFAULT 0,
  working_state_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id)
    REFERENCES company_sessions(company_id)
    ON DELETE CASCADE
);
```

`template_id` is globally unique. New records use `crypto.randomUUID()`. Migrated records use the deterministic ID `default-<company_id>`, for example `default-co1_seo`.

The SQL name column only enforces non-null values; the 1–100-character rule is enforced by the management routes. Timestamps are ISO strings for new and updated records. Migration preserves original company timestamps.

`working_state_json` retains the existing state representation instead of creating separate tables for every stage. Relevant keys include:

- `stage`: `briefing`, `variable_review`, `template_checkpoint`, `pricing_engine`, or `lead_simulation` when assigned by a stage operation.
- `briefing_completed_at` and `unlocked_at`, when applicable.
- `extracted_variables`: extraction summary, counts, timestamps, and snapshots.
- `template_generated` and `template_generated_at`.
- `template_stats`: file path, tag/loop/conditional/mutation counts, mutation details, and optional tier-comparison matrix.
- `pricing_rules`: compiled rules, their evaluation and validation/sample-check state, or `null`.

A newly created or reset record has `working_state_json = NULL`; it does not necessarily contain an explicit `stage: 'briefing'` value.

### 4.2 `company_variables`

The existing table gains:

```sql
template_id TEXT,
FOREIGN KEY (template_id)
  REFERENCES proposal_templates(template_id)
  ON DELETE CASCADE
```

Its original company foreign key and variable fields remain. The column is structurally nullable to support adding it to an existing populated table. Migration then backfills old records and installs triggers to reject future null or incorrectly owned values.

Application queries now use:

```sql
WHERE company_id = ? AND template_id = ?
```

Updates of one variable additionally include `id = ?`. The variable ID remains the row's global primary key. Its human-readable or template variable name is not used as the ownership boundary.

### 4.3 Indexes and ownership triggers

| Database object | Definition/purpose |
| --- | --- |
| `idx_templates_company` | Index on `proposal_templates(company_id)` for company template lists. |
| `idx_variables_template_lookup` | Index on `company_variables(company_id, template_id, category, is_deleted)`. |
| `idx_template_owner` | Unique index on `proposal_templates(company_id, template_id)`. |
| `idx_company_variables_lookup` | Existing company/category/deleted index retained. |
| `variable_template_insert` | Before inserting a variable, rejects a null template ID or a template not owned by its company. |
| `variable_template_update` | Performs the same check when a variable's company or template ID is updated. |

The trigger error is `Variable requires a template belonging to its company`.

Two separate foreign keys alone would allow a variable with company A's ID and company B's valid template ID. The triggers enforce that the pair belongs together. They apply to direct SQL writes as well as application writes. They do not add a template-transfer feature or validate changes to the parent template's owner; no owner-change route is provided.

SQLite foreign keys are enabled by `PRAGMA foreign_keys = ON` on the application connection. WAL mode remains enabled.

### 4.4 `schema_migrations`

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY
);
```

The completed migration is recorded as `multiple_templates_v1`. This is a one-time completion marker, not a general migration framework with ordered versions and automatic down migrations.

### 4.5 `template_workflows` view

```sql
CREATE VIEW IF NOT EXISTS template_workflows AS
SELECT
  c.company_name, c.industry, c.location,
  c.email, c.website, c.phone, c.data_json,
  t.*
FROM proposal_templates t
JOIN company_sessions c ON c.company_id = t.company_id;
```

This read-only view combines shared company profile fields with one template's workflow fields. It lets the existing stage routes retain their combined response shape without reading obsolete company workflow state. Writes target the underlying tables, not this view.

The repository also provides `loadWorkflow()`, which achieves the same composition in TypeScript by loading the company and template and returning `{ ...company, ...template }`. Template values override overlapping legacy company workflow fields.

## 5. Migration and startup

Source: [templates-migration.ts](../backend/src/db/templates-migration.ts).

A migration updates an existing database's structure and data. Editing `CREATE TABLE IF NOT EXISTS` alone only helps when a table is absent; it cannot add a column to an existing table.

### 5.1 Startup order

`initDatabase()` now:

1. Resolves the database and storage locations.
2. Opens SQLite and enables WAL and foreign keys.
3. Creates tables and the existing/new initial indexes if absent.
4. Runs the existing company-column upgrades.
5. Seeds companies from the mock dataset if `company_sessions` is empty.
6. Calls `migrateTemplates(db, getStorageDir())`.
7. Creates the `template_workflows` view if absent.
8. Assigns the open connection to the module-level `instance` and returns it.

Assigning `instance = db` also makes later `getDatabase()` calls reuse the explicitly initialized connection. `closeDatabase()` closes that instance and clears it.

### 5.2 Migration algorithm

1. Create `schema_migrations` if needed.
2. Return immediately if `multiple_templates_v1` is already recorded.
3. Start `BEGIN IMMEDIATE`.
4. Inspect `PRAGMA table_info(company_variables)`.
5. If `template_id` is missing, add the nullable column with its template foreign key and cascading delete.
6. Read every company currently present.
7. Validate its ID against `^[a-zA-Z0-9_-]+$` before constructing file paths.
8. `INSERT OR IGNORE` a template named `Default template` with ID `default-<company_id>`.
9. Copy its pricing spec, all quotation metadata fields, briefing lock, workflow JSON, and timestamps from the company row.
10. Assign that default template ID to the company's variables whose `template_id IS NULL`. Already assigned rows are not reassigned.
11. For each existing legacy `original_quotation.docx` and `template.docx`, create the nested destination directory and copy the file if the destination does not already exist.
12. Compare the complete source and destination bytes. A difference throws `Existing migration destination differs from source` instead of overwriting the destination.
13. If saved `template_stats` exists, rewrite its `template_path` to the new nested location, relative to the process working directory with forward slashes.
14. Create the template-variable lookup index, owner index, and ownership triggers.
15. Insert the migration completion marker and commit.
16. On error, roll back the database transaction and rethrow.

### 5.3 What migration preserves

Migration creates defaults for every current company, including seeded companies with no completed workflow. Existing variable IDs, descriptors, prices, state, and document bytes are preserved rather than re-extracted or recalculated.

Legacy source files are **copied, not moved or deleted**. The migration does not copy old company-level log artifacts. It does not update or remove the obsolete workflow fields from company rows.

The completion marker prevents a restart from duplicating defaults or copying old company pricing back over edited template pricing. Deleting a default after migration does not make it reappear automatically.

### 5.4 Failure and compatibility boundaries

The transaction covers database operations only. A failed migration may leave copied destination files behind; it does not roll back filesystem changes. On retry, identical destinations are accepted, and differing destinations cause an error.

Malformed saved workflow JSON can fail the migration because that value is parsed to rewrite its template path. There is no silent fallback that discards it.

If a database was manually modified to contain `template_id` without its foreign key, the migration detects the column and skips `ALTER TABLE`; it does not rebuild the table to repair missing constraints. Such databases need their foreign keys inspected separately. Once the marker exists, this migration also does not recreate missing triggers or indexes on subsequent starts.

There is no automatic full-database backup or downgrade migration. The retained source Word files are not a replacement for a SQLite backup.

## 6. Document and log storage

### 6.1 Before and after

```text
Before:
backend/storage/<company_id>/original_quotation.docx
backend/storage/<company_id>/template.docx

After:
backend/storage/<company_id>/<template_id>/original_quotation.docx
backend/storage/<company_id>/<template_id>/template.docx

Debug artifacts:
logs/<company_id>/<template_id>/<timestamp>-variables-raw.json
logs/<company_id>/<template_id>/<timestamp>-template.md
logs/<company_id>/<template_id>/<timestamp>-rules-raw.json
logs/<company_id>/<template_id>/<timestamp>-rules-repair.json
```

`templateDirectory(companyId, templateId)` validates both IDs and joins them beneath `getStorageDir()`. It does not create the directory itself or check database ownership; middleware/repositories check ownership and the upload/migration/mutator creates directories when needed.

`STORAGE_DIR` still overrides the backend storage root. A relative value is resolved against the current process working directory. `DB_PATH` independently overrides the SQLite location; absent an override, the database is `database.sqlite` in the storage root. Without `STORAGE_DIR`, the source-relative default resolves to `backend/storage`.

Logs use the existing source-relative `LOG_ROOT`, resolving to the prototype's `logs` directory. They do not move when `STORAGE_DIR` changes.

### 6.2 Sample-document fallback

`resolveQuotationPath(companyId, templateId?)` first returns an existing original quotation in the selected directory.

If an explicit non-default template has no original quotation, it throws `Upload a quotation for this template first`. An arbitrary new template cannot silently borrow a company's mock document.

The existing mock-document fallback remains for `default-<companyId>` and legacy direct calls that omit the optional template ID. It maps the three mock company IDs to their original sample documents. Direct calls without a template ID still use the old company-level directory; HTTP generation calls pass a template ID.

### 6.3 Deletion and downloads

Deletion removes only `original_quotation.docx` and `template.docx` in the selected nested folder before deleting the database row. It does not recursively remove arbitrary files, the folder, historical logs, or legacy source copies.

Download reads the selected template's correct file, but the suggested download filename is still `<company_id>_template.docx`. Two templates of one company therefore have the same suggested filename even though their stored paths differ.

## 7. Routing and request isolation

Source: [app.ts](../backend/src/app.ts) and [template-scope.ts](../backend/src/middleware/template-scope.ts).

The common workflow prefix is:

```text
/api/companies/:companyId/templates/:templateId
```

`app.ts` mounts middleware and stage routers in this order:

```ts
app.use(
  workflowPath,
  requireTemplate,
  serializeTemplateWrites,
  briefingRouter,
  variablesRouter,
  templateRouter,
  rulesRouter,
  logsRouter
);
app.use('/api/companies/:companyId/templates', templatesRouter);
```

The workflow routers use `Router({ mergeParams: true })` so they inherit `companyId` and `templateId`. Their local paths are `/variables`, `/briefing/submit`, and so on; they do not repeat the parent IDs.

For individual template management requests, the first mount validates/locks the template, then falls through to the management router when no stage route matches. Collection requests, such as creating a template, do not have a `templateId` and use the collection router directly.

### 7.1 Ownership checks

`requireTemplate` validates the ID character set and verifies the record using both company and template IDs. Invalid IDs, unknown templates, or a template under the wrong company return:

```json
{"success": false, "error": "Template not found for this company"}
```

The status is **404**. This runs before Multer writes an upload. Variable reads/writes additionally filter by the two IDs; individual updates include the variable ID too.

These are resource-ownership checks within the prototype. They do not authenticate a caller or prove that a logged-in user has access to the company in the URL. This feature adds no authentication layer.

### 7.2 Concurrent operations

`serializeTemplateWrites` keeps a process-local `Set` keyed by `<companyId>:<templateId>`.

- GET, HEAD, and OPTIONS bypass the write guard.
- Other methods acquire that template's guard.
- Another operation for the same guarded template returns **409**, rather than queueing.
- Another template can continue independently.
- The guard is released on the response's `finish` event.

Busy response:

```json
{
  "success": false,
  "error": "This template is busy. Wait for the current operation to finish and retry."
}
```

This also guards POST `/rules/calculate`, even though it only evaluates data, because the guard uses HTTP methods rather than inspecting operation semantics. It is an in-process guard, not a database/distributed lock. Its limits are described in section 15.

## 8. API reference

Use these abbreviations only when reading this table:

```text
C = /api/companies/:companyId/templates
T = /api/companies/:companyId/templates/:templateId
```

### 8.1 Template management

| Method and URL | Request | Successful response | Behavior |
| --- | --- | --- | --- |
| GET `C` | None | 200 `{ success, templates }` | Summaries ordered by `created_at`, then `template_id`. |
| POST `C` | JSON `{ "name": "Managed IT" }` | 201 `{ success, company }` | Creates a blank template with server-generated UUID. |
| GET `T` | None | 200 `{ success, company }` | Shared profile plus selected workflow. |
| PATCH `T` | JSON `{ "name": "New name" }` | 200 `{ success, company }` | Changes name and update time only. |
| DELETE `T` | None | 200 `{ "success": true }` | Deletes known nested Word files and the template record. |
| POST `T/reset` | None | 200 `{ success, company }` | Restores mock pricing and clears downstream progress while keeping the original quotation. |

List summary entries contain exactly `template_id`, `name`, and `updated_at`. An empty list is valid. The company must exist, otherwise the management router returns 404 `Company not found`.

Create/rename reject missing, non-string, blank, or overlong names with 400 `Enter a template name of 1–100 characters`.

### 8.2 Combined response compatibility

The management API intentionally returns the selected workflow under `company`, reusing `formatCompanyResponse()` so existing stage components need fewer changes. Conceptually:

```json
{
  "success": true,
  "company": {
    "company_id": "co1_seo",
    "company_name": "Northstar Digital",
    "template_id": "a-server-generated-uuid",
    "template_name": "Managed IT",
    "pricing_spec": "",
    "working_state": null,
    "briefing_locked": false,
    "document_metadata": null,
    "data": { "company_basics": {} }
  }
}
```

This example omits unchanged profile and timestamp fields. `data_json` becomes parsed `data`; `working_state_json` becomes parsed `working_state`; the lock becomes a Boolean. Document metadata is returned when a quotation filename is present. In a composed response, pricing, metadata, and timestamps come from the template row.

`CompanyRow` gains optional `template_id` and `name`; the formatter exposes them as `template_id` and `template_name`. They remain optional because ordinary company responses do not contain a selected template.

### 8.3 Briefing, variables, and document routes

| Method and URL | Input | Output/behavior |
| --- | --- | --- |
| POST `T/briefing/submit` | Multipart `prompt` (or `pricing_spec`) and optional `file` | Parses `.docx`, locks briefing, returns `{ success, message, company, markdown, metadata }`. An existing original may be reused without a new file. |
| POST `T/briefing/unlock` | None | Preserves briefing and original quotation, clears downstream setup, returns combined `company`. |
| GET `T/briefing/markdown` | None | `filename`, `filesize`, `markdown`, `parsed_at`, and `briefing_locked`, plus `success`. |
| GET `T/variables` | None | `{ success, company_id, variables, compound_tables }`. Includes soft-deleted records for review. |
| POST `T/variables/extract` | None | Extracts from this template's Markdown/pricing and shared company profile; returns extraction summary/count and variables/tables. |
| PUT `T/variables` | JSON `{ variables?: [...], compound_tables?: [...] }` | Persists scoped edits, invalidates generated output/rules, returns `{ success, updated_count }`. |
| POST `T/variables/custom` | JSON custom-variable fields | Verifies sample text against this quotation; returns 201 `{ success, variable }`. |
| POST `T/template/generate` | None | Generates this template's Word file; returns path, counts, and mutation `details`. |
| GET `T/template/status` | None | `{ success, exists, template_path, filesize, stats }`. Checks actual file existence and reads saved statistics. |
| GET `T/template/download` | None | Streams the selected `.docx`, or returns 404 if no generated file exists. |

Briefing upload retains the 20 MB limit and `.docx` extension filter. Missing/empty prompt or absent original document is a 400; failed Word-to-Markdown parsing is a 422. Ownership validation precedes disk writes, but prompt validation and parsing occur after Multer saves the uploaded file.

Custom-variable fields are `natural_name`, `exact_quotation_snippet`, optional `category`, `context_anchor`, `data_type`, and `description`. Defaults remain `customer_input` and `string`. The sample must occur in normalized quotation Markdown. A snake-case variable name is derived from the natural name; this is text verification, not an additional Word AST traversal in that route.

Variable/table response shapes largely remain unchanged: the URL supplies template scope, and individual formatted variable responses do not currently expose `template_id`.

### 8.4 Pricing routes

| Method and URL | Input | Output/behavior |
| --- | --- | --- |
| POST `T/rules/compile` | None | Requires parsed Markdown and at least one pricing variable; compiles and persists `{ success, pricing_rules }`; stage becomes `pricing_engine`. |
| GET `T/rules` | None | Returns saved pricing state; 404 if not compiled/saved. |
| PUT `T/rules` | JSON `{ rules }` | Validates against selected variables, evaluates/checks the sample, and persists if structurally valid. |
| POST `T/rules/calculate` | JSON `{ inputs }` | Returns `{ success, evaluation, payload }` using this template's rules and tier matrix. Does not save a generated proposal. |
| POST `T/rules/proceed` | None | Requires saved rules without structural validation errors; sets stage to `lead_simulation` and returns combined `company`. |

Invalid PUT structure returns 400 with `errors[{path,message}]` and does not persist. Compile retains the existing one-repair-attempt behavior. Proceed checks structural errors; it does not require every sample comparison to match. The calculator still performs all arithmetic in JavaScript.

### 8.5 Logs and unchanged routes

GET `T/logs` lists up to 20 artifacts, newest filename first, with `file`, `kind`, `logged_at`, and `size`. Only files with accepted basenames are listed. GET `T/logs/:file` returns artifact text. Path separators and `.`/`..` artifact names are rejected. Missing directories yield an empty list; missing artifacts yield 404.

Company list/detail/profile/import/reset, company configurations, inbox connect/disconnect, health checks, and `/api/settings/ai` retain their company/application-level URLs. The old company-only briefing/variables/template/rules/log URLs are replaced rather than redirected.

## 9. Backend implementation

### 9.1 Template repository

[templates.repository.ts](../backend/src/repositories/templates.repository.ts) introduces `TemplateRow` and these functions:

| Function | Responsibility |
| --- | --- |
| `listTemplates(companyId)` | Query this company's templates in stable creation order. |
| `loadTemplate(companyId, templateId)` | Fetch a template only within its company. |
| `loadWorkflow(companyId, templateId)` | Compose shared profile and template state; return undefined if either is absent. |
| `insertTemplate(companyId, templateId, name)` | Insert the name, IDs, and timestamps; SQL defaults initialize other fields. |
| `renameTemplate(companyId, templateId, name)` | Update name and timestamp. |
| `deleteTemplate(companyId, templateId)` | Delete the scoped database record. |
| `companyExists(companyId)` | Validate the collection's parent company. |
| `saveWorkflowState(companyId, templateId, state)` | Serialize and update selected workflow JSON and timestamp. |
| `resetTemplateState(companyId, templateId, spec)` | Transactionally delete its variables and reset pricing/lock/state. |

Queries bind values through placeholders. File operations live in the storage service, not the repository. This is a focused repository introduction; it does not refactor all existing route-level SQL into repositories.

### 9.2 Storage and reset service

[template-storage.ts](../backend/src/services/template-storage.ts) contains four operations:

- `templateDirectory`: validate IDs and derive the selected directory.
- `invalidateTemplate`: load state; set stage to `variable_review`, generated flag to false, statistics and pricing rules to null; save state; remove its generated Word file if present. It preserves unrelated keys, including any older generation timestamp.
- `removeProposalTemplate`: remove the two known Word files, then delete the record.
- `resetProposalTemplate`: look up mock pricing, invalidate the generated result, then call the transactional database reset. Quotation metadata and original file remain.

The reset database transaction does not include the earlier filesystem invalidation. Deletion likewise spans filesystem and database operations without a shared atomic transaction.

### 9.3 Briefing

[briefing.ts](../backend/src/routes/briefing.ts) now reads `template_workflows`, writes `proposal_templates`, and passes both IDs to every workflow query. Multer writes into the selected nested folder.

After successful parsing, submission invalidates old generated output, deletes all variables for this template (including custom ones), and initializes a new `variable_review` state. Re-scanning variables separately preserves custom variables; submitting a new briefing does not.

Unlock deletes only the selected template's variables and generated file, preserves its prompt/document, sets `briefing_locked = 0`, and saves the reset state. The shared company profile JSON is no longer rewritten during briefing submission.

### 9.4 Variables

[variables.ts](../backend/src/routes/variables.ts) carries template scope through listing, extraction, normal-variable inserts, table-loop inserts, custom inserts, inline updates, soft deletion, active-variable reloads, and state persistence.

Extraction still delegates to the configured AI provider using quotation Markdown, pricing notes, company name, profile basics, and industry. It logs the result under the selected template, preserves custom rows, replaces non-custom rows, and clears stale template/rules state.

Editing variables or adding a custom variable now calls backend invalidation. Previously hiding the generated card in React alone could leave an old document or pricing state available after reload.

The original category/data-type checks, descriptors, sorting, soft-deletion behavior, and response structures remain. Variable updates retain the pre-existing per-item loop and `updated_count` behavior; see section 15 for its limits.

### 9.5 Word template generation

[template.ts](../backend/src/routes/template.ts) passes the selected template ID into the mutator, scopes status/download paths, and saves generation statistics on the template record.

[template-mutator.service.ts](../backend/src/services/template-mutator.service.ts) now:

- Accepts optional template scope in `resolveQuotationPath`.
- Accepts `templateId = default-<companyId>` in `mutateDocumentTemplate` for existing direct callers/tests.
- Reads only this template's active variables.
- Writes the generated file beside this template's original quotation.

The longest-text-first matching, loops, conditional rows, paragraph handling, tier-matrix tagging, mutation reporting, and `easy-template-x` hydration algorithm are unchanged. Generation still sets `template_checkpoint`, saves counts/details/matrix, and clears pricing rules. Markdown artifact conversion runs asynchronously after the Word file is written and does not block the response.

### 9.6 Pricing compilation and calculation

[pricing-compiler.service.ts](../backend/src/services/pricing-compiler.service.ts) changes `loadCompany(companyId, templateId = default-<companyId>)` to call `loadWorkflow()`. Despite its old name, the helper now returns a template-scoped combined workflow.

`loadStage2Context(companyId, templateId = default-<companyId>)` filters variables by both IDs. Compiler inputs therefore combine the shared profile with the selected template's briefing, quotation, variables, and generation statistics. Raw and repair logs include the template directory.

[rules.ts](../backend/src/routes/rules.ts) reads/writes `working_state_json.pricing_rules` on `proposal_templates`. All compile, fetch, edit, calculate, and proceed operations use the selected scope.

`pricing-calculator.ts`, the rule schema, benchmark formulas, and AI provider implementations were not redesigned for multiple templates. Different templates produce different calculations because their saved rule inputs differ, not because there is a new calculator per template.

### 9.7 Company compatibility and logging

[companies.ts](../backend/src/routes/companies.ts) gains optional template fields in its row type and formatter. Its company endpoints remain.

[seed.ts](../backend/src/db/seed.ts) changes reset cleanup to delete only variables with `template_id IS NULL`. Company reseeding therefore does not wipe valid template-owned variables. The existing company row reseed and legacy company-level file cleanup remain separate from template reset.

[pipeline-log.ts](../backend/src/services/pipeline-log.ts) adds an optional fourth `templateId` argument. Scoped callers write into nested directories; omitted scope retains the old company-level behavior. Timestamp naming and best-effort logging remain unchanged.

[logs.ts](../backend/src/routes/logs.ts) inherits scope, reads only that template's directory, filters out directories when listing artifacts, and explicitly rejects `.` and `..` file names.

## 10. Frontend implementation

### 10.1 Entry point and outer application

[main.tsx](../frontend/src/main.tsx) now renders [TemplatesApp.tsx](../frontend/src/TemplatesApp.tsx), still within the existing StrictMode and ThemeProvider.

`TemplatesApp` owns company/template selection, list loading, management form mode/name, busy state, and management errors. It calls the management API for create/rename/delete and refreshes the list afterward. Loading effects use an `alive` flag so obsolete list results do not replace newer state.

Its remembered-selection key is `proposal-template:<companyId>`. Only the ID is stored there; documents and pricing are not stored in the browser. It validates a remembered ID against the latest list before using it. The company itself is not remembered by this feature; initial load starts at the first returned company.

The selected workflow is mounted as:

```tsx
<TemplateWorkspace
  key={`${companyId}:${templateId}`}
  activeCompanyId={companyId}
  templateId={templateId}
  templateControls={controls}
  onCompanyChange={...}
/>
```

Changing either ID unmounts the old workspace and mounts a new one. This separates its local variables, document preview, rule editor, notifications, and in-flight callback targets. This is UI isolation, not cancellation of server work.

### 10.2 Existing application becomes a workspace

[App.tsx](../frontend/src/App.tsx) now exports `TemplateWorkspace` rather than owning the entire selection lifecycle. Its props are `activeCompanyId`, `templateId`, `onCompanyChange`, and `templateControls`.

It fetches `fetchProposalTemplate()` instead of `fetchCompany()` for workflow state. It passes the template ID for briefing submission/unlock, document generation/status, pricing compilation, and proceeding to simulation. The controls render above the existing workspace content.

Import and Reset now call `resetProposalTemplate()`. The obsolete `handleSaveSpec` that wrote template pricing through company profile updates was removed, together with the unused `onSaveSpec` component prop. Shared configuration loading and the Voice & inbox drawer still use the company ID alone.

### 10.3 Components

| Component | Change |
| --- | --- |
| `CompanyProfileCard.tsx` | Passes `company.template_id` to variable, checkpoint, and pricing decks; removes unused save-spec prop; scopes reset/import confirmations to the selected template. |
| `VariableReviewDeck.tsx` | Requires `templateId`; passes it to fetch, extract, update, and custom-variable API calls; includes it in relevant effect/callback dependencies. |
| `TemplateCheckpointCard.tsx` | Requires `templateId`; uses it for preview blob and download URL, and related reload dependencies. |
| `pricing/PricingEngineDeck.tsx` | Requires `templateId`; sends it with rule updates; includes it in the autosave dependency list. |
| `DevDock.tsx` | Uses selected template ID for rule JSON saves, artifact lists, and artifact text reads. |
| `ConfigurationSheet.tsx` | No template ownership change; remains shared per company. |

Pricing edits retain their 300 ms debounce. Effect cleanup clears a pending timer. A save already dispatched can still complete for its original template. Switching confirmation explains that unsaved edits can be discarded; it is not a flush-all-edits-before-switch mechanism.

### 10.4 Types and API helpers

[types/company.ts](../frontend/src/types/company.ts) adds optional `template_id` and `template_name` to `Company`. Most stage components continue using the existing combined `Company` type. A complete rename to separate `CompanyProfile` and `TemplateWorkflow` types was not undertaken.

[services/api.ts](../frontend/src/services/api.ts) adds:

```ts
interface ProposalTemplateSummary {
  template_id: string;
  name: string;
  updated_at: string;
}

listTemplates(companyId)
fetchProposalTemplate(companyId, templateId)
createProposalTemplate(companyId, name)
renameProposalTemplate(companyId, templateId, name)
deleteProposalTemplate(companyId, templateId)
resetProposalTemplate(companyId, templateId)
```

Management helpers share `templateRequest()`, encode company/template path segments, parse the JSON response, and throw its error message on failure.

Every existing workflow helper now accepts explicit template scope. The actual argument order is:

```ts
submitBriefing(companyId, prompt, file, templateId)
unlockBriefing(companyId, templateId)
fetchQuotationMarkdown(companyId, templateId)
fetchVariables(companyId, templateId)
extractVariables(companyId, templateId)
updateVariables(companyId, payload, templateId)
addCustomVariable(companyId, payload, templateId)
generateTemplate(companyId, templateId)
fetchTemplateStatus(companyId, templateId)
fetchTemplateBlob(companyId, templateId)
getTemplateDownloadUrl(companyId, templateId)
compilePricingRules(companyId, templateId)
fetchPricingRules(companyId, templateId)
updatePricingRules(companyId, rules, templateId)
calculatePricing(companyId, inputs, templateId)
proceedToLeadSimulation(companyId, templateId)
fetchLogArtifacts(companyId, templateId)
fetchLogArtifact(companyId, file, templateId)
```

The briefing file argument now permits `File | null | undefined` explicitly before the required template ID. Company profile/configuration and AI settings helpers retain their original scope.

`RulesValidationError` also changed from a TypeScript constructor parameter property to an explicit `errors` field assigned in the constructor, satisfying the frontend compiler's `erasableSyntaxOnly` restriction. Its runtime validation-error behavior is unchanged.

## 11. State transitions and invalidation

| Operation | Selected-template result | Other templates |
| --- | --- | --- |
| Create | Empty pricing, unlocked briefing, null metadata/state; no files yet. | Unchanged. |
| Submit briefing | Save parsed quotation and pricing; delete previous variables; clear generated output/rules; lock briefing; `variable_review`. | Unchanged. |
| Extract/re-scan variables | Preserve custom rows, replace extracted rows; invalidate document/rules; save extraction snapshot; `variable_review`. | Unchanged. |
| Edit/soft-delete/add variable | Persist edit; delete generated file; clear statistics/rules; `variable_review`. | Unchanged. |
| Generate document | Save Word file and statistics; clear pricing rules; `template_checkpoint`. | Unchanged. |
| Compile rules | Save compiled state and sample checks; `pricing_engine`. | Unchanged. |
| Edit rules | Save valid updated rules and checks; merge into existing working state. | Unchanged. |
| Calculate | Evaluate selected rules and return a payload; no proposal file created by this route. | Unchanged. |
| Proceed | Save `lead_simulation` after structural validation checks. | Unchanged. |
| Unlock | Preserve original and pricing; clear variables/document/rules; `briefing`. | Unchanged. |
| Mock reset/import | Preserve original/metadata; replace pricing; clear variables/document/state; unlock. | Unchanged. |
| Rename | Change name/timestamp only. | Unchanged. |
| Delete | Remove known Word files and template row; cascade variables where FK exists. | Unchanged. |
| Restart | Read persisted records/files; completed migration does not overwrite them. | Persisted independently. |

The five-stage visual sequence remains. This feature does not implement the missing full Stage 5 lead-email extraction, narrative drafting, and downloadable personalized-proposal workflow. The existing hydration helper and calculation endpoint are building blocks, not proof that the complete simulator is available.

## 12. Complete change inventory

### 12.1 New implementation and test files

| File | Purpose |
| --- | --- |
| [backend/src/db/templates-migration.ts](../backend/src/db/templates-migration.ts) | One-time schema/data migration, default template creation, document copying, indexes/triggers, completion marker. |
| [backend/src/middleware/template-scope.ts](../backend/src/middleware/template-scope.ts) | Ownership/ID validation and per-template in-process write guard. |
| [backend/src/repositories/templates.repository.ts](../backend/src/repositories/templates.repository.ts) | Scoped template data access, profile composition, and transactional reset. |
| [backend/src/routes/templates.ts](../backend/src/routes/templates.ts) | List/create/detail/rename/delete/reset management API. |
| [backend/src/services/template-storage.ts](../backend/src/services/template-storage.ts) | Nested paths, downstream invalidation, known-file deletion, and mock reset orchestration. |
| [backend/src/tests/templates.test.ts](../backend/src/tests/templates.test.ts) | Multi-template integration and legacy migration coverage. |
| [frontend/src/TemplatesApp.tsx](../frontend/src/TemplatesApp.tsx) | Template management UI, remembered selection, and keyed workspace lifecycle. |

### 12.2 Modified implementation files

| File | Relevant change |
| --- | --- |
| [backend/src/app.ts](../backend/src/app.ts) | Mount nested workflow/management routes and scope middleware; retain shared routes. |
| [backend/src/db/database.ts](../backend/src/db/database.ts) | New table/column/FK/index, startup migration, combined view, connection singleton assignment. |
| [backend/src/db/seed.ts](../backend/src/db/seed.ts) | Company reset cleanup restricted to unassigned variables. |
| [backend/src/routes/briefing.ts](../backend/src/routes/briefing.ts) | Selected-template upload paths, reads/writes, resets, removal of shared pricing JSON update. |
| [backend/src/routes/companies.ts](../backend/src/routes/companies.ts) | Optional template fields in row/response. |
| [backend/src/routes/logs.ts](../backend/src/routes/logs.ts) | Nested artifact paths and safer file listing/name checks. |
| [backend/src/routes/rules.ts](../backend/src/routes/rules.ts) | Template-scoped compilation, persistence, evaluation, and progression. |
| [backend/src/routes/template.ts](../backend/src/routes/template.ts) | Template-scoped generation, status, download, statistics, and log artifact path. |
| [backend/src/routes/variables.ts](../backend/src/routes/variables.ts) | Both IDs on variable operations and inserts; backend invalidation. |
| [backend/src/services/pipeline-log.ts](../backend/src/services/pipeline-log.ts) | Optional template ID and nested logs. |
| [backend/src/services/pricing-compiler.service.ts](../backend/src/services/pricing-compiler.service.ts) | Scoped profile/context loaders and logs; default-template arguments for direct callers. |
| [backend/src/services/template-mutator.service.ts](../backend/src/services/template-mutator.service.ts) | Scoped originals/output/variable reads and restricted mock fallback. |
| [frontend/src/App.tsx](../frontend/src/App.tsx) | Selected-template workspace, scoped requests, template controls, reset/import rewiring. |
| [frontend/src/components/CompanyProfileCard.tsx](../frontend/src/components/CompanyProfileCard.tsx) | Template prop forwarding and confirmation wording. |
| [frontend/src/components/DevDock.tsx](../frontend/src/components/DevDock.tsx) | Scoped pricing JSON/log requests. |
| [frontend/src/components/TemplateCheckpointCard.tsx](../frontend/src/components/TemplateCheckpointCard.tsx) | Scoped preview/download. |
| [frontend/src/components/VariableReviewDeck.tsx](../frontend/src/components/VariableReviewDeck.tsx) | Scoped variable requests and dependencies. |
| [frontend/src/components/pricing/PricingEngineDeck.tsx](../frontend/src/components/pricing/PricingEngineDeck.tsx) | Scoped rule autosave. |
| [frontend/src/main.tsx](../frontend/src/main.tsx) | Render the new outer application. |
| [frontend/src/services/api.ts](../frontend/src/services/api.ts) | Management helpers, scope arguments/URLs, error-class compilation fix. |
| [frontend/src/types/company.ts](../frontend/src/types/company.ts) | Optional template identity/name fields. |

### 12.3 Modified existing tests

| Test file | Adaptation |
| --- | --- |
| `backend/src/tests/briefing.test.ts` | Nested default-template URLs and nested original-document path expectations. |
| `backend/src/tests/companies.test.ts` | Scoped fixture variables; company reset now expected to preserve template-owned variables. |
| `backend/src/tests/configurations.test.ts` | Nested logs URLs; invalid traversal route expected to return 404. Shared configuration tests remain. |
| `backend/src/tests/pricing.routes.test.ts` | Scoped briefing/generation/rules/detail URLs and template IDs in fixture inserts. |
| `backend/src/tests/template-mutator.test.ts` | Template IDs in fixture rows and nested output path. |
| `backend/src/tests/variables.test.ts` | Nested default-template URLs for briefing, variable operations, and unlock. |

### 12.4 Change provenance and documentation

The user had already edited `app.ts`, `database.ts`, and `variables.ts` to begin this feature. The completed implementation incorporated that direction: it corrected the foreign-key separator, completed actual column/migration handling, normalized partially changed variable routes, and propagated scope to the remaining layers.

Both backend and frontend `package-lock.json` were already modified before this implementation began. Those changes were retained; they are not evidence that this feature introduced new dependencies. The feature uses existing packages and Node built-ins.

The repository-root file `.scratch/multiple-templates-documentation.patch` contains previously proposed changes to the prototype plan, design, AGENTS instructions, and scratch specification. It is a proposed patch, not an applied migration or runtime dependency. This guide is a new, separately requested document; it does not imply that the older patch has been applied. Some older documentation and route comments still describe company-only paths.

## 13. Testing and verification

### 13.1 Recorded verification

The implementation turn completed with **63 backend tests passing, zero failures**, backend `npm run typecheck` passing, and frontend `npm run build` passing. The build runs `tsc -b` before Vite, so it checks the frontend project references as well as producing assets. Vite reported a bundle-size warning; the build succeeded.

Those are recorded results from the implementation, not a claim that this documentation-only change reran the suite. Browser interaction and live AI calls were not verified in that implementation turn.

The sandboxed test runner initially failed at `uv_os_get_passwd`; the successful tests ran outside that sandbox after approval. Tests used temporary SQLite/storage directories, not the user's saved database.

### 13.2 New integration test coverage

`templates.test.ts` contains two top-level tests. The first exercises:

1. Rejecting a blank template name.
2. Creating two templates in one company.
3. Uploading and parsing a quotation separately for each.
4. Adding a custom variable only to the first.
5. Confirming the second has no such variable.
6. Attempting to edit the first variable through the second template without changing the first.
7. Generating a real Word template and checking the nested file exists.
8. Confirming the second cannot download the first's generated document.
9. Saving different pricing tables in the two templates.
10. Calculating the same lead inputs as **35,073** and **46,764**, proving independent saved pricing.
11. Rejecting detail, variables, download, rules, and logs requests through a different company.
12. Rejecting an upload through the wrong company before creating its destination directory.
13. Rejecting a direct SQL variable insert with a mismatched company/template pair.
14. Renaming a template.
15. Closing/reopening SQLite and confirming saved name, pricing text, and generated document remain.
16. Resetting the second template without removing the first's variables/file.
17. Editing a variable and confirming backend invalidation removes the generated file.
18. Deleting the first template while the second remains accessible.
19. Confirming the deleted template has no variable rows.
20. Confirming `PRAGMA foreign_key_check` returns no violations.

The second test constructs an old database without `template_id` and confirms:

- Pricing text and saved pricing-rule state are copied to the default template.
- Existing variables receive its ID.
- A document's bytes are preserved at the nested destination.
- Restart does not create another default or overwrite pricing edited after migration.

The migration test uses representative bytes rather than a valid Word file because it tests copying, not document parsing. The integration test uses a real sample Word file for generation.

### 13.3 Coverage boundaries

Existing tests continue covering pricing formulas, variable editing, document mutations, company settings, and profile behavior. The new tests do not prove every browser interaction, live extraction quality, crash consistency, parallel-write scenario, malformed migration destination, or all partial-schema histories.

In particular, `backend/src/tests/gemini.live.ts` still contains the old company-only workflow URLs. It is outside the offline `npm test` glob (`*.test.ts`) and needs its endpoints updated before it can validate the new route layout. Do not interpret the offline pass count as a passing live test.

## 14. Running and inspecting the feature

### 14.1 Start locally

From the repository root, use separate terminals:

```powershell
cd prototypes/new-auto-proposal/backend
npm run dev
```

```powershell
cd prototypes/new-auto-proposal/frontend
npm run dev
```

Backend startup runs the migration automatically; there is no separate migration command. Use the existing environment configuration for storage/database and AI keys. The default backend port remains 3001 unless overridden. New templates can be created without an AI call; variable extraction and rule compilation require configured provider access.

Restart the backend and refresh the frontend when upgrading so the browser and server agree on the new API paths. Preserve a database/storage backup before applying the migration to valuable saved work.

### 14.2 Verification commands

```powershell
# Run from prototypes/new-auto-proposal/backend
npm test
npm run typecheck
```

```powershell
# Run from prototypes/new-auto-proposal/frontend
npm run build
```

### 14.3 Read-only SQL inspection

List saved templates:

```sql
SELECT company_id, template_id, name, briefing_locked, updated_at
FROM proposal_templates
ORDER BY company_id, created_at, template_id;
```

Inspect workflow and generated-file metadata:

```sql
SELECT
  template_id,
  name,
  json_extract(working_state_json, '$.stage') AS stage,
  json_extract(working_state_json, '$.template_stats.template_path') AS file_path,
  json_extract(working_state_json, '$.pricing_rules') AS pricing_rules
FROM proposal_templates
WHERE company_id = 'co1_seo';
```

Count variables per template:

```sql
SELECT company_id, template_id, COUNT(*) AS variable_count
FROM company_variables
GROUP BY company_id, template_id;
```

Inspect migration and constraints:

```sql
SELECT * FROM schema_migrations;
PRAGMA table_info(company_variables);
PRAGMA foreign_key_list(company_variables);
PRAGMA foreign_key_check;
```

Check that `multiple_templates_v1` is present and that the actual nested Word file exists. A saved path alone is not proof that a file remains on disk. Do not use `company_sessions.working_state_json` to inspect the current selected template.

### 14.4 Manual walkthrough

1. Select a company and inspect its Default template.
2. Create `Managed IT`, submit a quotation, review variables, and generate a template.
3. Create `Security audit`, upload its sample, and configure different pricing.
4. Switch between them and verify the quotation, variables, preview, and prices restore separately.
5. Edit a variable and check the generated preview/rules disappear for that template only.
6. Reset one and confirm the other remains intact.
7. Restart the backend and refresh to confirm persistence.
8. Rename and delete a template, including testing the empty state after the last deletion.
9. Check shared voice/inbox settings remain the same between templates of the same company.

## 15. Compatibility and known limitations

These details describe the implementation as reviewed, rather than promises of behavior that has not been built or tested.

### 15.1 Scope and API compatibility

- Old company-only workflow URLs have no compatibility redirects. External callers must supply the template ID.
- Shared company endpoints still expose legacy workflow/pricing fields. Selected-template callers must use the nested detail route.
- Some comments and UI success messages still use company-oriented terminology, even when the action is template-scoped.
- Variable response types do not yet expose `template_id`; ownership is conveyed by the route and enforced in SQL.
- The default-template helper arguments support existing direct service callers, but do not choose whichever template the browser last selected.
- The new repository layer does not eliminate existing raw SQL in older routes/services or fully implement the main repository's four-tier architecture.
- No new authentication, user authorization, or canonical `tenant_id` integration was added to this company-based prototype.

### 15.2 Writes, files, and failure handling

- The write guard is process-local. Multiple backend processes would need shared coordination or optimistic version checks.
- It releases on response `finish`, with no explicit abort/timeout cleanup. An abnormal connection termination that never reaches `finish` can leave a guard entry stuck until restart.
- GET requests are not locked. File generation, deletion, and SQLite updates are not a single atomic filesystem/database transaction.
- Upload writes to `original_quotation.docx` before prompt validation and document parsing. A failed submission can replace the old original while leaving previously saved metadata/state. The feature does not add temporary upload staging.
- Variable extraction and multi-item updates retain non-transactional sequences. An error partway through can leave partial changes.
- `PUT /variables` increments `updated_count` per processed item rather than actual affected SQL rows. An out-of-scope variable ID is not modified, but can still produce a success response/count and invalidate the selected template. The isolation test checks the other template is unchanged, not that such a request returns 404.
- Some existing unlock cleanup catches ignore deletion failures; the implementation does not add a file-reconciliation job.
- Debug Markdown logging is asynchronous and can finish after the request guard is released. Historical artifacts are best-effort output, not transactional workflow state.

### 15.3 Migration and retention

- Old source documents, obsolete company workflow fields, empty template directories, and historical logs remain. There is no automatic retention cleanup or archive/export feature.
- Old logs are not migrated into default-template directories, so they are not listed by the new nested log endpoint.
- A partially hand-edited database with a template column but no FK is not rebuilt automatically; cascade behavior must be verified on that database.
- The one-time marker means companies added after migration do not automatically receive defaults from this migration. They can receive templates through the create endpoint.
- There is no downgrade migration, automatic backup, or migration repair command.

### 15.4 Frontend and verification

- Selection warnings are unconditional when a template is selected, not based on precise dirty-field tracking.
- Remounting prevents old workspace callbacks from changing the new workspace, but does not abort or roll back backend work.
- Renaming refreshes the selector but keeps the same workspace key. Its already-loaded `company.template_name` can remain stale until that workflow reloads, even though the server and selector have the new name.
- No cross-tab synchronization or browser-storage error fallback is implemented for remembered selection.
- Downloads from different templates share the company-based suggested filename.
- No end-to-end browser automation or live-provider verification was added, and the separate live test still requires URL updates.
- The Stage 5 completion notice remains a saved-stage transition, not a completed personalized-proposal generation feature.

These boundaries matter when extending the prototype: new workflow operations should always carry both IDs, use the selected template's saved state and directory, preserve shared company settings, and add tests that exercise two templates rather than only the default.
