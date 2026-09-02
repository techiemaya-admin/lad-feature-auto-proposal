# 02: Express Backend Table & Row Mutation Service

**What to build:** An Express backend service in `prototypes/test-docXMLater/backend` that maintains an in-memory document session store, accepts uploaded `.docx` files, exposes API endpoints to find tables and rows by index or text, performs row additions, deletions, clearing, and empty row purges using `docXMLater`, and streams the modified document for download.

**Blocked by:** 01: Research and Verify docXMLater Table & Row Capabilities

**Status:** ready-for-agent

- [ ] Express server running on port 5001 with CORS, JSON body parser, and Multer upload middleware.
- [ ] In-memory session store mapping `docId` to active `Document` instances.
- [ ] `POST /api/document/upload` accepts `.docx` file, initializes `docXMLater`, and returns discovered table metadata and `docId`.
- [ ] `GET /api/document/:docId/tables/:tableIndex` returns table dimensions and full 2D string grid.
- [ ] `POST /api/document/:docId/tables/search` finds and returns the index of the first table containing query text.
- [ ] `POST /api/document/:docId/tables/:tableIndex/rows/search` finds and returns the index of the first row containing query text.
- [ ] `POST /api/document/:docId/tables/:tableIndex/rows/add` inserts a blank row with matching column span below the target row (or at table end).
- [ ] `DELETE /api/document/:docId/tables/:tableIndex/rows/:rowIndex` removes the specified row from the table.
- [ ] `POST /api/document/:docId/tables/:tableIndex/rows/:rowIndex/clear` clears text across all cells in the specified row.
- [ ] `POST /api/document/:docId/tables/:tableIndex/remove-empty-rows` removes all empty rows and returns the count of purged rows.
- [ ] `GET /api/document/:docId/download` serializes the active `Document` back to a `.docx` buffer and streams it with appropriate MIME type headers.
