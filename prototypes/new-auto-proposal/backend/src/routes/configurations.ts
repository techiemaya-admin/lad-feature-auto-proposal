import { Router, Request, Response } from "express";
import { getDatabase } from "../db/database.js";
import {
  getCompanyConfiguration,
  updateCompanyConfiguration,
  setEmailConnection,
} from "../services/company-config.service.js";

const router = Router();

function companyEmail(id: string): { email: string | null } | undefined {
  return getDatabase().prepare("SELECT email FROM company_sessions WHERE company_id = ?").get(id) as
    | { email: string | null }
    | undefined;
}

// GET /api/companies/:id/configurations - drafter preferences + email link status (defaults if never saved)
router.get("/:id/configurations", (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!companyEmail(id)) {
    res.status(404).json({ success: false, error: `Company ${id} not found` });
    return;
  }
  res.json({ success: true, configuration: getCompanyConfiguration(id) });
});

// PUT /api/companies/:id/configurations - partial update of the free-text fields
router.put("/:id/configurations", (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!companyEmail(id)) {
    res.status(404).json({ success: false, error: `Company ${id} not found` });
    return;
  }
  try {
    res.json({ success: true, configuration: updateCompanyConfiguration(id, req.body || {}) });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid configuration" });
  }
});

// POST /api/companies/:id/email/connect - mock: links the company's profile address (see company-config.service)
router.post("/:id/email/connect", (req: Request, res: Response): void => {
  const { id } = req.params;
  const company = companyEmail(id);
  if (!company) {
    res.status(404).json({ success: false, error: `Company ${id} not found` });
    return;
  }
  if (!company.email) {
    res.status(400).json({ success: false, error: "Add an email address to the company profile first" });
    return;
  }
  res.json({ success: true, configuration: setEmailConnection(id, true, company.email) });
});

// POST /api/companies/:id/email/disconnect
router.post("/:id/email/disconnect", (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!companyEmail(id)) {
    res.status(404).json({ success: false, error: `Company ${id} not found` });
    return;
  }
  res.json({ success: true, configuration: setEmailConnection(id, false, null) });
});

export default router;
