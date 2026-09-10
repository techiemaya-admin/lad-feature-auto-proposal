import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("Auto-Proposal Backend API Suite", async (t) => {
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

  await t.test("GET /api/health returns 200 OK", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  await t.test("GET /api/companies returns all 3 seeded companies", async () => {
    const res = await request(app).get("/api/companies");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.companies.length, 3);
  });

  await t.test("GET /api/companies/co1_seo returns Northstar profile", async () => {
    const res = await request(app).get("/api/companies/co1_seo");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.company.company_name, "Northstar Digital");
  });

  await t.test("PUT /api/companies/co1_seo/profile persists pricing spec modifications", async () => {
    const modifiedSpec = "Local SEO: $1,200/mo base. Enterprise: $4,500/mo.";
    const putRes = await request(app)
      .put("/api/companies/co1_seo/profile")
      .send({ pricing_spec: modifiedSpec });

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.success, true);
    assert.equal(putRes.body.company.pricing_spec, modifiedSpec);

    // Verify persistence via GET
    const getRes = await request(app).get("/api/companies/co1_seo");
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.company.pricing_spec, modifiedSpec);
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

    // Verify company_variables was cleared
    const postResetVars = await request(app).get("/api/companies/co1_seo/variables");
    assert.equal(postResetVars.status, 200);
    assert.equal(postResetVars.body.variables.length, 0);
  });

  await t.test("POST /api/companies/co2_msp/import re-seeds settings", async () => {
    const importRes = await request(app).post("/api/companies/co2_msp/import");
    assert.equal(importRes.status, 200);
    assert.equal(importRes.body.success, true);
    assert.equal(importRes.body.company.company_name, "Fortress IT Group");
  });
});
