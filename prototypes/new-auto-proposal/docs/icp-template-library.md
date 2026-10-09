# ICP template library: workflow and implementation

Reviewed against the working tree on **8 October 2026**. Paths are relative to `prototypes/new-auto-proposal` unless stated otherwise.

This guide describes the ICP onboarding workflow added on top of the existing multiple-template feature, including the later custom-template submit-button fix. It supersedes the earlier dropdown-based entry flow described in [multiple-templates.md](multiple-templates.md). The underlying document, variable and pricing pipeline still applies.

## 1. What changed

Previously, the application selected a saved template automatically and opened its workspace. Users managed templates through a dropdown and name-only creation form.

Now, the entry point is a company-specific template library. An empty library offers **Import ICP data**. The AI creates three saved starting briefs from the selected company's mock profile. Each has a name, description and pricing brief. These records exist before any quotation upload or generated Word document.

Users choose a card to enter the existing workflow, or add a custom template with their own three fields. Saved templates remain available after reload or backend restart. Each company may create at most seven templates through these APIs.

## 2. User journey

### Startup and empty state

- The top bar retains the three company tabs, application identity and light/dark theme toggle.
- The frontend fetches companies, selects the first company and loads its saved templates.
- It opens the library rather than automatically reopening a remembered template. The old localStorage selection behavior is removed.
- While fetching, it shows a loading message.
- An empty library shows a centered welcome panel with the selected company name, the heading **Your next proposal starts here**, and a short explanation of the three tailored starting briefs.
- Three overlapping, decorative document illustrations sit above the heading. A subtle primary-color gradient, rounded border and card surface match the light/dark theme. The illustrations are hidden from assistive technology and do not represent saved templates or loading progress.
- The **Import ICP data** button is larger (56px tall), with a sparkle icon and arrow. It fills the available panel width on small screens and uses its content width on larger screens. The panel is capped at `max-w-2xl` with responsive padding.
- Supporting text below the button reads **Three tailored briefs. Ready for you to make your own.** The custom creation button still appears only once cards exist.
- Existing templates are preserved and shown as cards. Upgrading an existing database does not clear the library to force onboarding.

### Importing ICP data

1. Click **Import ICP data** for the selected company.
2. The UI disables competing actions and displays exactly three page-shaped skeleton cards.
3. Skeletons pulse with staggered animation delays; motion-safe classes respect reduced-motion preferences. A status message explains that the app is considering customers, offers and pricing.
4. The server loads only the matching company record from the mock dataset and requests three briefs from the configured AI.
5. After validation and database commit, the cards display the names and descriptions.
6. A failed import displays an error and allows retry. The frontend also reloads the list after an error because the server may have saved successfully even if the response was lost.

### Opening a template

- Clicking a card opens `TemplateWorkspace`, keyed by company ID and template ID to isolate component state.
- The existing workflow fetches the saved template; `PromptDocCapsule` initializes its prompt from `company.pricing_spec`.
- This import does not upload a quotation, extract variables, generate a Word document, compile pricing rules or lock the briefing.
- The user still supplies a sample quotation and proceeds through the existing five-stage workflow.
- **All templates** returns to the library and refreshes the list. A confirmation warns that unsaved edits will be discarded; saved work stays intact.
- Switching companies from a workspace gives the same unsaved-edit warning. Library company switching resets the active selection, form and error state.

### Compact template cards

- Cards use 24px inner padding, a 256px minimum height, no extra outer vertical padding, a 40px document icon and tighter gaps. Their height can still grow with content; it is not fixed.
- Titles use 16px text with snug line height. Descriptions use 13px text with 20px line height and a maximum of four displayed lines (`line-clamp-4`). The open action has a smaller top gap.
- Long saved/custom descriptions are visually truncated rather than stretching the card or introducing an inner scrollbar. The full description remains in the database and is placed in the paragraph's native `title` tooltip for mouse hover.
- Existing descriptions are not rewritten or regenerated. Short descriptions display in full when they fit; truncation depends on viewport width and text wrapping.
- The hover tooltip is not an explicit expand control and is not reliably available on touch devices. These changes reduce scrolling, but do not guarantee that all cards or every full description fit on every screen.

### Custom templates

