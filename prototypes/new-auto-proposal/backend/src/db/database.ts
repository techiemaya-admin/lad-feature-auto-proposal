import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedAllCompanies } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let instance: DatabaseSync | null = null;

export function getStorageDir(): string {
  const custom = process.env.STORAGE_DIR;
  if (custom) {
    const resolved = path.isAbsolute(custom)
      ? custom
      : path.resolve(process.cwd(), custom);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }

  const defaultDir = path.resolve(__dirname, "../../storage");
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export function initDatabase(dbPath?: string): DatabaseSync {
  let finalPath: string;

  if (dbPath) {
    finalPath = dbPath;
  } else if (process.env.DB_PATH) {
    finalPath = path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.resolve(process.cwd(), process.env.DB_PATH);
  } else {
    finalPath = path.join(getStorageDir(), "database.sqlite");
  }

  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(finalPath);

  // Enable WAL mode and foreign keys for performance and reliability
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Create company_sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_sessions (
      company_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      industry TEXT,
      location TEXT,
      email TEXT,
      website TEXT,
      phone TEXT,
      data_json TEXT NOT NULL,
      pricing_spec TEXT NOT NULL,
      working_state_json TEXT,
      quotation_filename TEXT,
      quotation_filesize INTEGER,
      quotation_markdown TEXT,
      quotation_parsed_at TEXT,
      briefing_locked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_variables (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      natural_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('customer_input', 'pricing', 'paragraph', 'table_loop', 'comparison_matrix', 'compound_table')),
      data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'currency', 'enum', 'paragraph', 'table')),
      is_custom INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      descriptor_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES company_sessions(company_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_company_variables_lookup 
    ON company_variables (company_id, category, is_deleted);
  `);

  // Non-destructive column migrations for existing databases
  const tableInfo = db.prepare("PRAGMA table_info(company_sessions)").all() as Array<{ name: string }>;
  const columnNames = new Set(tableInfo.map((col) => col.name));

  if (!columnNames.has("quotation_filename")) {
    db.exec("ALTER TABLE company_sessions ADD COLUMN quotation_filename TEXT;");
  }
  if (!columnNames.has("quotation_filesize")) {
    db.exec("ALTER TABLE company_sessions ADD COLUMN quotation_filesize INTEGER;");
  }
  if (!columnNames.has("quotation_markdown")) {
    db.exec("ALTER TABLE company_sessions ADD COLUMN quotation_markdown TEXT;");
  }
  if (!columnNames.has("quotation_parsed_at")) {
    db.exec("ALTER TABLE company_sessions ADD COLUMN quotation_parsed_at TEXT;");
  }
  if (!columnNames.has("briefing_locked")) {
    db.exec("ALTER TABLE company_sessions ADD COLUMN briefing_locked INTEGER DEFAULT 0;");
  }

  // Auto-seed if table is empty
  const countStmt = db.prepare("SELECT count(*) as count FROM company_sessions");
  const row = countStmt.get() as { count: number };
  if (row && row.count === 0) {
    seedAllCompanies(db);
  }

  return db;
}

export function getDatabase(): DatabaseSync {
  if (!instance) {
    instance = initDatabase();
  }
  return instance;
}

export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
