import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { toMarkdown } from "@firecrawl/anydoc";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import { setRulesModelCall } from "../services/pricing-compiler.service.js";
import { toWire, type PricingRules, type Stage2Context } from "../services/pricing-rules.types.js";
import { fillDates, setPdfConverter } from "../services/proposal-generator.service.js";
import { substitutePlaceholders, setNarrativeModelCall } from "../services/narrative-drafter.service.js";
import { leadFields, setLeadModelCall } from "../services/lead-extractor.service.js";
import { buildClarifyPrompt, setClarifyModelCall } from "../services/clarification-drafter.service.js";

/**
 * Stage 5 offline: the pure pieces (dates, placeholder substitution, per-company fact schema) and the
 * routes end to end on co1 with every model call and the PDF converter stubbed.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");
const mockDataDir = path.resolve(__dirname, "../../../Mock Data");
const rulesOf = (id: string): PricingRules => JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.rules.json`), "utf8"));
const stage2Of = (id: string): Stage2Context => {
  const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.variables.json`), "utf8"));
  return { variables: fx.variables.map((v: any) => ({ variable_name: v.variable_name, category: v.category, sample_value: v.sample_text, enum_options: v.enum_options })), loop_tables: [] };
};

test("fillDates: earliest sample date becomes today, the others keep their offset, format and suffix", () => {
  const vars = [
    { variable_name: "client_name", category: "customer_input", sample_value: "Bloom & Co" },
    { variable_name: "proposal_date", category: "customer_input", data_type: "date", sample_value: "September 7, 2026" },
    { variable_name: "proposal_valid_until", category: "customer_input", data_type: "string", sample_value: "September 21, 2026 (14 days)" },
    { variable_name: "contract_months", category: "pricing", data_type: "number", sample_value: "12" },
  ];
  assert.deepEqual(fillDates(vars, new Date(2026, 8, 18)), { proposal_date: "September 18, 2026", proposal_valid_until: "October 2, 2026 (14 days)" });
  assert.deepEqual(fillDates(vars, new Date(2026, 11, 25)), { proposal_date: "December 25, 2026", proposal_valid_until: "January 8, 2027 (14 days)" });
  assert.deepEqual(fillDates([vars[0], vars[3]]), {});
});

test("substitutePlaceholders: known tags are filled, unknown tags stripped and reported", () => {
  const r = substitutePlaceholders("Growth at {selected_tier_rate} for {contract_months} months, {mystery} total {total_investment_amount}.", {
    selected_tier_rate: "$3,000/mo", contract_months: "12", total_investment_amount: "$35,073.00", has_tax: true, rows: [],
  });
  assert.equal(r.text, "Growth at $3,000/mo for 12 months, total $35,073.00.");
  assert.deepEqual(r.tags_placed, ["selected_tier_rate", "contract_months", "total_investment_amount"]);
  assert.deepEqual(r.unknown_tags, ["mystery"]);
});

test("leadFields: rules inputs plus the undefined non-date customer inputs, per company", () => {
  const brief = (id: string, extra: Stage2Context["variables"] = [], rules = rulesOf(id)) => {
    const s2 = stage2Of(id);
    return leadFields(rules, { ...s2, variables: [...s2.variables, ...extra] }).map((f) => `${f.name}:${f.input_type}${f.required ? "!" : ""}${f.options.length ? `[${f.options.join("|")}]` : ""}`);
  };
  assert.deepEqual(brief("co1_seo"), ["location_count:integer!", "client_state:region![TX]", "annual_prepay:boolean", "client_name:text!"]);
  // seen live on co2: a "14 days" validity window is a Stage 2 customer input the sheet holds as a constant — never asked
  const validity = [{ variable_name: "proposal_validity_period", category: "customer_input", sample_value: "14 days" }];
  const withConstant = rulesOf("co1_seo");
  withConstant.variables.push({ name: "proposal_validity_period", label: "Validity", in_document: true, unit: "text", condition_flag: "", kind: "constant", value: "14 days" });
  assert.deepEqual(brief("co1_seo", validity, withConstant).at(-1), "client_name:text!");
  assert.deepEqual(brief("co1_seo", validity).at(-1), "proposal_validity_period:text!");
  assert.deepEqual(brief("co2_msp"), ["seat_count:integer!", "selected_tier:choice![Essential|Standard|Premium]", "extra_device_count:integer", "client_state:region![OH]", "client_name:text!"]);
  const co3 = brief("co3_dev");
  assert.equal(co3[0], "product_count:integer!");
  assert.match(co3[1], /^project_template_name:choice!\[.*E-Commerce Build.*\]$/);
  assert.match(co3[2], /^selected_addons:multi_choice\[.*Copywriting.*\]$/);
  assert.deepEqual(co3.slice(3), ["rush_delivery:boolean", "client_name:text!"]);
});

test("Proposal routes", async (t) => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-proposal-proposal-test-"));
  process.env.DB_PATH = path.join(testDir, "test.sqlite");
  process.env.STORAGE_DIR = path.join(testDir, "storage");
  fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
  initDatabase(process.env.DB_PATH);
  const app = createApp();
  const cwd = process.cwd();
  process.chdir(path.resolve(__dirname, "../..")); // resolveQuotationPath's Mock Data fallback
  const docxPath = path.join(process.env.STORAGE_DIR, "co1_seo", "proposal.docx");
  const pdfPath = path.join(process.env.STORAGE_DIR, "co1_seo", "proposal.pdf");

  t.after(() => {
    setRulesModelCall(null);
    setLeadModelCall(null);
    setClarifyModelCall(null);
    setNarrativeModelCall(null);
    setPdfConverter(null);
    process.chdir(cwd);
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the sqlite/docx handles for a moment; a leaked temp dir is not a failure.
    }
  });

  // Stage 1 for real, Stage 2 from the golden fixture, Stage 3 for real, Stage 4 from the rules fixture.
  const submit = await request(app)
    .post("/api/companies/co1_seo/briefing/submit")
    .field("prompt", "Local $1000/mo, Growth $3000/mo, Authority $8000/mo. 10% off for annual prepay. Texas tax 8.25%.")
    .attach("file", path.join(mockDataDir, "docx", "Co1_Proposal_Northstar_BloomAndCo.docx"));
  assert.equal(submit.status, 200, submit.text);
  const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, "co1_seo.variables.json"), "utf8"));
  const db = getDatabase();
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
     VALUES (?, 'co1_seo', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
  );
  fx.variables.forEach((v: any, i: number) =>
    insert.run(`v${i}`, v.variable_name, v.variable_name, v.category, v.category === "pricing" ? "currency" : "string", i,
      JSON.stringify({ sample_value: v.sample_text, enum_options: v.enum_options, visibility_rule: v.condition_flag ? { condition_flag: v.condition_flag } : undefined,
        paragraph_config: v.category === "paragraph" ? { mode: "ai_generated", purpose: `purpose of ${v.variable_name}`, tone: "warm" } : undefined }), now, now));
  assert.equal((await request(app).post("/api/companies/co1_seo/template/generate")).status, 200);
  setRulesModelCall(async () => toWire(rulesOf("co1_seo")));
  assert.equal((await request(app).post("/api/companies/co1_seo/rules/compile")).status, 200);

  const lead = "Hi, we're Bloom & Co, two clinics in the Austin area, would rather pay once a year.";
  const facts = { location_count: 2, client_state: "tx", annual_prepay: true, client_name: "Bloom & Co" };

  await t.test("409 until the rules stage proceeds", async () => {
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead })).status, 409);
    assert.equal((await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: facts })).status, 409);
    assert.equal((await request(app).post("/api/companies/co1_seo/rules/proceed")).status, 200);
  });

  await t.test("extract builds the facts from the model answer and lists what is missing", async () => {
    const prompts: string[] = [];
    setLeadModelCall(async (prompt) => { prompts.push(prompt); return { ...facts, assumptions: ["Counted two clinics as 2 locations"] }; });
    const full = await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead });
    assert.equal(full.status, 200, full.text);
    assert.deepEqual(full.body.inputs, { ...facts, client_state: "TX" });
    assert.deepEqual(full.body.missing, []);
    assert.deepEqual(full.body.fields.map((f: any) => f.name), ["location_count", "client_state", "annual_prepay", "client_name"]);
    assert.deepEqual(full.body.assumptions, ["Counted two clinics as 2 locations"]);
    assert.match(prompts[0], /client_state \(Client state\): region/);
    assert.match(prompts[0], /annual_prepay .* \(optional\)/);

    setLeadModelCall(async () => ({ ...facts, client_state: null, assumptions: [] }));
    const partial = await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead });
    assert.deepEqual(partial.body.missing, ["client_state"]);
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: "" })).status, 400);
  });

  await t.test("a silent lead gets the seller's default from code", async () => {
    const rules = rulesOf("co1_seo");
    const prepay = rules.variables.find((v) => v.name === "annual_prepay") as any;
    prepay.default = true;
    prepay.assume_when = "a yearly plan or paying up front means yes";
    assert.equal((await request(app).put("/api/companies/co1_seo/rules").send({ rules })).status, 200);
    let prompt = "";
    setLeadModelCall(async (p) => { prompt = p; return { ...facts, annual_prepay: null, assumptions: [] }; });
    const res = await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead });
    assert.equal(res.status, 200, res.text);
    assert.match(prompt, /annual_prepay .*\(read it as: a yearly plan or paying up front means yes\)/);
    assert.equal(res.body.inputs.annual_prepay, true);
    assert.deepEqual(res.body.assumed, ["annual_prepay"]);
    assert.deepEqual(res.body.missing, []);
    assert.equal(res.body.fields.find((f: any) => f.name === "annual_prepay").default, true);
    assert.equal((await request(app).put("/api/companies/co1_seo/rules").send({ rules: rulesOf("co1_seo") })).status, 200);
  });

  await t.test("clarify drafts an email naming the missing facts in natural language", async () => {
    let seen = "";
    setClarifyModelCall(async (prompt) => { seen = prompt; return { subject: "Re: local SEO", body: "Which state are the clinics in?" }; });
    const res = await request(app).post("/api/companies/co1_seo/lead/clarify").send({ lead_text: lead, inputs: { ...facts, client_state: null }, missing: ["client_state"], assumed: ["annual_prepay"] });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.subject, "Re: local SEO");
    assert.match(seen, /WHAT WE STILL NEED[\s\S]*- Client state/);
    assert.ok(seen.includes("Number of locations: 2"), seen);
    assert.match(seen, /WHAT WE'RE ASSUMING[\s\S]*Pays annually up front: true/);
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/clarify").send({ lead_text: lead, inputs: facts, missing: [] })).status, 400);
  });

  await t.test("clarify tells the drafter the real options of a missing choice field", async () => {
    // Seen live: without them the drafter invented its own, the lead answered in those terms, and the extractor guessed a tier.
    const fields = leadFields(rulesOf("co3_dev"), stage2Of("co3_dev"));
    const company = { company_id: "co1_seo", company_name: "Northstar", data_json: "{}" } as any;
    const prompt = buildClarifyPrompt({ company, fields, inputs: { product_count: 60 }, missing: ["project_template_name"], leadText: "60 products" });
    const stillNeed = prompt.slice(prompt.indexOf("WHAT WE STILL NEED"), prompt.indexOf("RULES"));
    for (const o of ["Landing Page", "Business Website", "E-Commerce Build", "Custom Web App"]) assert.ok(stillNeed.includes(o), `${o} is offered`);
  });

  await t.test("reply plays the lead against the thread so the extractor can re-read it", async () => {
    const thread = `From: the lead\n${lead}\n\nFrom: Northstar\nSubject: Re: local SEO\nWhich state are the clinics in?`;
    let seen = "";
    setClarifyModelCall(async (prompt) => { seen = prompt; return { subject: "Re: Re: local SEO", body: "Texas, both of them." }; });
    const res = await request(app).post("/api/companies/co1_seo/lead/reply").send({ lead_text: thread });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.body, "Texas, both of them.");
    assert.match(seen, /You play the lead[\s\S]*Which state are the clinics in\?/);
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/reply").send({ lead_text: "" })).status, 400);

    // The extractor is told the thread shape and that the lead's later word wins.
    let extractPrompt = "";
    setLeadModelCall(async (prompt) => { extractPrompt = prompt; return { ...facts, assumptions: [] }; });
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: `${thread}\n\nFrom: the lead\n${res.body.body}` })).status, 200);
    assert.match(extractPrompt, /Texas, both of them\./);
  });

  await t.test("generate refuses missing required facts with 400", async () => {
    const res = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: { ...facts, client_state: null }, lead_text: lead });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.missing, ["client_state"]);
    assert.ok(!fs.existsSync(docxPath));
  });

  await t.test("generate: numbers from the calculator, prose from placeholders, docx + pdf on disk", async () => {
    let narrativePrompt = "";
    setNarrativeModelCall(async (prompt, names) => {
      narrativePrompt = prompt;
      return Object.fromEntries(names.map((n) => [n, `${n}: {selected_tier} at {selected_tier_rate} for {contract_months} months, {not_a_tag} total {total_investment_amount}.`]));
    });
    setPdfConverter(async () => Buffer.from("%PDF-1.4 stub"));
    const res = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: facts, lead_text: lead });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, true);
    assert.equal(res.body.payload.total_investment_amount, "$35,073.00");
    assert.equal(res.body.payload.client_name, "Bloom & Co");
    assert.match(res.body.payload.proposal_date, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    assert.match(res.body.payload.proposal_valid_until, / \(14 days\)$/);
    const para = res.body.narrative.client_current_situation_narrative;
    assert.equal(para.text, "client_current_situation_narrative: Growth at $3,000/mo for 12 months, total $35,073.00.");
    assert.deepEqual(para.unknown_tags, ["not_a_tag"]);
    assert.match(narrativePrompt, /\{total_investment_amount\} = "\$35,073.00"/);
    assert.match(narrativePrompt, /Purpose: purpose of client_current_situation_narrative/);
    assert.match(narrativePrompt, /Bloom & Co, two clinics/);
    assert.equal(res.body.files.docx, "/api/companies/co1_seo/proposal/download?format=docx&client=Bloom%20%26%20Co");
    assert.equal(res.body.files.pdf, "/api/companies/co1_seo/proposal/download?format=pdf&client=Bloom%20%26%20Co");
    assert.ok(fs.existsSync(docxPath) && fs.existsSync(pdfPath));

    const md = await toMarkdown(docxPath);
    assert.ok(md.includes("$35,073.00"), md);
    assert.ok(md.includes("Bloom & Co"), md);
    assert.ok(!/[{}]/.test(md), md.match(/.{0,40}[{}].{0,40}/g)?.join("\n"));

    const dl = await request(app).get(res.body.files.docx);
    assert.equal(dl.status, 200);
    assert.match(dl.headers["content-disposition"], /attachment.*Proposal - Bloom & Co\.docx/);
    // The preview URL must render in the iframe, the button's must save to disk.
    const preview = await request(app).get(res.body.files.pdf);
    assert.equal(preview.status, 200);
    assert.match(preview.headers["content-disposition"], /^inline; filename="Proposal - Bloom & Co\.pdf"$/);
    assert.match(preview.headers["content-type"], /application\/pdf/);
    assert.match((await request(app).get(`${res.body.files.pdf}&download=1`)).headers["content-disposition"], /attachment.*Proposal - Bloom & Co\.pdf/);
    assert.equal((await request(app).get("/api/companies/co1_seo/proposal/download?format=txt")).status, 400);
  });

  await t.test("generate fills a silent fact from its default itself, so a client cannot skip the policy", async () => {
    const rules = rulesOf("co1_seo");
    (rules.variables.find((v) => v.name === "location_count") as any).default = 1;
    (rules.variables.find((v) => v.name === "annual_prepay") as any).default = true;
    assert.equal((await request(app).put("/api/companies/co1_seo/rules").send({ rules })).status, 200);
    let narrativePrompt = "";
    setNarrativeModelCall(async (prompt, names) => { narrativePrompt = prompt; return Object.fromEntries(names.map((n) => [n, n])); });
    // The client's assumed[] is trusted only for fields that actually carry a default (client_state has none).
    const res = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: { ...facts, location_count: null }, lead_text: lead, assumed: ["annual_prepay", "client_state"] });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.evaluation.values.location_count, 1);
    assert.match(narrativePrompt, /- Number of locations: 1 \(assumed/);
    assert.match(narrativePrompt, /- Pays annually up front: true \(assumed/);
    assert.match(narrativePrompt, /- Client state: tx\n/);
    assert.equal((await request(app).put("/api/companies/co1_seo/rules").send({ rules: rulesOf("co1_seo") })).status, 200);
  });

  await t.test("a PDF failure keeps the docx and reports pdf: null", async () => {
    setPdfConverter(async () => { throw new Error("soffice exploded"); });
    const res = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: facts, lead_text: lead });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.files.pdf, null);
    assert.equal(res.body.pdf_error, "soffice exploded");
    assert.ok(fs.existsSync(docxPath) && !fs.existsSync(pdfPath));
    assert.equal((await request(app).get("/api/companies/co1_seo/proposal/download?format=pdf")).status, 404);
  });

  await t.test("a review rule declines the lead and leaves no document behind", async () => {
    const rules = rulesOf("co1_seo");
    rules.review_rules.push({ when: [{ var: "location_count", op: "gt", value: 100 }], reason: "Franchise-scale — needs a call" });
    assert.equal((await request(app).put("/api/companies/co1_seo/rules").send({ rules })).status, 200);
    const res = await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: { ...facts, location_count: 140 }, lead_text: lead });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.success, false);
    assert.equal(res.body.declined, true);
    assert.equal(res.body.needs_review[0].reason, "Franchise-scale — needs a call");
    assert.ok(!fs.existsSync(docxPath));
  });

  await t.test("regenerating the template clears a generated proposal (hard reset)", async () => {
    setPdfConverter(async () => Buffer.from("%PDF"));
    assert.equal((await request(app).post("/api/companies/co1_seo/proposal/generate").send({ inputs: facts, lead_text: lead })).status, 200);
    assert.ok(fs.existsSync(docxPath));
    assert.equal((await request(app).post("/api/companies/co1_seo/template/generate")).status, 200);
    assert.ok(!fs.existsSync(docxPath) && !fs.existsSync(pdfPath));
    assert.equal((await request(app).post("/api/companies/co1_seo/lead/extract").send({ lead_text: lead })).status, 409);
  });
});