- **Add custom template** opens an inline form for name, description and pricing brief.
- All three fields are required. Empty/whitespace-only values disable the save action; inputs also have length limits.
- **Save and open template** creates the database record, refreshes the library, closes the form and opens that template's workspace.
- The supplied pricing brief is prefilled exactly through the existing `pricing_spec` path, after surrounding whitespace is trimmed during validation.
- The form has a saving state and cancel action. Failures are displayed without discarding the entered values.
- Custom creation does not call the AI.

### Deletion and capacity

- Each card has a separate, labeled delete button, outside the card's open button.
- Deletion requires confirmation and uses the existing template deletion endpoint.
- The deletion service removes `original_quotation.docx`, `template.docx`, `proposal.docx`, `proposal.pdf` and the template row; associated variables are removed through database ownership/cascade behavior. An assigned email is retained but becomes unassigned. Logs are not cleaned up by this action.
- The responsive grid adjusts to the remaining cards: one column on small screens, two at the small breakpoint and three at the large breakpoint.
- A count shows the number of templates out of seven. At seven, custom creation is disabled and an explanatory message appears.
- The backend independently enforces capacity. Deletion frees a slot.
- Deleting every card returns to the initial import-only screen. Reimporting then creates three new records; it does not restore deleted templates.

## 3. AI input and output

The implementation reuses `loadDataset()` from `backend/src/db/seed.ts` and selects the record whose `company_id` matches the route. Its source is [companies_dataset.json](../Mock%20Data/companies_dataset.json), not browser-entered JSON and not a modified copy of `company_sessions.data_json`.

The full selected profile is serialized into the prompt, including company basics, services, target customers, ideal customer, offers and buyer segments. Following the demo merge, pricing text comes separately from `findSeed(companyId).pricing_spec` in [test_seeds.json](../Mock%20Data/test_seeds.json), and is appended as dev pricing context. Other companies are not included. The incoming demo branch removed pricing seeds from `companies_dataset.json`; it now holds imported profile data only.

`generateJson()` in `ai-extraction.service.ts` selects the provider/model from persisted AI settings, just as the existing extraction pipeline does. There is no separate ICP model setting. Gemini receives a structured response schema; DeepSeek receives the equivalent JSON shape instruction through the shared generation adapter.

The prompt asks the AI to:

- Produce exactly three distinct, specific template names, descriptions and actionable pricing briefs.
- Keep each description to one sentence of 1-160 characters, ideally 15-22 words, identifying only the buyer and main offer. Avoid lists, line breaks, pricing details and repetition of the template name. Put supporting details in `pricing_spec` instead.
- Infer direct buyer type from explicit business type, target customers, ideal customer and buyer segments.
- Keep every proposal B2B for a B2B-only company, or B2C for a B2C-only company; cover both if the company serves both.
- Avoid confusing a business customer's consumer audience with the company selling directly to consumers.
- Vary supported offers, services, buyer segments, scopes or packages when buyer type alone does not distinguish the proposals.
- Preserve relevant supplied prices, conditions, discounts, tax uncertainty and limitations.
- Avoid inventing rates/services or calculating totals; identify missing pricing for the user to supply.
- Treat profile content as data rather than instructions.

Expected model output:

```json
{
  "templates": [
    {"name": "First proposal", "description": "Buyer and offer", "pricing_spec": "Pricing briefing"},
    {"name": "Second proposal", "description": "Buyer and offer", "pricing_spec": "Pricing briefing"},
    {"name": "Third proposal", "description": "Buyer and offer", "pricing_spec": "Pricing briefing"}
  ]
}
```

Server-side validation requires exactly three entries and three distinct names after trimming and case normalization. It also validates each field below. Business suitability and B2B/B2C correctness are prompt instructions, not independently verified semantic constraints. The schema does not guarantee that every model-generated pricing statement is correct.

## 4. Database and migration

### Template fields

| Field | Storage and purpose |
| --- | --- |
| `template_id` | Existing primary key; generated with `crypto.randomUUID()` for new briefs. |
| `company_id` | Existing company ownership key. |
| `name` | Existing display name, saved immediately. |
| `description` | New `TEXT NOT NULL DEFAULT ''` column for the card description. |
| `pricing_spec` | Existing column reused for the initial AI/user pricing brief and subsequent briefing workflow. |
| `created_at`, `updated_at` | Existing timestamps assigned on creation. |

