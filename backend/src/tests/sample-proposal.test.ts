import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { toMarkdown } from "@firecrawl/anydoc";
import { createApp } from "../app.js";
import { initDatabase, closeDatabase } from "../db/database.js";
import {
  buildSampleDocument,
  setSampleProposalModelCall,
  priceSampleOutput,
} from "../services/sample-proposal.service.js";
import { findSeed } from "../db/seed.js";
import { setSampleSectionModelCall } from "../services/sample-sections.service.js";

const draft = {
  title: "Search growth proposal",
  overview: "Reach nearby business buyers.",
  scope: "Local search optimisation.",
  terms: "Delivery follows the agreed project schedule.",
  items: ["Search support", "Setup"],
};
const sample = {
  draft,
  customer: "Example Customer",
  currency: "USD",
  confirmed: true,
  lines: [
    { quantity: 3, rate: 19.99, discount: 10, tax: 8.25, period: "monthly" },
    { quantity: 1, rate: 100, discount: 0, tax: 0, period: "one-time" },
  ],
};

const brief =
  "Current pricing instructions: USD 19.99 per unit monthly, 10% discount, 8.25% tax. Setup USD 100 one-time, no tax (0%).";
const literal = (
  id: string,
  value: number,
  source = brief,
  kind = "brief",
) => ({ id, op: "literal", value, args: [] as string[], source, kind });
const formula = (id: string, op: string, ...args: string[]) => ({
  id,
  op,
  args,
  value: 0,
  source: "",
  kind: "formula",
});
const output = {
  ...draft,
  customer: sample.customer,
  currency: "USD",
  scenario: "A fictional local business buying three units and initial setup.",
  questions: [] as string[],
  calculations: [
    literal("quantity", 3, "Fictional customer units", "scenario"),
    literal("rate", 19.99),
    literal("discount", 10),
    literal("tax", 8.25),
    literal("setup", 100),
  ],
  lines: [
    {
      quantity: "quantity",
      rate: "rate",
      discount: "discount",
      tax: "tax",
      period: "monthly",
      source: brief,
    },
    {
      quantity: "one",
      rate: "setup",
      discount: "zero",
      tax: "zero",
      period: "one-time",
      source: brief,
    },
  ],
};

const uncertainBrief = brief.replace("8.25% tax", "tax rate unknown");
const estimatedOutput = { ...output, questions: ["Tax rate is unspecified; zero tax is assumed for this illustrative sample."],
  calculations: output.calculations.map(step => step.id === "tax"
    ? literal("tax", 0, "Tax rate is unspecified; zero tax is assumed for this illustrative sample.", "assumption")
    : step.kind === "brief" ? { ...step, source: uncertainBrief } : step),
  lines: output.lines.map(line => ({ ...line, source: uncertainBrief })),
};

