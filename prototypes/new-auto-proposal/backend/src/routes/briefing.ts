import { templateDirectory, invalidateTemplate } from "../services/template-storage.js";
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { toMarkdown } from "@firecrawl/anydoc";
import { getDatabase } from "../db/database.js";
import { formatCompanyResponse, CompanyRow } from "./companies.js";
import { clearProposalFiles } from "../services/proposal-generator.service.js";
import { buildSampleDocument, draftSampleProposal, sampleText, SampleProposalError } from "../services/sample-proposal.service.js";
import { draftSampleSection, validateSampleSections, SampleSectionError } from "../services/sample-sections.service.js";

const router = Router({ mergeParams: true });

// Draft/build are previews: only the normal submit endpoint persists the reviewed document.
for (const action of ["sample-draft", "sample-document", "sample-section"] as const) {
  router.post(`/briefing/${action}`, async (req: Request, res: Response): Promise<void> => {
    try {
      const row = getDatabase().prepare(`SELECT w.*, t.description FROM template_workflows w
        JOIN proposal_templates t ON t.template_id = w.template_id AND t.company_id = w.company_id
        WHERE w.company_id = ? AND w.template_id = ?`).get(req.params.companyId, req.params.templateId) as unknown as (CompanyRow & { description: string }) | undefined;
      if (!row) { res.status(404).json({ error: "Template not found" }); return; }
      if (row.briefing_locked) { res.status(409).json({ error: "Unlock the briefing before creating a new sample." }); return; }
      if (action === "sample-section") {
        const pricingBrief = sampleText(req.body?.pricing_spec, "Pricing brief", 20000);
        const scenario = sampleText(req.body?.scenario, "Sample customer requirements", 3000);
        const sections = validateSampleSections(req.body?.sections);
        const section = await draftSampleSection({ company_name: row.company_name, company: JSON.parse(row.data_json),
          template: { name: row.name, description: row.description }, pricing_brief: pricingBrief, scenario,
          scope: sampleText(req.body?.scope, "Sample scope", 6000), existing_sections: sections }, req.body?.section);
        res.json({ section });
      } else if (action === "sample-draft") {
        const pricingBrief = sampleText(req.body?.pricing_spec, "Pricing brief", 20000);
        const sections = validateSampleSections(req.body?.sections);
        const sample = await draftSampleProposal({ company_name: row.company_name, company: JSON.parse(row.data_json),
          template: { name: row.name, description: row.description }, pricing_brief: pricingBrief });
        const document = await buildSampleDocument(row.company_name, { ...sample, sections, confirmed: true });
        res.json({ ...sample, document_base64: document.toString("base64") });
      } else {
        const buffer = await buildSampleDocument(row.company_name, req.body);
        res.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
          .attachment("generated_sample_proposal.docx").send(buffer);
      }
    } catch (error) {
      res.status(error instanceof SampleProposalError || error instanceof SampleSectionError ? error.status : 500).json({
        error: error instanceof SampleProposalError || error instanceof SampleSectionError ? error.message : "Unable to create the sample proposal. Please try again.",
      });
    }
  });
}

// Configure Multer storage to route uploaded .docx files to storage/<company_id>/original_quotation.docx
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const companyId = req.params.companyId;
    const targetDir = templateDirectory(companyId, req.params.templateId);
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
router.post("/briefing/submit", handleUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId: id, templateId } = req.params;
    const db = getDatabase();

    // Verify company exists
    const selectStmt = db.prepare("SELECT * FROM template_workflows WHERE company_id = ? AND template_id = ?");
    const existing = selectStmt.get(id, templateId) as unknown as CompanyRow | undefined;

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

    const companyDir = templateDirectory(id, templateId);
    let sampleReviewNotes: string[] = [];
    try {
      const previousState = JSON.parse(existing.working_state_json || "{}");
      const notes = req.body.sample_review_notes === undefined
        ? (req.file ? [] : previousState.sample_review_notes ?? []) : JSON.parse(req.body.sample_review_notes);
      if (!Array.isArray(notes) || notes.length > 80) throw new Error("Invalid notes");
      sampleReviewNotes = notes.map(note => sampleText(note, "Review note", 1000));
    } catch { res.status(400).json({ error: "Invalid sample review notes" }); return; }
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

    invalidateTemplate(id, templateId);
    const now = new Date().toISOString();

    // Downstream state initialization / clear previous downstream results on re-submit
    db.prepare("DELETE FROM company_variables WHERE company_id = ? AND template_id = ?").run(id, templateId);
    clearProposalFiles(id, templateId);
    const workingState = {
      stage: "variable_review",
      briefing_completed_at: now,
      extracted_variables: null,
      template_generated: false,
      pricing_rules: null,
      sample_review_notes: sampleReviewNotes,
    };

    const updateStmt = db.prepare(`
      UPDATE proposal_templates SET
        pricing_spec = ?,
        quotation_filename = ?,
        quotation_filesize = ?,
        quotation_markdown = ?,
        quotation_parsed_at = ?,
        briefing_locked = 1,
        working_state_json = ?,
        updated_at = ?
      WHERE company_id = ? AND template_id = ?
    `);

    updateStmt.run(
      promptText,
      originalFilename,
      fileSize,
      markdown,
      now,
      JSON.stringify(workingState),
      now,
      id, templateId
    );

    const updatedRow = selectStmt.get(id, templateId) as unknown as CompanyRow;
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
router.post("/briefing/unlock", (req: Request, res: Response): void => {
  try {
    const { companyId: id, templateId } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare("SELECT * FROM template_workflows WHERE company_id = ? AND template_id = ?");
    const existing = selectStmt.get(id, templateId) as unknown as CompanyRow | undefined;

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
      const deleteVarsStmt = db.prepare("DELETE FROM company_variables WHERE company_id = ? AND template_id = ?");
      deleteVarsStmt.run(id, templateId);
    } catch {
      // Table may not exist yet in certain unit test runs
    }

    // Clean up downstream generated template.docx if present
    const templatePath = path.join(templateDirectory(id, templateId), "template.docx");
    if (fs.existsSync(templatePath)) {
      try {
        fs.unlinkSync(templatePath);
      } catch {
        // Ignore file unlink error
      }
    }
    clearProposalFiles(id, templateId);

    // Reset downstream progress while preserving prompt text and quotation file
    const resetWorkingState = {
      stage: "briefing",
      unlocked_at: now,
      extracted_variables: null,
      template_generated: false,
      pricing_rules: null,
      sample_review_notes: JSON.parse(existing.working_state_json || "{}").sample_review_notes ?? [],
    };

    const updateStmt = db.prepare(`
      UPDATE proposal_templates SET
        briefing_locked = 0,
        working_state_json = ?,
        updated_at = ?
      WHERE company_id = ? AND template_id = ?
    `);

    updateStmt.run(JSON.stringify(resetWorkingState), now, id, templateId);

    const updatedRow = selectStmt.get(id, templateId) as unknown as CompanyRow;

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
router.get("/briefing/markdown", (req: Request, res: Response): void => {
  try {
    const { companyId: id, templateId } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare(`
      SELECT quotation_filename, quotation_filesize, quotation_markdown, quotation_parsed_at, briefing_locked
      FROM template_workflows
      WHERE company_id = ? AND template_id = ?
    `);
    const row = selectStmt.get(id, templateId) as {
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