The three brief fields are persisted even if the user never uploads or generates a document. No extra JSON file or separate ideas table is introduced. The original AI brief is not versioned separately: later explicit briefing edits/resets can update `pricing_spec` through the existing workflow.

### Startup behavior

`database.ts` checks `PRAGMA table_info(proposal_templates)` and adds `description` only when absent. Existing template rows receive an empty description, and the UI supplies fallback description text for them.

The company count is captured before initial seeding. `migrateTemplates` now accepts a `migrateExisting` argument, defaulting to true. On a fresh database, startup seeds the mock company profiles but passes false so legacy default templates are not manufactured. The migration still installs its indexes/triggers and records completion.

For an existing database with company records that still needs the older multiple-template migration, legacy workflow migration remains enabled. Already-migrated databases retain their templates. Restarting does not recreate deleted templates or automatically call the AI.

### Transaction and concurrency

`saveIdeas()` uses `BEGIN IMMEDIATE`, checks the company's current template count plus the requested batch, inserts every record and commits. Errors roll back the batch, preventing partial imports. The seven-template maximum is enforced by this service, not a new SQLite CHECK constraint; direct repository/SQL writes can bypass it.

ICP import requires an empty library. A process-local set rejects duplicate imports for the same company and is cleared in `finally`. After the asynchronous model call, the service checks the library again so a template created while generation was running is not overwritten or silently combined with the import.

## 5. HTTP API

Base: `/api/companies/:companyId/templates`. Company existence is checked by the router; individual-template operations retain ownership validation.

| Method and suffix | Behavior |
| --- | --- |
| `GET /` | Lists `template_id`, `name`, `description`, `pricing_spec`, `updated_at`. Ordering remains creation time, then ID. |
| `POST /import-icp` | Requires an empty library; generates and saves exactly three briefs. Returns 201 with `{ success: true, templates: [...] }`. |
| `POST /` | Creates one custom template from all three fields; returns 201 with `{ success: true, company: ... }`, using the existing workflow response formatter. |
| `GET /:templateId` | Existing saved workflow response, including `template_id`, `template_name` and `pricing_spec`, used to open the editor. The description is available in list responses; it was not added to this formatter. |
| `PATCH /:templateId` | Existing name-only rename endpoint remains available; the new card UI does not expose rename. |
| `DELETE /:templateId` | Existing deletion behavior, now called from cards. |
| `POST /:templateId/reset` | Existing reset behavior remains available in the workspace. |

Custom request example:

```json
{
  "name": "Managed IT for growing teams",
  "description": "Ongoing support for a small professional-services firm.",
  "pricing_spec": "Use our Standard per-seat rate and document any additional server charges."
}
```

Validation limits are 1-100 characters for name, 1-1000 for description and 1-20000 for pricing brief. Each must be a nonblank string. The validator checks the original string length before returning trimmed values. Older API clients that send only a name must now supply the other two fields. The shorter 160-character description target is an AI prompt instruction, not a new API/schema validation limit. Both AI output validation and custom forms still accept descriptions up to 1000 characters; the card clamps long content visually.

Expected failures:

- **400:** Invalid custom fields or invalid rename name.
- **404:** Unknown company, unavailable company ICP record, or a template outside the selected company.
- **409:** Import already running, library not empty, templates added during import, template write contention, or capacity exceeded.
- **502:** Model/provider failure or invalid AI output; no partial imported batch is retained.
- **500:** Unexpected route-level creation/import failure.

`app.ts` mounts the management router before the generic `:templateId` workflow middleware. Otherwise, `import-icp` is interpreted as a template ID and rejected before its handler runs. Rename, delete and reset explicitly use `serializeTemplateWrites`, preserving their protection against in-flight template operations after this routing change.

## 6. File-by-file implementation inventory

