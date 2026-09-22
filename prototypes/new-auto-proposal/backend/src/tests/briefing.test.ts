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

  const northstarDocx = path.resolve(__dirname, "../../../Mock Data/docx/Co1_Proposal_Northstar_BloomAndCo.docx");

  t.after(() => {
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  await t.test("POST /briefing/submit rejects a missing file, an empty prompt, and a non-.docx upload", async () => {
    const fakeTxt = path.join(testDir, "test.txt");
    fs.writeFileSync(fakeTxt, "hello world");
    const url = "/api/companies/co1_seo/briefing/submit";
    const cases = [
      { req: request(app).post(url).field("prompt", "My custom pricing prompt"), error: "quotation document is required" },
      { req: request(app).post(url).attach("file", northstarDocx), error: "prompt cannot be empty" },
      { req: request(app).post(url).field("prompt", "Some pricing notes").attach("file", fakeTxt), error: ".docx" },
    ];
    for (const c of cases) {
      const res = await c.req;
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes(c.error), res.body.error);
    }
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
    assert.equal(res.body.company.document_metadata.filename, "Co1_Proposal_Northstar_BloomAndCo.docx");
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
    assert.equal(res.body.filename, "Co1_Proposal_Northstar_BloomAndCo.docx");
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

  // co2 and co3 ingestion is not repeated here: the same .docx files go through AnyDoc in
  // template-mutator.test.ts, where a parse regression shows up as a lost variable.
});
