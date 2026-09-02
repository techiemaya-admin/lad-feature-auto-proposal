import { Router, type Request, type Response, type NextFunction } from "express"
import multer from "multer"
import { Document, type Table } from "docxmlater"
import { sessionStore } from "../session.js"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
})

export const documentRouter = Router()

/**
 * Helper to retrieve an existing Document session or respond with 404.
 */
function getSessionDocument(req: Request, res: Response): Document | null {
  const { docId } = req.params
  if (!docId) {
    res.status(400).json({ error: "Missing docId parameter." })
    return null
  }
  const doc = sessionStore.get(docId)
  if (!doc) {
    res.status(404).json({ error: `Document session '${docId}' not found.` })
    return null
  }
  return doc
}

/**
 * Helper to retrieve a Table by index or respond with 400/404.
 */
function getDocumentTable(doc: Document, tableIndexStr: string, res: Response): { table: Table; tableIndex: number } | null {
  const tableIndex = parseInt(tableIndexStr, 10)
  if (Number.isNaN(tableIndex) || tableIndex < 0) {
    res.status(400).json({ error: "Invalid tableIndex: must be a non-negative integer." })
    return null
  }
  const table = doc.getTableAt(tableIndex)
  if (!table) {
    res.status(404).json({ error: `Table at index ${tableIndex} not found.` })
    return null
  }
  return { table, tableIndex }
}

/**
 * POST /api/document/upload
 * Accepts a .docx file, initializes docXMLater, stores session, and returns table metadata.
 */
documentRouter.post("/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file uploaded. Please provide a .docx file in the 'file' field." })
    }

    const doc = await Document.loadFromBuffer(req.file.buffer)
    const docId = sessionStore.create(doc)

    const tables = doc.getTables().map((table, index) => ({
      index,
      rowCount: table.getRowCount(),
      columnCount: table.getColumnCount(),
      preview: table.toArray()[0]?.join(" | ") ?? "",
    }))

    return res.json({
      docId,
      tableCount: tables.length,
      tables,
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * GET /api/document/:docId/tables/:tableIndex
 * Returns table dimensions and full 2D string grid.
 */
documentRouter.get("/:docId/tables/:tableIndex", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table, tableIndex } = result
  return res.json({
    index: tableIndex,
    rowCount: table.getRowCount(),
    columnCount: table.getColumnCount(),
    grid: table.toArray(),
  })
})

/**
 * POST /api/document/:docId/tables/search
 * Finds and returns the index of the first table containing query text.
 */
documentRouter.post("/:docId/tables/search", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const { query } = req.body
  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Query parameter must be a non-empty string." })
  }

  const q = query.trim().toLowerCase()
  const tables = doc.getTables()
  for (let i = 0; i < tables.length; i++) {
    if (tables[i].toPlainText().toLowerCase().includes(q)) {
      return res.json({
        foundIndex: i,
        rowCount: tables[i].getRowCount(),
        columnCount: tables[i].getColumnCount(),
      })
    }
  }

  return res.status(404).json({ error: `No table matching query "${query}" found.` })
})

/**
 * POST /api/document/:docId/tables/:tableIndex/rows/search
 * Finds and returns the index of the first row containing query text.
 */
documentRouter.post("/:docId/tables/:tableIndex/rows/search", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table } = result
  const { query } = req.body
  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Query parameter must be a non-empty string." })
  }

  const q = query.trim().toLowerCase()
  const rows = table.getRows()
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].getText().toLowerCase().includes(q)) {
      return res.json({ foundRowIndex: i })
    }
  }

  return res.status(404).json({ error: `No row matching query "${query}" found.` })
})

/**
 * POST /api/document/:docId/tables/:tableIndex/rows/add
 * Inserts a blank row with matching column span below the target row (or at table end).
 */
documentRouter.post("/:docId/tables/:tableIndex/rows/add", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table } = result
  const { afterRowIndex } = req.body

  let insertPosition: number
  if (afterRowIndex !== undefined && afterRowIndex !== null) {
    const parsedAfter = Number(afterRowIndex)
    if (Number.isNaN(parsedAfter) || parsedAfter < 0) {
      return res.status(400).json({ error: "Invalid afterRowIndex: must be a non-negative integer." })
    }
    insertPosition = parsedAfter + 1
  } else {
    insertPosition = table.getRowCount()
  }

  table.insertRow(insertPosition)

  return res.json({
    grid: table.toArray(),
    rowCount: table.getRowCount(),
  })
})

/**
 * DELETE /api/document/:docId/tables/:tableIndex/rows/:rowIndex
 * Removes the specified row from the table.
 */
documentRouter.delete("/:docId/tables/:tableIndex/rows/:rowIndex", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table } = result
  const rowIndex = parseInt(req.params.rowIndex, 10)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= table.getRowCount()) {
    return res.status(400).json({ error: `Invalid rowIndex: out of bounds [0, ${table.getRowCount() - 1}].` })
  }

  if (table.getRowCount() <= 1) {
    return res.status(400).json({ error: "Cannot delete row: OpenXML tables must contain at least one row." })
  }

  const success = table.removeRow(rowIndex)
  if (!success) {
    return res.status(400).json({ error: "Cannot delete row: OpenXML tables must contain at least one row." })
  }

  return res.json({
    grid: table.toArray(),
    rowCount: table.getRowCount(),
  })
})

/**
 * POST /api/document/:docId/tables/:tableIndex/rows/:rowIndex/clear
 * Clears text across all cells in the specified row non-destructively.
 */
documentRouter.post("/:docId/tables/:tableIndex/rows/:rowIndex/clear", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table } = result
  const rowIndex = parseInt(req.params.rowIndex, 10)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= table.getRowCount()) {
    return res.status(400).json({ error: `Invalid rowIndex: out of bounds [0, ${table.getRowCount() - 1}].` })
  }

  const colCount = table.getColumnCount()
  for (let col = 0; col < colCount; col++) {
    table.setCell(rowIndex, col, "")
  }

  return res.json({
    grid: table.toArray(),
  })
})

/**
 * POST /api/document/:docId/tables/:tableIndex/remove-empty-rows
 * Removes all empty rows and returns the count of purged rows.
 */
documentRouter.post("/:docId/tables/:tableIndex/remove-empty-rows", (req: Request, res: Response) => {
  const doc = getSessionDocument(req, res)
  if (!doc) return

  const result = getDocumentTable(doc, req.params.tableIndex, res)
  if (!result) return

  const { table } = result
  const removedCount = table.removeEmptyRows()

  return res.json({
    removedCount,
    grid: table.toArray(),
    rowCount: table.getRowCount(),
  })
})

/**
 * GET /api/document/:docId/download
 * Serializes the active Document back to a .docx buffer and streams it with appropriate headers.
 */
documentRouter.get("/:docId/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = getSessionDocument(req, res)
    if (!doc) return

    const buffer = await doc.toBuffer()
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    res.setHeader("Content-Disposition", 'attachment; filename="modified.docx"')
    res.setHeader("Content-Length", buffer.length)
    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
})
