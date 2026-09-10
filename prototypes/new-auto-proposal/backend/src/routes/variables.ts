import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Document } from "docxmlater";
import { getDatabase, getStorageDir } from "../db/database.js";
import {
  extractVariablesWithGemini,
  generateTableManifest,
  ExtractionResponse,
} from "../services/gemini.service.js";
import type { CompanyRow } from "./companies.js";

const router = Router();

export interface VariableRow {
  id: string;
  company_id: string;
  variable_name: string;
  natural_name: string;
  category: string;
  data_type: string;
  is_custom: number;
  is_deleted: number;
  sort_order: number;
  descriptor_json: string;
  created_at: string;
  updated_at: string;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function formatVariableRow(row: VariableRow) {
  let descriptor: Record<string, unknown> = {};
  try {
    descriptor = JSON.parse(row.descriptor_json);
  } catch {
    descriptor = {};
  }

  return {
    id: row.id,
    company_id: row.company_id,
    variable_name: row.variable_name,
    natural_name: row.natural_name,
    category: row.category,
    data_type: row.data_type,
    is_custom: Boolean(row.is_custom),
    is_deleted: Boolean(row.is_deleted),
    sort_order: row.sort_order,
    descriptor,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/companies/:id/variables - Retrieve all persisted variables and compound tables
router.get("/:id/variables", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT * FROM company_variables
      WHERE company_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `);

    const rows = stmt.all(id) as unknown as VariableRow[];

    const variables: ReturnType<typeof formatVariableRow>[] = [];
    const compound_tables: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const formatted = formatVariableRow(row);
      if (
        formatted.category === "comparison_matrix" ||
        formatted.category === "table_loop" ||
        formatted.category === "compound_table" ||
        formatted.data_type === "table"
      ) {
        compound_tables.push({
          id: formatted.id,
          table_id: formatted.variable_name,
          natural_name: formatted.natural_name,
          table_index: (formatted.descriptor as any).table_index ?? 0,
          type:
            formatted.category === "comparison_matrix"
              ? "comparison_matrix"
              : (formatted.descriptor as any).type ?? "repeating_loop",
          loop_tag: (formatted.descriptor as any).loop_tag,
          columns: (formatted.descriptor as any).columns ?? [],
          enum_options: (formatted.descriptor as any).enum_options ?? [],
          default_value: (formatted.descriptor as any).default_value,
          mutation: (formatted.descriptor as any).mutation,
          is_deleted: formatted.is_deleted,
        });
      } else {
        variables.push(formatted);
      }
    }

    res.json({
      success: true,
      company_id: id,
      variables,
      compound_tables,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch variables",
    });
  }
});

// POST /api/companies/:id/variables/extract - Prompts Gemini and persists discovered variables
router.post("/:id/variables/extract", async (req: Request, res: Response): Promise<void> => {
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

    if (!company.quotation_markdown || !company.quotation_markdown.trim()) {
      res.status(400).json({
        success: false,
        error: "Quotation markdown is missing. Please submit a quotation document first.",
      });
      return;
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(company.data_json);
    } catch {
      parsedData = {};
    }

    const companyBasics = parsedData.company_basics || {
      company_name: company.company_name,
      location: company.location,
      email: company.email,
      phone: company.phone,
    };

    // Pre-inspect original_quotation.docx to generate ground-truth Table Manifest (LAYER 1.5)
    let tableManifest: string | undefined;
    const storageDir = getStorageDir();
    const companyDir = path.join(storageDir, id);
    const sourceFilePath = path.join(companyDir, "original_quotation.docx");

    let docBuffer: Buffer | null = null;
    if (fs.existsSync(sourceFilePath)) {
      docBuffer = fs.readFileSync(sourceFilePath);
    } else {
      // Mock Data fallback if original_quotation.docx is not yet in storage
      const mockFileMap: Record<string, string> = {
        co1_seo: "Proposal_Northstar_BloomAndCo.docx",
        co2_msp: "Proposal_FortressIT_WhitfieldAssociates.docx",
        co3_dev: "Proposal_Fieldstone_RosewoodHomeGoods.docx",
      };
      const mockFilename = mockFileMap[id];
      if (mockFilename) {
        const candidateMockDirs = [
          path.resolve(process.cwd(), "Mock Data/docx"),
          path.resolve(process.cwd(), "../Mock Data/docx"),
          path.resolve(process.cwd(), "prototypes/new-auto-proposal/Mock Data/docx"),
        ];
        const foundDir = candidateMockDirs.find((d) => fs.existsSync(path.join(d, mockFilename)));
        if (foundDir) {
          const mockPath = path.join(foundDir, mockFilename);
          if (!fs.existsSync(companyDir)) {
            fs.mkdirSync(companyDir, { recursive: true });
          }
          fs.copyFileSync(mockPath, sourceFilePath);
          docBuffer = fs.readFileSync(sourceFilePath);
        }
      }
    }

    if (docBuffer) {
      try {
        tableManifest = await generateTableManifest(docBuffer);
      } catch (err) {
        console.error("Failed to generate table manifest from docx:", err);
      }
    }

    // Extract using Gemini structured outputs
    const extraction: ExtractionResponse = await extractVariablesWithGemini({
      markdown: company.quotation_markdown,
      pricingSpec: company.pricing_spec,
      companyName: company.company_name,
      companyBasics,
      industry: company.industry,
      tableManifest,
    });

    // AST Grounding & Normalization: Guarantee complete row_identifier, col_index, and sample_text
    // for all table cell and conditional row mutations using the inspected docx AST
    if (docBuffer) {
      try {
        const doc = await Document.loadFromBuffer(docBuffer);
        const tables = doc.getTables();

        for (const v of extraction.variables) {
          const m = v.mutation;
          if (m.action === "replace_table_cell" || m.action === "wrap_conditional_row") {
            const tIdx = m.table_index ?? 0;
            const targetTable = tables[tIdx];
            if (targetTable) {
              const rows = targetTable.getRows();

              // If col_index or row_identifier is missing, scan table rows to locate exact cell
              if (m.col_index === undefined || !m.row_identifier) {
                const sampleToFind = (m.sample_text || v.sample_value || "").trim();
                let foundRowIdx = -1;
                let foundColIdx = -1;

                if (sampleToFind) {
                  for (let r = 0; r < rows.length; r++) {
                    const cells = rows[r].getCells();
                    for (let c = 0; c < cells.length; c++) {
                      if (cells[c].getText().includes(sampleToFind)) {
                        foundRowIdx = r;
                        foundColIdx = c;
                        break;
                      }
                    }
                    if (foundRowIdx >= 0) break;
                  }
                }

                if (foundRowIdx >= 0) {
                  if (m.col_index === undefined) m.col_index = foundColIdx;
                  if (!m.row_identifier) {
                    const col0 = rows[foundRowIdx].getCell(0)?.getText().trim();
                    m.row_identifier = col0 || rows[0].getCell(foundColIdx)?.getText().trim() || v.natural_name;
                  }
                } else {
                  // Fallback based on table row structure
                  const colCount = rows[0]?.getCellCount() || 2;
                  if (m.col_index === undefined) m.col_index = colCount === 2 ? 1 : 0;
                  if (!m.row_identifier) m.row_identifier = v.natural_name || v.variable_name;
                }
              }

              // Ensure sample_text is populated
              if (!m.sample_text && v.sample_value) {
                m.sample_text = v.sample_value;
              }

              // Ensure template_tag is populated
              if (!m.template_tag) {
                m.template_tag = `{${v.variable_name}}`;
              }

              // Ensure condition_tag is populated for wrap_conditional_row
              if (m.action === "wrap_conditional_row" && !m.condition_tag) {
                m.condition_tag = v.visibility_rule?.condition_flag || `has_${v.variable_name}`;
              }
            }
          }
        }

        // Guarantee columns array and mutations for repeating loop compound tables
        for (const t of extraction.compound_tables) {
          const tableName = (t.natural_name || t.table_id || "").toLowerCase();
          const loopTag = typeof t.loop_tag === "string" ? t.loop_tag.toLowerCase() : "";
          const targetTable = tables[t.table_index];
          const hasAddonInTable = targetTable
            ? targetTable.getRows().some((r) => {
                const txt = r.getText().toLowerCase();
                return txt.includes("add-on") || txt.includes("addon");
              })
            : false;

          const isAddonLoop =
            loopTag === "addon_items" ||
            loopTag.includes("addon") ||
            tableName.includes("add-on") ||
            tableName.includes("addon") ||
            hasAddonInTable;

          if (t.type === "repeating_loop" && (!t.columns || t.columns.length === 0)) {
            if (t.loop_tag === "milestones" || t.loop_tag === "project_phases" || t.table_index === 1) {
              t.columns = ["phase_number", "milestone_title", "deliverable_summary"];
            } else if (isAddonLoop) {
              t.columns = ["addon_name", "addon_fee"];
            } else if (t.loop_tag === "payment_milestones" || t.table_index === 3) {
              t.columns = ["milestone_name", "trigger_description", "payment_amount"];
            }
          }

          if (t.type === "repeating_loop" && isAddonLoop) {
            if (!t.mutation) {
              t.mutation = {
                action: "collapse_repeating_table",
                table_index: t.table_index,
                loop_tag: t.loop_tag || "addon_items",
                template_row_index: 2,
                row_identifier: "add-on",
              };
            } else if (t.mutation.action === "collapse_repeating_table") {
              if (t.mutation.template_row_index === undefined) {
                t.mutation.template_row_index = 2;
              }
              if (!t.mutation.row_identifier) {
                t.mutation.row_identifier = "add-on";
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to ground variables against document AST:", err);
      }
    }

    const now = new Date().toISOString();

    // Idempotent re-scan: delete previous non-custom variables, preserving user-added custom variables
    const deleteNonCustomStmt = db.prepare(`
      DELETE FROM company_variables
      WHERE company_id = ? AND is_custom = 0
    `);
    deleteNonCustomStmt.run(id);

    // Insert atomic variables
    const insertStmt = db.prepare(`
      INSERT INTO company_variables (
        id, company_id, variable_name, natural_name, category, data_type,
        is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let sortIndex = 0;
    const insertedVariables: ReturnType<typeof formatVariableRow>[] = [];

    for (const v of extraction.variables) {
      const varId = crypto.randomUUID();
      const descriptorJson = JSON.stringify({
        sample_value: v.sample_value,
        description: v.description,
        enum_options: v.enum_options,
        default_value: v.default_value,
        visibility_rule: v.visibility_rule,
        paragraph_config: v.paragraph_config,
        mutation: v.mutation,
      });

      insertStmt.run(
        varId,
        id,
        v.variable_name,
        v.natural_name,
        v.category,
        v.data_type,
        0, // is_custom
        0, // is_deleted
        sortIndex++,
        descriptorJson,
        now,
        now
      );

      insertedVariables.push({
        id: varId,
        company_id: id,
        variable_name: v.variable_name,
        natural_name: v.natural_name,
        category: v.category,
        data_type: v.data_type,
        is_custom: false,
        is_deleted: false,
        sort_order: sortIndex - 1,
        descriptor: JSON.parse(descriptorJson),
        created_at: now,
        updated_at: now,
      });
    }

    // Insert compound tables
    const insertedCompoundTables: Array<Record<string, unknown>> = [];
    let tableIndex = 100;

    for (const t of extraction.compound_tables) {
      const tableRowId = crypto.randomUUID();
      const category =
        t.type === "comparison_matrix"
          ? "comparison_matrix"
          : "table_loop";

      const descriptorJson = JSON.stringify({
        table_id: t.table_id,
        natural_name: t.natural_name,
        table_index: t.table_index,
        type: t.type,
        loop_tag: t.loop_tag,
        columns: t.columns || [],
        enum_options: t.enum_options || [],
        default_value: t.default_value,
        mutation: t.mutation,
      });

      insertStmt.run(
        tableRowId,
        id,
        t.table_id,
        t.natural_name,
        category,
        "table",
        0, // is_custom
        0, // is_deleted
        tableIndex++,
        descriptorJson,
        now,
        now
      );

      insertedCompoundTables.push({
        id: tableRowId,
        table_id: t.table_id,
        natural_name: t.natural_name,
        table_index: t.table_index,
        type: t.type,
        loop_tag: t.loop_tag,
        columns: t.columns || [],
        enum_options: t.enum_options || [],
        default_value: t.default_value,
        mutation: t.mutation,
        is_deleted: false,
      });
    }

    // Update working_state_json on company_sessions
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
      stage: "variable_review",
      extracted_variables: {
        document_summary: extraction.document_summary,
        extracted_at: now,
        variables_count: extraction.variables.length,
        compound_tables_count: extraction.compound_tables.length,
        variables: extraction.variables,
        compound_tables: extraction.compound_tables,
      },
    };

    const updateSessionStmt = db.prepare(`
      UPDATE company_sessions
      SET working_state_json = ?, updated_at = ?
      WHERE company_id = ?
    `);
    updateSessionStmt.run(JSON.stringify(workingState), now, id);

    res.json({
      success: true,
      company_id: id,
      document_summary: extraction.document_summary,
      extracted_count: extraction.variables.length,
      variables: insertedVariables,
      compound_tables: insertedCompoundTables,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract variables via Gemini",
    });
  }
});

// PUT /api/companies/:id/variables - Persist inline edits, category moves, paragraph modes, and soft deletions
router.put("/:id/variables", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const { variables, compound_tables } = req.body;
    let updatedCount = 0;
    const now = new Date().toISOString();

    if (Array.isArray(variables)) {
      const updateStmt = db.prepare(`
        UPDATE company_variables SET
          natural_name = COALESCE(?, natural_name),
          category = COALESCE(?, category),
          data_type = COALESCE(?, data_type),
          is_deleted = COALESCE(?, is_deleted),
          sort_order = COALESCE(?, sort_order),
          descriptor_json = COALESCE(?, descriptor_json),
          updated_at = ?
        WHERE id = ? AND company_id = ?
      `);

      for (const item of variables) {
        if (!item.id) continue;

        let descriptorJson: string | null = null;
        if (item.descriptor) {
          descriptorJson = typeof item.descriptor === "string"
            ? item.descriptor
            : JSON.stringify(item.descriptor);
        }

        const isDeleted =
          typeof item.is_deleted === "boolean"
            ? item.is_deleted ? 1 : 0
            : typeof item.is_deleted === "number"
            ? item.is_deleted
            : null;

        updateStmt.run(
          item.natural_name ?? null,
          item.category ?? null,
          item.data_type ?? null,
          isDeleted,
          item.sort_order ?? null,
          descriptorJson,
          now,
          item.id,
          id
        );
        updatedCount++;
      }
    }

    if (Array.isArray(compound_tables)) {
      const updateCompoundStmt = db.prepare(`
        UPDATE company_variables SET
          natural_name = COALESCE(?, natural_name),
          descriptor_json = COALESCE(?, descriptor_json),
          is_deleted = COALESCE(?, is_deleted),
          updated_at = ?
        WHERE id = ? AND company_id = ?
      `);

      for (const item of compound_tables) {
        if (!item.id) continue;

        let descriptorJson: string | null = null;
        if (item.descriptor) {
          descriptorJson = typeof item.descriptor === "string"
            ? item.descriptor
            : JSON.stringify(item.descriptor);
        }

        const isDeleted =
          typeof item.is_deleted === "boolean"
            ? item.is_deleted ? 1 : 0
            : typeof item.is_deleted === "number"
            ? item.is_deleted
            : null;

        updateCompoundStmt.run(
          item.natural_name ?? null,
          descriptorJson,
          isDeleted,
          now,
          item.id,
          id
        );
        updatedCount++;
      }
    }

    // Refresh working_state_json with current active variables
    const selectAllStmt = db.prepare(`
      SELECT * FROM company_variables
      WHERE company_id = ? AND is_deleted = 0
      ORDER BY sort_order ASC
    `);
    const activeRows = selectAllStmt.all(id) as unknown as VariableRow[];

    const selectCompanyStmt = db.prepare("SELECT working_state_json FROM company_sessions WHERE company_id = ?");
    const comp = selectCompanyStmt.get(id) as { working_state_json: string } | undefined;
    if (comp) {
      let ws: any = {};
      try {
        ws = JSON.parse(comp.working_state_json || "{}");
      } catch {
        ws = {};
      }
      ws.extracted_variables = {
        ...(ws.extracted_variables || {}),
        updated_at: now,
        active_count: activeRows.length,
        variables: activeRows.map(formatVariableRow),
      };

      const updateWsStmt = db.prepare("UPDATE company_sessions SET working_state_json = ?, updated_at = ? WHERE company_id = ?");
      updateWsStmt.run(JSON.stringify(ws), now, id);
    }

    res.json({
      success: true,
      updated_count: updatedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update variables",
    });
  }
});