| File | Change and reason |
| --- | --- |
| `backend/src/services/template-ideas.service.ts` (new) | Idea type, field validator, seven-template constant, transactional batch creation, AI schema/prompt, import orchestration, error statuses and duplicate-import guard. Exposes `setTemplateIdeasModelCall()` for offline tests; passing null restores the normal provider call. |
| `backend/src/repositories/templates.repository.ts` | Adds `description` to `TemplateRow`; extends `insertTemplate` with description and pricing-spec parameters, retaining empty-string defaults for internal callers. |
| `backend/src/db/database.ts` | Adds the non-destructive description migration and distinguishes fresh company seeding from legacy workflow migration. |
| `backend/src/db/templates-migration.ts` | Adds the optional migration switch and skips copying company workflows for fresh installations. |
| `backend/src/routes/templates.ts` | Adds ICP import, validates full custom briefs, returns descriptions/briefs in lists and explicitly guards management writes. |
| `backend/src/app.ts` | Orders management routes before generic template-scoped workflow routes. |
| `frontend/src/services/api.ts` | Extends `ProposalTemplateSummary`; changes `createProposalTemplate` to send all three fields; adds `importIcpTemplates`. |
| `frontend/src/TemplatesApp.tsx` | Replaces dropdown management with themed cards, empty/loading/error states, generation skeletons, custom form, deletion, capacity feedback, and workspace/library navigation. Uses existing Button, Input, Textarea, Card and theme primitives with Lucide icons. |
| `backend/src/tests/template-ideas.test.ts` (new) | Integration coverage for new import/custom creation contracts with a stubbed model. |
| `backend/src/tests/template-fixtures.ts` (new) | Explicitly seeds template fixtures for existing pipeline tests now that fresh application databases start empty. |
| `backend/src/tests/briefing.test.ts` | Uses explicit template fixtures. |
| `backend/src/tests/companies.test.ts` | Uses explicit template fixtures. |
| `backend/src/tests/configurations.test.ts` | Uses explicit template fixtures for template-scoped log tests. |
| `backend/src/tests/pricing.routes.test.ts` | Uses explicit template fixtures. |
| `backend/src/tests/template-mutator.test.ts` | Uses explicit template fixtures. |
| `backend/src/tests/variables.test.ts` | Uses explicit template fixtures. |
| `backend/src/tests/templates.test.ts` | Supplies description and pricing brief when creating templates through the API; retains isolation and legacy migration coverage. |

The initial ICP library reused the existing document pipeline without adding dependencies. Subsequent demo merges added Stage 5, split dev seeds from profile data, and added `date-fns` to both packages. The merge changes and routing-specific file inventory are recorded below. Pre-existing local platform-metadata changes in package-lock files remain separate from the incoming dependency updates.

### Follow-up: shorter descriptions and fuller welcome screen

`backend/src/services/template-ideas.service.ts` changes only the AI prompt for description brevity: one sentence, at most 160 characters, ideally 15-22 words. The shared validator, database and custom-form limit remain unchanged.

`frontend/src/TemplatesApp.tsx` tightens card padding, icon sizing, title/description typography and action spacing; clamps descriptions to four lines and exposes the full text through a native hover tooltip. It also replaces the bare empty-state button with the themed welcome panel and larger import button described above. Existing saved text and import behavior are preserved. The three decorative welcome documents are distinct from the three animated skeleton cards shown during import.

### Follow-up: save button did nothing

The custom form already handled `onSubmit`, but its shared Base UI `Button` defaults to `type="button"`. The save button omitted an explicit type, so clicking it did not submit the form or call the creation API.

`TemplatesApp.tsx` now explicitly sets `type="submit"` on **Save and open template**. Cancel remains `type="button"`. The busy label was also corrected to `Saving...`. The shared button primitive was left unchanged to avoid changing unrelated buttons.

## 7. Verification and manual checks

The implementation run passed **65 backend tests**, the backend typecheck and the frontend production build. The frontend build was rerun and passed after the submit-button fix, after the compact-card/description changes, and after the welcome-panel change. Vite reported its existing nonblocking large-chunk warning. These results are historical checks from implementation, not a claim of a fresh run whenever this document is read.

The new integration test covers:

- Empty initial template library.
- Selected-company data in the prompt and explicit B2B/mixed-buyer instructions.
- Concurrent duplicate import rejection.
- Exactly three saved briefs and an unlocked initial workflow.
- Persistence across database close/reopen and company isolation.
- Rejection of importing into a populated library and incomplete custom payloads.
- Capacity at seven, cross-company deletion rejection and slot reuse after deletion.
- Wrong-length model output, duplicate names, missing fields, provider errors and successful retry.

