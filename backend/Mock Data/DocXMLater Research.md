# docXMLater Table & Row Capabilities Research Reference

**Document Version:** 1.0.0  
**Package Under Test:** `docxmlater@12.1.0` (npm: [docxmlater](https://www.npmjs.com/package/docxmlater) | GitHub: [ItMeDiaTech/docXMLater](https://github.com/ItMeDiaTech/docXMLater))  
**Target Specification:** [docXMLater Table & Row Testing Prototype Spec](../../.scratch/docxmlater-table-prototype/spec.md)  
**Related Issue:** [01: Research and Verify docXMLater Table & Row Capabilities](../../.scratch/docxmlater-table-prototype/issues/01-research-docxmlater-table-capabilities.md)

---

## 1. Executive Summary & Package Architecture

`docxmlater` is a zero-native-dependency TypeScript library designed for non-destructive reading, mutation, and serialization of Microsoft Word (`.docx` / ECMA-376 OpenXML) documents. Unlike template substitution engines (such as `docxtemplater`) or HTML/markdown converters (such as `mammoth`), `docxmlater` maintains an in-memory Document Object Model (DOM) of the OpenXML package backed by `jszip`, parsing and generating XML while preserving styles, numbering, track changes, bookmarks, and structural hierarchy.

### Key Classes for Table Operations

```
┌─────────────────────────────────────────────────────────────┐
│                          Document                           │
│  - load() / loadFromBuffer() / create()                     │
│  - getTables() / getAllTables() / getTableAt() / toBuffer() │
└──────────────────────────────┬──────────────────────────────┘
                               │ contains 1..n
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                            Table                            │
│  - getRows() / getRow() / insertRow() / removeRow()         │
│  - getCell() / setCell() / removeEmptyRows() / toArray()    │
└──────────────────────────────┬──────────────────────────────┘
                               │ contains 1..n
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          TableRow                           │
│  - getCells() / getCell() / getTotalGridSpan() / toArray()  │
└──────────────────────────────┬──────────────────────────────┘
                               │ contains 1..n
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          TableCell                          │
│  - getParagraphs() / createParagraph() / getText()          │
└──────────────────────────────┬──────────────────────────────┘
                               │ contains 1..n
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          Paragraph                          │
│  - setText() / clearContent() / toXML()                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Document-Level Table Capabilities (`Document`)

The `Document` class coordinates package unzipping, document-level properties, body elements, and binary serialization.

### 2.1 Initialization & Binary Serialization

```typescript
import { Document } from 'docxmlater';

// 1. Create a blank document
const doc = Document.create();

// 2. Load from disk
const docFromFile = await Document.load('./template.docx');

// 3. Load from in-memory Buffer (used in Express Multer upload)
const docFromBuffer = await Document.loadFromBuffer(req.file.buffer);

// 4. Serialize back to .docx Buffer (used in Express download endpoint)
const outputBuffer: Buffer = await doc.toBuffer();
```

### 2.2 Table Discovery & Lookup

| Method | Signature | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `getTables()` | `doc.getTables()` | `Table[]` | Returns all top-level tables directly under document body. |
| `getAllTables()` | `doc.getAllTables()` | `Table[]` | Recursively walks the entire document tree to find tables (including inside SDTs/content controls). |
| `getTableAt(index)` | `doc.getTableAt(index: number)` | `Table \| undefined` | Retrieves the top-level table at 0-based `index`. |
| `getTableIndex(table)` | `doc.getTableIndex(table: Table)` | `number` | Returns 0-based index of table in body elements, or `-1` if not found. |
| `getTableCount()` | `doc.getTableCount()` | `number` | Returns the total count of top-level tables. |
| `addTable(table)` | `doc.addTable(table: Table)` | `this` | Appends a `Table` instance to the document body. |
| `createTable(rows, cols)`| `doc.createTable(rows: number, cols: number)` | `Table` | Creates, appends, and returns a new grid table. |

### 2.3 Table Search by Text (Empirically Verified Pattern)

`Document` does not expose an arbitrary text search helper on tables, but `Table` exposes `toPlainText()` and `toArray()`. To find the first table containing a specific keyword:

```typescript
function findTableByText(doc: Document, query: string): { table: Table; index: number } | null {
  const q = query.trim().toLowerCase();
  const tables = doc.getTables();
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    // toPlainText() returns tab-separated cells on newline-separated rows
    if (table.toPlainText().toLowerCase().includes(q)) {
      return { table, index: i };
    }
  }
  return null;
}
```

---

## 3. Table Class Reference (`Table`)

The `Table` class represents an ECMA-376 `<w:tbl>` element, managing row arrays, column definitions, borders, shading, and formatting.

### 3.1 Dimensions & Cell Access

| Method | Signature | Description |
| :--- | :--- | :--- |
| `getRowCount()` | `table.getRowCount(): number` | Number of rows currently in the table. |
| `getColumnCount()` | `table.getColumnCount(): number` | Number of columns in row 0 (or grid). |
| `getRow(index)` | `table.getRow(index: number): TableRow \| undefined` | Returns row at 0-based index. |
| `getRows()` | `table.getRows(): TableRow[]` | Returns shallow copy of all `TableRow` instances. |
| `getCell(rowIndex, colIndex)` | `table.getCell(r: number, c: number): TableCell \| undefined` | Safe 2D cell lookup. Returns `undefined` if indices are out of bounds. |
| `setCell(rowIndex, colIndex, text)` | `table.setCell(r: number, c: number, text: string): this` | Replaces cell text content while preserving the first paragraph structure. Extra paragraphs in the cell are removed. |

### 3.2 Row Mutations (Add, Insert, Remove)

#### Adding & Inserting Rows
```typescript
// 1. Insert a blank row below a specific row index (clamped to bounds)
// If row parameter is omitted, docxmlater automatically determines grid column
// span using formatting.tableGrid or Math.max(...rows.map(r => r.getTotalGridSpan()))
const newRow = table.insertRow(targetIndex + 1);

// 2. Append a row with string values
table.addRowFromArray(['Line Item 1', 'Qty: 4', '$400']);

// 3. Insert multiple blank rows at once
const addedRows: TableRow[] = table.insertRows(targetIndex, 3);
```

#### Deleting Rows & The Single-Row Guard
```typescript
const success: boolean = table.removeRow(rowIndex);
```

> [!IMPORTANT]
> **ECMA-376 Single-Row Invariant (`removeRow` returns `false`):**
> Per ECMA-376 §17.4.38, an OpenXML table must contain at least one row (`<w:tr>`).
> `Table.prototype.removeRow` has an internal guard:
> ```typescript
> if (this.rows.length <= 1 && !this.trackingContext?.isEnabled()) {
>   return false;
> }
> ```
> Attempting to delete the final row of a table will return `false` and leave the row in place. Backend services must catch this condition and inform the user.

### 3.3 Data Export & Grid Representation

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `toArray()` | `string[][]` | 2D matrix of trimmed/plain text strings for all rows and cells. |
| `toPlainText(colSep?, rowSep?)` | `string` | Tab/newline delimited plain text. |
| `toCSV(delimiter?)` | `string` | RFC 4180 compliant CSV export with quoted fields. |

---

## 4. TableRow Class Reference (`TableRow`)

The `TableRow` class represents `<w:tr>`, managing cells, row formatting (height, header repeat, cantSplit), and revision tracking.

### 4.1 Row Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `getCellCount()` | `row.getCellCount(): number` | Number of cells in this row. |
| `getCell(index)` | `row.getCell(index: number): TableCell \| undefined` | 0-based cell lookup. |
| `getCells()` | `row.getCells(): TableCell[]` | Array of cells. |
| `getTotalGridSpan()` | `row.getTotalGridSpan(): number` | Total grid units spanned by cells, accounting for `gridBefore`, `gridAfter`, and `columnSpan`. |
| `toArray()` | `row.toArray(): string[]` | Array of string texts for each cell in this row. |
| `getText(separator?)` | `row.getText(separator?: string): string` | Concatenated text of all cells (default separator is `\t`). |
| `createCell(text?)` | `row.createCell(text?: string): TableCell` | Creates and appends a cell. |
| `addCell(cell)` | `row.addCell(cell: TableCell): this` | Appends a cell. |

### 4.2 Row Search by Text (Empirically Verified Pattern)

```typescript
function findRowByText(table: Table, query: string): { row: TableRow; index: number } | null {
  const q = query.trim().toLowerCase();
  const rows = table.getRows();
  for (let i = 0; i < rows.length; i++) {
    // row.getText() checks text across all cells in this row
    if (rows[i].getText().toLowerCase().includes(q)) {
      return { row: rows[i], index: i };
    }
  }
  return null;
}
```

---

## 5. TableCell & Paragraph Reference (`TableCell`, `Paragraph`)

### 5.1 Cell Structure & OpenXML Schema Requirement

In OpenXML WordprocessingML (`wml.xsd`), every table cell `<w:tc>` must have:
1. Optional cell properties `<w:tcPr>` (width, borders, shading, merges).
2. **At least one block-level child element** (typically `<w:p>`). An empty `<w:tc/>` element is structurally invalid and triggers Word's "unreadable content" repair warning.

### 5.2 Non-Destructive Cell Text Clearing

When "clearing" a row's contents:
- **Incorrect:** Deleting the paragraph (`cell.removeParagraph(0)`). Leaving a cell with zero paragraphs causes structural corruption if not restored.
- **Correct (Recommended):** Use `table.setCell(rowIndex, colIndex, "")` or `para.setText("")`.

#### Why `table.setCell(r, c, "")` is Non-Destructive
Looking at `docxmlater`'s internal implementation in `Table.ts`:
```typescript
setCell(rowIndex: number, colIndex: number, text: string): this {
  const cell = this.getCell(rowIndex, colIndex);
  if (!cell) return this;

  const paragraphs = cell.getParagraphs();
  if (paragraphs.length > 0) {
    paragraphs[0]!.setText(text);
    // Remove extra paragraphs
    for (let p = paragraphs.length - 1; p >= 1; p--) {
      cell.removeParagraph(p);
    }
  } else {
    cell.createParagraph(text);
  }

  return this;
}
```
1. `paragraphs[0].setText("")` replaces run content with a single empty run (`<w:r><w:t xml:space="preserve"></w:t></w:r>`) while preserving the paragraph node `<w:p>`.
2. Any extra paragraphs in multi-line cells are purged.
3. If the cell had no paragraphs, `cell.createParagraph("")` initializes one.

#### Defensive Fallback in `TableCell.toXML()`
Even if all paragraphs were detached, `TableCell.prototype.toXML` includes a defensive guard (lines 1766–1769):
```typescript
if (this.paragraphs.length > 0) {
  // ... serialize paragraphs ...
} else {
  // Empty cell needs at least one empty paragraph per ECMA-376
  cellChildren.push(new Paragraph().toXML());
}
```
This double guarantee ensures that clearing cell text never corrupts the document XML.

---

## 6. Native Empty Row Removal (`removeEmptyRows`)

`Table.prototype.removeEmptyRows()` is built directly into `docxmlater`.

### 6.1 Exact Implementation Analysis

From `docxmlater/src/elements/Table.ts`:
```typescript
removeEmptyRows(): number {
  const emptyIndices = this.filterRows((cells) => cells.every((c) => c.getText().trim() === ''));
  if (emptyIndices.length === 0) return 0;

  // Do not remove all rows (must keep at least one row per ECMA-376)
  const toRemove =
    emptyIndices.length >= this.rows.length
      ? emptyIndices.slice(0, this.rows.length - 1)
      : emptyIndices;

  for (let i = toRemove.length - 1; i >= 0; i--) {
    this.removeRow(toRemove[i]!);
  }
  return toRemove.length;
}
```

### 6.2 Key Behavioral Nuances
1. **Emptiness Definition:** A row is empty if **every** cell has `cell.getText().trim() === ''`. Rows with spaces, tabs, or non-visible whitespace are recognized as empty.
2. **Reverse Splice:** The loop runs backwards (`i = toRemove.length - 1 down to 0`), ensuring indices do not shift during splice operations.
3. **All-Empty Safeguard:** If every single row in the table is empty, `emptyIndices.slice(0, this.rows.length - 1)` removes all rows **except the first row**, satisfying OpenXML's minimum 1-row constraint.
4. **Return Value:** Returns the exact count of rows removed (`number`).

---

## 7. Edge Cases & Backend Engineering Guardrails

When building the Express backend service (`prototypes/test-docXMLater/backend`), adhere to the following rules:

### 1. The Single-Row Table Limit
- **Behavior:** `table.removeRow(0)` on a 1-row table returns `false`.
- **Backend Handling:** Return HTTP 400 or a structured response:
  ```json
  { "error": "Cannot delete row: OpenXML tables must contain at least one row." }
  ```

### 2. Clamped Row Insertion
- **Behavior:** `table.insertRow(index)` clamps `index < 0` to `0` and `index > rows.length` to `rows.length`.
- **Backend Handling:** Accept `afterRowIndex?: number`. If `afterRowIndex` is provided, insert at `afterRowIndex + 1`. If omitted, insert at `table.getRowCount()` (append).

### 3. Merged Cells & Grid Width Discrepancies
- **Behavior:** If an existing table has horizontally merged cells (`gridSpan`), `row.getCellCount()` might be smaller than `table.getColumnCount()`.
- **Handling:** `insertRow()` uses `Math.max(...rows.map(r => r.getTotalGridSpan()))` to generate cells matching the physical column grid.

### 4. Substring Search Robustness
- Trim search queries and compare with `.toLowerCase()`.
- If no matching table or row is found, return HTTP 404 with `{ "error": "No table/row matching query found." }`.

### 5. In-Memory Session Management
- Maintain documents in a `Map<string, Document>()`.
- Each upload generates a `docId = crypto.randomUUID()`.
- Operations mutate the `Document` in place.
- Download calls `doc.toBuffer()` and streams with:
  ```typescript
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="modified.docx"');
  ```

---

## 8. Summary of Verified Method Mappings for Prototype Endpoints

| Endpoint Requirement | Recommended `docxmlater` Code Implementation |
| :--- | :--- |
| **Upload DOCX** | `const doc = await Document.loadFromBuffer(req.file.buffer);` |
| **List Tables** | `doc.getTables().map((t, idx) => ({ index: idx, rowCount: t.getRowCount(), columnCount: t.getColumnCount(), preview: t.toArray()[0]?.join(' \| ') ?? '' }))` |
| **Get Table Grid** | `const table = doc.getTableAt(tableIndex); return { grid: table.toArray(), rowCount: table.getRowCount(), columnCount: table.getColumnCount() };` |
| **Search Table** | `const idx = doc.getTables().findIndex(t => t.toPlainText().toLowerCase().includes(query.toLowerCase()));` |
| **Search Row** | `const rowIdx = table.getRows().findIndex(r => r.getText().toLowerCase().includes(query.toLowerCase()));` |
| **Add Row Below** | `const targetPos = afterRowIndex !== undefined ? afterRowIndex + 1 : table.getRowCount(); table.insertRow(targetPos);` |
| **Remove Row** | `const ok = table.removeRow(rowIndex); if (!ok) throw new Error('Cannot remove row');` |
| **Clear Row** | `for (let c = 0; c < table.getColumnCount(); c++) { table.setCell(rowIndex, c, ''); }` |
| **Remove Empty Rows** | `const removedCount = table.removeEmptyRows();` |
| **Download DOCX** | `const buffer = await doc.toBuffer(); res.send(buffer);` |
