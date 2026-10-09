import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import { insertTemplate, deleteTemplate } from "../repositories/templates.repository.js";
import { setEmailRoutingModelCall } from "../services/email-routing.service.js";

test("email routing includes unconfigured templates, rejects foreign IDs and detects changed candidates", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-routing-"));
  process.env.DB_PATH = path.join(dir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase();
  const app = createApp();
  const root = "/api/companies/co1_seo/templates";
  try {
    const email = await request(app).get(`${root}/mock-email`);
    assert.equal(email.status, 200);
    assert.match(email.body.email, /Bloom & Co/);
    assert.equal((await request(app).post(`${root}/route-email`)).status, 409);
    insertTemplate("co1_seo", "local-seo", "Local SEO", "Dental clinics", "$1000 monthly");
    insertTemplate("co1_seo", "custom", "Custom offer", "Franchise SEO", "Scope first");
    insertTemplate("co2_msp", "foreign", "Private IT offer", "Other company", "Other rates");
    for (const id of ["local-seo", "custom"]) {
      setEmailRoutingModelCall(async prompt => {
        assert.ok(prompt.includes(email.body.email));
        assert.match(prompt, /Dental clinics/);
        assert.match(prompt, /Scope first/);
        assert.doesNotMatch(prompt, /Private IT offer/);
        return { template_id: id, reason: "The offer fits the requested SEO services." };
      });
      const result = await request(app).post(`${root}/route-email`);
      assert.equal(result.status, 200, result.text);
      assert.equal(result.body.routing.template_id, id);
    }
    const saved = (await request(app).get(`${root}/mock-email`)).body.routing;
    assert.equal(saved.template_id, "custom");
    assert.equal(saved.email, email.body.email);
    assert.equal(saved.source, "ai");
    assert.ok(saved.routed_at);
    closeDatabase(); initDatabase();
    assert.deepEqual((await request(app).get(`${root}/mock-email`)).body.routing, saved);
    const manual = await request(app).put(`${root}/route-email`).send({ template_id: "local-seo" });
    assert.equal(manual.status, 200);
    assert.equal(manual.body.routing.source, "manual");
    assert.equal(manual.body.routing.template_id, "local-seo");
    assert.equal((await request(app).put(`${root}/route-email`).send({ template_id: "foreign" })).status, 404);
    assert.equal((await request(app).get("/api/companies/co2_msp/templates/mock-email")).body.routing.template_id, null);
    assert.throws(() => getDatabase().prepare("UPDATE mock_email_routes SET template_id = 'foreign' WHERE company_id = 'co1_seo'").run(), /belong/);
    setEmailRoutingModelCall(async () => {
      assert.equal((await request(app).put(`${root}/route-email`).send({ template_id: "custom" })).status, 200);
      return { template_id: "local-seo", reason: "Late AI result" };
    });
    assert.equal((await request(app).post(`${root}/route-email`)).status, 409);
    assert.equal((await request(app).get(`${root}/mock-email`)).body.routing.template_id, "custom");
    setEmailRoutingModelCall(async () => ({ template_id: null, reason: "Several offers fit." }));
    assert.equal((await request(app).post(`${root}/route-email`)).body.routing.template_id, null);
    for (const invalid of [{ template_id: "foreign", reason: "Wrong company" }, { template_id: "missing", reason: "Unknown" }, { template_id: "custom" }]) {
      setEmailRoutingModelCall(async () => invalid);
      assert.equal((await request(app).post(`${root}/route-email`)).status, 502);
    }
    setEmailRoutingModelCall(async () => { throw new Error("provider failure"); });
    assert.equal((await request(app).post(`${root}/route-email`)).status, 502);
    await request(app).put(`${root}/route-email`).send({ template_id: "custom" });
    setEmailRoutingModelCall(async () => { throw new Error("failed re-route"); });
    assert.equal((await request(app).post(`${root}/route-email`)).status, 502);
    assert.equal((await request(app).get(`${root}/mock-email`)).body.routing.template_id, "custom");
    setEmailRoutingModelCall(async () => {
      deleteTemplate("co1_seo", "custom");
      return { template_id: "custom", reason: "Offer fits" };
    });
    assert.equal((await request(app).post(`${root}/route-email`)).status, 409);
    const afterDelete = (await request(app).get(`${root}/mock-email`)).body.routing;
    assert.equal(afterDelete.template_id, null);
    assert.equal(afterDelete.email_id, saved.email_id);
    assert.equal(afterDelete.email, saved.email);
    assert.equal(afterDelete.source, "unassigned");
    assert.equal((getDatabase().prepare("SELECT count(*) AS n FROM mock_email_routes WHERE company_id = 'co1_seo'").get() as any).n, 1);
    await request(app).put(`${root}/route-email`).send({ template_id: "local-seo" });
    const beforeEdit = (await request(app).get(`${root}/mock-email`)).body.routing;
    const edit = await request(app).put(`${root}/mock-email`).send({ email: "We need SEO for our new clinic.", version: beforeEdit.version });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.routing.template_id, null);
    assert.equal(edit.body.routing.routed_at, null);
    assert.equal(edit.body.routing.email_id, saved.email_id);
    assert.equal((await request(app).put(`${root}/mock-email`).send({ email: "stale edit", version: beforeEdit.version })).status, 409);
    for (const invalid of ["", "   ", "x".repeat(12001), 123]) {
      assert.equal((await request(app).put(`${root}/mock-email`).send({ email: invalid, version: edit.body.routing.version })).status, 400);
    }
    closeDatabase(); initDatabase();
    assert.equal((await request(app).get(`${root}/mock-email`)).body.email, "We need SEO for our new clinic.");
    setEmailRoutingModelCall(async prompt => {
      assert.match(prompt, /We need SEO for our new clinic/);
      assert.ok(!prompt.includes(email.body.email));
      return { template_id: "local-seo", reason: "Clinic SEO fits." };
    });
    assert.equal((await request(app).post(`${root}/route-email`)).status, 200);
    const assigned = (await request(app).get(`${root}/mock-email`)).body.routing;
    assert.equal((await request(app).get(`${root}/local-seo`)).body.company.sample_lead_text, assigned.email);
    insertTemplate("co1_seo", "unrelated", "Other offer", "Unrelated template", "Other brief");
    assert.equal((await request(app).get(`${root}/unrelated`)).body.company.sample_lead_text, email.body.email);
    closeDatabase(); initDatabase();
    assert.equal((await request(app).get(`${root}/local-seo`)).body.company.sample_lead_text, assigned.email);
    await request(app).put(`${root}/route-email`).send({ template_id: "unrelated" });
    assert.equal((await request(app).get(`${root}/unrelated`)).body.company.sample_lead_text, assigned.email);
    assert.equal((await request(app).get(`${root}/local-seo`)).body.company.sample_lead_text, email.body.email);
    await request(app).put(`${root}/route-email`).send({ template_id: "local-seo" });
    const refreshed = (await request(app).get(`${root}/mock-email`)).body.routing;
    assert.equal((await request(app).put(`${root}/mock-email`).send({ email: assigned.email, version: refreshed.version })).body.routing.template_id, "local-seo");
    assert.equal((await request(app).post("/api/companies/unknown/templates/route-email")).status, 404);
  } finally { setEmailRoutingModelCall(null); closeDatabase(); }
});
