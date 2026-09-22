import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";
import { setExtractionModelCall } from "../services/ai-extraction.service.js";

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
  const northstarDocx = findDocx("Co1_Proposal_Northstar_BloomAndCo.docx");
  const fortressDocx = findDocx("Co2_Proposal_FortressIT_WhitfieldAssociates.docx");
  const fieldstoneDocx = findDocx("Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx");

  t.after(() => {
    setExtractionModelCall(null);
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  await t.test("Submitting briefing and creating custom variable verified against quotation markdown", async () => {
    // 1. Submit briefing first to populate quotation_markdown
    const submitRes = await request(app)
      .post("/api/companies/co1_seo/templates/default-co1_seo/briefing/submit")
      .field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. Texas tax 8.25%.")
      .attach("file", northstarDocx);

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.company.briefing_locked, true);

    // 2. Reject custom variable if snippet is NOT in quotation
    const invalidRes = await request(app)
      .post("/api/companies/co1_seo/templates/default-co1_seo/variables/custom")
      .send({
        natural_name: "Alien Planet Coordinate",
        category: "customer_input",
        exact_quotation_snippet: "Alpha Centauri Sector 9999",
      });

    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.success, false);
    assert.ok(invalidRes.body.error.includes("not found in the quotation"));

    // 3. Reject unknown categories / data types
    const badCategory = await request(app)
      .post("/api/companies/co1_seo/templates/default-co1_seo/variables/custom")
      .send({ natural_name: "X", category: "comparison_matrix", exact_quotation_snippet: "Bloom & Co Dental Group" });
    assert.equal(badCategory.status, 400);

    // 4. Accept custom variable when exact snippet exists
    const validRes = await request(app)
      .post("/api/companies/co1_seo/templates/default-co1_seo/variables/custom")
      .send({
        natural_name: "Client Target Business",
        category: "customer_input",
        exact_quotation_snippet: "Bloom & Co Dental Group",
      });

    assert.equal(validRes.status, 201);
    assert.equal(validRes.body.success, true);
    assert.equal(validRes.body.variable.natural_name, "Client Target Business");
    assert.equal(validRes.body.variable.is_custom, true);
    assert.equal(validRes.body.variable.descriptor.sample_value, "Bloom & Co Dental Group");

    // 5. Verify custom variable is returned by GET /variables
    const listRes = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.variables.length, 1);
    assert.equal(listRes.body.variables[0].natural_name, "Client Target Business");
  });

  await t.test("PUT /api/companies/co1_seo/templates/default-co1_seo/variables updates natural names, categories, and soft deletes", async () => {
    const listRes = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    const customVar = listRes.body.variables[0];

    const putRes = await request(app)
      .put("/api/companies/co1_seo/templates/default-co1_seo/variables")
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

    const recheck = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    const updated = recheck.body.variables.find((v: any) => v.id === customVar.id);
    assert.equal(updated.natural_name, "Renamed Client Organization");
    assert.equal(updated.category, "pricing");
    assert.equal(updated.is_deleted, true);
  });

  await t.test("Re-scan immediately returns preserved custom variables and matches reload", async () => {
    const base = "/api/companies/co1_seo/templates/default-co1_seo";
    const added = await request(app).post(`${base}/variables/custom`).send({
      natural_name: "Keep this custom field",
      exact_quotation_snippet: "Bloom & Co Dental Group",
    });
    assert.equal(added.status, 201);
    const before = (await request(app).get(`${base}/variables`)).body.variables;
    let run = 0;
    setExtractionModelCall(async () => ({
      document_summary: "Offline extraction",
      variables: [{
        variable_name: `extracted_${++run}`, natural_name: "Extracted customer",
        category: "customer_input", data_type: "string", sample_text: "Bloom & Co Dental Group",
        description: "Customer name", condition_flag: "", context_text: "", enum_options: [],
      }],
      loop_tables: [],
    }));
    try {
      for (let i = 0; i < 2; i++) {
        const scan = await request(app).post(`${base}/variables/extract`);
        assert.equal(scan.status, 200, scan.text);
        assert.equal(scan.body.extracted_count, 1);
        for (const custom of before) {
          assert.deepEqual(scan.body.variables.find((v: any) => v.id === custom.id), custom);
        }
        assert.equal(scan.body.variables.filter((v: any) => !v.is_custom).length, 1);
        assert.ok(scan.body.variables.some((v: any) => v.variable_name === `extracted_${i + 1}`));
        const reloaded = await request(app).get(`${base}/variables`);
        assert.deepEqual(scan.body.variables, reloaded.body.variables);
        assert.deepEqual(scan.body.compound_tables, reloaded.body.compound_tables);
        const workflow = (await request(app).get(base)).body.company.working_state;
        assert.deepEqual(workflow.extracted_variables.variables, scan.body.variables);
        assert.equal(workflow.extracted_variables.variables_count, scan.body.variables.length);
      }
    } finally { setExtractionModelCall(null); }
  });

  await t.test("POST /briefing/unlock executes cascading deletion on company_variables", async () => {
    // Unlocking must delete variables for co1_seo
    const unlockRes = await request(app).post("/api/companies/co1_seo/templates/default-co1_seo/briefing/unlock");
    assert.equal(unlockRes.status, 200);
    assert.equal(unlockRes.body.company.briefing_locked, false);

    const listRes = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.variables.length, 0);
  });

});
