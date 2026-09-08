import { Router, Request, Response } from "express";
import { getDatabase } from "../db/database.js";
import { resetCompanyById } from "../db/seed.js";

const router = Router();

export interface CompanyRow {
  company_id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  data_json: string;
  pricing_spec: string;
  working_state_json: string | null;
  quotation_filename?: string | null;
  quotation_filesize?: number | null;
  quotation_markdown?: string | null;
  quotation_parsed_at?: string | null;
  briefing_locked?: number | null;
  created_at: string;
  updated_at: string;
}

export function formatCompanyResponse(row: CompanyRow) {
  let parsedData: Record<string, unknown> = {};
  try {
    parsedData = JSON.parse(row.data_json);
  } catch {
    parsedData = {};
  }

  let parsedWorkingState: Record<string, unknown> | null = null;
  if (row.working_state_json) {
    try {
      parsedWorkingState = JSON.parse(row.working_state_json);
    } catch {
      parsedWorkingState = null;
    }
  }

  let documentMetadata = null;
  if (row.quotation_filename) {
    documentMetadata = {
      filename: row.quotation_filename,
      filesize: row.quotation_filesize || 0,
      extracted_markdown: row.quotation_markdown || "",
      parsed_at: row.quotation_parsed_at || "",
    };
  }

  return {
    company_id: row.company_id,
    company_name: row.company_name,
    industry: row.industry,
    location: row.location,
    email: row.email,
    website: row.website,
    phone: row.phone,
    data: parsedData,
    pricing_spec: row.pricing_spec,
    working_state: parsedWorkingState,
    briefing_locked: Boolean(row.briefing_locked),
    document_metadata: documentMetadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/companies - list all tabs / company summaries
router.get("/", (_req: Request, res: Response): void => {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT company_id, company_name, industry, location, email, website, phone, pricing_spec, briefing_locked, quotation_filename, updated_at, created_at
      FROM company_sessions
      ORDER BY company_id ASC
    `);
    const rows = stmt.all();
    res.json({
      success: true,
      companies: rows.map((r: any) => ({
        ...r,
        briefing_locked: Boolean(r.briefing_locked),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch companies",
    });
  }
});

// GET /api/companies/:id - fetch full company profile and session state
router.get("/:id", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM company_sessions WHERE company_id = ?
    `);
    const row = stmt.get(id) as unknown as CompanyRow | undefined;

    if (!row) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    res.json({
      success: true,
      company: formatCompanyResponse(row),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch company",
    });
  }
});

// POST /api/companies/:id/import - re-seed / import settings from companies_dataset.json
router.post("/:id/import", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const reseeded = resetCompanyById(db, id);

    const stmt = db.prepare(`SELECT * FROM company_sessions WHERE company_id = ?`);
    const row = stmt.get(id) as unknown as CompanyRow;

    res.json({
      success: true,
      message: `Settings imported successfully for ${reseeded.company_basics.company_name}`,
      company: formatCompanyResponse(row),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to import settings",
    });
  }
});

// POST /api/companies/:id/reset - reset company to pristine mock default
router.post("/:id/reset", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const reset = resetCompanyById(db, id);

    const stmt = db.prepare(`SELECT * FROM company_sessions WHERE company_id = ?`);
    const row = stmt.get(id) as unknown as CompanyRow;

    res.json({
      success: true,
      message: `Reset ${reset.company_basics.company_name} to baseline defaults`,
      company: formatCompanyResponse(row),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset company",
    });
  }
});

// PUT /api/companies/:id/profile - persist user edits to profile and pricing spec
router.put("/:id/profile", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const selectStmt = db.prepare(`SELECT * FROM company_sessions WHERE company_id = ?`);
    const existing = selectStmt.get(id) as unknown as CompanyRow | undefined;

    if (!existing) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(existing.data_json);
    } catch {
      parsedData = {};
    }

    const {
      company_basics,
      company_details,
      ideal_customer,
      offer,
      pricing_engine_spec,
      pricing_spec,
      data,
    } = req.body;

    // Merge whole data payload if supplied
    if (data && typeof data === "object") {
      parsedData = { ...parsedData, ...data };
    }

    if (company_basics) {
      parsedData.company_basics = { ...(parsedData.company_basics || {}), ...company_basics };
    }

    if (company_details) {
      parsedData.company_details = { ...(parsedData.company_details || {}), ...company_details };
    }

    if (ideal_customer) {
      parsedData.ideal_customer = { ...(parsedData.ideal_customer || {}), ...ideal_customer };
    }

    if (offer) {
      parsedData.offer = { ...(parsedData.offer || {}), ...offer };
    }

    // Determine final pricing spec string
    let finalPricingSpec = existing.pricing_spec;
    if (typeof pricing_spec === "string") {
      finalPricingSpec = pricing_spec;
    } else if (pricing_engine_spec?.pricing_context) {
      finalPricingSpec = pricing_engine_spec.pricing_context;
    } else if (typeof pricing_engine_spec === "string") {
      finalPricingSpec = pricing_engine_spec;
    }

    parsedData.pricing_engine_spec = {
      ...(parsedData.pricing_engine_spec || {}),
      pricing_context: finalPricingSpec,
    };

    const companyName = parsedData.company_basics?.company_name || existing.company_name;
    const industry = parsedData.company_details?.industry || existing.industry;
    const location = parsedData.company_basics?.location || existing.location;
    const email = parsedData.company_basics?.email || existing.email;
    const website = parsedData.company_basics?.website || existing.website;
    const phone = parsedData.company_basics?.phone || existing.phone;
    const updatedDataJson = JSON.stringify(parsedData, null, 2);
    const now = new Date().toISOString();

    const updateStmt = db.prepare(`
      UPDATE company_sessions SET
        company_name = ?,
        industry = ?,
        location = ?,
        email = ?,
        website = ?,
        phone = ?,
        data_json = ?,
        pricing_spec = ?,
        updated_at = ?
      WHERE company_id = ?
    `);

    updateStmt.run(
      companyName,
      industry,
      location,
      email,
      website,
      phone,
      updatedDataJson,
      finalPricingSpec,
      now,
      id
    );

    const reloaded = selectStmt.get(id) as unknown as CompanyRow;

    res.json({
      success: true,
      message: "Company profile updated successfully",
      company: formatCompanyResponse(reloaded),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update company profile",
    });
  }
});

export default router;
