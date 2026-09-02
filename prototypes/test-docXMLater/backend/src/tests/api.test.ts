import assert from "node:assert/strict"
import request from "supertest"
import { Document } from "docxmlater"
import { createApp } from "../app.js"
import { sessionStore } from "../session.js"

async function runTests() {
  console.log("=== Starting docXMLater Backend API Test Suite ===\n")
  const app = createApp()

  // 1. Prepare sample DOCX in memory
  console.log("[Setup] Generating in-memory test .docx document...")
  const seedDoc = Document.create()

  // Table 0: 4 rows x 3 columns with headers, data, and an empty row
  const t0 = seedDoc.createTable(4, 3)
  t0.setCell(0, 0, "Item")
  t0.setCell(0, 1, "Quantity")
  t0.setCell(0, 2, "Price")

  t0.setCell(1, 0, "Product Alpha")
  t0.setCell(1, 1, "2")
  t0.setCell(1, 2, "$100")

  // Row 2 is intentionally empty for remove-empty-rows testing
  t0.setCell(2, 0, "")
  t0.setCell(2, 1, "")
  t0.setCell(2, 2, "")

  t0.setCell(3, 0, "Product Beta")
  t0.setCell(3, 1, "5")
  t0.setCell(3, 2, "$250")

  // Table 1: 1 row x 2 columns for single-row deletion limit testing
  const t1 = seedDoc.createTable(1, 2)
  t1.setCell(0, 0, "Confidential Notice")
  t1.setCell(0, 1, "Internal Use Only")

  const seedDocBuffer = await seedDoc.toBuffer()
  assert.ok(seedDocBuffer.length > 0, "Seed docx buffer should be non-empty")
  console.log(`[Setup] Generated seed document (${seedDocBuffer.length} bytes)\n`)

  let activeDocId = ""

  // -------------------------------------------------------------
  // Test 1: GET /api/health
  // -------------------------------------------------------------
  {
    console.log("[Test 1] GET /api/health")
    const res = await request(app).get("/api/health")
    assert.equal(res.status, 200)
    assert.equal(res.body.status, "ok")
    console.log("  ✓ Health check passed")
  }

  // -------------------------------------------------------------
  // Test 2: POST /api/document/upload (Validation & Success)
  // -------------------------------------------------------------
  {
    console.log("[Test 2] POST /api/document/upload")
    // Missing file
    const res400 = await request(app).post("/api/document/upload")
    assert.equal(res400.status, 400)
    assert.ok(res400.body.error)
    console.log("  ✓ Rejects upload without file (400)")

    // Valid file
    const res200 = await request(app)
      .post("/api/document/upload")
      .attach("file", seedDocBuffer, "sample.docx")

    assert.equal(res200.status, 200)
    assert.ok(res200.body.docId, "Response should have docId")
    assert.equal(res200.body.tableCount, 2, "Should discover 2 tables")
    assert.equal(res200.body.tables.length, 2)
    assert.equal(res200.body.tables[0].index, 0)
    assert.equal(res200.body.tables[0].rowCount, 4)
    assert.equal(res200.body.tables[0].columnCount, 3)
    assert.equal(res200.body.tables[1].index, 1)
    assert.equal(res200.body.tables[1].rowCount, 1)

    activeDocId = res200.body.docId
    console.log(`  ✓ Document parsed successfully. docId=${activeDocId}`)
  }

  // -------------------------------------------------------------
  // Test 3: GET /api/document/:docId/tables/:tableIndex
  // -------------------------------------------------------------
  {
    console.log("[Test 3] GET /api/document/:docId/tables/:tableIndex")
    // Nonexistent session
    const res404Session = await request(app).get("/api/document/non-existent-uuid/tables/0")
    assert.equal(res404Session.status, 404)
    console.log("  ✓ Returns 404 for invalid docId")

    // Out of bounds table
    const res404Table = await request(app).get(`/api/document/${activeDocId}/tables/99`)
    assert.equal(res404Table.status, 404)
    console.log("  ✓ Returns 404 for out of bounds tableIndex")

    // Valid table 0
    const res200 = await request(app).get(`/api/document/${activeDocId}/tables/0`)
    assert.equal(res200.status, 200)
    assert.equal(res200.body.index, 0)
    assert.equal(res200.body.rowCount, 4)
    assert.equal(res200.body.columnCount, 3)
    assert.equal(res200.body.grid.length, 4)
    assert.deepEqual(res200.body.grid[0], ["Item", "Quantity", "Price"])
    assert.deepEqual(res200.body.grid[1], ["Product Alpha", "2", "$100"])
    console.log("  ✓ Table 0 2D grid retrieved accurately")
  }

  // -------------------------------------------------------------
  // Test 4: POST /api/document/:docId/tables/search
  // -------------------------------------------------------------
  {
    console.log("[Test 4] POST /api/document/:docId/tables/search")
    // Missing query
    const res400 = await request(app)
      .post(`/api/document/${activeDocId}/tables/search`)
      .send({})
    assert.equal(res400.status, 400)

    // Search table 0 by text "alpha"
    const resFound0 = await request(app)
      .post(`/api/document/${activeDocId}/tables/search`)
      .send({ query: "alpha" })
    assert.equal(resFound0.status, 200)
    assert.equal(resFound0.body.foundIndex, 0)
    assert.equal(resFound0.body.rowCount, 4)
    assert.equal(resFound0.body.columnCount, 3)

    // Search table 1 by text "confidential"
    const resFound1 = await request(app)
      .post(`/api/document/${activeDocId}/tables/search`)
      .send({ query: "CONFIDENTIAL" })
    assert.equal(resFound1.status, 200)
    assert.equal(resFound1.body.foundIndex, 1)

    // Search nonexistent
    const resNotFound = await request(app)
      .post(`/api/document/${activeDocId}/tables/search`)
      .send({ query: "nonexistent keyword xyz" })
    assert.equal(resNotFound.status, 404)
    console.log("  ✓ Table search by text passed (case-insensitive, 200 & 404)")
  }

  // -------------------------------------------------------------
  // Test 5: POST /api/document/:docId/tables/:tableIndex/rows/search
  // -------------------------------------------------------------
  {
    console.log("[Test 5] POST /api/document/:docId/tables/:tableIndex/rows/search")
    // Search row in Table 0
    const resFound = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/rows/search`)
      .send({ query: "beta" })
    assert.equal(resFound.status, 200)
    assert.equal(resFound.body.foundRowIndex, 3)

    // Search row nonexistent in Table 0
    const resNotFound = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/rows/search`)
      .send({ query: "Nonexistent Row Data" })
    assert.equal(resNotFound.status, 404)
    console.log("  ✓ Row search by text passed (case-insensitive, 200 & 404)")
  }

  // -------------------------------------------------------------
  // Test 6: POST /api/document/:docId/tables/:tableIndex/rows/add
  // -------------------------------------------------------------
  {
    console.log("[Test 6] POST /api/document/:docId/tables/:tableIndex/rows/add")
    // 6a. Insert after row index 1 (between Product Alpha and empty row)
    const resAddAfter = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/rows/add`)
      .send({ afterRowIndex: 1 })
    assert.equal(resAddAfter.status, 200)
    assert.equal(resAddAfter.body.rowCount, 5)
    // The newly inserted row at index 2 should have 3 empty cells
    assert.equal(resAddAfter.body.grid[2].length, 3)
    assert.deepEqual(resAddAfter.body.grid[2], ["", "", ""])
    console.log("  ✓ Insert row after index 1 passed (rowCount=5)")

    // 6b. Append at table end (no afterRowIndex)
    const resAppend = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/rows/add`)
      .send({})
    assert.equal(resAppend.status, 200)
    assert.equal(resAppend.body.rowCount, 6)
    assert.equal(resAppend.body.grid[5].length, 3)
    console.log("  ✓ Append row at end passed (rowCount=6)")
  }

  // -------------------------------------------------------------
  // Test 7: POST /api/document/:docId/tables/:tableIndex/rows/:rowIndex/clear
  // -------------------------------------------------------------
  {
    console.log("[Test 7] POST /api/document/:docId/tables/:tableIndex/rows/:rowIndex/clear")
    // Clear row 1 ("Product Alpha", "2", "$100")
    const resClear = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/rows/1/clear`)
    assert.equal(resClear.status, 200)
    assert.deepEqual(resClear.body.grid[1], ["", "", ""])
    console.log("  ✓ Clear row 1 passed (all cells cleared non-destructively)")
  }

  // -------------------------------------------------------------
  // Test 8: POST /api/document/:docId/tables/:tableIndex/remove-empty-rows
  // -------------------------------------------------------------
  {
    console.log("[Test 8] POST /api/document/:docId/tables/:tableIndex/remove-empty-rows")
    // Table 0 currently has:
    // row 0: Header ("Item", "Quantity", "Price")
    // row 1: cleared -> ["", "", ""] (empty)
    // row 2: newly inserted -> ["", "", ""] (empty)
    // row 3: originally empty row -> ["", "", ""] (empty)
    // row 4: "Product Beta"
    // row 5: appended empty row -> ["", "", ""] (empty)
    const resRemoveEmpty = await request(app)
      .post(`/api/document/${activeDocId}/tables/0/remove-empty-rows`)
    assert.equal(resRemoveEmpty.status, 200)
    assert.equal(resRemoveEmpty.body.removedCount, 4)
    assert.equal(resRemoveEmpty.body.rowCount, 2)
    assert.deepEqual(resRemoveEmpty.body.grid[0], ["Item", "Quantity", "Price"])
    assert.deepEqual(resRemoveEmpty.body.grid[1], ["Product Beta", "5", "$250"])
    console.log("  ✓ Remove empty rows passed (purged 4 empty rows, remaining=2)")
  }

  // -------------------------------------------------------------
  // Test 9: DELETE /api/document/:docId/tables/:tableIndex/rows/:rowIndex
  // -------------------------------------------------------------
  {
    console.log("[Test 9] DELETE /api/document/:docId/tables/:tableIndex/rows/:rowIndex")
    // 9a. Test single-row invariant refusal on Table 1 (which only has 1 row)
    const resSingleRowGuard = await request(app)
      .delete(`/api/document/${activeDocId}/tables/1/rows/0`)
    assert.equal(resSingleRowGuard.status, 400)
    assert.match(resSingleRowGuard.body.error, /at least one row/i)
    console.log("  ✓ Single-row table deletion prevented with 400 guard")

    // 9b. Delete row 1 ("Product Beta") from Table 0
    const resDelete = await request(app)
      .delete(`/api/document/${activeDocId}/tables/0/rows/1`)
    assert.equal(resDelete.status, 200)
    assert.equal(resDelete.body.rowCount, 1)
    assert.deepEqual(resDelete.body.grid[0], ["Item", "Quantity", "Price"])
    console.log("  ✓ Valid row deletion passed (rowCount=1)")
  }

  // -------------------------------------------------------------
  // Test 10: GET /api/document/:docId/download (Round-trip integrity)
  // -------------------------------------------------------------
  {
    console.log("[Test 10] GET /api/document/:docId/download")
    const resDownload = await request(app)
      .get(`/api/document/${activeDocId}/download`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = []
        res.on("data", (chunk) => data.push(chunk))
        res.on("end", () => callback(null, Buffer.concat(data)))
      })

    assert.equal(resDownload.status, 200)
    assert.equal(
      resDownload.headers["content-type"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert.ok(resDownload.body.length > 0)

    // Verify binary round-trip: reload downloaded buffer into docxmlater
    const reloadedDoc = await Document.loadFromBuffer(resDownload.body)
    const reloadedTables = reloadedDoc.getTables()
    assert.equal(reloadedTables.length, 2, "Reloaded document should preserve both tables")
    assert.equal(reloadedTables[0].getRowCount(), 1, "Table 0 should have 1 remaining row")
    assert.deepEqual(reloadedTables[0].toArray()[0], ["Item", "Quantity", "Price"])
    assert.equal(reloadedTables[1].getRowCount(), 1, "Table 1 should have 1 row")
    console.log(`  ✓ Document binary download verified. Round-trip re-parsing successful (${resDownload.body.length} bytes)`)
  }

  console.log("\n==================================================")
  console.log("🎉 ALL API TESTS PASSED SUCCESSFULLY!")
  console.log("==================================================")
}

runTests().catch((err) => {
  console.error("\n❌ Test suite failed:", err)
  process.exit(1)
})
