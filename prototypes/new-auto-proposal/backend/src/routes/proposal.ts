import fs from "node:fs";
import path from "node:path";
import { Router, Request, Response } from "express";
import { draftClarification, draftLeadReply } from "../services/clarification-drafter.service.js";
import { extractLeadFacts, fillDefaults, leadFields, missingFields } from "../services/lead-extractor.service.js";
import { loadCompany, loadStage2Context } from "../services/pricing-compiler.service.js";
import type { PricingRulesState } from "../services/pricing-rules.types.js";
import { generateProposal, proposalFilePath } from "../services/proposal-generator.service.js";
import type { MutationLogEntry } from "../services/template-mutator.service.js";
import type { CompanyRow } from "./companies.js";

const router = Router();
const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const MAX_LEAD_CHARS = 12_000;

/** Stage 5 needs a compiled rule set and the stage set by POST /rules/proceed. */
function loadStage5(req: Request, res: Response): { company: CompanyRow; workingState: any; state: PricingRulesState } | null {
  const company = loadCompany(req.params.id);
  if (!company) {
    fail(res, 404, `Company "${req.params.id}" not found`);
    return null;
  }
  let workingState: any = {};
  try { workingState = JSON.parse(company.working_state_json || "{}"); } catch { workingState = {}; }
  const state: PricingRulesState | null = workingState.pricing_rules ?? null;
  if (workingState.stage !== "lead_simulation" || !state) {
    fail(res, 409, "Proceed from the pricing engine first — Stage 5 is not open");
    return null;
  }
  return { company, workingState, state };
}

const leadTextOf = (req: Request, res: Response): string | null => {
  const text = typeof req.body?.lead_text === "string" ? req.body.lead_text.trim() : "";
  if (!text) fail(res, 400, "lead_text is required");
  else if (text.length > MAX_LEAD_CHARS) fail(res, 400, `lead_text is longer than ${MAX_LEAD_CHARS} characters`);
  else return text;
  return null;
};

/** paragraph name → the value tags the template reported as living inside it ("{x} lives inside {para}"). */
function coveredByParagraph(details: MutationLogEntry[] = []): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of details) {
    const owner = d.action === "covered" ? /lives inside \{([a-z0-9_]+)\}/.exec(d.info ?? "")?.[1] : undefined;
    if (owner) (out[owner] ??= []).push(d.target);
  }
  return out;
}

// POST /api/companies/:id/lead/extract — body { lead_text } → { inputs, missing, assumptions }
router.post("/:id/lead/extract", async (req: Request, res: Response): Promise<void> => {
  try {
    const s5 = loadStage5(req, res);
    if (!s5) return;
    const leadText = leadTextOf(req, res);
    if (leadText === null) return;
    const facts = await extractLeadFacts(s5.company, s5.state.rules, loadStage2Context(s5.company.company_id), leadText);
    res.json({ success: true, ...facts });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to extract lead facts");
  }
});

const namesOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// POST /api/companies/:id/lead/clarify — body { lead_text, inputs, missing, assumed? } → { subject, body }
router.post("/:id/lead/clarify", async (req: Request, res: Response): Promise<void> => {
  try {
    const s5 = loadStage5(req, res);
    if (!s5) return;
    const leadText = leadTextOf(req, res);
    if (leadText === null) return;
    const missing = namesOf(req.body?.missing);
    if (!missing.length) return void fail(res, 400, "missing must list at least one field");
    const fields = leadFields(s5.state.rules, loadStage2Context(s5.company.company_id));
    const email = await draftClarification({ company: s5.company, fields, inputs: req.body?.inputs ?? {}, missing, assumed: namesOf(req.body?.assumed), leadText });
    res.json({ success: true, ...email });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to draft the clarification email");
  }
});

// POST /api/companies/:id/lead/reply — body { lead_text: the thread, ending with our ask } → { subject, body }
// The simulator playing the lead; the caller appends it to the thread and re-extracts.
router.post("/:id/lead/reply", async (req: Request, res: Response): Promise<void> => {
  try {
    const s5 = loadStage5(req, res);
    if (!s5) return;
    const leadText = leadTextOf(req, res);
    if (leadText === null) return;
    res.json({ success: true, ...(await draftLeadReply(s5.company, leadText)) });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to draft the lead's reply");
  }
});

// POST /api/companies/:id/proposal/generate — body { inputs, lead_text, assumed? }; facts in, documents out (never re-extracts)
router.post("/:id/proposal/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const s5 = loadStage5(req, res);
    if (!s5) return;
    const { company, workingState, state } = s5;
    const inputs = req.body?.inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) return void fail(res, 400, "Body must be { inputs, lead_text }");
    const stage2 = loadStage2Context(company.company_id);
    const fields = leadFields(state.rules, stage2);
    // Defaults are applied here too (server-side truth); the client's assumed[] names what extract already filled.
    const assumable = new Set(fields.filter((f) => f.default !== undefined).map((f) => f.name));
    const assumed = [...new Set([...namesOf(req.body?.assumed).filter((n) => assumable.has(n)), ...fillDefaults(fields, inputs)])];
    const missing = missingFields(fields, inputs);
    if (missing.length) {
      res.status(400).json({ success: false, error: `Missing required facts: ${missing.join(", ")}`, missing });
      return;
    }

    const result = await generateProposal({
      company, rules: state.rules, stage2, inputs, assumed,
      tierMatrix: workingState.template_stats?.tier_matrix,
      coveredBy: coveredByParagraph(workingState.template_stats?.details),
      leadText: typeof req.body?.lead_text === "string" ? req.body.lead_text : "",
    });
    if (result.declined) {
      res.json({ success: false, declined: true, needs_review: result.needs_review, evaluation: result.evaluation });
      return;
    }
    // The client's name for the filename: whatever Stage 2 called it, it is the first free-text fact.
    const nameField = fields.find((f) => f.input_type === "text");
    const client = encodeURIComponent(String((nameField && inputs[nameField.name]) || company.company_name));
    const download = (ext: string) => `/api/companies/${company.company_id}/proposal/download?format=${ext}&client=${client}`;
    res.json({
      success: true,
      evaluation: result.evaluation,
      payload: result.payload,
      narrative: result.narrative,
      files: { docx: download("docx"), pdf: result.pdf ? download("pdf") : null },
      ...(result.pdf_error ? { pdf_error: result.pdf_error } : {}),
    });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to generate the proposal");
  }
});

// GET /api/companies/:id/proposal/download?format=docx|pdf[&client=…][&download=1]
// The PDF is served inline by default so the Stage 5 <iframe> renders it; the download buttons ask for
// `download=1` and get the attachment. A .docx has nothing to preview, so it is always an attachment.
router.get("/:id/proposal/download", (req: Request, res: Response): void => {
  const format = req.query.format === "pdf" ? "pdf" : req.query.format === "docx" ? "docx" : null;
  if (!format) return void fail(res, 400, "format must be docx or pdf");
  const file = path.resolve(proposalFilePath(req.params.id, format));
  if (!fs.existsSync(file)) return void fail(res, 404, `No proposal.${format} has been generated for this company yet`);
  // ponytail: nothing is persisted, so the client name rides on the URL the generate call handed out.
  const client = String(req.query.client ?? "").replace(/[^\w &'.,-]/g, "").trim() || req.params.id;
  const filename = `Proposal - ${client}.${format}`;
  if (format === "docx" || req.query.download === "1") return void res.download(file, filename);
  res.sendFile(file, { headers: { "Content-Disposition": `inline; filename="${filename}"` } });
});

export default router;
