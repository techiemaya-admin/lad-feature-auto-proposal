import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("Companies: reset re-seeds the mock default", async (t) => {
  // Use isolated temporary SQLite database for tests
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-test-"));
  const testDbPath = path.join(testDbDir, "test.sqlite");
  process.env.DB_PATH = testDbPath;
  process.env.STORAGE_DIR = testDbDir;

  initDatabase(testDbPath);
  const app = createApp();

  t.after(() => {
    closeDatabase();
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  await t.test("POST /api/companies/co1_seo/reset re-seeds to pristine default and preserves template variables", async () => {
    // Insert a dummy variable to verify reset wipes company_variables
    const db = getDatabase();
    db.prepare(`
      INSERT INTO company_variables (id, company_id, template_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
      VALUES ('var_test_1', 'co1_seo', 'default-co1_seo', 'test_var', 'Test Var', 'pricing', 'currency', 0, 0, 1, '{}', datetime('now'), datetime('now'))
    `).run();

    const preResetVars = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    assert.equal(preResetVars.body.variables.length, 1);

    const resetRes = await request(app).post("/api/companies/co1_seo/reset");
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);
    assert.ok(resetRes.body.company.pricing_spec.includes("Local is $1000/mo"));

    // Verify subsequent GET reflects reset
    const getRes = await request(app).get("/api/companies/co1_seo");
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.company.pricing_spec.includes("Local is $1000/mo"));

    // Shared profile reset must preserve template variables
    const postResetVars = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/variables");
    assert.equal(postResetVars.status, 200);
    assert.equal(postResetVars.body.variables.length, 1);
  });

});
