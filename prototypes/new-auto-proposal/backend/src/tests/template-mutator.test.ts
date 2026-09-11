import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document } from "docxmlater";
import { toMarkdown } from "@firecrawl/anydoc";
import { initDatabase, closeDatabase, getDatabase } from "../db/database.js";
import {
  applyTemplate,
  buildTierMatrixPayload,
  hydrateProposalTemplate,
  mutateDocumentTemplate,
} from "../services/template-mutator.service.js";

/**
 * Golden test: a hand-written "ideal Gemini response" (fixtures/*.variables.json)
 * is pushed through the engine for each mock quotation, and the resulting
 * template.docx is checked for the exact tag layout the expected templates in
 * Mock Data/templated_markdown describe — especially the overlap/duplicate cases
 * that broke the previous engine.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockDocxDir = path.resolve(__dirname, "../../../Mock Data/docx");
const fixturesDir = path.join(__dirname, "fixtures");

const COMPANIES = {
  co1_seo: "Co1_Proposal_Northstar_BloomAndCo.docx",
  co2_msp: "Co2_Proposal_FortressIT_WhitfieldAssociates.docx",
  co3_dev: "Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx",
} as const;

async function renderFixture(id: keyof typeof COMPANIES) {
  const fx = JSON.parse(fs.readFileSync(path.join(fixturesDir, `${id}.variables.json`), "utf8"));
  const doc = await Document.loadFromBuffer(fs.readFileSync(path.join(mockDocxDir, COMPANIES[id])));
  const { details, tier_matrix } = applyTemplate(doc, fx.variables, fx.loop_tables);
  const buffer = await doc.toBuffer();
  const out = path.join(os.tmpdir(), `mutator-test-${id}.docx`);
  fs.writeFileSync(out, buffer);
  // anydoc escapes "_" inside bold runs; strip that so assertions read like the template.
  const markdown = (await toMarkdown(out)).replace(/\\_/g, "_");
  return { fx, details, tier_matrix, buffer, markdown };
}

for (const id of Object.keys(COMPANIES) as Array<keyof typeof COMPANIES>) {
  test(`${id}: every fixture variable and loop is applied`, async () => {
    const { details } = await renderFixture(id);
    const missed = details.filter((d) => !d.applied).map((d) => `${d.target}: ${d.info}`);
    assert.deepEqual(missed, []);
  });
}

test("co1: overlapping samples are placed longest-first and the tier name is replaced everywhere", async () => {
  const { markdown } = await renderFixture("co1_seo");
  assert.match(markdown, /\{selected_tier\} Package — \{contract_months\} months × \{selected_tier_rate\} \| \{base_investment_amount\}/);
  assert.match(markdown, /\| \*\*\{tier1_name\}\*\* \| \*\*\{tier2_name\}\s+— Recommended\*\* \| \*\*\{tier3_name\}\*\* \|/); // matrix header keeps its suffix
  assert.match(markdown, /\| \{tier1_r1\} \| \*\*\{tier2_r1\}\*\* \| \{tier3_r1\} \|/); // matrix cell keeps bold
  assert.doesNotMatch(markdown, /Up to 3 locations|\$8,000\/mo/); // every matrix cell is a tag
  assert.match(markdown, /Included vs\. Not Included — \{selected_tier\} Tier/);
  assert.match(markdown, /\{#has_annual_discount\}Annual prepay discount \(\{annual_discount_percentage\}\) \| −\{annual_discount_amount\}\{\/has_annual_discount\}/);
  assert.match(markdown, /\{#has_tax\}\{tax_jurisdiction\} sales tax \(\{tax_rate\}\) \| \{tax_amount\}\{\/has_tax\}/);
  assert.doesNotMatch(markdown, /Included: Google Business Profile/); // whole bullet list collapsed
  assert.match(markdown, /\*\*Included vs\. Not Included — \{selected_tier\} Tier\*\*\n\n\{scope_inclusions_narrative\}\n\n\*\*Your Investment\*\*/);
});

