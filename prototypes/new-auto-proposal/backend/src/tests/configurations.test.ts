import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";

test("company configurations: defaults, save, isolation across companies, survives reseed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "company-config-"));
  const dbPath = path.join(dir, "test.sqlite");
  process.env.DB_PATH = dbPath;
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase(dbPath);
  try {
    const app = createApp();

    const fresh = await request(app).get("/api/companies/co1_seo/configurations");
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.configuration.style_notes, "");
    assert.equal(fresh.body.configuration.email_connected, false);

    const saved = await request(app)
      .put("/api/companies/co1_seo/configurations")
      .send({ style_notes: "Warm, direct.", clarification_notes: "One question at a time." });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.configuration.style_notes, "Warm, direct.");
    assert.equal(saved.body.configuration.reference_proposal_text, ""); // untouched field keeps its default

    // Another company never sees co1's notes
    const other = await request(app).get("/api/companies/co2_msp/configurations");
    assert.equal(other.body.configuration.style_notes, "");

    // Trust boundary: oversized + wrong-typed fields are rejected, nothing persisted
    const tooLong = await request(app).put("/api/companies/co1_seo/configurations").send({ style_notes: "x".repeat(6001) });
    assert.equal(tooLong.status, 400);
    const wrongType = await request(app).put("/api/companies/co1_seo/configurations").send({ style_notes: 42 });
    assert.equal(wrongType.status, 400);
    const missing = await request(app).get("/api/companies/nope/configurations");
    assert.equal(missing.status, 404);

    // Mock email link uses the profile address; disconnect clears it
    const connected = await request(app).post("/api/companies/co1_seo/email/connect");
    assert.equal(connected.body.configuration.email_connected, true);
    assert.ok(connected.body.configuration.email_address, "profile email is the linked address");
    assert.ok(connected.body.configuration.email_connected_at);
    const disconnected = await request(app).post("/api/companies/co1_seo/email/disconnect");
    assert.equal(disconnected.body.configuration.email_connected, false);
    assert.equal(disconnected.body.configuration.email_address, null);

    // "Import Settings" reseeds the pricing spec, not the tenant's preferences
    await request(app).post("/api/companies/co1_seo/import");
    const afterReseed = await request(app).get("/api/companies/co1_seo/configurations");
    assert.equal(afterReseed.body.configuration.style_notes, "Warm, direct.");
  } finally {
    closeDatabase();
  }
});

test("pipeline logs: lists artifacts newest first and refuses path traversal", async () => {
  const app = createApp();
  const list = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/logs");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.artifacts));
  if (list.body.artifacts.length > 1) {
    assert.ok(list.body.artifacts[0].file > list.body.artifacts[1].file, "newest stamp first");
    assert.match(list.body.artifacts[0].logged_at, /^\d{4}-\d{2}-\d{2} /);
    const one = await request(app).get(`/api/companies/co1_seo/templates/default-co1_seo/logs/${list.body.artifacts[0].file}`);
    assert.equal(one.status, 200);
  }
  const escape = await request(app).get("/api/companies/co1_seo/templates/default-co1_seo/logs/..%2F..%2Fpackage.json");
  assert.equal(escape.status, 404);
  const escapeId = await request(app).get("/api/companies/..%2F..%2Fbackend/logs");
  assert.equal(escapeId.status, 404);
});
