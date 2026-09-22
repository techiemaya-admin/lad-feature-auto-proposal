import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, getDatabase, closeDatabase } from "../db/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
test("templates isolate documents, variables, state, resets, deletion and survive restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "multiple-templates-"));
  process.env.DB_PATH = path.join(dir, "db.sqlite");
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase();
  const app = createApp();
  const root = "/api/companies/co1_seo/templates";
  try {
    assert.equal((await request(app).post(root).send({ name: " " })).status, 400);
    const a = await request(app).post(root).send({ name: "Managed IT" });
    const b = await request(app).post(root).send({ name: "Security audit" });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const aid = a.body.company.template_id, bid = b.body.company.template_id;
    const ap = `${root}/${aid}`, bp = `${root}/${bid}`;
    const doc = path.resolve(here, "../../../Mock Data/docx/Co1_Proposal_Northstar_BloomAndCo.docx");
    for (const [base, prompt] of [[ap, "IT pricing"], [bp, "Audit pricing"]]) {
      const result = await request(app).post(`${base}/briefing/submit`).field("prompt", prompt).attach("file", doc);
      assert.equal(result.status, 200, result.text);
    }
    const variable = await request(app).post(`${ap}/variables/custom`).send({ natural_name: "Customer", exact_quotation_snippet: "Bloom & Co Dental Group" });
    assert.equal(variable.status, 201, variable.text);
    assert.equal((await request(app).get(`${bp}/variables`)).body.variables.length, 0);
    await request(app).put(`${bp}/variables`).send({ variables: [{ id: variable.body.variable.id, natural_name: "Wrong template" }] });
    assert.equal((await request(app).get(`${ap}/variables`)).body.variables[0].natural_name, "Customer");
    assert.equal((await request(app).post(`${ap}/template/generate`)).status, 200);
    const generated = path.join(process.env.STORAGE_DIR, "co1_seo", aid, "template.docx");
    assert.ok(fs.existsSync(generated));
    assert.equal((await request(app).get(`${bp}/template/download`)).status, 404);
    const rules = JSON.parse(fs.readFileSync(path.join(here, "fixtures/co1_seo.rules.json"), "utf8"));
    const saveA = await request(app).put(`${ap}/rules`).send({ rules });
    assert.equal(saveA.status, 200, saveA.text);
    rules.tables[0].rows[1].monthly_rate = 4000;
    const saveB = await request(app).put(`${bp}/rules`).send({ rules });
    assert.equal(saveB.status, 200, saveB.text);
    const inputs = { location_count: 2, client_state: "TX", annual_prepay: true };
    const priceA = await request(app).post(`${ap}/rules/calculate`).send({ inputs });
    const priceB = await request(app).post(`${bp}/rules/calculate`).send({ inputs });
    assert.equal(priceA.body.evaluation.values.total_investment_amount, 35073);
    assert.equal(priceB.body.evaluation.values.total_investment_amount, 46764);
    const foreign = `/api/companies/co2_msp/templates/${aid}`;
    for (const suffix of ["", "/variables", "/template/download", "/rules", "/logs"]) {
      assert.equal((await request(app).get(foreign + suffix)).status, 404);
    }
    assert.equal((await request(app).post(`${foreign}/briefing/submit`).field("prompt", "Bad").attach("file", Buffer.from("rejected"), "quote.docx")).status, 404);
    assert.ok(!fs.existsSync(path.join(process.env.STORAGE_DIR, "co2_msp", aid)));
    assert.throws(() => getDatabase().prepare(`INSERT INTO company_variables
      (id, company_id, template_id, variable_name, natural_name, category, data_type, descriptor_json, created_at, updated_at)
      VALUES ('bad', 'co2_msp', ?, 'x', 'X', 'pricing', 'number', '{}', '', '')`).run(aid), /belonging/);
    await request(app).patch(bp).send({ name: "Security review" });
    closeDatabase(); initDatabase();
    assert.equal((await request(app).get(bp)).body.company.template_name, "Security review");
    assert.equal((await request(app).get(ap)).body.company.pricing_spec, "IT pricing");
    assert.equal((await request(app).get(`${ap}/template/status`)).body.exists, true);
    await request(app).post(`${bp}/reset`);
    assert.ok(fs.existsSync(generated));
    assert.equal((await request(app).get(`${ap}/variables`)).body.variables.length, 1);
    // A variable edit must invalidate the saved template, not just hide its card in the UI.
    await request(app).put(`${ap}/variables`).send({ variables: [{ id: variable.body.variable.id, natural_name: "Client" }] });
    assert.equal((await request(app).get(`${ap}/template/status`)).body.exists, false);
    await request(app).delete(ap);
    assert.equal((await request(app).get(ap)).status, 404);
    assert.equal((await request(app).get(bp)).status, 200);
    assert.equal((getDatabase().prepare("SELECT count(*) AS n FROM company_variables WHERE company_id = ? AND template_id = ?").get("co1_seo", aid) as any).n, 0);
    assert.deepEqual(getDatabase().prepare("PRAGMA foreign_key_check").all(), []);
  } finally { closeDatabase(); }
});

