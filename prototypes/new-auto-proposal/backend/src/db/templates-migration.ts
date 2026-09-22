import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/** Preserve the single-workflow prototype once; never re-copy stale company state. */
export function migrateTemplates(db: DatabaseSync, storageDir: string): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)");
  if (db.prepare("SELECT name FROM schema_migrations WHERE name = ?").get("multiple_templates_v1")) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const columns = db.prepare("PRAGMA table_info(company_variables)").all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === "template_id")) {
      db.exec("ALTER TABLE company_variables ADD COLUMN template_id TEXT REFERENCES proposal_templates(template_id) ON DELETE CASCADE");
    }
    const companies = db.prepare("SELECT * FROM company_sessions").all();
    for (const company of companies) {
      const id = String(company.company_id);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Cannot migrate invalid company identifier");
      const templateId = `default-${id}`;
      db.prepare(`INSERT OR IGNORE INTO proposal_templates
        (template_id, company_id, name, pricing_spec, quotation_filename, quotation_filesize,
         quotation_markdown, quotation_parsed_at, briefing_locked, working_state_json, created_at, updated_at)
        SELECT ?, company_id, 'Default template', pricing_spec, quotation_filename, quotation_filesize,
         quotation_markdown, quotation_parsed_at, briefing_locked, working_state_json, created_at, updated_at
        FROM company_sessions WHERE company_id = ?`).run(templateId, id);
      db.prepare("UPDATE company_variables SET template_id = ? WHERE company_id = ? AND template_id IS NULL").run(templateId, id);
      const destination = path.join(storageDir, id, templateId);
      for (const file of ["original_quotation.docx", "template.docx"]) {
        const source = path.join(storageDir, id, file);
        if (fs.existsSync(source)) {
          fs.mkdirSync(destination, { recursive: true });
          const target = path.join(destination, file);
          if (!fs.existsSync(target)) fs.copyFileSync(source, target);
          if (!fs.readFileSync(source).equals(fs.readFileSync(target))) throw new Error("Existing migration destination differs from source");
        }
      }
      const row = db.prepare("SELECT working_state_json FROM proposal_templates WHERE company_id = ? AND template_id = ?").get(id, templateId) as { working_state_json: string | null };
      if (row.working_state_json) {
        const state = JSON.parse(row.working_state_json);
        if (state.template_stats) state.template_stats.template_path = path.relative(process.cwd(), path.join(destination, "template.docx")).replace(/\\/g, "/");
        db.prepare("UPDATE proposal_templates SET working_state_json = ? WHERE company_id = ? AND template_id = ?").run(JSON.stringify(state), id, templateId);
      }
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_variables_template_lookup ON company_variables(company_id, template_id, category, is_deleted);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_template_owner ON proposal_templates(company_id, template_id);
      CREATE TRIGGER IF NOT EXISTS variable_template_insert BEFORE INSERT ON company_variables
      WHEN NEW.template_id IS NULL OR NOT EXISTS (SELECT 1 FROM proposal_templates WHERE company_id = NEW.company_id AND template_id = NEW.template_id)
      BEGIN SELECT RAISE(ABORT, 'Variable requires a template belonging to its company'); END;
      CREATE TRIGGER IF NOT EXISTS variable_template_update BEFORE UPDATE OF company_id, template_id ON company_variables
      WHEN NEW.template_id IS NULL OR NOT EXISTS (SELECT 1 FROM proposal_templates WHERE company_id = NEW.company_id AND template_id = NEW.template_id)
      BEGIN SELECT RAISE(ABORT, 'Variable requires a template belonging to its company'); END;`);
    db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run("multiple_templates_v1");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
