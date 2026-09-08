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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

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
