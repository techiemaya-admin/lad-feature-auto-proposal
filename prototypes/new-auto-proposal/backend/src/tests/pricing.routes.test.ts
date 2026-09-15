import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import { setRulesModelCall } from "../services/pricing-compiler.service.js";
import { toWire, type AiPricingRules, type PricingRules } from "../services/pricing-rules.types.js";

/**
 * Stage 4 routes end to end with the model call stubbed (npm test stays offline):
 * compile → read → edit (rejected / accepted) → calculate → reset by earlier stages → proceed.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");
const mockDataDir = path.resolve(__dirname, "../../../Mock Data");
const fixture = (): PricingRules => JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.rules.json"), "utf8"));

test("Pricing rules routes", async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-rules-test-"));
  process.env.DB_PATH = path.join(testDir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(testDir, "storage");
  fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
  initDatabase(process.env.DB_PATH);
  const app = createApp();
  const cwd = process.cwd();
  process.chdir(path.resolve(__dirname, "../..")); // resolveQuotationPath's Mock Data fallback

  t.after(() => {
    setRulesModelCall(null);
    process.chdir(cwd);
    closeDatabase();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  /** Stage 1 for real (anydoc markdown), Stage 2 from the golden fixture, Stage 3 for real (tier matrix in template_stats). */
  const seedThroughStage2 = async () => {
    const submit = await request(app)
      .post("/api/companies/co1_seo/briefing/submit")
      .field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. 10% off for annual prepay. Texas tax 8.25%.")
      .attach("file", path.join(mockDataDir, "docx", "Co1_Proposal_Northstar_BloomAndCo.docx"));
    assert.equal(submit.status, 200, submit.text);
    const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.variables.json"), "utf8"));
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare("DELETE FROM company_variables WHERE company_id = 'co1_seo'").run();
    const insert = db.prepare(
      `INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
       VALUES (?, 'co1_seo', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
    );
    fx.variables.forEach((v: any, i: number) =>
      insert.run(`v${i}`, v.variable_name, v.variable_name, v.category, v.category === "pricing" ? "currency" : "string", i,
        JSON.stringify({ sample_value: v.sample_text, enum_options: v.enum_options, visibility_rule: v.condition_flag ? { condition_flag: v.condition_flag } : undefined }), now, now));
    const generate = await request(app).post("/api/companies/co1_seo/template/generate");
    assert.equal(generate.status, 200, generate.text);
  };
  const getRules = () => request(app).get("/api/companies/co1_seo/rules");
  const stageOf = async () => (await request(app).get("/api/companies/co1_seo")).body.company.working_state?.stage;

  await seedThroughStage2();
  setRulesModelCall(async () => toWire(fixture()));

  await t.test("404 before compile, then compile persists an all-green state and moves the stage", async () => {
    assert.equal((await getRules()).status, 404);
    const res = await request(app).post("/api/companies/co1_seo/rules/compile");
    assert.equal(res.status, 200, res.text);
    const state = res.body.pricing_rules;
    assert.deepEqual(state.validation_errors, []);
    assert.deepEqual(state.sample_check.filter((c: any) => !c.ok), []);
    assert.equal(state.evaluation.values.total_investment_amount, 35073);
    assert.equal(await stageOf(), "pricing_engine");
    const read = await getRules();
    assert.equal(read.status, 200);
    assert.equal(read.body.pricing_rules.rules.variables.length, fixture().variables.length);
  });

  await t.test("PUT rejects structural errors without persisting, accepts edits and re-checks the sample", async () => {
    const bad = fixture();
    (bad.variables.find((v) => v.name === "subtotal_amount") as any).args.push(1);
    const rejected = await request(app).put("/api/companies/co1_seo/rules").send({ rules: bad });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.errors[0].path, "variables[10].args");
    assert.deepEqual((await getRules()).body.pricing_rules.validation_errors, []);

    const edited = fixture();
    (edited.variables.find((v) => v.name === "annual_discount_percentage") as any).value = 0.15;
    const accepted = await request(app).put("/api/companies/co1_seo/rules").send({ rules: edited });
    assert.equal(accepted.status, 200, accepted.text);
    const mismatches = accepted.body.pricing_rules.sample_check.filter((c: any) => !c.ok).map((c: any) => c.name);
    assert.ok(mismatches.includes("annual_discount_percentage") && mismatches.includes("total_investment_amount"), mismatches.join());
    assert.equal((await getRules()).body.pricing_rules.rules.variables.find((v: any) => v.name === "annual_discount_percentage").value, 0.15);
  });

  await t.test("calculate evaluates arbitrary lead inputs and returns the proposal payload", async () => {
    const res = await request(app).post("/api/companies/co1_seo/rules/calculate").send({ inputs: { location_count: 3, client_state: "CA" } });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.evaluation.values.selected_tier, "Growth");
    assert.equal(res.body.payload.has_tax, false);
    assert.equal(res.body.payload.has_annual_discount, false);
    assert.equal(res.body.payload.total_investment_amount, "$36,000.00");
    assert.equal(typeof res.body.payload.tier1_name, "string");
  });

  await t.test("proceed moves to lead_simulation only when the rules are valid", async () => {
    const res = await request(app).post("/api/companies/co1_seo/rules/proceed");
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.company.working_state.stage, "lead_simulation");
  });

  await t.test("regenerating the template and unlocking the briefing both reset Stage 4", async () => {
    const regen = await request(app).post("/api/companies/co1_seo/template/generate");
    assert.equal(regen.status, 200, regen.text);
    assert.equal((await getRules()).status, 404);
    assert.equal((await request(app).post("/api/companies/co1_seo/rules/proceed")).status, 409);

    assert.equal((await request(app).post("/api/companies/co1_seo/rules/compile")).status, 200);
    assert.equal((await getRules()).status, 200);
    const unlock = await request(app).post("/api/companies/co1_seo/briefing/unlock");
    assert.equal(unlock.status, 200, unlock.text);
    assert.equal((await getRules()).status, 404);
    assert.equal(unlock.body.company.working_state.pricing_rules, null);
  });

  await t.test("a broken first attempt is repaired by the retry, which sees the errors", async () => {
    await seedThroughStage2();
    const cyclic = fixture();
    (cyclic.variables.find((v) => v.name === "base_investment_amount") as any).args = ["subtotal_amount", "contract_months"];
    const prompts: string[] = [];
    let calls = 0;
    setRulesModelCall(async (prompt: string): Promise<AiPricingRules> => {
      prompts.push(prompt);
      return toWire(calls++ === 0 ? cyclic : fixture());
    });
    const res = await request(app).post("/api/companies/co1_seo/rules/compile");
    assert.equal(res.status, 200, res.text);
    assert.equal(calls, 2);
    assert.deepEqual(res.body.pricing_rules.validation_errors, []);
    assert.deepEqual(res.body.pricing_rules.sample_check.filter((c: any) => !c.ok), []);
    assert.match(prompts[1], /circular definition/);
    assert.match(prompts[1], /PREVIOUS ATTEMPT/);
    assert.doesNotMatch(prompts[0], /PREVIOUS ATTEMPT/);
  });

  await t.test("compile refuses a company that has not reached Stage 2", async () => {
    const res = await request(app).post("/api/companies/co2_msp/rules/compile");
    assert.equal(res.status, 400);
  });
});