The existing suite continues to cover legacy migration, template isolation, document generation and the custom-variable Re-scan regression. API tests do not simulate clicking the frontend button.

To verify manually:

1. Restart the backend to run schema initialization and open the frontend.
2. Select a company with no templates. Existing saved templates are intentionally preserved; do not clear a real database merely to see onboarding.
3. Check the welcome panel in light/dark themes and at mobile/desktop widths, including the larger import button. Import ICP data and check that the decorative welcome documents are replaced by three animated loading cards while the configured provider responds.
4. Confirm the three saved names/descriptions fit the company's actual buyers and offers. Newly generated descriptions should be short single sentences. Check an existing long description: its card should show at most four lines, without an inner scrollbar, and mouse hover should reveal its full text.
5. Reload before opening a card; the same briefs should remain.
6. Open a card and verify the pricing brief is prefilled and the normal document-upload workflow is available.
7. Return with **All templates**, create a custom template, fill all fields and click **Save and open template**. Check the new workspace and saved brief.
8. Reload or restart the backend; confirm both AI and custom templates persist.
9. Fill the library to seven, confirm creation is disabled/rejected, then delete one and add another.
10. Switch companies and confirm their libraries and workflows remain separate.

No live AI response or browser visual/interaction run was performed during the recorded implementation verification. Model quality, responsive appearance and click behavior should be checked manually using the running app.

## 8. Boundaries and known limitations

- Import is available only for an empty library; this is not an append-three or regenerate feature.
- There is no persisted import-progress job. Reloading during generation loses the skeleton state; a repeated request may receive 409 until the original import finishes. Saved results can then be retrieved by reloading.
- Import locking is process-local. Multi-process coordination is not implemented, although transactional capacity checks remain in SQLite.
- The seven-template limit does not delete or trim pre-existing rows above the limit.
- AI output is structurally validated, but buyer classification and factual pricing accuracy are not separately evaluated.
- The library does not expose the AI picker; it uses existing persisted settings, whose picker remains in the workspace.
- Card descriptions have no edit UI. Name-only rename remains an API capability. Pricing briefs can be changed through the existing briefing workflow.
- Explicit reset/import-settings actions in the existing workspace can replace the current pricing brief with mock defaults. Persistence is not immutable version history.
- UI errors leave entered custom data in memory, but unsaved form edits are not persisted across reloads or navigation.
- No real inbox integration or authentication was added. Stage 5 is now implemented through the demo merge; PDF conversion uses its existing LibreOffice configuration (`SOFFICE_PATH`).

## 9. Documentation relationship

This guide is the current reference for library entry, ICP import, brief creation, capacity and the submit-button fix. The original [multiple-template guide](multiple-templates.md) remains useful for the underlying template-scoped document pipeline; its earlier dropdown, name-only creation and default-template descriptions are historical where they conflict with this guide.

The earlier `.scratch/icp-template-library-docs.patch` and `.scratch/mock-email-routing-docs.patch` were proposed documentation drafts. This guide supersedes them; do not apply those drafts on top of the current documentation.

## 10. Saved email routing and editing

### Behavior and scope

The library's collapsible **Check a lead email** panel (`frontend/src/components/RoutingTestPanel.tsx`) sits below the template grid and starts with the selected company's sample lead message. It is displayed once the company has templates. All company-owned templates are candidates: AI-created, custom, brief-only, partially configured and fully configured. Routing chooses relevance, not readiness. Assigning an email does not complete template setup.

**Check** calls the configured AI with the saved email and each candidate's ID, name, description and pricing brief. The prompt asks for one exact candidate ID and a short explanation, or null if no offer fits or multiple offers fit equally well. Both the email and candidate contents are treated as untrusted data. The backend validates the ID against the candidate set and caps the nonblank explanation at 500 characters.

