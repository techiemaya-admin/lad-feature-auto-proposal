# Spec: docXMLater Table & Row Testing Prototype

Status: ready-for-agent

## Problem Statement

When building automated quotation, proposal, and contract workflows that parse and update customer `.docx` documents, developers frequently need to locate specific pricing or specification tables, identify target rows (such as line items, subtotals, or template placeholders), and perform targeted structural mutations (adding new rows, removing obsolete rows, clearing temporary values, or purging blank spacing rows) without corrupting Word document styling or XML structure.

Currently, evaluating whether `docXMLater` reliably satisfies these table and row manipulation requirements requires writing ad-hoc scripts. Developers lack a fast, visual, end-to-end sandbox prototype to upload real-world DOCX files, execute targeted table/row operations, immediately observe the resulting grid in a clean interface, and download the modified document to verify OpenXML compliance in Microsoft Word.

## Solution

A dedicated, fast, and self-contained prototype in `prototypes/test-docXMLater` comprising:
1. A lightweight Express backend that loads uploaded `.docx` files into memory using `docXMLater`, exposes high-level table and row lookup endpoints, executes discrete mutations, and streams back the modified `.docx` binary.
2. A single-page React frontend styled with default Shadcn UI and Tailwind CSS featuring a split layout:
   - A left control sidebar providing document upload, table search (by index or contained text), row search (by index or contained text), and action buttons (Add Row Below, Remove Specific Row, Clear Row Contents, Remove Empty Rows, Download).
   - A right display pane rendering the active table with Shadcn borders and typography, highlighting the targeted/found row.

## User Stories

1. As a developer, I want to upload an existing `.docx` document from my local machine, so that I can inspect and test table operations on real documents.
2. As a developer, I want to see an immediate status indicator confirming that my file was successfully parsed and tables were discovered, so that I know the document is ready for testing.
3. As a developer, I want to locate a table by specifying its zero-based index, so that I can directly select and view a known table.
4. As a developer, I want to search for a table by entering text contained within it, so that I can automatically select the first table matching my query without guessing its index.
5. As a developer, I want to see the currently selected table rendered in a clean, legible grid, so that I can visually verify its structure and content.
6. As a developer, I want to locate a row within the selected table by specifying its zero-based row index, so that I can inspect and target a specific row.
7. As a developer, I want to search for a row by entering text contained inside it, so that the system automatically locates and targets the first row matching that keyword.
8. As a developer, I want the found or targeted row to be visually highlighted in the table grid, so that I have immediate confirmation of what row will be affected by subsequent actions.
9. As a developer, I want to add a new row below the currently selected row (or at the bottom if no row is selected), so that I can test row insertion capabilities with auto-generated empty cells matching the table column span.
10. As a developer, I want to delete the currently targeted row, so that I can test programmatic row removal.
11. As a developer, I want to clear the text contents of the currently targeted row without removing the row or deleting its cell structures, so that I can test non-destructive row clearing.
12. As a developer, I want to trigger an automated sweep to remove all empty rows in the active table, so that I can test docXMLater's native empty row cleanup capability.
13. As a developer, I want to download the modified document as a `.docx` file at any point during my testing session, so that I can open it in Microsoft Word and verify formatting and round-trip fidelity.
14. As a developer, I want clear and informative error messages if a search query yields no matches or an index is out of bounds, so that I understand why an operation could not be executed.

## Implementation Decisions

### Architectural Decisions
- **In-Memory Document Session Store:** The Express backend maintains active `Document` instances in an in-memory map keyed by session UUID (`docId`). This avoids disk I/O churn and enables instant round-trip responses for interactive row operations.
- **Minimalist Single-Component Frontend:** The UI is contained in `src/App.tsx` utilizing standard Shadcn/Tailwind components (Button, Input, Card, Table) in a two-column split layout (Controls on the left, Table Viewer on the right).
- **Single Backend Service:** The backend is implemented as a single, focused Express server in `backend/server.ts` executed with `tsx watch`.

### API Contracts
- `POST /api/document/upload`: Accepts `multipart/form-data` with key `file`. Returns `{ docId: string, tableCount: number, tables: Array<{ index: number, rowCount: number, columnCount: number, preview: string }> }`.
- `GET /api/document/:docId/tables/:tableIndex`: Returns `{ index: number, rowCount: number, columnCount: number, grid: string[][] }`.
- `POST /api/document/:docId/tables/search`: Accepts `{ query: string }`. Returns `{ foundIndex: number, rowCount: number, columnCount: number }` for the first matching table.
- `POST /api/document/:docId/tables/:tableIndex/rows/search`: Accepts `{ query: string }`. Returns `{ foundRowIndex: number }` for the first matching row.
- `POST /api/document/:docId/tables/:tableIndex/rows/add`: Accepts `{ afterRowIndex?: number }`. Inserts a blank row below `afterRowIndex` (or appends if omitted). Returns updated `{ grid: string[][], rowCount: number }`.
- `DELETE /api/document/:docId/tables/:tableIndex/rows/:rowIndex`: Removes the specified row. Returns updated `{ grid: string[][], rowCount: number }`.
- `POST /api/document/:docId/tables/:tableIndex/rows/:rowIndex/clear`: Empties all cell texts in the specified row. Returns updated `{ grid: string[][] }`.
- `POST /api/document/:docId/tables/:tableIndex/remove-empty-rows`: Cleans all blank rows in the table. Returns `{ removedCount: number, grid: string[][], rowCount: number }`.
- `GET /api/document/:docId/download`: Streams the modified `.docx` binary with standard OpenXML content headers.

### State & Interaction Conventions
- Search queries use case-insensitive substring matching.
- Selecting or finding a table resets any previously selected row index.
- Row clearing preserves cell paragraphs (`w:p`) with empty text strings (`""`), ensuring OpenXML schema validity.

## Testing Decisions

### Testing Seam
- **Primary Seam:** The HTTP API boundary of the Express server.
- **Rationale:** Testing at the HTTP request/response boundary validates file upload, document parsing, session state mutation, table/row search logic, row structural mutations, and binary `.docx` output in a single, high-fidelity contract test without mocking `docXMLater`.
- A standalone test script (`backend/test-api.ts` or Jest test) will upload a valid `.docx`, execute table search, row search, add row, clear row, remove empty rows, remove row, and download the resulting buffer, confirming that the output buffer is non-empty and valid.

## Out of Scope

- Pre-loaded sample document generation without file upload (user uploads their own `.docx`).
- Track changes / revision mode toggles (focus is strictly on standard destructive edits).
- Multi-match steppers (search selects the first match).
- Click-to-select rows directly on the table matrix (selection is driven by index or text search inputs).
- Cell styling tools (custom color pickers, font size adjustments, border customization UI).
- Database persistence or multi-tenant user authentication (this is a local developer prototype).

## Further Notes

- The prototype directory is `prototypes/test-docXMLater/`.
- Frontend runs via Vite on port `5173`.
- Backend runs via Express on port `5001`.
- Vite proxy configured to forward `/api` requests to `http://localhost:5001`.
