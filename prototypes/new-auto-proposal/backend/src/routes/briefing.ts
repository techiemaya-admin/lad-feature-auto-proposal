import { Router, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { toMarkdown } from "@firecrawl/anydoc";
import { getDatabase, getStorageDir } from "../db/database.js";
import { formatCompanyResponse, CompanyRow } from "./companies.js";

const router = Router();

// Configure Multer storage to route uploaded .docx files to storage/<company_id>/original_quotation.docx
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const companyId = req.params.id;
    const targetDir = path.join(getStorageDir(), companyId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (_req, _file, cb) => {
    cb(null, "original_quotation.docx");
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".docx") {
      cb(new Error("Only Microsoft Word (.docx) documents are supported"));
      return;
    }
    cb(null, true);
  },
});

// Middleware wrapper to handle multer error cleanly as JSON
function handleUpload(req: Request, res: Response, next: () => void) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`,
      });
      return;
    } else if (err instanceof Error) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
      return;
    }
    next();
  });
}

// POST /api/companies/:id/briefing/submit
// Accepts prompt text + .docx upload, converts to Markdown via @firecrawl/anydoc, and updates SQLite
router.post("/:id/briefing/submit", handleUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Verify company exists
    const selectStmt = db.prepare("SELECT * FROM company_sessions WHERE company_id = ?");
    const existing = selectStmt.get(id) as unknown as CompanyRow | undefined;

    if (!existing) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    const promptText = (req.body.prompt ?? req.body.pricing_spec ?? "").trim();
    if (!promptText) {
      res.status(400).json({
        success: false,
        error: "Pricing prompt cannot be empty",
      });
      return;
    }

    const companyDir = path.join(getStorageDir(), id);
    const targetFilePath = path.join(companyDir, "original_quotation.docx");

    let originalFilename = "";
    let fileSize = 0;

    if (req.file) {
      originalFilename = req.file.originalname;
      fileSize = req.file.size;
    } else if (fs.existsSync(targetFilePath)) {
      // Retain previously uploaded file if present
      originalFilename = existing.quotation_filename || "original_quotation.docx";
      const stat = fs.statSync(targetFilePath);
      fileSize = stat.size;
    } else {
      res.status(400).json({
        success: false,
        error: "A Microsoft Word (.docx) quotation document is required",
      });
      return;
    }

    // Convert docx to semantic Markdown via @firecrawl/anydoc
    let markdown = "";
    try {
      markdown = await toMarkdown(targetFilePath);
    } catch (parseError) {
      res.status(422).json({
        success: false,
        error: `Failed to convert quotation document to Markdown: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
      });
      return;
    }

    const now = new Date().toISOString();

    // Update data_json pricing_engine_spec as well
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(existing.data_json);
    } catch {
      parsedData = {};
    }
    parsedData.pricing_engine_spec = {
      ...(parsedData.pricing_engine_spec || {}),
      pricing_context: promptText,
    };
    const updatedDataJson = JSON.stringify(parsedData, null, 2);

    // Downstream state initialization / clear previous downstream results on re-submit
    const workingState = {
      stage: "variable_review",
      briefing_completed_at: now,
      extracted_variables: null,
      template_generated: false,
      pricing_rules: null,
    };

    const updateStmt = db.prepare(`
      UPDATE company_sessions SET
        pricing_spec = ?,
        data_json = ?,
        quotation_filename = ?,
        quotation_filesize = ?,
        quotation_markdown = ?,
        quotation_parsed_at = ?,
        briefing_locked = 1,
        working_state_json = ?,
        updated_at = ?
      WHERE company_id = ?
    `);

    updateStmt.run(
      promptText,
      updatedDataJson,
      originalFilename,
      fileSize,
      markdown,
      now,
      JSON.stringify(workingState),
      now,
      id
    );

    const updatedRow = selectStmt.get(id) as unknown as CompanyRow;
    const formatted = formatCompanyResponse(updatedRow);

    res.json({
      success: true,
      message: "Briefing submitted and quotation parsed successfully",
      company: formatted,
      markdown,
      metadata: formatted.document_metadata,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process briefing submission",
    });
  }
});

// POST /api/companies/:id/briefing/unlock
// Hard Reset / Unlock: safely resets downstream state while preserving user prompt text and document
router.post("/:id/briefing/unlock", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare("SELECT * FROM company_sessions WHERE company_id = ?");
    const existing = selectStmt.get(id) as unknown as CompanyRow | undefined;

    if (!existing) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    const now = new Date().toISOString();

    // Cascading Hard Reset on Briefing Unlock:
    // Delete all variables in company_variables table for this company
    try {
      const deleteVarsStmt = db.prepare("DELETE FROM company_variables WHERE company_id = ?");
      deleteVarsStmt.run(id);
    } catch {
      // Table may not exist yet in certain unit test runs
    }

    // Clean up downstream generated template.docx if present
    const templatePath = path.join(getStorageDir(), id, "template.docx");
    if (fs.existsSync(templatePath)) {
      try {
        fs.unlinkSync(templatePath);
      } catch {
        // Ignore file unlink error
      }
    }

    // Reset downstream progress while preserving prompt text and quotation file
    const resetWorkingState = {
      stage: "briefing",
      unlocked_at: now,
      extracted_variables: null,
      template_generated: false,
    };

    const updateStmt = db.prepare(`
      UPDATE company_sessions SET
        briefing_locked = 0,
        working_state_json = ?,
        updated_at = ?
      WHERE company_id = ?
    `);

    updateStmt.run(JSON.stringify(resetWorkingState), now, id);

    const updatedRow = selectStmt.get(id) as unknown as CompanyRow;

    res.json({
      success: true,
      message: "Briefing unlocked. Downstream state safely reset.",
      company: formatCompanyResponse(updatedRow),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlock briefing",
    });
  }
});

// GET /api/companies/:id/briefing/markdown
// Fetch extracted quotation Markdown and metadata
router.get("/:id/briefing/markdown", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare(`
      SELECT quotation_filename, quotation_filesize, quotation_markdown, quotation_parsed_at, briefing_locked
      FROM company_sessions
      WHERE company_id = ?
    `);
    const row = selectStmt.get(id) as {
      quotation_filename?: string;
      quotation_filesize?: number;
      quotation_markdown?: string;
      quotation_parsed_at?: string;
      briefing_locked?: number;
    } | undefined;

    if (!row) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    res.json({
      success: true,
      filename: row.quotation_filename || null,
      filesize: row.quotation_filesize || null,
      markdown: row.quotation_markdown || null,
      parsed_at: row.quotation_parsed_at || null,
      briefing_locked: Boolean(row.briefing_locked),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch briefing markdown",
    });
  }
});

export default router;
