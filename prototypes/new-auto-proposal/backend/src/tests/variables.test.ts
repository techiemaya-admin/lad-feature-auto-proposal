import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import { generateTableManifest } from "../services/gemini.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Variables & Gemini Extraction Suite", async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-vars-test-"));
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
      // ignore
    }
  });

  await t.test("generateTableManifest extracts exact table indexes, headers, and row counts across all benchmark proposals", async () => {
    const northstarBuf = fs.readFileSync(northstarDocx);
    const fortressBuf = fs.readFileSync(fortressDocx);
    const fieldstoneBuf = fs.readFileSync(fieldstoneDocx);

    const nsManifest = await generateTableManifest(northstarBuf);
    assert.ok(nsManifest.includes("- Table 0: [Date | Prepared By | Proposal Valid Until] (2 rows, 3 cols)"));
    assert.ok(nsManifest.includes("- Table 1:") && nsManifest.includes("Local") && nsManifest.includes("Authority] (5 rows, 3 cols)"));
    assert.ok(nsManifest.includes("- Table 2: [Line Item | Amount] (6 rows, 2 cols)"));

    const fortManifest = await generateTableManifest(fortressBuf);
    assert.ok(fortManifest.includes("- Table 0: [Date | Prepared By | Proposal Valid Until] (2 rows, 3 cols)"));
    assert.ok(fortManifest.includes("- Table 1: [Essential | Standard — Recommended | Premium] (4 rows, 3 cols)"));
    assert.ok(fortManifest.includes("- Table 2: [Total employees / seats | 42] (9 rows, 2 cols)"));
    assert.ok(fortManifest.includes("- Table 3: [One-time setup & onboarding (42 seats × $75.00) | $3,150.00] (1 rows, 2 cols)"));

    const fieldManifest = await generateTableManifest(fieldstoneBuf);
    assert.ok(fieldManifest.includes("- Table 0: [Date | Prepared By | Proposal Valid Until] (2 rows, 3 cols)"));
    assert.ok(fieldManifest.includes("- Table 1: [Phase | Milestone | Deliverable] (6 rows, 3 cols)"));
    assert.ok(fieldManifest.includes("- Table 2: [Line Item | Amount] (7 rows, 2 cols)"));
    assert.ok(fieldManifest.includes("- Table 3: [Milestone | Trigger | Amount] (3 rows, 3 cols)"));
  });

  await t.test("GET /api/companies/co1_seo/variables returns empty lists initially", async () => {
    const res = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.variables, []);
    assert.deepEqual(res.body.compound_tables, []);
  });

  await t.test("POST /api/companies/co1_seo/variables/extract fails if quotation has not been submitted", async () => {
    const res = await request(app).post("/api/companies/co1_seo/variables/extract");
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes("Quotation markdown is missing"));
  });

  await t.test("Submitting briefing and creating custom variable verified against quotation markdown", async () => {
    // 1. Submit briefing first to populate quotation_markdown
    const submitRes = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. Texas tax 8.25%.")
      .attach("file", northstarDocx);

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.company.briefing_locked, true);

    // 2. Reject custom variable if snippet is NOT in quotation
    const invalidRes = await request(app)
      .post("/api/companies/co1_seo/variables/custom")
      .send({
        natural_name: "Alien Planet Coordinate",
        category: "customer_input",
        exact_quotation_snippet: "Alpha Centauri Sector 9999",
      });

    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.success, false);
    assert.ok(invalidRes.body.error.includes("not found in the quotation"));

    // 3. Accept custom variable when exact snippet exists
    const validRes = await request(app)
      .post("/api/companies/co1_seo/variables/custom")
      .send({
        natural_name: "Client Target Business",
        category: "customer_input",
        exact_quotation_snippet: "Bloom & Co Dental Group",
      });

    assert.equal(validRes.status, 201);
    assert.equal(validRes.body.success, true);
    assert.equal(validRes.body.variable.natural_name, "Client Target Business");
    assert.equal(validRes.body.variable.is_custom, true);
    assert.equal(validRes.body.variable.descriptor.mutation.action, "replace_text_run");

    // 4. Verify custom variable is returned by GET /variables
    const listRes = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.variables.length, 1);
    assert.equal(listRes.body.variables[0].natural_name, "Client Target Business");
  });

  await t.test("PUT /api/companies/co1_seo/variables updates natural names, categories, and soft deletes", async () => {
    const listRes = await request(app).get("/api/companies/co1_seo/variables");
    const customVar = listRes.body.variables[0];

    const putRes = await request(app)
      .put("/api/companies/co1_seo/variables")
      .send({
        variables: [
          {
            id: customVar.id,
            natural_name: "Renamed Client Organization",
            category: "pricing",
            is_deleted: true,
          },
        ],
      });

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.success, true);
    assert.equal(putRes.body.updated_count, 1);

    const recheck = await request(app).get("/api/companies/co1_seo/variables");
    const updated = recheck.body.variables.find((v: any) => v.id === customVar.id);
    assert.equal(updated.natural_name, "Renamed Client Organization");
    assert.equal(updated.category, "pricing");
    assert.equal(updated.is_deleted, true);
  });

  await t.test("POST /briefing/unlock executes cascading deletion on company_variables", async () => {
    // Unlocking must delete variables for co1_seo
    const unlockRes = await request(app).post("/api/companies/co1_seo/briefing/unlock");
    assert.equal(unlockRes.status, 200);
    assert.equal(unlockRes.body.company.briefing_locked, false);

    const listRes = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.variables.length, 0);
  });

  // End-to-end Gemini extraction test if GEMINI_API_KEY is available
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your-key")) {
    await t.test(
      "POST /variables/extract calls Gemini, extracts variables and compound tables without agency collision",
      { timeout: 90000 },
      async () => {
        // Ingest Fortress IT
        const fortressSubmit = await request(app)
          .post("/api/companies/co2_msp/briefing/submit")
          .field("prompt", "Standard $55/seat, Professional $85/seat, Enterprise $130/seat.")
          .attach("file", fortressDocx);

        assert.equal(fortressSubmit.status, 200);

        const extractRes = await request(app)
          .post("/api/companies/co2_msp/variables/extract")
          .timeout(90000);

        assert.equal(extractRes.status, 200);
        assert.equal(extractRes.body.success, true);
        assert.ok(extractRes.body.variables.length > 0);

        const vars = extractRes.body.variables;
        // Check Agency Identity Collision Guard: Fortress IT Group should NEVER be an extracted customer variable
        const agencyCollision = vars.find(
          (v: any) =>
            v.variable_name.toLowerCase().includes("fortress") ||
            (v.descriptor?.sample_value && v.descriptor.sample_value.includes("Fortress IT Group"))
        );
        assert.equal(
          agencyCollision,
          undefined,
          `Agency name "Fortress IT Group" was extracted as a variable: ${JSON.stringify(agencyCollision)}`
        );

        // Check Agency Phone Collision Guard: (614) 555-0193 should NOT be extracted
        const phoneCollision = vars.find(
          (v: any) =>
            (v.descriptor?.sample_value && v.descriptor.sample_value.includes("555-0193")) ||
            v.variable_name.toLowerCase().includes("agency_phone")
        );
        assert.equal(
          phoneCollision,
          undefined,
          `Agency phone was extracted as a variable: ${JSON.stringify(phoneCollision)}`
        );

        // Verify client name or seats was extracted
        const clientNameVar = vars.find(
          (v: any) =>
            v.variable_name.toLowerCase().includes("client") ||
            v.variable_name.toLowerCase().includes("customer") ||
            (v.descriptor?.sample_value && v.descriptor.sample_value.includes("Whitfield"))
        );
        assert.ok(clientNameVar, "Expected client placeholder (Whitfield & Associates) to be extracted");

        // Verify selected_tier enum presence if tiered
        const tierVar = vars.find(
          (v: any) => v.variable_name === "selected_tier" || v.data_type === "enum"
        );
        assert.ok(tierVar, "Expected selected_tier or enum variable for package selection");

        // Verify compound tables
        assert.ok(Array.isArray(extractRes.body.compound_tables));

        // Verify scope inclusion / SLA bullets are ai_generated if extracted as paragraph
        const scopeVar = vars.find(
          (v: any) =>
            v.category === "paragraph" &&
            (v.natural_name.toLowerCase().includes("included") ||
              v.variable_name.toLowerCase().includes("included") ||
              v.variable_name.toLowerCase().includes("scope") ||
              (v.descriptor?.description && v.descriptor.description.toLowerCase().includes("sla")))
        );
        if (scopeVar) {
          assert.equal(
            scopeVar.descriptor?.paragraph_config?.mode,
            "ai_generated",
            "Scope / SLA inclusions must be classified as ai_generated"
          );
        }

        // Check Ground-Truth Table Index: Metadata fields must never drift to Table 1
        const metadataVar = vars.find(
          (v: any) =>
            v.descriptor?.mutation?.table_index !== undefined &&
            (v.variable_name.includes("date") ||
              v.variable_name.includes("valid") ||
              v.natural_name.toLowerCase().includes("valid until"))
        );
        if (metadataVar) {
          assert.equal(
            metadataVar.descriptor.mutation.table_index,
            0,
            `Metadata variable table_index drifted to Table ${metadataVar.descriptor.mutation.table_index} instead of Table 0`
          );
        }

        // Verify table cell mutations consistently include row_identifier and col_index
        const cellMutations = vars.filter(
          (v: any) =>
            v.descriptor?.mutation?.action === "replace_table_cell" ||
            v.descriptor?.mutation?.action === "wrap_conditional_row"
        );
        for (const cm of cellMutations) {
          const m = cm.descriptor.mutation;
          assert.ok(
            m.row_identifier !== undefined && m.row_identifier.trim().length > 0,
            `Expected row_identifier on table cell mutation for ${cm.variable_name}`
          );
          assert.ok(
            typeof m.col_index === "number",
            `Expected numeric col_index on table cell mutation for ${cm.variable_name}`
          );
        }
      }
    );

    await t.test(
      "POST /variables/extract on Northstar extracts tier-agnostic pricing, ai_generated scope bullets, and guards seller identity",
      { timeout: 90000 },
      async () => {
        // Re-submit Northstar briefing
        const northstarSubmit = await request(app)
          .post("/api/companies/co1_seo/briefing/submit")
          .field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. Texas tax 8.25%.")
          .attach("file", northstarDocx);
        assert.equal(northstarSubmit.status, 200);

        const extractRes = await request(app)
          .post("/api/companies/co1_seo/variables/extract")
          .timeout(90000);

        assert.equal(extractRes.status, 200);
        assert.equal(extractRes.body.success, true);

        const vars = extractRes.body.variables;

        // 1. Tier-Agnostic Naming: selected_tier enum with Local, Growth, Authority
        const selectedTierVar = vars.find((v: any) => v.variable_name === "selected_tier");
        assert.ok(selectedTierVar, "Expected selected_tier variable to be extracted");
        assert.equal(selectedTierVar.data_type, "enum");
        assert.ok(
          selectedTierVar.descriptor?.enum_options?.includes("Local") &&
            selectedTierVar.descriptor?.enum_options?.includes("Growth") &&
            selectedTierVar.descriptor?.enum_options?.includes("Authority"),
          `Expected enum_options to include Local, Growth, Authority; got ${JSON.stringify(selectedTierVar.descriptor?.enum_options)}`
        );

        // Assert NO variable named growth_package_monthly_rate or hardcoded tier rate exists
        const hardcodedTierVar = vars.find(
          (v: any) =>
            v.variable_name.toLowerCase().includes("growth_package") ||
            v.variable_name.toLowerCase().includes("growth_tier")
        );
        assert.equal(
          hardcodedTierVar,
          undefined,
          `Expected no hardcoded tier variable like growth_package_monthly_rate, but found: ${JSON.stringify(hardcodedTierVar)}`
        );

        // Assert canonical role-based variable exists
        const rateVar = vars.find(
          (v: any) =>
            v.variable_name === "selected_tier_rate" ||
            v.variable_name === "monthly_rate" ||
            v.variable_name === "monthly_investment" ||
            v.variable_name === "tier_base_investment" ||
            v.variable_name === "total_investment"
        );
        assert.ok(rateVar, "Expected canonical tier rate variable (selected_tier_rate / monthly_rate) to exist");

        // 2. Scope Inclusion Classification: Included vs Not Included is ai_generated if extracted
        const scopeVar = vars.find(
          (v: any) =>
            v.category === "paragraph" &&
            (v.natural_name.toLowerCase().includes("included") ||
              v.variable_name.toLowerCase().includes("included") ||
              v.variable_name.toLowerCase().includes("scope"))
        );
        if (scopeVar) {
          assert.equal(
            scopeVar.descriptor?.paragraph_config?.mode,
            "ai_generated",
            "Scope inclusions must be marked ai_generated"
          );
        }

        // 3. Agency Identity Collision Guard: Northstar phone (512) 555-0148 and strategy team name are NOT extracted
        const phoneCollision = vars.find(
          (v: any) =>
            (v.descriptor?.sample_value && v.descriptor.sample_value.includes("555-0148")) ||
            v.variable_name.toLowerCase().includes("agency_phone")
        );
        assert.equal(
          phoneCollision,
          undefined,
          `Agency phone was extracted as a variable: ${JSON.stringify(phoneCollision)}`
        );

        const teamCollision = vars.find(
          (v: any) =>
            v.variable_name.toLowerCase().includes("northstar") ||
            (v.descriptor?.sample_value && v.descriptor.sample_value.toLowerCase().includes("strategy team"))
        );
        assert.equal(
          teamCollision,
          undefined,
          `Agency team name was extracted as a variable: ${JSON.stringify(teamCollision)}`
        );

        // 4. Variables with Visibility Rules must emit action: "wrap_conditional_row" and valid condition_tag
        const conditionalVars = vars.filter((v: any) => v.descriptor?.visibility_rule?.condition_flag);
        assert.ok(conditionalVars.length > 0, "Expected at least one variable with a visibility_rule (e.g. tax or discount)");

        for (const cv of conditionalVars) {
          const m = cv.descriptor?.mutation;
          assert.equal(
            m?.action,
            "wrap_conditional_row",
            `Variable "${cv.variable_name}" with visibility_rule must emit action: "wrap_conditional_row", got: ${m?.action}`
          );
          assert.equal(
            m?.condition_tag,
            cv.descriptor.visibility_rule.condition_flag,
            `Variable "${cv.variable_name}" mutation condition_tag must match visibility_rule condition_flag`
          );
          assert.ok(
            m?.row_identifier && m.row_identifier.trim().length > 0,
            `Variable "${cv.variable_name}" wrap_conditional_row must include row_identifier`
          );
          assert.equal(
            typeof m?.col_index,
            "number",
            `Variable "${cv.variable_name}" wrap_conditional_row must include col_index`
          );
        }
      }
    );

    await t.test(
      "POST /variables/extract on Fieldstone extracts populated repeating loop columns, payment schedule, and persists columns to SQLite",
      { timeout: 90000 },
      async () => {
        const fieldstoneSubmit = await request(app)
          .post("/api/companies/co3_dev/briefing/submit")
          .field("prompt", "Base e-commerce build $9,500. Copywriting add-on $600. SEO add-on $450. 50/50 payment split.")
          .attach("file", fieldstoneDocx);
        assert.equal(fieldstoneSubmit.status, 200);

        const extractRes = await request(app)
          .post("/api/companies/co3_dev/variables/extract")
          .timeout(90000);

        assert.equal(extractRes.status, 200);
        assert.equal(extractRes.body.success, true);

        const tables = extractRes.body.compound_tables;
        assert.ok(Array.isArray(tables) && tables.length >= 2, "Expected at least 2 compound tables");

        // Verify milestone loop columns
        const milestoneTable = tables.find(
          (t: any) => t.type === "repeating_loop" && (t.loop_tag === "milestones" || t.table_index === 1)
        );
        assert.ok(milestoneTable, "Expected milestones repeating loop table");
        assert.ok(
          Array.isArray(milestoneTable.columns) && milestoneTable.columns.length >= 3,
          `Expected milestone loop columns array to be populated with at least 3 items, got: ${JSON.stringify(milestoneTable.columns)}`
        );
        assert.ok(
          milestoneTable.columns.some((c: string) => c.includes("phase")),
          `Expected phase column in milestones, got: ${JSON.stringify(milestoneTable.columns)}`
        );
        assert.ok(
          milestoneTable.columns.some((c: string) => c.includes("milestone") || c.includes("title")),
          `Expected milestone/title column in milestones, got: ${JSON.stringify(milestoneTable.columns)}`
        );

        // Verify addon items loop columns if extracted
        const addonTable = tables.find(
          (t: any) => t.type === "repeating_loop" && t.loop_tag === "addon_items"
        );
        if (addonTable) {
          assert.ok(
            Array.isArray(addonTable.columns) && addonTable.columns.length >= 2,
            `Expected addon loop columns array to be populated, got: ${JSON.stringify(addonTable.columns)}`
          );
          assert.ok(
            addonTable.columns.some((c: string) => c.includes("addon_name") || c.includes("name") || c.includes("item")),
            `Expected addon_name in addon columns, got: ${JSON.stringify(addonTable.columns)}`
          );
        }

        // Verify payment milestones loop if extracted
        const paymentTable = tables.find(
          (t: any) => t.type === "repeating_loop" && (t.loop_tag === "payment_milestones" || t.table_index === 3)
        );
        if (paymentTable) {
          assert.ok(
            Array.isArray(paymentTable.columns) && paymentTable.columns.length >= 2,
            `Expected payment loop columns array to be populated, got: ${JSON.stringify(paymentTable.columns)}`
          );
        }

        // Verify persistence in SQLite database
        const db = getDatabase();
        const dbRows = db
          .prepare("SELECT * FROM company_variables WHERE company_id = ? AND data_type = 'table'")
          .all("co3_dev") as any[];
        assert.ok(dbRows.length > 0, "Expected table rows in company_variables table");
        const milestoneDbRow = dbRows.find((r) => {
          const desc = JSON.parse(r.descriptor_json);
          return desc.type === "repeating_loop" && (desc.loop_tag === "milestones" || desc.table_index === 1);
        });
        assert.ok(milestoneDbRow, "Milestone table must be persisted in SQLite");
        const desc = JSON.parse(milestoneDbRow.descriptor_json);
        assert.ok(Array.isArray(desc.columns) && desc.columns.length > 0, "Descriptor JSON must store columns array");

        // Verify working_state_json has compound_tables with columns
        const sessionRow = db
          .prepare("SELECT working_state_json FROM company_sessions WHERE company_id = ?")
          .get("co3_dev") as any;
        const ws = JSON.parse(sessionRow.working_state_json);
        assert.ok(ws.extracted_variables?.compound_tables?.length > 0);
        const wsMilestone = ws.extracted_variables.compound_tables.find(
          (t: any) => t.type === "repeating_loop" && (t.loop_tag === "milestones" || t.table_index === 1)
        );
        assert.ok(Array.isArray(wsMilestone?.columns) && wsMilestone.columns.length > 0);
      }
    );
  }
});
