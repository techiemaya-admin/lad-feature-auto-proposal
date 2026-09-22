import { Router, Request, Response } from "express";
import { getDatabase } from "../db/database.js";
import { buildProposalPayload, evaluate } from "../services/pricing-calculator.js";
import { buildRulesState, compilePricingRules, loadCompany, loadStage2Context } from "../services/pricing-compiler.service.js";
import type { PricingRulesState } from "../services/pricing-rules.types.js";
import { formatCompanyResponse, type CompanyRow } from "./companies.js";

const router = Router({ mergeParams: true });

/** Stage 4 state lives in working_state_json.pricing_rules (null until compiled; earlier stages null it). */
function readState(company: CompanyRow): { workingState: any; state: PricingRulesState | null } {
  let workingState: any = {};
  try { workingState = JSON.parse(company.working_state_json || "{}"); } catch { workingState = {}; }
  return { workingState, state: workingState.pricing_rules ?? null };
}

function persist(company: CompanyRow, patch: Record<string, unknown>): CompanyRow {
  const { workingState } = readState(company);
  const now = new Date().toISOString();
  getDatabase()
    .prepare("UPDATE proposal_templates SET working_state_json = ?, updated_at = ? WHERE company_id = ? AND template_id = ?")
    .run(JSON.stringify({ ...workingState, ...patch }), now, company.company_id, company.template_id!);
  return loadCompany(company.company_id, company.template_id)!;
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });

// POST /api/companies/:id/rules/compile — AI compiles pricing_spec + quotation + Stage 2 into PricingRules
router.post("/rules/compile", async (req: Request, res: Response): Promise<void> => {
  try {
    const company = loadCompany(req.params.companyId, req.params.templateId);
    if (!company) return void fail(res, 404, `Company "${req.params.companyId}" not found`);
    if (!company.quotation_markdown) return void fail(res, 400, "Submit the briefing first — the sample quotation has not been parsed");
    const stage2 = loadStage2Context(company.company_id, company.template_id);
    if (!stage2.variables.some((v) => v.category === "pricing")) return void fail(res, 400, "Confirm the variables first — there are no pricing variables to define");

    const state = await compilePricingRules(company.company_id, company, stage2);
    persist(company, { pricing_rules: state, stage: "pricing_engine" });
    res.json({ success: true, pricing_rules: state });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to compile pricing rules");
  }
});

// GET /api/companies/:id/rules
router.get("/rules", (req: Request, res: Response): void => {
  const company = loadCompany(req.params.companyId, req.params.templateId);
  if (!company) return void fail(res, 404, `Company "${req.params.companyId}" not found`);
  const { state } = readState(company);
  if (!state) return void fail(res, 404, "Pricing rules have not been compiled yet");
  res.json({ success: true, pricing_rules: state });
});

// PUT /api/companies/:id/rules — body { rules }; structural errors → 400 and nothing persisted
router.put("/rules", (req: Request, res: Response): void => {
  try {
    const company = loadCompany(req.params.companyId, req.params.templateId);
    if (!company) return void fail(res, 404, `Company "${req.params.companyId}" not found`);
    const rules = req.body?.rules;
    if (!rules || !Array.isArray(rules.variables) || !Array.isArray(rules.tables)) return void fail(res, 400, "Body must be { rules: PricingRules }");
    const { state: previous } = readState(company);
    const state = buildRulesState(rules, loadStage2Context(company.company_id, company.template_id), previous?.compiled_at);
    if (state.validation_errors.length) {
      res.status(400).json({ success: false, error: "Pricing rules have structural errors", errors: state.validation_errors });
      return;
    }
    persist(company, { pricing_rules: state });
    res.json({ success: true, pricing_rules: state });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to update pricing rules");
  }
});

// POST /api/companies/:id/rules/calculate — body { inputs }; Stage 5's entry point (a lead, not the sample)
router.post("/rules/calculate", (req: Request, res: Response): void => {
  try {
    const company = loadCompany(req.params.companyId, req.params.templateId);
    if (!company) return void fail(res, 404, `Company "${req.params.companyId}" not found`);
    const { workingState, state } = readState(company);
    if (!state) return void fail(res, 404, "Pricing rules have not been compiled yet");
    const stage2 = loadStage2Context(company.company_id, company.template_id);
    const evaluation = evaluate(state.rules, req.body?.inputs ?? {});
    res.json({ success: true, evaluation, payload: buildProposalPayload(state.rules, evaluation, stage2, workingState.template_stats?.tier_matrix) });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : "Failed to calculate pricing");
  }
});

// POST /api/companies/:id/rules/proceed — 409 until the rules are compiled and structurally valid
router.post("/rules/proceed", (req: Request, res: Response): void => {
  const company = loadCompany(req.params.companyId, req.params.templateId);
  if (!company) return void fail(res, 404, `Company "${req.params.companyId}" not found`);
  const { state } = readState(company);
  if (!state) return void fail(res, 409, "Compile the pricing rules before proceeding");
  if (state.validation_errors.length) return void fail(res, 409, "Fix the pricing rule errors before proceeding");
  const updated = persist(company, { stage: "lead_simulation" });
  res.json({ success: true, company: formatCompanyResponse(updated) });
});

export default router;