test("generated sample uses reviewed prices with cent rounding and separate billing totals, then enters the normal persisted workflow", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sample-proposal-"));
  process.env.DB_PATH = path.join(dir, "db.sqlite");
  process.env.STORAGE_DIR = path.join(dir, "storage");
  initDatabase();
  const app = createApp();
  let prompt = "";
  setSampleProposalModelCall(async (value) => {
    prompt = value;
    return output;
  });
  try {
    const created = await request(app)
      .post("/api/companies/co1_seo/templates")
      .send({
        name: "Local search",
        description: "For nearby business buyers",
        pricing_spec: "Old brief",
      });
    assert.equal(created.status, 201, created.text);
    const id = created.body.company.template_id;
    const base = `/api/companies/co1_seo/templates/${id}`;
    let sectionPrompt = "";
    setSampleSectionModelCall(async (value) => {
      sectionPrompt = value;
      return {
        content:
          "Additional content support can be discussed as an optional upgrade outside this quotation.",
      };
    });
    const sectionRequest = {
      pricing_spec: brief,
      scenario: output.scenario,
      scope: draft.scope,
      sections: [],
      section: {
        title: "Room to grow",
        position: "before_terms",
        instructions: "Suggest relevant upgrades without adding to the quote",
      },
    };
    const sectionResponse = await request(app)
      .post(`${base}/briefing/sample-section`)
      .send(sectionRequest);
    assert.equal(sectionResponse.status, 200, sectionResponse.text);
    for (const fact of [
      brief,
      output.scenario,
      draft.scope,
      "Local search",
      "ideal_customer",
      sectionRequest.section.instructions,
    ])
      assert.ok(sectionPrompt.includes(fact));
    const sections = [
      sectionResponse.body.section,
      {
        title: "Working together",
        content: "We agree the next steps together.",
        position: "before_scope",
      },
      {
        title: "Future review",
        content: "We can revisit the agreed scope later.",
        position: "before_terms",
      },
    ];
    assert.equal(
      (
        await request(app)
          .post(
            `/api/companies/co2_msp/templates/${id}/briefing/sample-section`,
          )
          .send(sectionRequest)
      ).status,
      404,
    );
    assert.equal(
      (
        await request(app)
          .post(`${base}/briefing/sample-section`)
          .send({
            ...sectionRequest,
            section: { ...sectionRequest.section, title: "" },
          })
      ).status,
      400,
    );
    setSampleSectionModelCall(async () => ({ content: "" }));
    assert.equal(
      (
        await request(app)
          .post(`${base}/briefing/sample-section`)
          .send(sectionRequest)
      ).status,
      502,
    );
    const drafted = await request(app)
      .post(`${base}/briefing/sample-draft`)
      .send({ pricing_spec: brief, sections });
    assert.equal(drafted.status, 200, drafted.text);
    assert.deepEqual(drafted.body.draft, draft);
    assert.deepEqual(drafted.body.lines, sample.lines);
    assert.deepEqual(drafted.body.totals, [
      { period: "one-time", amount: "USD 100.00" },
      { period: "monthly", amount: "USD 58.42" },
    ]);
    const automaticFile = path.join(dir, "automatic.docx");
    fs.writeFileSync(
      automaticFile,
      Buffer.from(drafted.body.document_base64, "base64"),
    );
    const automaticMarkdown = await toMarkdown(automaticFile);
    assert.match(automaticMarkdown, /optional upgrade outside this quotation/);
    assert.ok(
      automaticMarkdown.indexOf("Working together") <
        automaticMarkdown.indexOf("Scope of services"),
    );
    assert.ok(
      automaticMarkdown.indexOf("Room to grow") <
        automaticMarkdown.indexOf("Future review"),
    );
    assert.ok(
      automaticMarkdown.indexOf("Future review") <
        automaticMarkdown.indexOf("Terms and next steps"),
    );
    assert.match(automaticMarkdown, /USD 58\.42/);
    assert.ok(automaticMarkdown.includes(output.scenario));
    assert.ok(prompt.includes("Current pricing instructions"));
    assert.ok(prompt.includes("For nearby business buyers"));
    assert.ok(prompt.includes(created.body.company.company_name));
    assert.ok(prompt.includes("ideal_customer"));
    assert.ok(!prompt.includes("Old brief"));
    const built = await request(app)
      .post(`${base}/briefing/sample-document`)
      .send(sample)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    assert.equal(built.status, 200);
    // LibreOffice rejects the old streamed ZIP even though AnyDoc reads it.
    assert.equal(built.body.readUInt32LE(0), 0x04034b50);
    assert.equal(
      built.body.readUInt16LE(6) & 0x08,
      0,
      "ZIP entry sizes must be written in the local header",
    );
    assert.ok(
      built.body.readUInt32LE(18) > 0,
      "The first document part must have a known compressed size",
    );
    const preview = path.join(dir, "preview.docx");
    fs.writeFileSync(preview, built.body);
    const markdown = await toMarkdown(preview);
    assert.match(markdown, /Example Customer/);
    assert.match(markdown, /Total \(monthly\).*USD 58\.42/);
    assert.match(markdown, /Total \(one-time\).*USD 100\.00/);
    assert.match(markdown, /USD 4\.45/);
    const before = await request(app).get(base);
    assert.equal(before.body.company.document_metadata, null);
    assert.equal(before.body.company.briefing_locked, false);
    const submitted = await request(app)
      .post(`${base}/briefing/submit`)
      .field("prompt", brief)
      .attach("file", automaticFile, "generated_sample_proposal.docx");
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.body.company.briefing_locked, true);
    assert.equal(
      (
        await request(app)
          .post(`${base}/briefing/sample-section`)
          .send(sectionRequest)
      ).status,
      409,
    );
    assert.match(submitted.body.markdown, /USD 58\.42/);
    assert.equal(
      (
        await request(app)
          .post(`${base}/briefing/sample-draft`)
          .send({ pricing_spec: "New" })
      ).status,
      409,
    );
    assert.equal(
      (await request(app).post(`${base}/briefing/sample-document`).send(sample))
        .status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .post(
            `/api/companies/co2_msp/templates/${id}/briefing/sample-document`,
          )
          .send(sample)
      ).status,
      404,
    );
    closeDatabase();
    initDatabase();
    const restored = await request(app).get(base);
    assert.match(
      restored.body.company.document_metadata.extracted_markdown,
      /Example Customer/,
    );
    assert.equal(
      restored.body.company.document_metadata.filename,
      "generated_sample_proposal.docx",
    );
    assert.match(
      restored.body.company.document_metadata.extracted_markdown,
      /Room to grow/,
    );
    await request(app).post(`${base}/briefing/unlock`);
    let attempts = 0;
    setSampleProposalModelCall(async () => ++attempts === 1 ? { ...estimatedOutput, lines: [] } : estimatedOutput);
    const blocked = await request(app)
      .post(`${base}/briefing/sample-draft`)
      .send({ pricing_spec: uncertainBrief });
    assert.equal(blocked.status, 200, blocked.text);
    assert.ok(blocked.body.document_base64);
    assert.equal(attempts, 2);
    assert.ok(blocked.body.questions.includes(estimatedOutput.questions[0]));
    assert.deepEqual(blocked.body.totals, [
      { period: "one-time", amount: "USD 100.00" },
      { period: "monthly", amount: "USD 53.97" },
    ]);
    const incompleteFile = path.join(dir, "incomplete.docx");
    fs.writeFileSync(
      incompleteFile,
      Buffer.from(blocked.body.document_base64, "base64"),
    );
    const incompleteMarkdown = await toMarkdown(incompleteFile);
    assert.doesNotMatch(
      incompleteMarkdown,
      /Draft sample|information to confirm|pricing brief does not resolve/,
    );
    assert.doesNotMatch(incompleteMarkdown, /Which tax rate should apply/);
    assert.doesNotMatch(incompleteMarkdown, /To confirm|TBD|zero tax is assumed/i);
    assert.match(incompleteMarkdown, /USD 53\.97/);
    const savedIncomplete = await request(app)
      .post(`${base}/briefing/submit`)
      .field("prompt", uncertainBrief)
      .field("sample_review_notes", JSON.stringify(blocked.body.questions))
      .attach("file", incompleteFile, "generated_sample_proposal.docx");
    assert.equal(savedIncomplete.status, 200, savedIncomplete.text);
    closeDatabase();
    initDatabase();
    assert.doesNotMatch(
      (await request(app).get(base)).body.company.document_metadata
        .extracted_markdown,
      /Which tax rate should apply/,
    );
    assert.ok(
      (
        await request(app).get(base)
      ).body.company.working_state.sample_review_notes.includes(
        estimatedOutput.questions[0],
      ),
    );
    const unlocked = await request(app).post(`${base}/briefing/unlock`);
    assert.ok(
      unlocked.body.company.working_state.sample_review_notes.includes(
        estimatedOutput.questions[0],
      ),
    );
    setSampleProposalModelCall(async () => ({ items: [] }));
    assert.equal(
      (
        await request(app)
          .post(`${base}/briefing/sample-draft`)
          .send({ pricing_spec: "New" })
      ).status,
      502,
    );
    assert.equal(
      (await request(app).get(base)).body.company.document_metadata.filename,
      "generated_sample_proposal.docx",
    );
  } finally {
    setSampleProposalModelCall(null);
    setSampleSectionModelCall(null);
    closeDatabase();
  }
});

