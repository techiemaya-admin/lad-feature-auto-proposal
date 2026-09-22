import path from "node:path";
import fs from "node:fs";
import { getStorageDir } from "../db/database.js";
import { loadTemplate, saveWorkflowState, deleteTemplate, resetTemplateState } from "../repositories/templates.repository.js";
import { loadDataset } from "../db/seed.js";

export function templateDirectory(companyId: string, templateId: string): string {
  for (const id of [companyId, templateId]) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid company or template identifier");
  }
  return path.join(getStorageDir(), companyId, templateId);
}

export function invalidateTemplate(companyId: string, templateId: string): void {
  const row = loadTemplate(companyId, templateId);
  if (!row) return;
  const state = JSON.parse(row.working_state_json || "{}");
  Object.assign(state, { stage: "variable_review", template_generated: false, template_stats: null, pricing_rules: null });
  saveWorkflowState(companyId, templateId, state);
  const file = path.join(templateDirectory(companyId, templateId), "template.docx");
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function removeProposalTemplate(companyId: string, templateId: string): void {
  const directory = templateDirectory(companyId, templateId);
  for (const name of ["original_quotation.docx", "template.docx"]) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  deleteTemplate(companyId, templateId);
}

export function resetProposalTemplate(companyId: string, templateId: string): void {
  const spec = loadDataset().companies.find(c => c.company_id === companyId)?.pricing_engine_spec.pricing_context ?? "";
  invalidateTemplate(companyId, templateId);
  resetTemplateState(companyId, templateId, spec);
}
