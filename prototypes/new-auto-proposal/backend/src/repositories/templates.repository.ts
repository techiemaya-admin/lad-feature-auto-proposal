import { getDatabase } from "../db/database.js";
import type { CompanyRow } from "../routes/companies.js";

export interface TemplateRow {
  template_id: string;
  company_id: string;
  name: string;
  pricing_spec: string;
  quotation_filename: string | null;
  quotation_filesize: number | null;
  quotation_markdown: string | null;
  quotation_parsed_at: string | null;
  briefing_locked: number;
  working_state_json: string | null;
  created_at: string;
  updated_at: string;
}

export function listTemplates(companyId: string): TemplateRow[] {
  return getDatabase().prepare("SELECT * FROM proposal_templates WHERE company_id = ? ORDER BY created_at, template_id").all(companyId) as unknown as TemplateRow[];
}

export function loadTemplate(companyId: string, templateId: string): TemplateRow | undefined {
  return getDatabase().prepare("SELECT * FROM proposal_templates WHERE company_id = ? AND template_id = ?").get(companyId, templateId) as unknown as TemplateRow | undefined;
}

/** Read-only composition: profile is shared; every workflow field comes from the template. */
export function loadWorkflow(companyId: string, templateId: string): (CompanyRow & TemplateRow) | undefined {
  const template = loadTemplate(companyId, templateId);
  const company = getDatabase().prepare("SELECT * FROM company_sessions WHERE company_id = ?").get(companyId) as unknown as CompanyRow | undefined;
  return company && template ? { ...company, ...template } : undefined;
}

export function insertTemplate(companyId: string, templateId: string, name: string): void {
  const now = new Date().toISOString();
  getDatabase().prepare("INSERT INTO proposal_templates (template_id, company_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(templateId, companyId, name, now, now);
}

export function renameTemplate(companyId: string, templateId: string, name: string): void {
  getDatabase().prepare("UPDATE proposal_templates SET name = ?, updated_at = ? WHERE company_id = ? AND template_id = ?").run(name, new Date().toISOString(), companyId, templateId);
}

export function deleteTemplate(companyId: string, templateId: string): void {
  getDatabase().prepare("DELETE FROM proposal_templates WHERE company_id = ? AND template_id = ?").run(companyId, templateId);
}

export function companyExists(companyId: string): boolean {
  return Boolean(getDatabase().prepare("SELECT company_id FROM company_sessions WHERE company_id = ?").get(companyId));
}

export function saveWorkflowState(companyId: string, templateId: string, state: unknown): void {
  getDatabase().prepare("UPDATE proposal_templates SET working_state_json = ?, updated_at = ? WHERE company_id = ? AND template_id = ?").run(JSON.stringify(state), new Date().toISOString(), companyId, templateId);
}

export function resetTemplateState(companyId: string, templateId: string, spec: string): void {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM company_variables WHERE company_id = ? AND template_id = ?").run(companyId, templateId);
    db.prepare(`UPDATE proposal_templates SET pricing_spec = ?, briefing_locked = 0, working_state_json = NULL,
      updated_at = ? WHERE company_id = ? AND template_id = ?`).run(spec, new Date().toISOString(), companyId, templateId);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