test("sample plans reproduce annual prepayment, MSP per-seat discounts and untaxed setup, and bundled project add-ons", () => {
  const seo = findSeed("co1_seo")!.pricing_spec!;
  const seoOutput = {
    ...output,
    items: ["Growth SEO annual prepayment"],
    calculations: [
      literal("monthly", 3000, seo),
      literal("discount", 10, seo),
      literal("tax", 8.25, seo),
      formula("annual", "mul", "monthly", "months_per_year"),
    ],
    lines: [
      {
        quantity: "one",
        rate: "annual",
        discount: "discount",
        tax: "tax",
        period: "annual",
        source: seo,
      },
    ],
  };
  assert.deepEqual(priceSampleOutput(seoOutput, seo).totals, [
    { period: "annual", amount: "USD 35073.00" },
  ]);
  const msp = findSeed("co2_msp")!.pricing_spec!;
  const mspOutput = {
    ...output,
    items: ["Standard support", "Extra servers", "Onboarding"],
    calculations: [
      literal("seats", 42, "Sample seats", "scenario"),
      literal("devices", 5, "Sample servers", "scenario"),
      literal("base", 65, msp),
      literal("reduction", 5, msp),
      literal("device_rate", 12, msp),
      literal("onboarding", 75, msp),
      literal("tax", 6, msp),
      formula("net_rate", "sub", "base", "reduction"),
    ],
    lines: [
      {
        quantity: "seats",
        rate: "net_rate",
        discount: "zero",
        tax: "tax",
        period: "monthly",
        source: msp,
      },
      {
        quantity: "devices",
        rate: "device_rate",
        discount: "zero",
        tax: "tax",
        period: "monthly",
        source: msp,
      },
      {
        quantity: "seats",
        rate: "onboarding",
        discount: "zero",
        tax: "zero",
        period: "one-time",
        source: msp,
      },
    ],
  };
  assert.deepEqual(priceSampleOutput(mspOutput, msp).totals, [
    { period: "one-time", amount: "USD 3150.00" },
    { period: "monthly", amount: "USD 2734.80" },
  ]);
  const dev =
    findSeed("co3_dev")!.pricing_spec +
    " Accounting confirms: no sales tax (0%).";
  const devOutput = {
    ...output,
    items: ["E-commerce", "Copywriting", "Basic SEO"],
    calculations: [
      literal("base", 9500, dev),
      literal("copy", 600, dev),
      literal("seo", 450, dev),
      literal("discount", 10, dev),
    ],
    lines: ["base", "copy", "seo"].map((rate) => ({
      quantity: "one",
      rate,
      discount: rate === "base" ? "zero" : "discount",
      tax: "zero",
      period: "one-time",
      source: dev,
    })),
  };
  assert.deepEqual(priceSampleOutput(devOutput, dev).totals, [
    { period: "one-time", amount: "USD 10445.00" },
  ]);
});

