import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Briefing & Quotation Ingestion Suite", async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-briefing-test-"));
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

  const northstarDocx = path.join(mockDataDir, "Proposal_Northstar_BloomAndCo.docx");
  const fortressDocx = path.join(mockDataDir, "Proposal_FortressIT_WhitfieldAssociates.docx");
  const fieldstoneDocx = path.join(mockDataDir, "Proposal_Fieldstone_RosewoodHomeGoods.docx");

  t.after(() => {
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  await t.test("POST /briefing/submit rejects request missing both file and existing file", async () => {
    const res = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .field("prompt", "My custom pricing prompt");

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes("quotation document is required"));
  });

  await t.test("POST /briefing/submit rejects request missing prompt text", async () => {
    const res = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .attach("file", northstarDocx);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes("prompt cannot be empty"));
  });

  await t.test("POST /briefing/submit rejects non-.docx uploads", async () => {
    const fakeTxt = path.join(testDir, "test.txt");
    fs.writeFileSync(fakeTxt, "hello world");

    const res = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .field("prompt", "Some pricing notes")
      .attach("file", fakeTxt);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes(".docx"));
  });

  await t.test("POST /briefing/submit ingests Northstar docx, converts via AnyDoc, and locks briefing", async () => {
    const customPrompt = "Tier 1 Local $1,000/mo, Tier 2 Growth $3,000/mo, Tier 3 Authority $8,000/mo. Texas tax 8.25%.";

    const res = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .field("prompt", customPrompt)
      .attach("file", northstarDocx);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.company.briefing_locked, true);
    assert.equal(res.body.company.pricing_spec, customPrompt);
    assert.ok(res.body.company.document_metadata);
    assert.equal(res.body.company.document_metadata.filename, "Proposal_Northstar_BloomAndCo.docx");
    assert.ok(res.body.company.document_metadata.filesize > 0);

    // Markdown assertions
    assert.ok(res.body.markdown);
    assert.ok(res.body.markdown.includes("SEO & Local Visibility Proposal"));
    assert.ok(res.body.markdown.includes("Bloom & Co Dental Group"));
    assert.ok(res.body.markdown.includes("35,073.00"));
    assert.ok(res.body.markdown.includes("|")); // table present

    // Verify file saved under storage/<company_id>/original_quotation.docx
    const savedFile = path.join(testStorageDir, "co1_seo", "original_quotation.docx");
    assert.ok(fs.existsSync(savedFile));
  });

  await t.test("GET /briefing/markdown returns extracted quotation markdown", async () => {
    const res = await request(app).get("/api/companies/co1_seo/briefing/markdown");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.filename, "Proposal_Northstar_BloomAndCo.docx");
    assert.equal(res.body.briefing_locked, true);
    assert.ok(res.body.markdown.includes("SEO & Local Visibility Proposal"));
  });

  await t.test("POST /briefing/unlock safely unlocks briefing and preserves prompt text", async () => {
    const res = await request(app).post("/api/companies/co1_seo/briefing/unlock");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.company.briefing_locked, false);
    assert.ok(res.body.company.pricing_spec.includes("Tier 1 Local"));
    assert.ok(res.body.company.document_metadata);
  });

  await t.test("Submitting Fortress IT (co2_msp) and Fieldstone (co3_dev) parses cleanly", async () => {
    // Fortress IT
    const fortressRes = await request(app)
      .post("/api/companies/co2_msp/briefing/submit")
      .field("prompt", "Standard $55/seat, Professional $85/seat, Enterprise $130/seat.")
      .attach("file", fortressDocx);

    assert.equal(fortressRes.status, 200);
    assert.equal(fortressRes.body.company.briefing_locked, true);
    assert.ok(fortressRes.body.markdown.includes("Managed IT Services Proposal"));
    assert.ok(fortressRes.body.markdown.includes("Whitfield & Associates"));

    // Fieldstone Studio
    const fieldstoneRes = await request(app)
      .post("/api/companies/co3_dev/briefing/submit")
      .field("prompt", "Brand Sprint $3,500, Custom Marketing Site $6,500, Full-Stack Web App $14,000.")
      .attach("file", fieldstoneDocx);

    assert.equal(fieldstoneRes.status, 200);
    assert.equal(fieldstoneRes.body.company.briefing_locked, true);
    assert.ok(fieldstoneRes.body.markdown.includes("Project Proposal"));
    assert.ok(fieldstoneRes.body.markdown.includes("Rosewood Home Goods"));
    assert.ok(fieldstoneRes.body.markdown.includes("10,445.00"));
  });
});
