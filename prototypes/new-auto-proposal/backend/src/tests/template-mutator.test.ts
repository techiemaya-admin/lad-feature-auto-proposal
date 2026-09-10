import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Document, Paragraph } from "docxmlater";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import {
  findTableAndRow,
  executeReplaceTextRun,
  executeReplaceTableCell,
  executeWrapConditionalRow,
  executeCollapseRepeatingTable,
  mutateDocumentTemplate,
  hydrateProposalTemplate,
  isColumnHeaderRow,
  tableMatchesHeaders,
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

  await t.test("Unit: Header Protection Guard prevents wrapping or overwriting Table Row 0", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(northstarDocx));
    const table2 = doc.getTableAt(2);
    assert.ok(table2);

    const headerTextBefore = table2.getRow(0)?.getText();
    assert.equal(headerTextBefore, "Line Item\tAmount");

    // 1. Attempt conditional wrap on Row 0 using header identifier
    const wrapHeaderRes = executeWrapConditionalRow(doc, {
      action: "wrap_conditional_row",
      table_index: 2,
      row_identifier: "Line Item",
      condition_tag: "has_discount",
    });

    // Should refuse to wrap header row
    assert.equal(wrapHeaderRes.applied, false);
    assert.equal(table2.getRow(0)?.getText(), headerTextBefore);
    assert.ok(!table2.getRow(0)?.getText().includes("{#has_discount}"));

    // 2. Wrap valid data row (Annual prepay discount)
    const wrapDataRes = executeWrapConditionalRow(doc, {
      action: "wrap_conditional_row",
      table_index: 2,
      row_identifier: "Annual prepay discount",
      condition_tag: "has_annual_discount",
    });

    assert.equal(wrapDataRes.applied, true);
    // Row 0 still untouched
    assert.equal(table2.getRow(0)?.getText(), headerTextBefore);
    // Row 2 received conditional wrapper
    const row2 = table2.getRow(2);
    assert.ok(row2);
    assert.ok(row2.getCell(0)?.getText().includes("{#has_annual_discount}"));
    assert.ok(row2.getCell(1)?.getText().includes("{/has_annual_discount}"));
  });

  await t.test("Unit: Comparison Matrix preserves Row 0 package header and targets rate row", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(northstarDocx));
    const table1 = doc.getTableAt(1);
    assert.ok(table1);

    const initialHeaderCol1 = table1.getRow(0)?.getCell(1)?.getText();
    assert.ok(initialHeaderCol1?.includes("Growth"));

    // Rate replacement targeting price row ($3,000/mo) in Table 1 Col 1
    const rateReplaceRes = executeReplaceTableCell(doc, {
      action: "replace_table_cell",
      table_index: 1,
      row_identifier: "$3,000/mo",
      col_index: 1,
      sample_text: "$3,000/mo",
      template_tag: "{selected_tier_rate}",
    });

    assert.equal(rateReplaceRes.applied, true);
    // Row 0 package title header is 100% preserved
    assert.equal(table1.getRow(0)?.getCell(1)?.getText(), initialHeaderCol1);
    // Row 1 rate cell receives dynamic tag
    assert.equal(table1.getRow(1)?.getCell(1)?.getText().trim(), "{selected_tier_rate}");
  });

  await t.test("Unit: Composite label cross-run replacement preserves surrounding text in Cell 0", async () => {
    const doc = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));
    const table2 = doc.getTableAt(2);
    assert.ok(table2);

    // Fortress IT Table 2 Row 4 has label: "Seat subtotal (42 seats × $60.00)"
    const row4Before = table2.getRow(4)?.getCell(0)?.getText();
    assert.ok(row4Before?.includes("Seat subtotal (42 seats × $60.00)"));

    const result = executeReplaceTableCell(
      doc,
      {
        action: "replace_table_cell",
        table_index: 2,
        row_identifier: "Seat subtotal",
        col_index: 0,
        sample_text: "42 seats × $60.00",
        template_tag: "{seat_count} seats × {adjusted_seat_rate}",
      },
      "seat_subtotal_formula"
    );

    assert.equal(result.applied, true);
    const row4After = table2.getRow(4)?.getCell(0)?.getText();
    assert.equal(
      row4After?.trim(),
      "Seat subtotal ({seat_count} seats × {adjusted_seat_rate})"
    );
    // Col 1 ($2,520.00) remains untouched
    assert.equal(table2.getRow(4)?.getCell(1)?.getText().trim(), "$2,520.00");
  });

  await t.test(
    "Unit: Payment Schedule Table collapses from 3 rows to 2 rows with {#payment_milestones}",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));
      const table3 = doc.getTableAt(3);
      assert.ok(table3);
      assert.equal(table3.getRowCount(), 3);

      const collapsePaymentRes = executeCollapseRepeatingTable(doc, {
        action: "collapse_repeating_table",
        table_index: 3,
        row_identifier: "Deposit",
        loop_tag: "payment_milestones",
        template_row_index: 1,
        column_tags: [
          { col_index: 0, replacement_tag: "{milestone_name}" },
          { col_index: 1, replacement_tag: "{trigger_description}" },
          { col_index: 2, replacement_tag: "{payment_amount}" },
        ],
        delete_sample_rows_from: 2,
      });

      assert.equal(collapsePaymentRes.applied, true);
      assert.equal(table3.getRowCount(), 2);
      const row1 = table3.getRow(1);
      assert.ok(row1?.getCell(0)?.getText().includes("{#payment_milestones}"));
      assert.ok(row1?.getCell(0)?.getText().includes("{milestone_name}"));
      assert.ok(row1?.getCell(1)?.getText().includes("{trigger_description}"));
      assert.ok(row1?.getCell(2)?.getText().includes("{/payment_milestones}"));
      assert.ok(row1?.getCell(2)?.getText().includes("{payment_amount}"));
    }
  );

  await t.test(
    "Unit: Fieldstone Add-on Loop Mid-Table Collapse collapses add-ons into {#addon_items} while preserving surrounding rows",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));
      const table2 = doc.getTableAt(2);
      assert.ok(table2);
      assert.equal(table2.getRowCount(), 7);

      const collapseAddonRes = executeCollapseRepeatingTable(doc, {
        action: "collapse_repeating_table",
        table_index: 2,
        row_identifier: "Copywriting add-on",
        loop_tag: "addon_items",
        template_row_index: 2,
        column_tags: [
          { col_index: 0, replacement_tag: "{addon_name}" },
          { col_index: 1, replacement_tag: "{addon_fee}" },
        ],
        delete_sample_rows_from: 3,
        delete_sample_rows_count: 1,
      });

      assert.equal(collapseAddonRes.applied, true);
      assert.equal(table2.getRowCount(), 6);

      // Row 0 header preserved
      assert.equal(table2.getRow(0)?.getText().trim(), "Line Item\tAmount");
      // Row 1 base template preserved
      assert.ok(table2.getRow(1)?.getText().includes("E-Commerce Build"));
      // Row 2 is now loop row
      const addonLoopRow = table2.getRow(2);
      assert.ok(addonLoopRow?.getCell(0)?.getText().includes("{#addon_items}"));
      assert.ok(addonLoopRow?.getCell(0)?.getText().includes("{addon_name}"));
      assert.ok(addonLoopRow?.getCell(1)?.getText().includes("{/addon_items}"));
      assert.ok(addonLoopRow?.getCell(1)?.getText().includes("{addon_fee}"));
      // Row 3 is Add-on subtotal
      assert.ok(table2.getRow(3)?.getText().includes("Add-on subtotal"));
      // Row 4 is Bundle discount
      assert.ok(table2.getRow(4)?.getText().includes("Bundle discount"));
      // Row 5 is Total Project Investment
      assert.ok(table2.getRow(5)?.getText().includes("Total Project Investment"));
    }
  );

  await t.test(
    "Integration: Hydrating mutated template with easy-template-x renders dynamic add-ons (0 vs 3) and flexible payment milestones (thirds)",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));

      // 1. Collapse Table 1 (Milestones)
      executeCollapseRepeatingTable(doc, {
        action: "collapse_repeating_table",
        table_index: 1,
        loop_tag: "milestones",
        template_row_index: 1,
        column_tags: [
          { col_index: 0, replacement_tag: "{phase_number}" },
          { col_index: 1, replacement_tag: "{milestone_title}" },
          { col_index: 2, replacement_tag: "{deliverable_summary}" },
        ],
        delete_sample_rows_from: 2,
      });

      // 2. Collapse Table 2 Add-ons mid-table section into {#addon_items}
      executeCollapseRepeatingTable(doc, {
        action: "collapse_repeating_table",
        table_index: 2,
        row_identifier: "Copywriting add-on",
        loop_tag: "addon_items",
        template_row_index: 2,
        column_tags: [
          { col_index: 0, replacement_tag: "{addon_name}" },
          { col_index: 1, replacement_tag: "{addon_fee}" },
        ],
        delete_sample_rows_from: 3,
        delete_sample_rows_count: 1,
      });

      // 3. Wrap conditional rows in Table 2
      executeWrapConditionalRow(doc, {
        action: "wrap_conditional_row",
        table_index: 2,
        row_identifier: "Add-on subtotal",
        condition_tag: "has_addons",
      });
      executeWrapConditionalRow(doc, {
        action: "wrap_conditional_row",
        table_index: 2,
        row_identifier: "Bundle discount",
        condition_tag: "has_bundle_discount",
      });

      // 4. Collapse Table 3 (Payment Schedule)
      executeCollapseRepeatingTable(doc, {
        action: "collapse_repeating_table",
        table_index: 3,
        row_identifier: "Deposit",
        loop_tag: "payment_milestones",
        template_row_index: 1,
        column_tags: [
          { col_index: 0, replacement_tag: "{milestone_name}" },
          { col_index: 1, replacement_tag: "{trigger_description}" },
          { col_index: 2, replacement_tag: "{payment_amount}" },
        ],
        delete_sample_rows_from: 2,
      });

      const templateBuffer = await doc.toBuffer();

      // Case A: 0 add-ons selected -> add-on items drop, conditional subtotal & discount drop cleanly
      const zeroAddonsPayload = {
        client_name: "Acme Corp",
        proposal_date: "October 12, 2026",
        proposal_valid_until: "November 12, 2026",
        project_template_name: "E-commerce Template",
        base_template_fee: "$8,500.00",
        has_addons: false,
        addon_items: [],
        has_bundle_discount: false,
        total_project_investment: "$8,500.00",
        milestones: [
          { phase_number: 1, milestone_title: "Discovery", deliverable_summary: "Scope doc" },
        ],
        payment_milestones: [
          {
            milestone_name: "Full Upfront (100%)",
            trigger_description: "Project kickoff",
            payment_amount: "$8,500.00",
          },
        ],
      };

      const hydratedZero = await hydrateProposalTemplate(templateBuffer, zeroAddonsPayload);
      assert.ok(hydratedZero.length > 0);

      const zeroDoc = await Document.loadFromBuffer(hydratedZero);
      const zeroTable2 = zeroDoc.getTableAt(2);
      assert.ok(zeroTable2);
      const zeroTable2Text = zeroTable2.getRows().map((r) => r.getText()).join("\n");
      assert.ok(!zeroTable2Text.includes("Copywriting"));
      assert.ok(!zeroTable2Text.includes("Basic SEO Setup"));
      assert.ok(!zeroTable2Text.includes("Add-on subtotal"));
      assert.ok(!zeroTable2Text.includes("Bundle discount"));
      assert.ok(zeroTable2Text.includes("E-Commerce Build"));
      assert.ok(zeroTable2Text.includes("Total Project Investment"));

      // Case B: 3 add-ons requested (including un-modeled CMS Integration & Extra Revisions) + flexible thirds payment
      const threeAddonsPayload = {
        client_name: "Rosewood Home Goods",
        proposal_date: "October 12, 2026",
        proposal_valid_until: "November 12, 2026",
        project_template_name: "E-commerce Template",
        base_template_fee: "$8,500.00",
        has_addons: true,
        addon_items: [
          { addon_name: "Copywriting", addon_fee: "$600.00" },
          { addon_name: "CMS Integration", addon_fee: "$800.00" },
          { addon_name: "Extra Revision Round", addon_fee: "$300.00" },
        ],
        has_bundle_discount: true,
        bundle_discount_amount: "$170.00",
        total_project_investment: "$10,030.00",
        milestones: [
          { phase_number: 1, milestone_title: "Discovery", deliverable_summary: "Requirements" },
          { phase_number: 2, milestone_title: "Design", deliverable_summary: "Figma prototype" },
        ],
        payment_milestones: [
          {
            milestone_name: "Deposit (33%)",
            trigger_description: "Kickoff",
            payment_amount: "$3,343.33",
          },
          {
            milestone_name: "Midpoint (33%)",
            trigger_description: "Beta delivery",
            payment_amount: "$3,343.33",
          },
          {
            milestone_name: "Final delivery (34%)",
            trigger_description: "Signoff",
            payment_amount: "$3,343.34",
          },
        ],
      };

      const hydratedThree = await hydrateProposalTemplate(templateBuffer, threeAddonsPayload);
      assert.ok(hydratedThree.length > 0);

      const threeDoc = await Document.loadFromBuffer(hydratedThree);
      const threeTable2 = threeDoc.getTableAt(2);
      assert.ok(threeTable2);
      const threeTable2Text = threeTable2.getRows().map((r) => r.getText()).join("\n");

      // Dynamic row synthesis successfully rendered all 3 add-ons!
      assert.ok(threeTable2Text.includes("Copywriting"));
      assert.ok(threeTable2Text.includes("CMS Integration"));
      assert.ok(threeTable2Text.includes("Extra Revision Round"));
      assert.ok(threeTable2Text.includes("Add-on subtotal"));
      assert.ok(threeTable2Text.includes("Bundle discount"));

      // Flexible thirds payment schedule rendered exactly 3 rows + header = 4 rows!
      const threeTable3 = threeDoc.getTableAt(3);
      assert.ok(threeTable3);
      assert.equal(threeTable3.getRowCount(), 4);
      const threeTable3Text = threeTable3.getRows().map((r) => r.getText()).join("\n");
      assert.ok(threeTable3Text.includes("Deposit (33%)"));
      assert.ok(threeTable3Text.includes("Midpoint (33%)"));
      assert.ok(threeTable3Text.includes("Final delivery (34%)"));
    }
  );

  await t.test(
    "Unit: findTableAndRow defaults allowHeaderRow: false and verifies table headers semantically",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));

      // 1. Without allowHeaderRow or row_identifier, it defaults to row 1 (never row 0)
      const defaultMatch = findTableAndRow(doc, 2);
      assert.ok(defaultMatch);
      assert.equal(defaultMatch.rowIndex, 1);
      assert.notEqual(defaultMatch.rowIndex, 0);

      // 2. Querying a column header token like "Line Item" with default allowHeaderRow: false returns null
      const headerMatch = findTableAndRow(doc, 2, "Line Item");
      assert.equal(headerMatch, null);

      // 3. Semantic column header verification resolves Table 2 ("Line Item | Amount") even if candidate tableIndex is 0
      const semanticMatch = findTableAndRow(doc, 0, undefined, {
        expectedHeaders: "Line Item | Amount",
      });
      assert.ok(semanticMatch);
      assert.equal(semanticMatch.tableIndex, 2);
      assert.equal(semanticMatch.rowIndex, 1);
    }
  );

  await t.test(
    "Unit: Row 0 column headers across Table 0, 1, 2 across all three proposals are 100% protected",
    async () => {
      const docNorthstar = await Document.loadFromBuffer(fs.readFileSync(northstarDocx));
      const docFortress = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));
      const docFieldstone = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));

      // Northstar
      assert.equal(isColumnHeaderRow(docNorthstar.getTableAt(0)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docNorthstar.getTableAt(1)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docNorthstar.getTableAt(2)?.getRow(0)), true);

      // Fortress IT: Table 0 & 1 have column headers; Table 2 is key-value data rows
      assert.equal(isColumnHeaderRow(docFortress.getTableAt(0)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docFortress.getTableAt(1)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docFortress.getTableAt(2)?.getRow(0)), false);

      // Fieldstone
      assert.equal(isColumnHeaderRow(docFieldstone.getTableAt(0)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docFieldstone.getTableAt(1)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docFieldstone.getTableAt(2)?.getRow(0)), true);
      assert.equal(isColumnHeaderRow(docFieldstone.getTableAt(3)?.getRow(0)), true);

      // Attempting to overwrite Table 0 Row 0 ("Date | Prepared By") fails and leaves text intact
      const t0Before = docNorthstar.getTableAt(0)?.getRow(0)?.getText();
      const overwriteT0Res = executeReplaceTableCell(docNorthstar, {
        action: "replace_table_cell",
        table_index: 0,
        row_identifier: "Prepared By",
        template_tag: "{bad_header_tag}",
      });
      assert.equal(overwriteT0Res.applied, false);
      assert.equal(docNorthstar.getTableAt(0)?.getRow(0)?.getText(), t0Before);

      // Attempting to conditionally wrap Table 1 Row 0 in Fortress IT fails and leaves text intact
      const t1Before = docFortress.getTableAt(1)?.getRow(0)?.getText();
      const wrapT1Res = executeWrapConditionalRow(docFortress, {
        action: "wrap_conditional_row",
        table_index: 1,
        row_identifier: "Essential",
        condition_tag: "has_essential",
      });
      assert.equal(wrapT1Res.applied, false);
      assert.equal(docFortress.getTableAt(1)?.getRow(0)?.getText(), t1Before);
    }
  );

  await t.test(
    "Unit: executeReplaceTableCell match-or-fail contract eliminates Case B fallthrough",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(northstarDocx));
      const table2 = doc.getTableAt(2)!;
      const cell1Before = table2.getRow(1)?.getCell(1)?.getText();

      // Attempt cell replacement with non-matching sample text
      const result = executeReplaceTableCell(doc, {
        action: "replace_table_cell",
        table_index: 2,
        row_identifier: "Growth Package",
        col_index: 1,
        sample_text: "$999,999.00", // Non-matching sample
        template_tag: "{corrupted_tag}",
      });

      // Must fail cleanly without destroying cell contents
      assert.equal(result.applied, false);
      assert.equal(table2.getRow(1)?.getCell(1)?.getText(), cell1Before);
      assert.ok(!table2.getRow(1)?.getCell(1)?.getText().includes("{corrupted_tag}"));
    }
  );

  await t.test(
    "Unit: Fortress IT Table 1 Row 0 and Table 2 Row 0 Col 1 remain intact against mismatched mutations",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fortressDocx));
      const table1 = doc.getTableAt(1)!;
      const table2 = doc.getTableAt(2)!;

      const t1Row0Before = table1.getRow(0)?.getCell(1)?.getText(); // "Standard — Recommended"
      const t2Row0Col1Before = table2.getRow(0)?.getCell(1)?.getText(); // "42"

      assert.ok(t1Row0Before?.includes("Standard"));
      assert.equal(t2Row0Col1Before?.trim(), "42");

      // 1. Attempt to overwrite Table 1 Row 0 with mismatched valid_until_date
      const mismatchDateT1 = executeReplaceTableCell(
        doc,
        {
          action: "replace_table_cell",
          table_index: 1,
          col_index: 1,
          sample_text: "September 21, 2026 (14 days)",
          template_tag: "{valid_until_date}",
        },
        "valid_until_date"
      );
      assert.equal(mismatchDateT1.applied, false);
      assert.equal(table1.getRow(0)?.getCell(1)?.getText(), t1Row0Before);

      // 2. Attempt to overwrite Table 2 Row 0 Col 1 ("42") with mismatched valid_until_date
      const mismatchDateT2 = executeReplaceTableCell(
        doc,
        {
          action: "replace_table_cell",
          table_index: 2,
          col_index: 1,
          sample_text: "September 21, 2026 (14 days)",
          template_tag: "{valid_until_date}",
        },
        "valid_until_date"
      );
      assert.equal(mismatchDateT2.applied, false);
      assert.equal(table2.getRow(0)?.getCell(1)?.getText()?.trim(), "42");

      // 3. Attempt to overwrite Table 2 Row 0 Col 1 ("42") with mismatched selected_tier
      const mismatchTierT2 = executeReplaceTableCell(
        doc,
        {
          action: "replace_table_cell",
          table_index: 2,
          col_index: 1,
          sample_text: "Standard — Recommended",
          template_tag: "{selected_tier}",
        },
        "selected_tier"
      );
      assert.equal(mismatchTierT2.applied, false);
      assert.equal(table2.getRow(0)?.getCell(1)?.getText()?.trim(), "42");
    }
  );

  await t.test(
    "Unit: executeReplaceTextRun replaces client_name globally across title and intro narrative",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(fieldstoneDocx));
      const paragraphs = doc.getAllParagraphs();

      // Verify "Rosewood Home Goods" exists in both title (Para 1) and intro (Para 9)
      const titlePara = paragraphs[1];
      const introPara = paragraphs[9];
      assert.ok(titlePara.getText().includes("Rosewood Home Goods"));
      assert.ok(introPara.getText().includes("Rosewood Home Goods"));

      const result = executeReplaceTextRun(
        doc,
        {
          action: "replace_text_run",
          sample_text: "Rosewood Home Goods",
          context_anchor: "Prepared for Rosewood Home Goods",
          template_tag: "{client_name}",
        },
        "client_name"
      );

      assert.equal(result.applied, true);

      // Global replacement: both title and intro must be updated to {client_name}
      assert.ok(titlePara.getText().includes("{client_name}"));
      assert.ok(!titlePara.getText().includes("Rosewood Home Goods"));

      assert.ok(introPara.getText().includes("{client_name}"));
      assert.ok(!introPara.getText().includes("Rosewood Home Goods"));
    }
  );

  await t.test(
    "Unit: executeReplaceTextRun numeric replacement uses word boundaries and preserves surrounding prices",
    async () => {
      const doc = await Document.loadFromBuffer(fs.readFileSync(northstarDocx));
      // Add a test paragraph with a numeric count "5" and adjacent price "$75.00"
      const para = new Paragraph().addText("Server allocation: 5 servers at $75.00/server monthly.");
      doc.addParagraph(para);

      const result = executeReplaceTextRun(
        doc,
        {
          action: "replace_text_run",
          sample_text: "5",
          context_anchor: "Server allocation",
          template_tag: "{server_count}",
        },
        "server_count"
      );

      assert.equal(result.applied, true);
      // Word boundary \b5\b must replace "5" without corrupting "$75.00" to "$7{server_count}.00"
      assert.ok(para.getText().includes("{server_count} servers"));
      assert.ok(para.getText().includes("$75.00/server"));
      assert.ok(!para.getText().includes("$7{server_count}"));
    }
  );
});