test("co2: identical text with different meaning is disambiguated by context_text", async () => {
  const { markdown } = await renderFixture("co2_msp");
  assert.match(markdown, /\{selected_tier\} tier base rate \| \{base_rate_per_seat\} \/ seat \/ mo/);
  assert.match(markdown, /\*\*Adjusted rate\*\* \| \*\*\{adjusted_seat_rate\} \/ seat \/ mo\*\*/);
  assert.match(markdown, /Seat subtotal \(\{seat_count\} seats × \{adjusted_seat_rate\}\)/);
  assert.match(markdown, /\{#has_extra_devices\}Managed devices beyond 1:1 \(\{extra_device_count\} servers × \{extra_device_rate\}\) \| \{extra_device_subtotal\}\{\/has_extra_devices\}/);
  assert.match(markdown, /within 5 business days/); // "5" outside the context row is untouched
  assert.match(markdown, /\{#has_volume_adjustment\}Volume adjustment \(\{volume_tier_band\}\) \| −\{volume_discount_per_seat\} \/ seat \/ mo\{\/has_volume_adjustment\}/);
  assert.match(markdown, /\*\{minimum_commitment_note\}\*/); // uniformly italic paragraph keeps italics
  assert.match(markdown, /\{scope_inclusions_narrative\}\n\n\*\*05/);
});

test("co3: loop tables collapse to one tagged row and keep fixed rows", async () => {
  const { markdown, buffer } = await renderFixture("co3_dev");
  assert.match(markdown, /\| \{#milestones\}\{phase_number\} \| \{milestone_title\} \| \{deliverable_summary\}\{\/milestones\} \|/);
  assert.match(markdown, /\{project_template_name\} \(base template, \{template_scope_summary\}\) \| \{base_template_fee\} \|\n\| \{#addon_items\}\{addon_name\} \| \{addon_fee\}\{\/addon_items\} \|\n\| \{#has_addons\}Add-on subtotal/);
  assert.match(markdown, /\| \{#payment_milestones\}\{milestone_name\} \| \{trigger_description\} \| \{payment_amount\}\{\/payment_milestones\} \|/);
  assert.doesNotMatch(markdown, /\| Discovery \||Copywriting add-on|Deposit \(50%\)/); // sample rows pruned
  assert.match(markdown, /\{addon_menu_narrative\}\n\n\*\*Your Investment\*\*/); // ✓/○ menu + note collapsed

  // The tags we place must be valid easy-template-x syntax: loops expand, false conditions drop the row.
  const hydrated = await Document.loadFromBuffer(
    await hydrateProposalTemplate(buffer, {
      client_name: "Acme",
      milestones: [
        { phase_number: 1, milestone_title: "Kickoff", deliverable_summary: "Plan" },
        { phase_number: 2, milestone_title: "Launch", deliverable_summary: "Live" },
      ],
      addon_items: [{ addon_name: "Copywriting", addon_fee: "$600.00" }],
      has_addons: true,
      has_bundle_discount: false,
      payment_milestones: [{ milestone_name: "Deposit", trigger_description: "Signing", payment_amount: "$1" }],
    })
  );
  const tables = hydrated.getTables();
  assert.equal(tables[1].getRowCount(), 3); // header + 2 milestones
  const investmentRows = tables[2].getRows().map((r) => r.getCell(0)?.getText().trim());
  assert.deepEqual(investmentRows, ["Line Item", "(base template, )", "Copywriting", "Add-on subtotal", "Total Project Investment"]);
});

test("tier matrix: the selected tier rotates into the highlighted column, others keep their order", async () => {
  const { tier_matrix, buffer } = await renderFixture("co1_seo");
  assert.deepEqual(tier_matrix, {
    selector: "selected_tier",
    recommended_index: 1,
    tiers: [
      { name: "Local", cells: ["$1,000/mo", "1 location", "1 blog post/mo", "—"] },
      { name: "Growth", cells: ["$3,000/mo", "Up to 3 locations", "4 content pieces/mo", "Citation building"] },
      { name: "Authority", cells: ["$8,000/mo", "Unlimited locations", "Weekly content", "Dedicated strategist"] },
    ],
  });
  const matrixRow = async (selected: string, row: number) => {
    const doc = await Document.loadFromBuffer(await hydrateProposalTemplate(buffer, buildTierMatrixPayload(tier_matrix!, selected)));
    return doc.getTables()[1].getRow(row)!.getCells().map((c) => c.getText().trim());
  };
  assert.deepEqual(await matrixRow("Local", 0), ["Growth", "Local  — Recommended", "Authority"]);
  assert.deepEqual(await matrixRow("Local", 1), ["$3,000/mo", "$1,000/mo", "$8,000/mo"]);
  assert.deepEqual(await matrixRow("Authority", 0), ["Local", "Authority  — Recommended", "Growth"]);
  assert.deepEqual(await matrixRow("Authority", 2), ["1 location", "Unlimited locations", "Up to 3 locations"]);
  assert.deepEqual(await matrixRow("Growth", 0), ["Local", "Growth  — Recommended", "Authority"]); // sample order unchanged

  const co3 = await renderFixture("co3_dev");
  assert.equal(co3.tier_matrix, undefined); // no comparison table in the dev-shop quotation
});

test("a sample the model normalised is reported as missed, never silently dropped", async () => {
  const doc = await Document.loadFromBuffer(fs.readFileSync(path.join(mockDocxDir, COMPANIES.co1_seo)));
  const { details } = applyTemplate(
    doc,
    [
      { variable_name: "selected_tier_rate", category: "pricing", sample_text: "$3,000.00" }, // document says "$3,000/mo"
      { variable_name: "contract_months", category: "customer_input", sample_text: "12", context_text: "Growth Package" },
    ],
    [{ loop_tag: "ghost", header_texts: ["No", "Such", "Table"], column_tags: ["a", "b", "c"], row_labels: [] }]
  );
  assert.deepEqual(
    details.map((d) => [d.target, d.applied]),
    [["selected_tier_rate", false], ["contract_months", true], ["ghost", false]]
  );
  assert.match(details[0].info!, /"\$3,000\.00" not found in document/);
  assert.match(details[2].info!, /no table with header/);
  assert.match(doc.getAllParagraphs().map((p) => p.getText()).join("\n"), /\$3,000\/mo/); // untouched, not half-replaced
});

test("a paragraph with a condition_flag is wrapped and disappears when the flag is false", async () => {
  const doc = await Document.loadFromBuffer(fs.readFileSync(path.join(mockDocxDir, COMPANIES.co1_seo)));
  const { details: [d] } = applyTemplate(
    doc,
    [{ variable_name: "payment_note", category: "paragraph", condition_flag: "has_annual_discount", sample_text: "You mentioned you'd rather pay annually than track a monthly invoice — that qualifies for our annual prepay discount, applied below." }],
    []
  );
  assert.equal(d.applied, true);
  assert.match(d.info!, /wrapped in \{#has_annual_discount\}/);
  const text = (p: Document) => p.getAllParagraphs().map((x) => x.getText()).join("\n");
  assert.match(text(doc), /\{#has_annual_discount\}\{payment_note\}\{\/has_annual_discount\}/);

  const shown = await Document.loadFromBuffer(await hydrateProposalTemplate(await doc.toBuffer(), { has_annual_discount: true, payment_note: "Pay yearly." }));
  assert.match(text(shown), /Pay yearly\./);
  const hidden = await Document.loadFromBuffer(await hydrateProposalTemplate(await doc.toBuffer(), { has_annual_discount: false, payment_note: "Pay yearly." }));
  assert.doesNotMatch(text(hidden), /Pay yearly\.|has_annual_discount/);
});

test("mutateDocumentTemplate reads descriptors from SQLite and writes template.docx", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutator-db-"));
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase(path.join(dir, "test.sqlite"));
  const cwd = process.cwd();
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO company_variables (id, company_id, variable_name, natural_name, category, data_type, is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at)
       VALUES (?, 'co3_dev', ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)`
    );
    insert.run("v1", "client_name", "Client", "customer_input", "string", 0, JSON.stringify({ sample_value: "Rosewood Home Goods" }), now, now);
    insert.run("v2", "bundle_discount_amount", "Discount", "pricing", "currency", 0, JSON.stringify({ sample_value: "$105.00", visibility_rule: { condition_flag: "has_bundle_discount" } }), now, now);
    insert.run("v3", "ignored", "Deleted", "pricing", "currency", 1, JSON.stringify({ sample_value: "$9,500.00" }), now, now);
    insert.run("t1", "milestones", "Milestones", "table_loop", "table", 0, JSON.stringify({ loop_tag: "milestones", header_texts: ["Phase", "Milestone", "Deliverable"], columns: ["phase_number", "milestone_title", "deliverable_summary"], row_labels: ["1", "2", "3", "4", "5"] }), now, now);

    process.chdir(path.resolve(__dirname, "../..")); // so the Mock Data fallback resolves
    const result = await mutateDocumentTemplate("co3_dev");
    assert.equal(result.tags_placed_count, 1);
    assert.equal(result.conditional_rows_wrapped_count, 1);
    assert.equal(result.loops_collapsed_count, 1);
    const xml = await Document.loadFromBuffer(fs.readFileSync(path.join(process.env.STORAGE_DIR, "co3_dev", "template.docx")));
    const text = xml.getAllParagraphs().map((p) => p.getText()).join("\n");
    assert.match(text, /\{client_name\}/);
    assert.match(text, /\{#has_bundle_discount\}/);
    assert.match(text, /\{#milestones\}/);
    assert.doesNotMatch(text, /\{ignored\}/);
  } finally {
    process.chdir(cwd);
    closeDatabase();
  }
});
