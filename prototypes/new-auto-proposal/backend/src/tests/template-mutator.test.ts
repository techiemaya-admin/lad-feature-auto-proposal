import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Document } from "docxmlater";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import {
  findTableAndRow,
  executeReplaceTextRun,
  executeReplaceTableCell,
  executeWrapConditionalRow,
  executeCollapseRepeatingTable,
  mutateDocumentTemplate,
} from "../services/template-mutator.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("docXMLater Word Template Mutation Suite", async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-mutator-test-"));
  const testDbPath = path.join(testDir, "test.sqlite");
  const testStorageDir = path.join(testDir, "storage");
  fs.mkdirSync(testStorageDir, { recursive: true });

  process.env.DB_PATH = testDbPath;
  process.env.STORAGE_DIR = testStorageDir;

  initDatabase(testDbPath);
  const app = createApp();

  const candidateMockDirs = [
    path.resolve(__dirname, "../../../Mock Data"),
    path.resolve(process.cwd(), "../Mock Data"),
    path.resolve(process.cwd(), "Mock Data"),
    path.resolve(process.cwd(), "prototypes/new-auto-proposal/Mock Data"),
  ];
  const mockDataDir = candidateMockDirs.find((d) => fs.existsSync(d));
  if (!mockDataDir) {
    throw new Error(`Mock Data directory not found. Looked in: ${candidateMockDirs.join(", ")}`);
  }

  const findDocx = (name: string) => {
    const docxSub = path.join(mockDataDir, "docx", name);
    return fs.existsSync(docxSub) ? docxSub : path.join(mockDataDir, name);
  };
  const northstarDocx = findDocx("Proposal_Northstar_BloomAndCo.docx");
  const fortressDocx = findDocx("Proposal_FortressIT_WhitfieldAssociates.docx");
  const fieldstoneDocx = findDocx("Proposal_Fieldstone_RosewoodHomeGoods.docx");

  t.after(() => {
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  await t.test("Unit: executeReplaceTextRun replaces text across XML runs", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));

    const result = executeReplaceTextRun(
      doc,
      {
        action: "replace_text_run",
        sample_text: "Whitfield & Associates",
        context_anchor: "Prepared for: Whitfield & Associates",
        template_tag: "{client_name}",
      },
      "client_name"
    );

    assert.equal(result.applied, true);

    // Verify tag is now in document text
    const fullText = doc
      .getAllParagraphs()
      .map((p) => p.getText())
      .join(" ");
    assert.ok(fullText.includes("{client_name}"));
  });

  await t.test("Unit: executeReplaceTableCell replaces cell with hybrid locator", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));

    // Fortress IT has Table 2 with row "Total employees / seats" -> "42"
    const result = executeReplaceTableCell(
      doc,
      {
        action: "replace_table_cell",
        table_index: 2,
        row_identifier: "Total employees / seats",
        col_index: 1,
        sample_text: "42",
        template_tag: "{seat_count}",
      },
      "seat_count"
    );

    assert.equal(result.applied, true);

    const match = findTableAndRow(doc, 2, "Total employees / seats");
    assert.ok(match);
    assert.equal(match.row.getCell(1)?.getText().trim(), "{seat_count}");
  });

  await t.test("Unit: executeWrapConditionalRow injects {#condition} across cells", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));

    // Fortress IT Table 2 has row: "Ohio state tax (6%, on recurring only)"
    const result = executeWrapConditionalRow(doc, {
      action: "wrap_conditional_row",
      table_index: 2,
      row_identifier: "Ohio state tax",
      condition_tag: "has_tax",
    });

    assert.equal(result.applied, true);

    const match = findTableAndRow(doc, 2, "Ohio state tax");
    assert.ok(match);
    const cell0 = match.row.getCell(0)?.getText() || "";
    const lastCell = match.row.getCell(match.row.getCellCount() - 1)?.getText() || "";

    assert.ok(cell0.includes("{#has_tax}"));
    assert.ok(lastCell.includes("{/has_tax}"));
  });

  await t.test(
    "Unit: executeCollapseRepeatingTable preserves header and collapses sample rows in reverse order",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));

      // Fieldstone Table 1 has 6 rows: Row 0 header, Rows 1..5 milestone phases
      const table1 = doc.getTableAt(1);
      assert.ok(table1);
      const initialRowCount = table1.getRowCount();
      assert.equal(initialRowCount, 6);

      const headerTextBefore = table1.getRow(0)?.getText();

      const result = executeCollapseRepeatingTable(
        doc,
        {
          action: "collapse_repeating_table",
          table_index: 1,
          loop_tag: "items",
          template_row_index: 1,
          column_tags: [
            { col_index: 0, replacement_tag: "{phase_number}" },
            { col_index: 1, replacement_tag: "{milestone_title}" },
            { col_index: 2, replacement_tag: "{deliverable_summary}" },
          ],
          delete_sample_rows_from: 2,
        },
        {
          loop_tag: "items",
        }
      );

      assert.equal(result.applied, true);

      // Header row must remain untouched
      assert.equal(table1.getRow(0)?.getText(), headerTextBefore);

      // Row 1 must have opening loop in Cell 0 and closing loop in last cell
      const row1 = table1.getRow(1);
      assert.ok(row1);
      assert.ok(row1.getCell(0)?.getText().includes("{#items}"));
      assert.ok(row1.getCell(2)?.getText().includes("{/items}"));

      // Redundant sample rows 2..5 must be pruned: table should now have exactly 2 rows
      assert.equal(table1.getRowCount(), 2);
    }
  );

  await t.test("Integration: Ingesting Fortress IT, seeding variables, and generating template", async () => {
    // 1. Ingest Fortress IT quote
    const submitRes = await request(app)
      .post("/api/companies/co2_msp/briefing/submit")
      .field("prompt", "MSP pricing prompt for Whitfield & Associates")
      .attach("file", fortressDocx);

    assert.equal(submitRes.status, 200);

    const db = getDatabase();
    const now = new Date().toISOString();

    // 2. Insert sample confirmed variables into company_variables
    const insertStmt = db.prepare(`
      INSERT INTO company_variables (
        id, company_id, variable_name, natural_name, category, data_type,
        is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `);

    insertStmt.run(
      "var_client_name",
      "co2_msp",
      "client_name",
      "Client Organization",
      "customer_input",
      "string",
      0,
      JSON.stringify({
        sample_value: "Whitfield & Associates",
        mutation: {
          action: "replace_text_run",
          sample_text: "Whitfield & Associates",
          context_anchor: "Prepared for: Whitfield & Associates",
          template_tag: "{client_name}",
        },
      }),
      now,
      now
    );

    insertStmt.run(
      "var_seats",
      "co2_msp",
      "seat_count",
      "Seat Count",
      "customer_input",
      "number",
      1,
      JSON.stringify({
        sample_value: "42",
        mutation: {
          action: "replace_table_cell",
          table_index: 2,
          row_identifier: "Total employees / seats",
          col_index: 1,
          sample_text: "42",
          template_tag: "{seat_count}",
        },
      }),
      now,
      now
    );

    insertStmt.run(
      "var_tax",
      "co2_msp",
      "sales_tax_amount",
      "Ohio State Sales Tax",
      "pricing",
      "currency",
      2,
      JSON.stringify({
        sample_value: "$154.80",
        visibility_rule: { condition_flag: "has_tax", show_when: "value > 0" },
        mutation: {
          action: "wrap_conditional_row",
          table_index: 2,
          row_identifier: "Ohio state tax",
          condition_tag: "has_tax",
        },
      }),
      now,
      now
    );

    // 3. Call POST /api/companies/co2_msp/template/generate
    const genRes = await request(app).post("/api/companies/co2_msp/template/generate");
    assert.equal(genRes.status, 200);
    assert.equal(genRes.body.success, true);
    assert.ok(genRes.body.tags_placed_count >= 2);
    assert.ok(genRes.body.conditional_rows_wrapped_count >= 1);

    // 4. Call GET /api/companies/co2_msp/template/status
    const statusRes = await request(app).get("/api/companies/co2_msp/template/status");
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.exists, true);
    assert.ok(statusRes.body.filesize > 0);
    assert.ok(statusRes.body.stats);

    // 5. Call GET /api/companies/co2_msp/template/download with binary buffer parser
    const dlRes = await request(app)
      .get("/api/companies/co2_msp/template/download")
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(dlRes.status, 200);
    assert.equal(
      dlRes.headers["content-type"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    // 6. Round-trip binary check: Reload the downloaded binary into docxmlater
    const reloadedDoc = await Document.loadFromBuffer(dlRes.body);
    assert.ok(reloadedDoc);
    const paragraphs = reloadedDoc.getAllParagraphs();
    assert.ok(paragraphs.length > 0);

    const reloadedText = paragraphs.map((p) => p.getText()).join(" ");
    assert.ok(
      reloadedText.includes("{client_name}"),
      "Mutated template should contain {client_name}"
    );

    // Table cell check
    const match = findTableAndRow(reloadedDoc, 2, "Total employees / seats");
    assert.ok(match);
    assert.equal(match.row.getCell(1)?.getText().trim(), "{seat_count}");
  });

  await t.test("Integration: Mutating Fieldstone (co3_dev) repeating milestones", async () => {
    const submitRes = await request(app)
      .post("/api/companies/co3_dev/briefing/submit")
      .field("prompt", "Fieldstone studio pricing spec")
      .attach("file", fieldstoneDocx);

    assert.equal(submitRes.status, 200);

    const db = getDatabase();
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO company_variables (
        id, company_id, variable_name, natural_name, category, data_type,
        is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `);

    insertStmt.run(
      "table_milestones",
      "co3_dev",
      "project_milestones",
      "Project Milestones",
      "table_loop",
      "table",
      0,
      JSON.stringify({
        table_index: 1,
        loop_tag: "milestones",
        type: "repeating_loop",
        columns: ["Phase", "Milestone", "Deliverable"],
        mutation: {
          action: "collapse_repeating_table",
          table_index: 1,
          loop_tag: "milestones",
          template_row_index: 1,
          delete_sample_rows_from: 2,
        },
      }),
      now,
      now
    );

    const genRes = await request(app).post("/api/companies/co3_dev/template/generate");
    assert.equal(genRes.status, 200);
    assert.equal(genRes.body.success, true);
    assert.equal(genRes.body.loops_collapsed_count, 1);

    const dlRes = await request(app)
      .get("/api/companies/co3_dev/template/download")
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(dlRes.status, 200);

    const mutatedDoc = await Document.loadFromBuffer(dlRes.body);
    const table1 = mutatedDoc.getTableAt(1);
    assert.ok(table1);
    assert.equal(table1.getRowCount(), 2);
    assert.ok(table1.getRow(1)?.getText().includes("{#milestones}"));
    assert.ok(table1.getRow(1)?.getText().includes("{/milestones}"));
  });
});
