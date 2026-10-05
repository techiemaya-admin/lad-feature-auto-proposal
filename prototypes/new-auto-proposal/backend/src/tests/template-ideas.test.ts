import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";
import { setTemplateIdeasModelCall } from "../services/template-ideas.service.js";

test("ICP import saves three briefs, validates AI output, isolates companies and enforces capacity", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "template-ideas-"));
  process.env.DB_PATH = path.join(dir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase();
  const app = createApp();
  const root = "/api/companies/co1_seo/templates";
  const other = "/api/companies/co2_msp/templates";
  const ideas = ["Local businesses", "Regional chains", "Franchises"].map(name => ({ name, description: `SEO for ${name}`, pricing_spec: "Local is $1000/mo; confirm tax with bookkeeper." }));
  try {
    assert.deepEqual((await request(app).get(root)).body.templates, []);
    let release!: (value: unknown) => void;
    const entered = new Promise<void>(resolve => {
      setTemplateIdeasModelCall(prompt => {
        assert.match(prompt, /Northstar Digital/);
        assert.doesNotMatch(prompt, /Fortress IT Group/);
        assert.match(prompt, /If B2B only, ALL three/);
        assert.match(prompt, /If both, cover both/);
        resolve();
        return new Promise(done => { release = done; });
      });
    });
    const pending = request(app).post(`${root}/import-icp`).then(r => r);
    await entered;
    assert.equal((await request(app).post(`${root}/import-icp`)).status, 409);
    release({ templates: ideas });
    const result = await pending;
    assert.equal(result.status, 201, result.text);
    assert.equal(result.body.templates.length, 3);
    assert.deepEqual((await request(app).get(other)).body.templates, []);
    const first = result.body.templates[0];
    const workflow = (await request(app).get(`${root}/${first.template_id}`)).body.company;
    assert.equal(workflow.pricing_spec, ideas[0].pricing_spec);
    assert.equal(workflow.briefing_locked, false);
    closeDatabase(); initDatabase();
    assert.deepEqual((await request(app).get(root)).body.templates, result.body.templates);
    assert.equal((await request(app).post(`${root}/import-icp`)).status, 409);
    assert.equal((await request(app).post(root).send({ name: "Missing fields" })).status, 400);
    for (let i = 0; i < 4; i++) assert.equal((await request(app).post(root).send({ ...ideas[0], name: `Custom ${i}` })).status, 201);
    assert.equal((await request(app).post(root).send(ideas[0])).status, 409);
    assert.equal((await request(app).delete(`${other}/${first.template_id}`)).status, 404);
    assert.equal((await request(app).delete(`${root}/${first.template_id}`)).status, 200);
    assert.equal((await request(app).post(root).send(ideas[0])).status, 201);
    for (const output of [{ templates: ideas.slice(1) }, { templates: [ideas[0], ideas[0], ideas[0]] }, { templates: [ideas[0], ideas[1], { name: "Bad" }] }]) {
      setTemplateIdeasModelCall(async () => output);
      assert.equal((await request(app).post(`${other}/import-icp`)).status, 502);
      assert.deepEqual((await request(app).get(other)).body.templates, []);
    }
    setTemplateIdeasModelCall(async () => { throw new Error("provider failure"); });
    assert.equal((await request(app).post(`${other}/import-icp`)).status, 502);
    setTemplateIdeasModelCall(async () => ({ templates: ideas }));
    assert.equal((await request(app).post(`${other}/import-icp`)).status, 201);
  } finally { setTemplateIdeasModelCall(null); closeDatabase(); }
});
