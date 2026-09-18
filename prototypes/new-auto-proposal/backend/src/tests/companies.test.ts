import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

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

  await t.test("POST /api/companies/co1_seo/reset re-seeds to pristine default and clears variables", async () => {
    // Insert a dummy variable to verify reset wipes company_variables
    const db = getDatabase();
    db.prepare(`
      INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
      VALUES ('var_test_1', 'co1_seo', 'test_var', 'Test Var', 'pricing', 'currency', 0, 0, 1, '{}', datetime('now'), datetime('now'))
    `).run();

    const preResetVars = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(preResetVars.body.variables.length, 1);

    const resetRes = await request(app).post("/api/companies/co1_seo/reset");
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);
    assert.ok(resetRes.body.company.pricing_spec.includes("Local is $1000/mo"));

    // Verify subsequent GET reflects reset
    const getRes = await request(app).get("/api/companies/co1_seo");
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.company.pricing_spec.includes("Local is $1000/mo"));
    // Dev-only seeds come from test_seeds.json: the pricing text lands in pricing_spec,
    // the sample lead is attached to the response (never stored).
    assert.ok(getRes.body.company.sample_lead_text.includes("Bloom & Co"));

    // Verify company_variables was cleared
    const postResetVars = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(postResetVars.status, 200);
    assert.equal(postResetVars.body.variables.length, 0);
  });

});

test("Database: a pre-`date` company_variables table is rebuilt in place, rows kept", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-migrate-"));
  const dbPath = path.join(dir, "old.sqlite");
  const old = new DatabaseSync(dbPath);
  old.exec(`
    CREATE TABLE company_variables (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, variable_name TEXT NOT NULL, natural_name TEXT NOT NULL,
      category TEXT NOT NULL, data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'currency', 'enum', 'paragraph', 'table')),
      is_custom INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, descriptor_json TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX idx_company_variables_lookup ON company_variables (company_id, category, is_deleted);
    INSERT INTO company_variables VALUES ('v1', 'co1_seo', 'x', 'X', 'customer_input', 'string', 0, 0, 0, '{}', 't', 't');
  `);
  old.close();
  closeDatabase();
  const db = initDatabase(dbPath);
  db.prepare("INSERT INTO company_variables VALUES ('v2', 'co1_seo', 'd', 'D', 'customer_input', 'date', 0, 0, 1, '{}', 't', 't')").run();
  assert.equal((db.prepare("SELECT count(*) AS n FROM company_variables").get() as { n: number }).n, 2);
  closeDatabase();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* handle may linger on Windows */ }
});
