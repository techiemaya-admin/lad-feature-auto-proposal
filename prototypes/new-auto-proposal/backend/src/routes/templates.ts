import { Router, type Request, type Response } from "express";
import { importTemplateIdeas, saveIdeas, validateIdea, TemplateIdeaError } from "../services/template-ideas.service.js";
import { listTemplates, loadWorkflow, renameTemplate, companyExists } from "../repositories/templates.repository.js";
import { requireTemplate, serializeTemplateWrites } from "../middleware/template-scope.js";
import { removeProposalTemplate, resetProposalTemplate } from "../services/template-storage.js";
import { formatCompanyResponse } from "./companies.js";

const router = Router({ mergeParams: true });
router.use((req, res, next) => {
  if (!companyExists(req.params.companyId)) {
    res.status(404).json({ success: false, error: "Company not found" });
    return;
  }
  next();
});
router.get("/", (req: Request, res: Response) => {
  res.json({ success: true, templates: listTemplates(req.params.companyId).map(({ template_id, name, description, pricing_spec, updated_at }) => ({ template_id, name, description, pricing_spec, updated_at })) });
});
router.post("/import-icp", async (req: Request, res: Response) => {
  try {
    const rows = await importTemplateIdeas(req.params.companyId);
    res.status(201).json({ success: true, templates: rows.map(({ template_id, name, description, pricing_spec, updated_at }) => ({ template_id, name, description, pricing_spec, updated_at })) });
  } catch (error) {
    res.status(error instanceof TemplateIdeaError ? error.status : 500).json({ success: false, error: error instanceof Error ? error.message : "Import failed" });
  }
});
router.post("/", (req: Request, res: Response) => {
  try {
    const idea = validateIdea(req.body);
    const before = new Set(listTemplates(req.params.companyId).map(t => t.template_id));
    const created = saveIdeas(req.params.companyId, [idea]).find(t => !before.has(t.template_id))!;
    res.status(201).json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, created.template_id)!) });
  } catch (error) {
    res.status(error instanceof TemplateIdeaError ? error.status : 500).json({ success: false, error: error instanceof Error ? error.message : "Could not create template" });
  }
});
router.get("/:templateId", requireTemplate, (req: Request, res: Response) => {
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, req.params.templateId)!) });
});
router.patch("/:templateId", requireTemplate, serializeTemplateWrites, (req: Request, res: Response) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 100) { res.status(400).json({ success: false, error: "Enter a template name of 1–100 characters" }); return; }
  renameTemplate(req.params.companyId, req.params.templateId, name);
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, req.params.templateId)!) });
});
router.delete("/:templateId", requireTemplate, serializeTemplateWrites, (req: Request, res: Response) => {
  const { companyId, templateId } = req.params;
  removeProposalTemplate(companyId, templateId);
  res.json({ success: true });
});
router.post("/:templateId/reset", requireTemplate, serializeTemplateWrites, (req: Request, res: Response) => {
  const { companyId, templateId } = req.params;
  resetProposalTemplate(companyId, templateId);
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(companyId, templateId)!) });
});
export default router;
