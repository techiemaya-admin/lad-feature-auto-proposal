import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { listTemplates, loadWorkflow, insertTemplate, renameTemplate, companyExists } from "../repositories/templates.repository.js";
import { requireTemplate } from "../middleware/template-scope.js";
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
  res.json({ success: true, templates: listTemplates(req.params.companyId).map(({ template_id, name, updated_at }) => ({ template_id, name, updated_at })) });
});
router.post("/", (req: Request, res: Response) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 100) { res.status(400).json({ success: false, error: "Enter a template name of 1–100 characters" }); return; }
  const id = crypto.randomUUID();
  insertTemplate(req.params.companyId, id, name);
  res.status(201).json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, id)!) });
});
router.get("/:templateId", requireTemplate, (req: Request, res: Response) => {
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, req.params.templateId)!) });
});
router.patch("/:templateId", requireTemplate, (req: Request, res: Response) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 100) { res.status(400).json({ success: false, error: "Enter a template name of 1–100 characters" }); return; }
  renameTemplate(req.params.companyId, req.params.templateId, name);
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(req.params.companyId, req.params.templateId)!) });
});
router.delete("/:templateId", requireTemplate, (req: Request, res: Response) => {
  const { companyId, templateId } = req.params;
  removeProposalTemplate(companyId, templateId);
  res.json({ success: true });
});
router.post("/:templateId/reset", requireTemplate, (req: Request, res: Response) => {
  const { companyId, templateId } = req.params;
  resetProposalTemplate(companyId, templateId);
  res.json({ success: true, company: formatCompanyResponse(loadWorkflow(companyId, templateId)!) });
});
export default router;
