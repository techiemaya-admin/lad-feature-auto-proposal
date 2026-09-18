import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CompanyRecord {
  company_id: string;
  company_basics: {
    company_name: string;
    location?: string;
    timings?: string;
    email?: string;
    website?: string;
    phone?: string | null;
  };
  company_details?: {
    industry?: string;
    value_proposition?: string;
    products_and_services?: string[];
    target_customers?: string;
  };
  ideal_customer?: {
    description?: string;
    pain_points?: string;
  };
  offer?: {
    buyer_segments?: string[];
    cost_of_doing_nothing?: string;
    discovery_questions?: string[];
    what_happens_after_they_sign?: string;
    evidenced_results?: string;
    who_is_not_a_good_fit?: string[];
    common_objections?: Array<{ objection: string; response: string }>;
    why_buyers_pick_you?: string;
    guarantee_risk_reversal?: string;
  };
}

export interface SeedRecord {
  company_id: string;
  pricing_spec?: string;
  sample_lead_text?: string;
}

export interface SeedsFile {
  note?: string;
  companies: SeedRecord[];
}

export interface DatasetFile {
  dataset_meta?: Record<string, unknown>;
  companies: CompanyRecord[];
}

function findMockDataFile(filename: string): string {
  const candidatePaths = [
    path.resolve(__dirname, `../../../Mock Data/${filename}`),
    path.resolve(process.cwd(), `Mock Data/${filename}`),
    path.resolve(process.cwd(), `../Mock Data/${filename}`),
    path.resolve(process.cwd(), `prototypes/new-auto-proposal/Mock Data/${filename}`),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`${filename} not found in candidate paths: ${candidatePaths.join(", ")}`);
}

export function findDatasetPath(): string {
  return findMockDataFile("companies_dataset.json");
}

export function loadDataset(): DatasetFile {
  const datasetPath = findDatasetPath();
  const raw = fs.readFileSync(datasetPath, "utf-8");
  return JSON.parse(raw) as DatasetFile;
}

/** Dev-only seeds (Stage 1 pricing text, Stage 5 sample lead) — never part of the imported dataset. */
export function loadSeeds(): SeedsFile {
  const raw = fs.readFileSync(findMockDataFile("test_seeds.json"), "utf-8");
  return JSON.parse(raw) as SeedsFile;
}

export function findSeed(companyId: string): SeedRecord | undefined {
  return loadSeeds().companies.find((c) => c.company_id === companyId);
}

export function upsertCompany(db: DatabaseSync, company: CompanyRecord, seed?: SeedRecord): void {
  const now = new Date().toISOString();
  const pricingSpec = seed?.pricing_spec || "";
  const dataJson = JSON.stringify(company, null, 2);

  const stmt = db.prepare(`
    INSERT INTO company_sessions (
      company_id, company_name, industry, location, email, website, phone,
      data_json, pricing_spec, updated_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(company_id) DO UPDATE SET
      company_name = excluded.company_name,
      industry = excluded.industry,
      location = excluded.location,
      email = excluded.email,
      website = excluded.website,
      phone = excluded.phone,
      data_json = excluded.data_json,
      pricing_spec = excluded.pricing_spec,
      quotation_filename = NULL,
      quotation_filesize = NULL,
      quotation_markdown = NULL,
      quotation_parsed_at = NULL,
      briefing_locked = 0,
      working_state_json = NULL,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    company.company_id,
    company.company_basics?.company_name || company.company_id,
    company.company_details?.industry || null,
    company.company_basics?.location || null,
    company.company_basics?.email || null,
    company.company_basics?.website || null,
    company.company_basics?.phone || null,
    dataJson,
    pricingSpec,
    now,
    now
  );
}

export function seedAllCompanies(db: DatabaseSync): void {
  const dataset = loadDataset();
  for (const company of dataset.companies) {
    upsertCompany(db, company, findSeed(company.company_id));
  }
}

export function resetCompanyById(db: DatabaseSync, companyId: string): CompanyRecord {
  const dataset = loadDataset();
  const found = dataset.companies.find((c) => c.company_id === companyId);
  if (!found) {
    throw new Error(`Company with id "${companyId}" not found in dataset.`);
  }

  upsertCompany(db, found, findSeed(companyId));

  try {
    const deleteVarsStmt = db.prepare("DELETE FROM company_variables WHERE company_id = ?");
    deleteVarsStmt.run(companyId);
  } catch {
    // Table may not exist yet in certain test setups
  }

  return found;
}