test("automatic sample pricing rejects invented rates, fictional prices, fabricated evidence and unsafe calculation graphs", () => {
  for (const bad of [
    {
      ...output,
      calculations: [
        literal("rate", 60),
        ...output.calculations.filter((step) => step.id !== "rate"),
      ],
    },
    {
      ...output,
      calculations: output.calculations.map((step) =>
        step.id === "rate"
          ? literal("rate", 60, "Customer price", "scenario")
          : step,
      ),
    },
    {
      ...output,
      calculations: output.calculations.map((step) =>
        step.id === "rate"
          ? literal("rate", 19.99, "Made-up rate 19.99")
          : step,
      ),
    },
    {
      ...output,
      calculations: [
        ...output.calculations,
        formula("broken", "div", "rate", "zero"),
      ],
    },
    {
      ...output,
      calculations: [...output.calculations, formula("cycle", "add", "cycle")],
    },
    {
      ...output,
      calculations: [...output.calculations, formula("code", "eval", "rate")],
    },
    {
      ...output,
      lines: output.lines.map((line) => ({ ...line, tax: "quantity" })),
    },
  ])
    assert.throws(() => priceSampleOutput(bad, brief));
});

test("sample documents reject missing confirmation, incomplete prices, unsupported billing and template tags", async () => {
  for (const invalid of [
    null,
    { ...sample, confirmed: false },
    { ...sample, lines: [] },
    { ...sample, draft: { ...draft, title: "{injected_tag}" } },
    ...[undefined, null, -1, 1.234, Infinity, "20"].map((rate) => ({
      ...sample,
      lines: [{ ...sample.lines[0], rate }, sample.lines[1]],
    })),
    {
      ...sample,
      lines: [{ ...sample.lines[0], period: "weekly" }, sample.lines[1]],
    },
  ])
    await assert.rejects(buildSampleDocument("Seller", invalid));
});

test("sample assumptions produce full totals, preserve known rates and remain only in UI review notes", async () => {
  const partial = priceSampleOutput({ ...estimatedOutput, questions: [] }, uncertainBrief);
  assert.equal(partial.lines[0].rate, 19.99);
  assert.equal(partial.lines[0].tax, 0);
  assert.ok(partial.questions.some(note => note.includes("Sample estimate for tax: 0")));
  assert.deepEqual(partial.totals, [
    { period: "one-time", amount: "USD 100.00" },
    { period: "monthly", amount: "USD 53.97" },
  ]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "partial-sample-"));
  const file = path.join(dir, "sample.docx");
  fs.writeFileSync(
    file,
    await buildSampleDocument("Seller", { ...partial, confirmed: true }),
  );
  const markdown = await toMarkdown(file);
  assert.doesNotMatch(
    markdown,
    /Monthly tax rate is missing|information to confirm/,
  );
  assert.match(markdown, /USD 19\.99/);
  assert.match(markdown, /Total \(monthly\): USD 53\.97/);
  assert.match(markdown, /Total \(one-time\): USD 100\.00/);
  assert.doesNotMatch(markdown, /USD 58\.42/);
  assert.doesNotMatch(markdown, /To confirm|TBD|Sample estimate|zero tax is assumed/i);
  assert.throws(() => priceSampleOutput(
    { ...output, currency: "", questions: [] },
    brief,
  ));
  assert.throws(() => priceSampleOutput({ ...output, lines: output.lines.map(line => ({ ...line, tax: "" })) }, brief));
  assert.throws(() => priceSampleOutput({ ...output, terms: "To confirm" }, brief));
  const estimatedRate = priceSampleOutput({ ...estimatedOutput,
    calculations: estimatedOutput.calculations.map(step => step.id === "rate" ? literal("rate", 25, "No applicable service rate: illustrative unit price estimated at 25.", "assumption") : step),
  }, uncertainBrief);
  assert.equal(estimatedRate.lines[0].rate, 25);
  assert.ok(estimatedRate.questions.some(note => note.includes("Sample estimate for rate: 25")));
});
