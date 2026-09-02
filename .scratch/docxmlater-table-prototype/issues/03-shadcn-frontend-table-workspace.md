# 03: Shadcn Frontend Table Testing Workspace

**What to build:** An interactive React application in `prototypes/test-docXMLater/frontend` styled with default Shadcn UI and Tailwind CSS, providing a split-view workspace where developers upload a `.docx`, search and select tables by index or text, search rows by index or text, execute row mutations, observe instant grid updates, and download the modified `.docx`.

**Blocked by:** 02: Express Backend Table & Row Mutation Service

**Status:** resolved

- [x] Vite proxy configured to forward `/api` requests to Express backend at `http://localhost:5001`.
- [x] Left control panel with file uploader component accepting `.docx` files and displaying document status.
- [x] Table search controls allowing selection by zero-based index or search by contained text.
- [x] Row search controls allowing targeting by zero-based index or search by contained text within the active table.
- [x] Action buttons for "Add Row Below", "Remove Row", "Clear Row Contents", and "Remove Empty Rows" wired to the backend API.
- [x] Top/header download button that triggers browser download of the updated `.docx` file.
- [x] Right display panel rendering the current table grid with Shadcn styling, row numbers, and distinct visual highlight on the currently targeted row.
- [x] User feedback toasts or banner notifications for search misses, errors, and empty-row cleanup counts.
