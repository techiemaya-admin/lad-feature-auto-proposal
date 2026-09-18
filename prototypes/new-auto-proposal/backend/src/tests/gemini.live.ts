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
import { toWire } from "../services/pricing-rules.types.js";
import { setPdfConverter } from "../services/proposal-generator.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Live Gemini contract check — run with `npm run test:live` (needs a real GEMINI_API_KEY in .env).
 * Not part of `npm test`: it is slow, costs money, and measures the prompt, not the code.
 * The engine only needs sample_text to be verbatim, so that is the property we measure.
 */
test("Gemini extraction contract (live)", { skip: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("your-key") }, async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-live-test-"));
  process.env.DB_PATH = path.join(testDir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(testDir, "storage");
  fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
  initDatabase(process.env.DB_PATH);
  const app = createApp();
  const mockDataDir = path.resolve(__dirname, "../../../Mock Data/docx");
  const northstarDocx = path.join(mockDataDir, "Co1_Proposal_Northstar_BloomAndCo.docx");
  const fortressDocx = path.join(mockDataDir, "Co2_Proposal_FortressIT_WhitfieldAssociates.docx");
  const fieldstoneDocx = path.join(mockDataDir, "Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx");
  t.after(() => {
    closeDatabase();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // The engine only needs sample_text to be verbatim, so that is the property we measure.
  {
    // Same tolerance as the engine's matcher: markdown emphasis, NBSP, dash and quote variants.
    const normalize = (s: string) =>
      s.replace(/\*+/g, "").replace(/\u00A0/g, " ").replace(/[\u2212\u2013]/g, "-").replace(/[\u2019\u2018]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

    const cases = [
      { id: "co1_seo", docx: northstarDocx, agency: "Northstar", client: "Bloom & Co", prompt: "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. Texas tax 8.25%.", loops: 0 },
      { id: "co2_msp", docx: fortressDocx, agency: "Fortress IT", client: "Whitfield", prompt: "Essential $45/seat, Standard $65/seat, Premium $85/seat. Ohio tax 6%.", loops: 0 },
      { id: "co3_dev", docx: fieldstoneDocx, agency: "Fieldstone", client: "Rosewood", prompt: "Base e-commerce build $9,500. Copywriting add-on $600. SEO add-on $450. 50/50 payment split.", loops: 2 },
    ];

    for (const c of cases) {
      await t.test(`POST /variables/extract (${c.id}): every sample_text is verbatim and the agency is never a variable`, { timeout: 90000 }, async () => {
        const submit = await request(app).post(`/api/companies/${c.id}/briefing/submit`).field("prompt", c.prompt).attach("file", c.docx);
        assert.equal(submit.status, 200);
        const markdown = normalize((await request(app).get(`/api/companies/${c.id}/briefing/markdown`)).body.markdown);

        const res = await request(app).post(`/api/companies/${c.id}/variables/extract`).timeout(90000);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const vars = res.body.variables as any[];
        assert.ok(vars.length > 0);

        const notVerbatim = vars
          .filter((v) => !v.descriptor.sample_value.split(/\r?\n/).every((line: string) => !line.trim() || markdown.includes(normalize(line))))
          .map((v) => `${v.variable_name}: ${JSON.stringify(v.descriptor.sample_value)}`);
        assert.deepEqual(notVerbatim, [], "sample_text must be copied verbatim from the quotation");

        assert.equal(vars.find((v) => normalize(v.descriptor.sample_value).includes(c.agency.toLowerCase())), undefined, "agency name extracted");
        assert.ok(vars.find((v) => v.descriptor.sample_value.includes(c.client)), "client name not extracted");
        assert.ok(vars.some((v) => v.category === "paragraph" && v.descriptor.paragraph_config?.mode === "ai_generated"), "no ai_generated narrative extracted");
        for (const v of vars.filter((v) => v.descriptor.visibility_rule)) {
          assert.match(v.descriptor.visibility_rule.condition_flag, /^has_/, `${v.variable_name} condition_flag`);
        }

        const tables = res.body.compound_tables as any[];
        assert.ok(tables.length >= c.loops, `expected >= ${c.loops} loop tables, got ${tables.length}`);
        for (const tbl of tables) {
          assert.ok(tbl.header_texts?.length > 0 && tbl.columns?.length === tbl.header_texts.length, `loop ${tbl.loop_tag} needs header_texts and one column tag per header`);
          assert.ok(tbl.row_labels?.length > 0, `loop ${tbl.loop_tag} needs row_labels`);
        }
      });
    }
  }
});

/**
 * Stage 5 live contract (co1): the lead extractor reads the sample WhatsApp reply correctly and the narrative
 * drafter writes placeholders, not numbers. Stages 2–4 come from the golden fixtures so only two calls are live.
 */
test("Lead extraction + narrative contract (live, co1)", { skip: !process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY, timeout: 180000 }, async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-live-s5-"));
  process.env.DB_PATH = path.join(testDir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(testDir, "storage");
  fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
  initDatabase(process.env.DB_PATH);
  const app = createApp();
  const cwd = process.cwd();
  process.chdir(path.resolve(__dirname, "../.."));
  t.after(() => {
    setRulesModelCall(null);
    setPdfConverter(null);
    process.chdir(cwd);
    closeDatabase();
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* leaked temp dir is not a failure */ }
  });

  const fixturesDir = path.join(__dirname, "fixtures");
  const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.variables.json"), "utf8"));
  const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.raw.json"), "utf8"));
  const submit = await request(app).post("/api/companies/co1_seo/briefing/submit").field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. 10% off annual. Texas tax 8.25%.")
    .attach("file", path.resolve(__dirname, "../../../Mock Data/docx/Co1_Proposal_Northstar_BloomAndCo.docx"));
  assert.equal(submit.status, 200, submit.text);
  const insert = getDatabase().prepare(
    `INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
     VALUES (?, 'co1_seo', ?, ?, ?, ?, 0, 0, ?, ?, datetime('now'), datetime('now'))`);
  fx.variables.forEach((v: any, i: number) => {
    const tips = raw.variables?.find((r: any) => r.variable_name === v.variable_name)?.paragraph_config;
    insert.run(`v${i}`, v.variable_name, v.variable_name, v.category, v.category === "pricing" ? "currency" : "string", i,
      JSON.stringify({ sample_value: v.sample_text, enum_options: v.enum_options, visibility_rule: v.condition_flag ? { condition_flag: v.condition_flag } : undefined, paragraph_config: tips }));
  });
  assert.equal((await request(app).post("/api/companies/co1_seo/template/generate")).status, 200);
  setRulesModelCall(async () => toWire(JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.rules.json"), "utf8"))));
  assert.equal((await request(app).post("/api/companies/co1_seo/rules/compile")).status, 200);
  assert.equal((await request(app).post("/api/companies/co1_seo/rules/proceed")).status, 200);

  const lead = (await request(app).get("/api/companies/co1_seo")).body.company.sample_lead_text as string;
  assert.ok(lead.includes("Bloom & Co"));

  const extract = await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead }).timeout(90000);
  assert.equal(extract.status, 200, extract.text);
  assert.equal(extract.body.inputs.location_count, 2);
  assert.equal(extract.body.inputs.client_state, "TX");
  assert.equal(extract.body.inputs.annual_prepay, true);
  assert.match(String(extract.body.inputs.client_name), /Bloom/);
  assert.deepEqual(extract.body.missing, []);

  setPdfConverter(async () => Buffer.from("%PDF stub"));
  const gen = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: extract.body.inputs, lead_text: lead }).timeout(120000);
  assert.equal(gen.status, 200, gen.text);
  assert.equal(gen.body.payload.total_investment_amount, "$35,073.00");
  const paragraphs = Object.entries(gen.body.narrative as Record<string, { text: string; tags_placed: string[]; unknown_tags: string[] }>);
  assert.ok(paragraphs.length >= 5, `expected the co1 narrative paragraphs, got ${paragraphs.length}`);
  const payload = gen.body.payload as Record<string, unknown>;
  for (const [name, p] of paragraphs) {
    assert.ok(p.text.trim().length > 40, `${name} is empty`);
    // Every money figure in the prose must have arrived through a placeholder, never been typed by the model.
    const placed = new Set(p.tags_placed.map((t) => String(payload[t])));
    for (const m of p.text.match(/\$[\d,]+(?:\.\d+)?(?:\/mo)?/g) ?? []) assert.ok(placed.has(m), `${name}: the model typed ${m} — "${p.text}"`);
    assert.deepEqual(p.unknown_tags, [], `${name} used tags the payload has no value for`);
  }
});
