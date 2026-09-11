import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";

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
