import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";
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
    assert.ok(Array.isArray(res.body.companies));
    assert.equal(res.body.companies.length, 3);

    const ids = res.body.companies.map((c: any) => c.company_id);
    assert.ok(ids.includes("co1_seo"));
    assert.ok(ids.includes("co2_msp"));
    assert.ok(ids.includes("co3_dev"));
  });

  await t.test("GET /api/companies/co1_seo returns Northstar profile", async () => {
    const res = await request(app).get("/api/companies/co1_seo");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.company.company_name, "Northstar Digital");
    assert.equal(res.body.company.location, "Austin, TX");
    assert.ok(res.body.company.pricing_spec.includes("Local is $1000/mo"));
    assert.ok(res.body.company.data.pricing_engine_spec);
  });

  await t.test("PUT /api/companies/co1_seo/profile persists pricing spec modifications", async () => {
    const modifiedSpec = "Customized pricing note: test update via PUT profile.";
    const putRes = await request(app)
      .put("/api/companies/co1_seo/profile")
      .send({ pricing_spec: modifiedSpec });

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.success, true);
    assert.equal(putRes.body.company.pricing_spec, modifiedSpec);

    // Verify it persists in subsequent GET
    const getRes = await request(app).get("/api/companies/co1_seo");
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.company.pricing_spec, modifiedSpec);
  });

  await t.test("POST /api/companies/co1_seo/reset re-seeds to pristine default", async () => {
    const resetRes = await request(app).post("/api/companies/co1_seo/reset");
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);
    assert.ok(resetRes.body.company.pricing_spec.includes("Local is $1000/mo"));

    // Verify subsequent GET reflects reset
    const getRes = await request(app).get("/api/companies/co1_seo");
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.company.pricing_spec.includes("Local is $1000/mo"));
  });

  await t.test("POST /api/companies/co2_msp/import re-seeds settings", async () => {
    const importRes = await request(app).post("/api/companies/co2_msp/import");
    assert.equal(importRes.status, 200);
    assert.equal(importRes.body.success, true);
    assert.equal(importRes.body.company.company_name, "Fortress IT Group");
  });
});
