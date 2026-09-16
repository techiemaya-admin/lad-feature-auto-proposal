import { getDatabase } from "../db/database.js";

export interface CompanyConfiguration {
  company_id: string;
  style_notes: string;
  reference_proposal_text: string;
  clarification_notes: string;
  email_connected: boolean;
  email_address: string | null;
  email_connected_at: string | null;
  updated_at: string | null;
}

type ConfigRow = Omit<CompanyConfiguration, "email_connected"> & { email_connected: number };

// Everything here is interpolated into a drafter prompt (ticket 06), so the trust boundary caps it.
export const MAX_NOTE_CHARS = 6000;
const TEXT_FIELDS = ["style_notes", "reference_proposal_text", "clarification_notes"] as const;
export type ConfigPatch = Partial<Pick<CompanyConfiguration, (typeof TEXT_FIELDS)[number]>>;

const EMPTY = (companyId: string): CompanyConfiguration => ({
  company_id: companyId,
  style_notes: "",
  reference_proposal_text: "",
  clarification_notes: "",
  email_connected: false,
  email_address: null,
  email_connected_at: null,
  updated_at: null,
});

// No seed step: a company with no row simply has the defaults.
export function getCompanyConfiguration(companyId: string): CompanyConfiguration {
  const row = getDatabase()
    .prepare("SELECT * FROM company_configurations WHERE company_id = ?")
    .get(companyId) as ConfigRow | undefined;
  return row ? { ...row, email_connected: Boolean(row.email_connected) } : EMPTY(companyId);
}

function ensureRow(companyId: string): void {
  getDatabase()
    .prepare("INSERT OR IGNORE INTO company_configurations (company_id, updated_at) VALUES (?, ?)")
    .run(companyId, new Date().toISOString());
}

/** Validates + upserts the free-text fields. Throws on bad input; the route turns that into a 400. */
export function updateCompanyConfiguration(companyId: string, patch: ConfigPatch): CompanyConfiguration {
  const sets: string[] = [];
  const values: string[] = [];
  for (const field of TEXT_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    if (typeof value !== "string") throw new Error(`${field} must be a string`);
    if (value.length > MAX_NOTE_CHARS) throw new Error(`${field} must be at most ${MAX_NOTE_CHARS} characters`);
    sets.push(`${field} = ?`);
    values.push(value);
  }
  if (sets.length === 0) throw new Error("Nothing to update");

  ensureRow(companyId);
  getDatabase()
    .prepare(`UPDATE company_configurations SET ${sets.join(", ")}, updated_at = ? WHERE company_id = ?`)
    .run(...values, new Date().toISOString(), companyId);
  return getCompanyConfiguration(companyId);
}

// ponytail: mock email link. Flips a flag against the company's profile address; the upgrade path is an
// OAuth (Gmail/M365) connect flow storing a refresh token — the columns and route shape stay the same.
export function setEmailConnection(companyId: string, connected: boolean, address: string | null): CompanyConfiguration {
  ensureRow(companyId);
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      "UPDATE company_configurations SET email_connected = ?, email_address = ?, email_connected_at = ?, updated_at = ? WHERE company_id = ?"
    )
    .run(connected ? 1 : 0, connected ? address : null, connected ? now : null, now, companyId);
  return getCompanyConfiguration(companyId);
}