test("legacy database migration preserves workflow and files exactly once", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "template-migration-"));
  process.env.DB_PATH = path.join(dir, "db.sqlite");
  process.env.STORAGE_DIR = path.join(dir, "storage");
  const old = new DatabaseSync(process.env.DB_PATH);
  old.exec(`CREATE TABLE company_sessions (
    company_id TEXT PRIMARY KEY, company_name TEXT NOT NULL, industry TEXT, location TEXT, email TEXT, website TEXT, phone TEXT,
    data_json TEXT NOT NULL, pricing_spec TEXT NOT NULL, working_state_json TEXT, quotation_filename TEXT, quotation_filesize INTEGER,
    quotation_markdown TEXT, quotation_parsed_at TEXT, briefing_locked INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE company_variables (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, variable_name TEXT NOT NULL, natural_name TEXT NOT NULL,
    category TEXT NOT NULL, data_type TEXT NOT NULL, is_custom INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
    descriptor_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO company_sessions (company_id, company_name, data_json, pricing_spec, working_state_json, created_at, updated_at)
      VALUES ('legacy', 'Legacy Company', '{}', 'Preserved rates', '{"stage":"template_checkpoint","template_stats":{"tags_placed_count":2},"pricing_rules":{"saved":true}}', 'a', 'b');
    INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, descriptor_json, created_at, updated_at)
      VALUES ('v', 'legacy', 'total', 'Total', 'pricing', 'currency', '{}', 'a', 'b');`);
  old.close();
  const folder = path.join(process.env.STORAGE_DIR, "legacy");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "template.docx"), "preserved document bytes");
  try {
    let db = initDatabase();
    const row = db.prepare("SELECT * FROM proposal_templates WHERE company_id = ?").get("legacy") as any;
    assert.equal(row.pricing_spec, "Preserved rates");
    assert.equal(JSON.parse(row.working_state_json).pricing_rules.saved, true);
    assert.equal((db.prepare("SELECT template_id FROM company_variables WHERE company_id = ?").get("legacy") as any).template_id, row.template_id);
    assert.equal(fs.readFileSync(path.join(folder, row.template_id, "template.docx"), "utf8"), "preserved document bytes");
    db.prepare("UPDATE proposal_templates SET pricing_spec = ? WHERE company_id = ? AND template_id = ?").run("New rates", "legacy", row.template_id);
    closeDatabase(); db = initDatabase();
    const rows = db.prepare("SELECT * FROM proposal_templates WHERE company_id = ?").all("legacy") as any[];
    assert.equal(rows.length, 1); assert.equal(rows[0].pricing_spec, "New rates");
  } finally { closeDatabase(); }
});