// POST /api/companies/:id/variables/custom - AST verification and custom variable creation
router.post("/:id/variables/custom", (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const selectStmt = db.prepare("SELECT quotation_markdown FROM company_sessions WHERE company_id = ?");
    const row = selectStmt.get(id) as { quotation_markdown?: string } | undefined;

    if (!row || !row.quotation_markdown) {
      res.status(400).json({
        success: false,
        error: "Quotation markdown is missing. Please submit a briefing quotation first.",
      });
      return;
    }

    const {
      natural_name,
      category = "customer_input",
      exact_quotation_snippet,
      context_anchor,
      data_type = "string",
      description = "",
    } = req.body;

    if (!natural_name || !natural_name.trim()) {
      res.status(400).json({
        success: false,
        error: "Natural name is required for custom variable",
      });
      return;
    }

    if (!exact_quotation_snippet || !exact_quotation_snippet.trim()) {
      res.status(400).json({
        success: false,
        error: "Exact quotation snippet is required to bind custom variable to the document",
      });
      return;
    }

    // AST / Text verification against quotation_markdown with normalized whitespace
    const normalizedMarkdown = normalizeWhitespace(row.quotation_markdown);
    const normalizedSnippet = normalizeWhitespace(exact_quotation_snippet);

    if (!normalizedMarkdown.includes(normalizedSnippet)) {
      res.status(400).json({
        success: false,
        error: `Snippet "${exact_quotation_snippet}" was not found in the quotation document. Please copy exact text from the quotation.`,
      });
      return;
    }

    // Derive a clean snake_case variable name
    let cleanVarName = natural_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!cleanVarName) {
      cleanVarName = `custom_var_${Date.now()}`;
    }

    const varId = crypto.randomUUID();
    const now = new Date().toISOString();

    const descriptor = {
      sample_value: exact_quotation_snippet.trim(),
      description: description || `Custom variable bound from quotation text: "${exact_quotation_snippet.trim()}"`,
      mutation: {
        action: "replace_text_run",
        sample_text: exact_quotation_snippet.trim(),
        context_anchor: context_anchor || exact_quotation_snippet.trim(),
        template_tag: `{${cleanVarName}}`,
      },
    };

    const insertStmt = db.prepare(`
      INSERT INTO company_variables (
        id, company_id, variable_name, natural_name, category, data_type,
        is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?)
    `);

    insertStmt.run(
      varId,
      id,
      cleanVarName,
      natural_name.trim(),
      category,
      data_type,
      JSON.stringify(descriptor),
      now,
      now
    );

    const createdRecord = {
      id: varId,
      company_id: id,
      variable_name: cleanVarName,
      natural_name: natural_name.trim(),
      category,
      data_type,
      is_custom: true,
      is_deleted: false,
      sort_order: 0,
      descriptor,
      created_at: now,
      updated_at: now,
    };

    res.status(201).json({
      success: true,
      variable: createdRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to add custom variable",
    });
  }
});

export default router;