A successful match is an actual SQLite assignment, not just an ephemeral suggestion. The UI displays **Goes to** (or **No match**), a truncated quote of the checked email, its reason, time and automatic/manual source, highlights the card, and offers **Open template**. The workspace shows no duplicate email card; the assigned email arrives via the Stage 5 prefill below. Reloading or restarting restores the assignment. A closed **Not right? Choose another…** disclosure lets the user select a different template without AI. Re-checking may replace the previous assignment; a successful no-match result clears it. A provider failure leaves the last successful assignment intact.

Routing does not send an email, automatically generate a proposal or require the mock **Connect inbox** flag.

### Editable message

The textarea accepts a different received email, up to 12,000 characters. The default seed is only a starting point. **Check** saves pending changes first and then routes the saved text; there is no separate save button. **Reset** discards an unsaved edit and restores the saved text. The manual override stays hidden until a saved answer exists, and editing hides the old answer and card highlight so they are not presented as a match for new text.

The server requires a nonblank string, validates the original length, trims surrounding whitespace and checks the supplied integer version. Saving changed text clears `template_id`, reason and routing time, marks the record unassigned and increments its version. Saving unchanged text preserves the assignment. A stale version returns 409 without overwriting the current message. Unsaved browser edits are not persisted automatically. There is no email history: saving replaces the one message held for that company.

### Persistence model

Startup creates `mock_email_routes` if absent; no manual migration command is needed.

| Column | Meaning |
| --- | --- |
| `company_id` | Primary key and company FK; one current mock/editable email per company. |
| `email_id` | Stable unique identifier, initially `mock-<companyId>`. |
| `email` | Saved message body snapshot, editable by the user. |
| `template_id` | Nullable FK to the assigned template. |
| `reason` | AI explanation, manual-assignment text or deletion notice. |
| `source` | Application values `unassigned`, `ai` or `manual`; stored as text. |
| `routed_at` | Last successful AI/manual routing timestamp, or null. |
| `version` | Integer incremented by assignment, changed email saves and assigned-template deletion. |

The first `GET /mock-email` lazily inserts a row from `findSeed(companyId).sample_lead_text` using `INSERT OR IGNORE`. Subsequent reads retain the saved message, including user edits; seed-file changes do not automatically overwrite existing rows.

Ownership triggers reject a template ID belonging to another company. Deleting a template clears its email assignment and timestamp, retains the email and adds a re-routing notice. Deleting the company cascades to its email row. Email deletion/history endpoints are not implemented.

### Concurrency and errors

AI routing captures the email version and candidate details before its asynchronous call. It rechecks the candidate list before saving and updates the email only if its captured version still matches. A deleted/changed candidate or a concurrent email edit/manual assignment causes 409, preventing an old AI result from overwriting new work. Manual assignment also uses the repository's conditional version update; there is no queue or persisted in-progress job.

On a lost response, a completed assignment can be recovered by reloading. The UI is not automatically synchronized across browser tabs.

### API contracts

Base: `/api/companies/:companyId/templates`. These management paths are mounted before the generic `:templateId` workflow routes.

| Method / path | Request | Response |
| --- | --- | --- |
| `GET /mock-email` | None | `{ success: true, email, routing }`; initializes the seed record if needed. |
| `PUT /mock-email` | `{ email, version }` | `{ success: true, routing }`; saves changed text and clears its assignment. |
| `POST /route-email` | None | `{ success: true, routing }`; AI routes the saved server-side email. |
| `PUT /route-email` | `{ template_id }` | `{ success: true, routing }`; assigns manually within the company. |

`routing` contains the persisted fields listed above. A null ID can mean never assigned, template deleted or a completed no-match result; `source`, `reason` and `routed_at` distinguish them. Invalid edits return 400; unknown company/template or missing email returns 404; empty candidate libraries and stale state return 409; invalid AI output/provider failure returns 502. Unexpected route failures return 500. No endpoint accepts a cross-company assignment.

### Check & Generate Proposal prefill

`formatCompanyResponse()` now obtains `sample_lead_text` in this order:

1. The saved email assigned to the requested company **and template**.
2. The company's sample lead from `test_seeds.json` if that template has no assignment.
3. Empty text if neither exists.

