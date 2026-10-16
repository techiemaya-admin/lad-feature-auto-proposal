import { getDatabase } from "../db/database.js";
import { insertTemplate } from "../repositories/templates.repository.js";
export function seedTemplateFixtures() {
  for (const row of getDatabase().prepare("SELECT company_id, pricing_spec FROM company_sessions").all()) {
    insertTemplate(String(row.company_id), `default-${row.company_id}`, "Default template", "Test workflow", String(row.pricing_spec));
  }
}
