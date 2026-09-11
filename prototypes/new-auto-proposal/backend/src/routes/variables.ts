import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { getDatabase } from "../db/database.js";
import { extractVariables } from "../services/ai-extraction.service.js";
import type { ExtractionResponse } from "../services/gemini.service.js";
import { logPipelineArtifact } from "../services/pipeline-log.js";
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

const CATEGORIES = ["customer_input", "pricing", "paragraph"];
const DATA_TYPES = ["string", "number", "currency", "enum", "paragraph"];

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

// GET /api/companies/:id/variables - Retrieve all persisted variables and loop tables
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
      if (formatted.category === "table_loop") {
        compound_tables.push({ id: formatted.id, ...formatted.descriptor, is_deleted: formatted.is_deleted });
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

    const company = db
      .prepare("SELECT * FROM company_sessions WHERE company_id = ?")
      .get(id) as unknown as CompanyRow | undefined;

    if (!company) {
      res.status(404).json({ success: false, error: `Company "${id}" not found` });
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

    const extraction: ExtractionResponse = await extractVariables({
      markdown: company.quotation_markdown,
      pricingSpec: company.pricing_spec,
      companyName: company.company_name,
      companyBasics: parsedData.company_basics || {
        company_name: company.company_name,
        location: company.location,
        email: company.email,
        phone: company.phone,
      },
      industry: company.industry,
    });
    logPipelineArtifact(id, "variables-raw.json", extraction);

    const now = new Date().toISOString();

    // Idempotent re-scan: delete previous non-custom variables, preserving user-added custom variables
    db.prepare("DELETE FROM company_variables WHERE company_id = ? AND is_custom = 0").run(id);

    const insertStmt = db.prepare(`
      INSERT INTO company_variables (
        id, company_id, variable_name, natural_name, category, data_type,
        is_custom, is_deleted, sort_order, descriptor_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `);

    const insertedVariables: ReturnType<typeof formatVariableRow>[] = [];
    extraction.variables.forEach((v, sortIndex) => {
      const varId = crypto.randomUUID();
      // Descriptor keys are what the review deck reads (sample_value, visibility_rule, paragraph_config)
      const descriptor = {
        sample_value: v.sample_text,
        description: v.description,
        context_text: v.context_text || undefined,
        enum_options: v.enum_options,
        visibility_rule: v.condition_flag ? { condition_flag: v.condition_flag } : undefined,
        paragraph_config: v.paragraph_config,
      };
      const descriptorJson = JSON.stringify(descriptor);
      insertStmt.run(varId, id, v.variable_name, v.natural_name, v.category, v.data_type, sortIndex, descriptorJson, now, now);
      insertedVariables.push({
        id: varId,
        company_id: id,
        variable_name: v.variable_name,
        natural_name: v.natural_name,
        category: v.category,
        data_type: v.data_type,
        is_custom: false,
        is_deleted: false,
        sort_order: sortIndex,
        descriptor: JSON.parse(descriptorJson),
        created_at: now,
        updated_at: now,
      });
    });

    const insertedCompoundTables: Array<Record<string, unknown>> = [];
    extraction.loop_tables.forEach((t, i) => {
      const tableRowId = crypto.randomUUID();
      const descriptor = {
        table_id: t.loop_tag,
        natural_name: t.natural_name,
        type: "repeating_loop",
        loop_tag: t.loop_tag,
        header_texts: t.header_texts,
        row_labels: t.row_labels,
        columns: t.column_tags,
      };
      insertStmt.run(tableRowId, id, t.loop_tag, t.natural_name, "table_loop", "table", 100 + i, JSON.stringify(descriptor), now, now);
      insertedCompoundTables.push({ id: tableRowId, ...descriptor, is_deleted: false });
    });

    let workingState: any = {};
    try {
      workingState = JSON.parse(company.working_state_json || "{}");
    } catch {
      workingState = {};
    }
    workingState = {
      ...workingState,
      stage: "variable_review",
      extracted_variables: {
        document_summary: extraction.document_summary,
        extracted_at: now,
        variables_count: extraction.variables.length,
        compound_tables_count: extraction.loop_tables.length,
        variables: insertedVariables,
        compound_tables: insertedCompoundTables,
      },
    };
    db.prepare("UPDATE company_sessions SET working_state_json = ?, updated_at = ? WHERE company_id = ?").run(
      JSON.stringify(workingState),
      now,
      id
    );

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
      error: error instanceof Error ? error.message : "Failed to extract variables",
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
        if (item.category != null && !CATEGORIES.includes(item.category)) {
          res.status(400).json({ success: false, error: `Unknown category "${item.category}"` });
          return;
        }

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

    if (!CATEGORIES.includes(category) || !DATA_TYPES.includes(data_type)) {
      res.status(400).json({ success: false, error: `Unknown category "${category}" or data_type "${data_type}"` });
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
      context_text: context_anchor || undefined,
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