`assignedEmail()` performs the scoped repository read. `LeadSimulator.tsx` already initializes its textarea from this response, so opening the assigned template uses the edited/routed email without a separate frontend override. The common response formatter keeps this behavior consistent after workflow requests. Reassignment moves the prefill to the new template; unrelated templates retain their demo sample. Reopen/reload to observe changes made elsewhere; there is no push-based refresh. Editing the Stage 5 textarea itself does not write back to the routing record.

### Mock inbox connection versus mock lead data

**Connect inbox** still only persists the proposal-making company's profile address, a connection flag and timestamp in `company_configurations`. It does not authenticate to Gmail/Outlook, read a mailbox, send drafts or invoke routing. The three initial mock messages are Bloom & Co for Northstar, Whitfield & Associates for Fortress IT, and Rosewood Home Goods for Fieldstone. They come from `test_seeds.json`, independently of the inbox flag. No sender/recipient envelope, attachment ingestion or real inbox polling is implemented.

### Routing implementation inventory

| File | Added or changed behavior |
| --- | --- |
| `backend/src/services/email-routing.service.ts` | AI matching, response validation, seed initialization, manual assignment, email-edit validation and stale-result checks. Uses the same persisted provider/model settings as extraction. |
| `backend/src/repositories/email-routing.repository.ts` | Reads/initializes email snapshots, conditionally saves assignments, replaces email text and reads an assigned message by company/template. |
| `backend/src/db/database.ts` | Email table, company/template ownership triggers and deletion handling. |
| `backend/src/routes/templates.ts` | Four email endpoints and error responses. |
| `backend/src/routes/companies.ts` | Assigned-email-first Stage 5 prefill in the common workflow response. |
| `frontend/src/services/api.ts` | Fetch/save/route/assign helpers and saved routing type including version. |
| `frontend/src/TemplatesApp.tsx` | Library layout, routing callbacks, highlighted card and restoration on navigation; workspace `templateControls` is breadcrumb-only. |
| `frontend/src/components/RoutingTestPanel.tsx` | Collapsible check panel, check/reset controls, saved result with email quote, closed manual-override disclosure. |
| `backend/src/tests/email-routing.test.ts` | Offline integration coverage for matching contracts, persistence, ownership, concurrency, editing and Stage 5 prefill. |

## 11. Remote demo merge integration record

These are local integration records, not a promise that the commits were pushed. The remote feature branch was explicitly pushed only through pre-merge `703bb6e` during this session. Both merges below were kept local as requested; check Git before assuming current remote state.

### First merge: demo through `4dded53`

- `703bb6e` preserved the completed ICP library, UI refinements, documentation and submit-button fix before integration.
- `24823dc` merged the demo's Stage 5, fixed-variable review, pricing hardening and seed split.
- Conflicts were resolved in `app.ts`, `db/database.ts`, `routes/briefing.ts`, `routes/template.ts`, `services/pricing-compiler.service.ts`, and the briefing/configuration/variable tests.
- Incoming features were retained; code assuming a single company workflow was adapted to template ownership.

**Stage 5 isolation:** `routes/proposal.ts` is mounted beneath `/api/companies/:companyId/templates/:templateId`. Lead extract/clarify/reply, proposal generation and download use the selected template's state, variables and rules. Frontend Stage 5 API helpers and `LeadSimulator.tsx` pass the template ID. Download links include it.

`proposal-generator.service.ts` reads the selected template's `template.docx` and writes `proposal.docx` / `proposal.pdf` in `storage/<companyId>/<templateId>/`. Lead, clarification, narrative, proposal-payload and proposal-Markdown artifacts use template-specific logging. Earlier-stage changes and pricing edits clear only that template's stale proposals. Deletion removes its proposal files too. Shared company reset no longer accidentally clears a default template's proposal.

**Schema reconciliation:** the incoming `fixed` category and `date` data type required rebuilding SQLite `company_variables`. The combined rebuild retains `template_id` and its foreign key, copies explicit existing columns rather than assuming the old shape, and recreates lookup indexes and ownership triggers afterward. Tests cover retained ownership, FK consistency and legacy single-workflow migration.

**Pricing seeds:** incoming `db/seed.ts` adds `findSeed()` and `test_seeds.json`; profile JSON no longer mirrors dev pricing. Template reset reads the selected seed. ICP generation now appends that company's seed pricing alongside its profile. No other company's pricing is sent.

