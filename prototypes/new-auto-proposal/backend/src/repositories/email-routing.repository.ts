import { getDatabase } from "../db/database.js";
export function assignedEmail(companyId: string, templateId: string): string | undefined {
  const row = getDatabase().prepare("SELECT email FROM mock_email_routes WHERE company_id = ? AND template_id = ?").get(companyId, templateId) as { email: string } | undefined;
  return row?.email;
}
export interface SavedEmailRoute {
  company_id: string; email_id: string; email: string; template_id: string | null;
  reason: string; source: string; routed_at: string | null; version: number;
}
export function ensureMockEmail(companyId: string, email: string): SavedEmailRoute {
  const db = getDatabase();
  db.prepare("INSERT OR IGNORE INTO mock_email_routes (company_id, email_id, email) VALUES (?, ?, ?)").run(companyId, `mock-${companyId}`, email);
  return db.prepare("SELECT * FROM mock_email_routes WHERE company_id = ?").get(companyId) as unknown as SavedEmailRoute;
}
export function saveEmailRoute(row: SavedEmailRoute, templateId: string | null, reason: string, source: string): boolean {
  return getDatabase().prepare(`UPDATE mock_email_routes SET template_id = ?, reason = ?, source = ?, routed_at = ?, version = version + 1
    WHERE company_id = ? AND email_id = ? AND version = ?`).run(templateId, reason, source, new Date().toISOString(), row.company_id, row.email_id, row.version).changes === 1;
}

export function replaceEmail(row: SavedEmailRoute, email: string): boolean {
  return getDatabase().prepare(`UPDATE mock_email_routes SET email = ?, template_id = NULL, reason = '', source = 'unassigned', routed_at = NULL, version = version + 1
    WHERE company_id = ? AND version = ?`).run(email, row.company_id, row.version).changes === 1;
}
