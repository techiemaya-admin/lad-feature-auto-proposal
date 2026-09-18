import { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { getDatabase, getStorageDir } from "../db/database.js";
import { mutateDocumentTemplate } from "../services/template-mutator.service.js";
import { logPipelineArtifact } from "../services/pipeline-log.js";
import { clearProposalFiles } from "../services/proposal-generator.service.js";
import { toMarkdown } from "@firecrawl/anydoc";
import type { CompanyRow } from "./companies.js";

const router = Router();

// POST /api/companies/:id/template/generate
// Mutates original_quotation.docx using docxmlater and confirmed variables
router.post("/:id/template/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Verify company session exists
    const selectStmt = db.prepare("SELECT * FROM company_sessions WHERE company_id = ?");
    const company = selectStmt.get(id) as unknown as CompanyRow | undefined;

    if (!company) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    // Execute in-memory AST mutations; a new template makes any generated proposal stale
    clearProposalFiles(id);
    const result = await mutateDocumentTemplate(id);

    // Log anydoc markdown of the templated docx (best-effort, never blocks the response)
    toMarkdown(path.join(getStorageDir(), id, "template.docx"))
      .then((md) => logPipelineArtifact(id, "template.md", md))
      .catch((err) => console.warn("[pipeline-log] anydoc conversion failed:", err));

    // Update company working_state_json in SQLite
    const now = new Date().toISOString();
    let workingState: any = {};
    if (company.working_state_json) {
      try {
        workingState = JSON.parse(company.working_state_json);
      } catch {
        workingState = {};
      }
    }

    workingState = {
      ...workingState,
      stage: "template_checkpoint",
      template_generated: true,
      pricing_rules: null, // a new template resets Stage 4 (hard-reset policy)
      template_generated_at: now,
      template_stats: {
        template_path: result.template_path,
        tags_placed_count: result.tags_placed_count,
        loops_collapsed_count: result.loops_collapsed_count,
        conditional_rows_wrapped_count: result.conditional_rows_wrapped_count,
        mutations_applied_count: result.mutations_applied_count,
        details: result.details,
        tier_matrix: result.tier_matrix,
      },
    };

    const updateStmt = db.prepare(`
      UPDATE company_sessions
      SET working_state_json = ?, updated_at = ?
      WHERE company_id = ?
    `);
    updateStmt.run(JSON.stringify(workingState), now, id);

    res.json({
      success: true,
      template_path: result.template_path,
      tags_placed_count: result.tags_placed_count,
      loops_collapsed_count: result.loops_collapsed_count,
      conditional_rows_wrapped_count: result.conditional_rows_wrapped_count,
      mutations_applied_count: result.mutations_applied_count,
      details: result.details,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate template",
    });
  }
});

// GET /api/companies/:id/template/status
// Returns whether template.docx exists and returns persisted generation stats
router.get("/:id/template/status", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare("SELECT working_state_json FROM company_sessions WHERE company_id = ?");
    const row = selectStmt.get(id) as { working_state_json?: string } | undefined;

    if (!row) {
      res.status(404).json({
        success: false,
        error: `Company "${id}" not found`,
      });
      return;
    }

    const templatePath = path.join(getStorageDir(), id, "template.docx");
    const exists = fs.existsSync(templatePath);
    let stats: any = null;
    let filesize: number | null = null;

    if (exists) {
      const fileStat = fs.statSync(templatePath);
      filesize = fileStat.size;
    }

    if (row.working_state_json) {
      try {
        const parsed = JSON.parse(row.working_state_json);
        stats = parsed.template_stats || null;
      } catch {
        stats = null;
      }
    }

    res.json({
      success: true,
      exists,
      template_path: exists ? path.relative(process.cwd(), templatePath).replace(/\\/g, "/") : null,
      filesize,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch template status",
    });
  }
});

// GET /api/companies/:id/template/download
// Streams binary .docx file with OpenXML content-type
router.get("/:id/template/download", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const templatePath = path.join(getStorageDir(), id, "template.docx");

    if (!fs.existsSync(templatePath)) {
      res.status(404).json({
        success: false,
        error: `Template for company "${id}" has not been generated yet. Please generate the template first.`,
      });
      return;
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${id}_template.docx"`);

    const fileStream = fs.createReadStream(templatePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to download template",
    });
  }
});

export default router;