**Repair logs and tests:** pricing compiler repair logs retain the incoming `fixing` and `kept` fields and the template scope, without duplicate log emission. Incoming redundant-test removals were preserved. Proposal tests were adapted to nested routes/files and given a second-template generation/deletion regression. Final first-merge checks passed 86 backend tests, backend typecheck and frontend build.

### Second merge: demo through `1e09442`

- `b4ced63` first preserved saved/editable email routing and assigned-email prefill.
- `17f1565` merged the incoming date workflow updates.
- Conflicts were resolved in `routes/rules.ts`, `routes/variables.ts`, `tests/pricing.routes.test.ts` and `tests/proposal.test.ts`.

**Date features:** dates are now typed Stage 4 sheet values, calculated from the reserved `today` input using `add_days` / `add_months`. Stage 5 uses the server's local date, not the chat/client timezone. The old heuristic `fillDates` path was replaced by sheet evaluation. Stage 2 retains a `date_format` pattern and verifies that the sample can be parsed and formatted back exactly. Invalid patterns warn and fall back to `MMMM d, yyyy`. Variable Review offers a date-format editor and today's preview. Details are in [Dates as a Stage 4 type](plans/07-date-type.md).

Both backend and frontend now depend on `date-fns`. The merge installed the incoming dependency updates. Template-scoped `loadStage2Context` was retained when adding today's calculation input, and date-format refresh calls pass `templateId` to `fetchVariables`.

**Re-scan compatibility:** the shared saved-variable collection remains the extraction response, preserving custom variables immediately after re-scan. Incoming date-format metadata is supplied through that collection instead of restoring the older response that contained only newly extracted variables. The offline extraction stub now supplies the required `date_format` field.

**Test integration:** incoming proposal/date tests use template-scoped URLs. The date-format edit test rebuilds the invalidated template before checking its tier-matrix pricing payload. A doubled template URL introduced during conflict resolution was corrected. The complete merged suite passed **92 tests**, backend typecheck and frontend production build. The build retains a nonblocking chunk-size warning.

Incoming docs, fixtures and AGENTS changes were carried through with the demo commits. Captured raw model fixtures were not retuned to make tests pass. Unrelated local lockfile platform-metadata edits and unapplied scratch patches were excluded from merge commits; the lockfile edits were temporarily stashed and their preservation verified.

## 12. Running and verifying the combined workflow

Restart the backend after pulling these changes: table initialization creates the email-routing table and runs the variable schema migration. Install dependencies in both `backend` and `frontend` if working from a fresh checkout or an older install (`npm install` in each).

If the frontend reports that `date-fns` cannot be resolved after dependency installation, stop the old Vite process and restart from `frontend` with:

```powershell
npm run dev -- --force
```

The package was confirmed installed and the production build passed when this error was reported; restarting forces Vite to rebuild its dependency cache. It is not a missing source file in `VariableReviewDeck.tsx`.

Manual routing checks:

1. Open a company with templates and review its prefilled email.
2. Replace the body, save it, reload and confirm the edit remains.
3. Route it; check the saved reason, highlighted card and assigned-template email panel.
4. Open that template's configured **Check & Generate Proposal** stage and verify it prefills the edited email.
5. Move the email manually; confirm the new template receives it and the previous template returns to its demo prefill.
6. Confirm a different company does not see that assignment.
7. Delete the assigned template; confirm the message is retained and can be routed again after templates are available.
8. Save changed text during a separate in-flight route; the stale result should be rejected rather than restore the old assignment.

The routing integration tests also exercise no-match results, invalid/foreign model IDs, provider failure preserving the previous assignment, required/oversized edit validation, stale edit versions, unchanged-text saves, one row per company and restart persistence. All AI tests are stubbed; no live matching accuracy, real mailbox delivery or end-to-end browser verification is claimed. The separate live test still needs its company-only URLs reconciled with template-scoped routes before it can be treated as verification of this branch.

Current limitations: one saved email per company, no message history, no automatic incoming mail, and no per-lead proposal archive. Stage 5 output files are overwritten per template on each generation; routing persistence does not create separate proposal runs. A template can receive an email before setup is complete, but document generation still requires the configured workflow.
