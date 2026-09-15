import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { Document } from "docxmlater";
import { toMarkdown } from "@firecrawl/anydoc";
import { applyTemplate } from "../services/template-mutator.service.js";
import { buildProposalPayload, evaluate, formatLike, parseSampleNumber, sampleCheck, validate } from "../services/pricing-calculator.js";
import { fromWire, toWire, type PricingRules, type Stage2Context, type Value } from "../services/pricing-rules.types.js";

/**
 * The pure calculator against hand-written ideal rules (fixtures/*.rules.json), whose
 * names are the Stage 2 fixtures' (fixtures/*.variables.json). Ground truth is
 * Mock Data/verification_guide.md — the three worked examples and the §4 checklist.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");
const ids = ["co1_seo", "co2_msp", "co3_dev"] as const;
type Id = (typeof ids)[number];

const rulesOf = (id: Id): PricingRules => JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.rules.json`), "utf8"));
/** .variables.json (the Stage 2 golden fixture) → what the compiler reads from company_variables. */
const stage2Of = (id: Id): Stage2Context => {
  const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.variables.json`), "utf8"));
  return {
    variables: fx.variables.map((v: any) => ({
      variable_name: v.variable_name, category: v.category, sample_value: v.sample_text,
      condition_flag: v.condition_flag, enum_options: v.enum_options, paragraph_mode: v.mode,
    })),
    loop_tables: fx.loop_tables.map((t: any) => ({ loop_tag: t.loop_tag, columns: t.column_tags, row_labels: t.row_labels })),
  };
};
const run = (id: Id, inputs?: Record<string, Value>) => {
  const rules = rulesOf(id);
  return evaluate(rules, inputs ?? rules.sample_inputs);
};

test("co1 benchmark: 2 locations, TX, annual prepay → $35,073.00", () => {
  const { values, present, needs_review } = run("co1_seo");
  assert.equal(values.selected_tier, "Growth");
  assert.equal(values.selected_tier_rate, 3000);
  assert.equal(values.base_investment_amount, 36000);
  assert.equal(values.annual_discount_amount, 3600);
  assert.equal(values.subtotal_amount, 32400);
  assert.equal(values.tax_jurisdiction, "Texas");
  assert.equal(values.tax_amount, 2673);
  assert.equal(values.total_investment_amount, 35073);
  assert.equal(present.annual_discount_amount, true);
  assert.equal(values.has_tax, true);
  assert.deepEqual(needs_review, []);
});

test("co1 §4: cap boundaries, absent discount row, non-TX lead", () => {
  assert.equal(run("co1_seo", { location_count: 3, client_state: "TX", annual_prepay: true }).values.selected_tier, "Growth"); // exactly at cap
  assert.equal(run("co1_seo", { location_count: 15, client_state: "TX", annual_prepay: true }).values.selected_tier, "Authority"); // unbounded cap

  const monthly = run("co1_seo", { location_count: 2, client_state: "TX" });
  assert.equal(monthly.present.annual_discount_amount, false); // row absent, not $0.00
  assert.equal(monthly.values.subtotal_amount, 36000);
  assert.equal(monthly.values.total_investment_amount, 38970);

  const ca = run("co1_seo", { location_count: 2, client_state: "CA", annual_prepay: true });
  assert.equal(ca.values.has_tax, false);
  assert.equal(ca.present.tax_amount, false);
  assert.equal(ca.values.total_investment_amount, 32400);
  assert.deepEqual(ca.needs_review, []); // a guarded lookup miss is not a review
});

test("co2 benchmark: 42 seats, Standard, 5 devices, OH → $2,734.80/mo + $3,150.00 setup", () => {
  const { values, present, needs_review } = run("co2_msp");
  assert.equal(values.base_rate_per_seat, 65);
  assert.equal(values.volume_tier_band, "25–49 seat band");
  assert.equal(values.volume_discount_per_seat, 5);
  assert.equal(values.adjusted_seat_rate, 60);
  assert.equal(values.seat_subtotal, 2520);
  assert.equal(values.extra_device_subtotal, 60);
  assert.equal(values.monthly_recurring_subtotal, 2580);
  assert.equal(values.tax_amount, 154.8);
  assert.equal(values.total_monthly_recurring, 2734.8);
  assert.equal(values.setup_fee_total, 3150);
  assert.equal(present.volume_discount_per_seat, true);
  assert.deepEqual(needs_review, []);
});

test("co2 §4: inclusive band edges, non-stacking bands, seat floor, untaxed setup, missing state", () => {
  const at = (seat_count: number, extra: Record<string, Value> = {}) =>
    run("co2_msp", { seat_count, selected_tier: "Standard", extra_device_count: 0, client_state: "OH", ...extra }).values;
  assert.equal(at(25).volume_discount_per_seat, 5);
  assert.equal(at(50).volume_discount_per_seat, 10);
  assert.equal(at(60).adjusted_seat_rate, 55); // −$10 only, never −$15
  assert.equal(at(24).has_volume_adjustment, false);

  const floor = run("co2_msp", { seat_count: 7, selected_tier: "Essential", client_state: "OH" });
  assert.equal(floor.values.billed_seat_count, 10);
  assert.equal(floor.values.seat_subtotal, 450);
  assert.equal(floor.values.setup_fee_total, 750);
  assert.equal(floor.present.extra_device_subtotal, false);

  // tax is on the recurring subtotal only: 2,580 × 6% = 154.80, not (2,580 + 3,150) × 6%
  assert.equal(run("co2_msp").values.tax_amount, 154.8);

  const noState = run("co2_msp", { seat_count: 42, selected_tier: "Standard" });
  assert.equal(noState.values.has_tax, false);
  assert.equal(noState.present.tax_amount, false);
  assert.match(noState.needs_review.map((r) => r.reason).join(), /Client state/);

  // choice inputs are matched loosely and canonicalised to the table's spelling
  assert.equal(run("co2_msp", { seat_count: 42, selected_tier: " standard ", client_state: "OH" }).values.selected_tier, "Standard");
});

test("co3 benchmark: E-Commerce + Copywriting + SEO → $10,445.00, split $5,222.50 / $5,222.50", () => {
  const { values, present, needs_review } = run("co3_dev");
  assert.equal(values.base_template_fee, 9500);
  assert.equal(values.template_scope_summary, "up to 100 products");
  assert.equal(values.addon_subtotal, 1050);
  assert.equal(values.bundle_discount_amount, 105);
  assert.equal(values.total_project_investment, 10445);
  assert.equal(present.bundle_discount_amount, true);
  assert.equal(values.has_addons, true);
  assert.deepEqual((values.addon_items as any[]).map((r) => r.addon_name), ["Copywriting add-on", "Basic SEO Setup add-on"]);
  assert.equal((values.milestones as any[]).length, 5);
  assert.deepEqual((values.payment_milestones as any[]).map((r) => r.payment_amount), [5222.5, 5222.5]);
  assert.deepEqual(needs_review, []);
});

test("co3 §4: one add-on no bundle, rush excluded from bundle count, cap boundary, scoping reviews", () => {
  const lead = (extra: Record<string, Value>) => run("co3_dev", { product_count: 60, project_template_name: "E-Commerce Build", ...extra });
  const one = lead({ selected_addons: ["Copywriting"] });
  assert.equal(one.values.has_bundle_discount, false);
  assert.equal(one.present.bundle_discount_amount, false);
  assert.equal(one.values.total_project_investment, 10100);

  const rush = lead({ selected_addons: ["Copywriting"], rush_delivery: true });
  assert.equal(rush.values.has_bundle_discount, false);
  assert.equal(rush.values.addon_subtotal, 2500); // 600 + 20% × 9,500

  assert.deepEqual(lead({ product_count: 100 }).needs_review, []);
  assert.match(lead({ product_count: 140 }).needs_review[0].reason, /product cap/);
  assert.match(run("co3_dev", { product_count: 10, project_template_name: "Custom Web App" }).needs_review[0].reason, /scoping call/);
  assert.deepEqual(run("co3_dev", { product_count: 500, project_template_name: "Landing Page" }).needs_review, []); // no cap = unbounded

  // loose choice matching: the sample quotation writes "E-commerce", the table "E-Commerce Build"
  assert.equal(run("co3_dev", { product_count: 1, project_template_name: "e-commerce build" }).values.base_template_fee, 9500);
});

test("split rows absorb the rounding remainder on the last row so they always sum to the total", () => {
  const rules = rulesOf("co3_dev");
  const splits = rules.tables.find((t) => t.id === "payment_splits")!;
  splits.rows = [1, 2, 3].map((n) => ({ milestone_name: `Third ${n}`, trigger_description: "", share: 1 / 3 }));
  rules.variables = rules.variables.map((v) =>
    v.name === "total_project_investment" ? { ...v, kind: "constant", value: 100 } as any : v);
  const { values } = evaluate(rules, rules.sample_inputs);
  assert.deepEqual((values.payment_milestones as any[]).map((r) => r.payment_amount), [33.33, 33.33, 33.34]);
});

test("validate: domain-level errors with paths", () => {
  const errs = (mutate: (r: PricingRules) => void, id: Id = "co1_seo") => {
    const r = rulesOf(id);
    mutate(r);
    return validate(r, stage2Of(id));
  };
  const messages = (e: { path: string; message: string }[]) => e.map((x) => `${x.path}: ${x.message}`).join("\n");
  for (const id of ids) assert.deepEqual(validate(rulesOf(id), stage2Of(id)), [], id);

  // cycle: base needs subtotal, subtotal needs base
  const cyc = errs((r) => { (r.variables.find((v) => v.name === "base_investment_amount") as any).args = ["subtotal_amount", "contract_months"]; });
  assert.match(messages(cyc), /base_investment_amount.*subtotal_amount|subtotal_amount.*base_investment_amount/);
  assert.match(messages(cyc), /cycle|circular/i);

  const unknown = errs((r) => { (r.variables.find((v) => v.name === "total_investment_amount") as any).args = ["subtotal_amount", "tax_amoun"]; });
  assert.equal(unknown[0].path, "variables[16].args[1]");
  assert.match(unknown[0].message, /tax_amoun/);

  assert.match(messages(errs((r) => { (r.variables.find((v) => v.name === "tax_rate") as any).table = "tax"; })), /tax_rate.*table "tax"/);
  assert.match(messages(errs((r) => { (r.variables.find((v) => v.name === "tax_rate") as any).take = "rat"; })), /column "rat"/);

  const undefinedDoc = errs((r) => { r.variables = r.variables.filter((v) => v.name !== "tax_jurisdiction"); });
  assert.match(messages(undefinedDoc), /tax_jurisdiction.*no definition/);
  const undefinedFlag = errs((r) => { r.variables = r.variables.filter((v) => v.name !== "has_annual_discount"); });
  assert.match(messages(undefinedFlag), /has_annual_discount.*condition/);

  assert.match(messages(errs((r) => { (r.variables.find((v) => v.name === "subtotal_amount") as any).args.push(1); })), /sub.*exactly 2/);
  assert.match(messages(errs((r) => { delete (r.variables.find((v) => v.name === "selected_tier") as any).options_table; }, "co2_msp")), /selected_tier.*options/);
  assert.match(messages(errs((r) => { delete (r.variables.find((v) => v.name === "milestones") as any).map.phase_number; }, "co3_dev")), /milestones.*phase_number/);
  assert.match(messages(errs((r) => { (r.variables.find((v) => v.name === "tax_amount") as any).condition_flag = "tax_rate"; })), /condition_flag.*tax_rate.*not a condition/);
  assert.match(messages(errs((r) => { r.variables.push({ ...r.variables[0], name: "location_count" }); })), /duplicate.*location_count/i);
  assert.match(messages(errs((r) => { r.variables.push({ ...r.variables[0], name: "Bad Name" }); })), /identifier/);
  // an aggregate over all rows needs no key column (the model leaves it "" — seen live on every first attempt)
  assert.deepEqual(errs((r) => { (r.variables.find((v) => v.name === "tax_match_count") as any).key_column = ""; }), []);
  assert.match(messages(errs((r) => { (r.variables.find((v) => v.name === "addon_items") as any).key_column = ""; }, "co3_dev")), /addon_items.*key column/);
});

test("formatLike renders a value in the sample's own notation", () => {
  assert.equal(formatLike("$3,000/mo", 3000), "$3,000/mo");
  assert.equal(formatLike("8.25%", 0.0825), "8.25%");
  assert.equal(formatLike("10%", 0.1), "10%");
  assert.equal(formatLike("10%", 0.0825), "8.25%"); // never lose precision to the sample's decimals
  assert.equal(formatLike("$36,000.00", 35073), "$35,073.00");
  assert.equal(formatLike("$36,000.00", 2734.8), "$2,734.80");
  assert.equal(formatLike("42", 42), "42");
  assert.equal(formatLike("12", 3), "3");
  assert.equal(formatLike("Growth", "Authority"), "Authority");
  assert.equal(formatLike("25–49 seat band", "50+ seat band"), "50+ seat band");
  assert.equal(formatLike("Yes", true), "Yes");
  assert.equal(formatLike("$3,000/mo", null), "");
  assert.equal(parseSampleNumber("$36,000.00"), 36000);
  assert.equal(parseSampleNumber("8.25%"), 0.0825);
  assert.equal(parseSampleNumber("42"), 42);
  assert.equal(parseSampleNumber("Growth"), null);
});

for (const id of ids) {
  test(`${id}: every document variable reproduces its sample value`, () => {
    const rules = rulesOf(id);
    const stage2 = stage2Of(id);
    const check = sampleCheck(rules, evaluate(rules, rules.sample_inputs), stage2);
    assert.deepEqual(check.filter((c) => !c.ok), []);
    const docVars = stage2.variables.filter((v) => v.category === "pricing").map((v) => v.variable_name);
    for (const name of docVars) assert.ok(check.some((c) => c.name === name), `${name} has a ledger entry`);
    for (const t of stage2.loop_tables) assert.ok(check.some((c) => c.name === t.loop_tag), `${t.loop_tag} has a ledger entry`);
  });
}

test("sampleCheck reports a mismatch with both values formatted like the quotation", () => {
  const rules = rulesOf("co1_seo");
  (rules.variables.find((v) => v.name === "annual_discount_percentage") as any).value = 0.15;
  const check = sampleCheck(rules, evaluate(rules, rules.sample_inputs), stage2Of("co1_seo"));
  const bad = check.filter((c) => !c.ok).map((c) => `${c.name}: ${c.computed} ≠ ${c.expected}`);
  assert.deepEqual(bad, [
    "annual_discount_percentage: 15% ≠ 10%",
    "annual_discount_amount: $5,400.00 ≠ $3,600.00",
    "subtotal_amount: $30,600.00 ≠ $32,400.00",
    "tax_amount: $2,524.50 ≠ $2,673.00",
    "total_investment_amount: $33,124.50 ≠ $35,073.00",
  ]);
});

const DOCX: Record<Id, string> = {
  co1_seo: "Co1_Proposal_Northstar_BloomAndCo.docx",
  co2_msp: "Co2_Proposal_FortressIT_WhitfieldAssociates.docx",
  co3_dev: "Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx",
};
const mockDocxDir = path.resolve(__dirname, "../../../Mock Data/docx");

for (const id of ids) {
  test(`${id}: proposal payload keys match the tags the template engine actually places`, async () => {
    const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.variables.json`), "utf8"));
    const doc = await Document.loadFromBuffer(fs.readFileSync(path.join(mockDocxDir, DOCX[id])));
    const { tier_matrix } = applyTemplate(doc, fx.variables, fx.loop_tables);
    const out = path.join(os.tmpdir(), `pricing-test-${id}.docx`);
    fs.writeFileSync(out, await doc.toBuffer());
    const markdown = (await toMarkdown(out)).replace(/\\_/g, "_");
    // Never compare against Mock Data/templated_markdown — it has drifted from what the engine emits.
    const tags = new Set([...markdown.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
    const opens = new Set([...markdown.matchAll(/\{#([a-z0-9_]+)\}/g)].map((m) => m[1]));

    const rules = rulesOf(id);
    const stage2 = stage2Of(id);
    const evaluation = evaluate(rules, rules.sample_inputs);
    const payload = buildProposalPayload(rules, evaluation, stage2, tier_matrix);

    const loopTags = new Set(stage2.loop_tables.map((t) => t.loop_tag));
    const flags = new Set([...opens].filter((o) => !loopTags.has(o)));
    const loopColumns = new Set(stage2.loop_tables.flatMap((t) => t.columns));
    const defined = new Set(rules.variables.map((v) => v.name));
    for (const tag of tags) {
      if (loopColumns.has(tag) && !defined.has(tag)) continue; // lives inside a loop row
      if (!defined.has(tag) && !/^tier\d+_/.test(tag)) continue; // customer_input the lead form fills later
      assert.ok(tag in payload && payload[tag] !== "", `{${tag}} is in the template but not in the payload`);
    }
    for (const flag of flags) assert.equal(typeof payload[flag], "boolean", `{#${flag}} needs a boolean`);
    for (const loop of loopTags) {
      assert.ok(opens.has(loop), `{#${loop}} is in the template`);
      const rows = payload[loop] as Record<string, unknown>[];
      assert.ok(Array.isArray(rows) && rows.length > 0, `${loop} rows`);
      for (const col of stage2.loop_tables.find((t) => t.loop_tag === loop)!.columns) assert.ok(col in rows[0], `${loop}.${col}`);
    }
    for (const key of Object.keys(payload)) {
      const inDoc = tags.has(key) || opens.has(key);
      const v = rules.variables.find((x) => x.name === key);
      if (v?.in_document || /^tier\d+_/.test(key)) assert.ok(inDoc, `payload.${key} has no tag in the template`);
    }
    // formatted like the quotation
    if (id === "co1_seo") assert.equal(payload.total_investment_amount, "$35,073.00");
    if (id === "co2_msp") assert.equal(payload.total_monthly_recurring, "$2,734.80");
    if (id === "co3_dev") assert.equal((payload.payment_milestones as any[])[0].payment_amount, "$5,222.50");
  });
}

for (const id of ids) {
  test(`${id}: rules survive the model wire shape (toWire → fromWire) and still validate`, () => {
    const rules = rulesOf(id);
    const back = fromWire(JSON.parse(JSON.stringify(toWire(rules))));
    assert.deepEqual(back, rules);
    assert.deepEqual(validate(back, stage2Of(id)), []);
  });
}

test("fromWire types cells by column unit and is lenient to model spellings", () => {
  const w = toWire(rulesOf("co1_seo"));
  const packages = w.tables[0];
  packages.rows[1].cells = [{ column: "name", text: "Growth" }, { column: "monthly_rate", text: "$3,000" }, { column: "location_cap", text: "" }];
  w.tables[1].rows[0].cells[2].text = "8.25%";
  const pct = w.variables.find((v) => v.name === "annual_discount_percentage")!;
  pct.value = "10%";
  const r = fromWire(w);
  assert.deepEqual(r.tables[0].rows[1], { name: "Growth", monthly_rate: 3000, location_cap: null });
  assert.equal(r.tables[1].rows[0].rate, 0.0825);
  assert.equal((r.variables.find((v) => v.name === "annual_discount_percentage") as any).value, 0.1);
  assert.deepEqual((r.variables.find((v) => v.name === "base_investment_amount") as any).args, ["selected_tier_rate", "contract_months"]);
});
