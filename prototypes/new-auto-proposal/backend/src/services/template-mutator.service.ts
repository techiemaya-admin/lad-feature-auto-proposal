import { Document, Table, TableRow, Paragraph } from "docxmlater";
import fs from "node:fs";
import path from "node:path";
import { getStorageDir, getDatabase } from "../db/database.js";
import type { MutationAction } from "./gemini.service.js";
import type { VariableRow } from "../routes/variables.js";

export interface MutationLogEntry {
  action: string;
  target: string;
  applied: boolean;
  info?: string;
}

export interface MutationResult {
  success: boolean;
  template_path: string;
  tags_placed_count: number;
  loops_collapsed_count: number;
  conditional_rows_wrapped_count: number;
  mutations_applied_count: number;
  details: MutationLogEntry[];
}

/**
 * Normalizes text whitespace for resilient comparison
 */
function normalizeText(text: string): string {
  return text.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Hybrid table and row locator:
 * 1. Tries candidate table_index first
 * 2. If row_identifier is not found, falls back to semantic search across all tables in the document
 */
export function findTableAndRow(
  doc: Document,
  tableIndex?: number,
  rowIdentifier?: string
): { table: Table; row: TableRow; rowIndex: number; tableIndex: number } | null {
  if (!rowIdentifier || !rowIdentifier.trim()) {
    if (tableIndex !== undefined) {
      const candidateTable = doc.getTableAt(tableIndex);
      if (candidateTable && candidateTable.getRowCount() > 0) {
        return {
          table: candidateTable,
          row: candidateTable.getRow(0)!,
          rowIndex: 0,
          tableIndex,
        };
      }
    }
    return null;
  }

  const target = normalizeText(rowIdentifier);

  // Fast path: check candidate table index
  if (tableIndex !== undefined && tableIndex >= 0) {
    const candidateTable = doc.getTableAt(tableIndex);
    if (candidateTable) {
      const rows = candidateTable.getRows();
      for (let r = 0; r < rows.length; r++) {
        if (normalizeText(rows[r].getText()).includes(target)) {
          return {
            table: candidateTable,
            row: rows[r],
            rowIndex: r,
            tableIndex,
          };
        }
      }
    }
  }

  // Fallback path: scan all tables in document
  const allTables = doc.getTables();
  for (let tIdx = 0; tIdx < allTables.length; tIdx++) {
    const table = allTables[tIdx];
    const rows = table.getRows();
    for (let r = 0; r < rows.length; r++) {
      if (normalizeText(rows[r].getText()).includes(target)) {
        return {
          table,
          row: rows[r],
          rowIndex: r,
          tableIndex: tIdx,
        };
      }
    }
  }

  return null;
}

/**
 * Replaces a text run in body paragraphs using context_anchor or sample_text
 */
export function executeReplaceTextRun(
  doc: Document,
  mutation: MutationAction,
  varName?: string
): { applied: boolean; info: string } {
  if (mutation.action !== "replace_text_run" || !mutation.sample_text) {
    return { applied: false, info: "Invalid replace_text_run mutation payload" };
  }

  let tag = mutation.template_tag || (varName ? `{${varName}}` : "");
  if (!tag.startsWith("{")) tag = `{${tag}}`;

  const sample = mutation.sample_text;
  const anchor = (mutation.context_anchor || "").trim();
  const allParagraphs = doc.getAllParagraphs();

  // 1. Try context_anchor search first
  if (anchor) {
    const normAnchor = normalizeText(anchor);
    const candidateParas = allParagraphs.filter((p) =>
      normalizeText(p.getText()).includes(normAnchor)
    );

    for (const para of candidateParas) {
      const count = para.replaceTextCrossRun(sample, tag, { caseSensitive: false });
      if (count > 0) {
        return { applied: true, info: `Replaced in anchor paragraph via cross-run (${count} match)` };
      }
    }
  }

  // 2. Fallback search across all paragraphs by sample_text
  const normSample = normalizeText(sample);
  for (const para of allParagraphs) {
    if (normalizeText(para.getText()).includes(normSample)) {
      const count = para.replaceTextCrossRun(sample, tag, { caseSensitive: false });
      if (count > 0) {
        return { applied: true, info: `Replaced across all paragraphs (${count} match)` };
      }
    }
  }

  return { applied: false, info: `No matching paragraph found for "${sample}"` };
}

/**
 * Replaces text in a specific table cell using hybrid resolution
 */
export function executeReplaceTableCell(
  doc: Document,
  mutation: MutationAction,
  varName?: string
): { applied: boolean; info: string } {
  if (mutation.action !== "replace_table_cell") {
    return { applied: false, info: "Not a replace_table_cell mutation" };
  }

  let tag = mutation.template_tag || (varName ? `{${varName}}` : "");
  if (!tag.startsWith("{")) tag = `{${tag}}`;

  const match = findTableAndRow(doc, mutation.table_index, mutation.row_identifier);
  if (!match) {
    return {
      applied: false,
      info: `Table row "${mutation.row_identifier || mutation.table_index}" not found`,
    };
  }

  const { table, row, rowIndex, tableIndex } = match;
  const colIndex = mutation.col_index ?? 1;
  const cellCount = row.getCellCount();
  const targetCol = Math.min(Math.max(0, colIndex), cellCount - 1);
  const cell = row.getCell(targetCol);

  if (!cell) {
    return { applied: false, info: `Cell at column ${targetCol} not found in row` };
  }

  // If sample_text is present, try replaceTextCrossRun within cell paragraphs first (preserves surrounding cell label text)
  if (mutation.sample_text) {
    let replacedCount = 0;
    for (const para of cell.getParagraphs()) {
      const count = para.replaceTextCrossRun(mutation.sample_text, tag, {
        caseSensitive: false,
      });
      if (count > 0) replacedCount += count;
    }
    if (replacedCount > 0) {
      return {
        applied: true,
        info: `Replaced within cell (Table ${tableIndex}, Row ${rowIndex}, Col ${targetCol})`,
      };
    }
  }

  // Fallback: replace cell text while preserving cell borders and shading
  table.setCell(rowIndex, targetCol, tag);
  return {
    applied: true,
    info: `Set cell text to "${tag}" (Table ${tableIndex}, Row ${rowIndex}, Col ${targetCol})`,
  };
}

/**
 * Wraps a calculation row across cells ({#condition_tag} in Cell 0, {/condition_tag} in last Cell)
 */
export function executeWrapConditionalRow(
  doc: Document,
  mutation: MutationAction
): { applied: boolean; info: string } {
  if (mutation.action !== "wrap_conditional_row") {
    return { applied: false, info: "Not a wrap_conditional_row mutation" };
  }

  const match = findTableAndRow(doc, mutation.table_index, mutation.row_identifier);
  if (!match) {
    return {
      applied: false,
      info: `Row "${mutation.row_identifier}" not found for conditional wrap`,
    };
  }

  const { table, row, rowIndex, tableIndex } = match;
  const cellCount = row.getCellCount();
  if (cellCount === 0) {
    return { applied: false, info: "Row has 0 cells" };
  }

  const rawTag = (mutation.condition_tag || "condition").replace(/^[#{/]+|[}]+$/g, "");
  const openTag = `{#${rawTag}}`;
  const closeTag = `{/${rawTag}}`;

  // Cell 0: Prepend opening condition tag
  const cell0 = row.getCell(0);
  if (cell0) {
    const text0 = cell0.getText().trim();
    if (!text0.includes(openTag)) {
      table.setCell(rowIndex, 0, `${openTag} ${text0}`.trim());
    }
  }

  // Last Cell: Append closing condition tag
  const lastCol = cellCount - 1;
  const lastCell = row.getCell(lastCol);
  if (lastCell) {
    const lastText = lastCell.getText().trim();
    if (!lastText.includes(closeTag)) {
      table.setCell(rowIndex, lastCol, `${lastText} ${closeTag}`.trim());
    }
  }

  // Process explicit cell overrides if provided in mutation.cells
  if (mutation.cells && Array.isArray(mutation.cells)) {
    for (const c of mutation.cells) {
      if (c.col_index >= 0 && c.col_index < cellCount) {
        if (!c.preserve_existing_label && c.template_tag) {
          table.setCell(rowIndex, c.col_index, c.template_tag);
        }
      }
    }
  }

  return {
    applied: true,
    info: `Wrapped row ${rowIndex} with ${openTag}...${closeTag} in Table ${tableIndex}`,
  };
}

/**
 * Collapses a repeating line-item table into a single loop row:
 * - Row 0: Preserved as header
 * - Row 1: Converted to {#items}...{/items} loop row
 * - Redundant sample rows: Pruned in reverse order
 * - Summary footers (Subtotal, Tax, Total, Terms): Strictly preserved
 */
export function executeCollapseRepeatingTable(
  doc: Document,
  mutation: MutationAction,
  compoundTable?: any
): { applied: boolean; info: string } {
  if (mutation.action !== "collapse_repeating_table") {
    return { applied: false, info: "Not a collapse_repeating_table mutation" };
  }

  let targetTable: Table | undefined;
  let targetIndex = mutation.table_index ?? -1;

  if (targetIndex >= 0) {
    targetTable = doc.getTableAt(targetIndex);
  }

  // Fallback: discover table with >= 3 rows if index was offset
  if (!targetTable) {
    const tables = doc.getTables();
    for (let i = 0; i < tables.length; i++) {
      if (tables[i].getRowCount() >= 3) {
        targetTable = tables[i];
        targetIndex = i;
        break;
      }
    }
  }

  if (!targetTable || targetTable.getRowCount() <= 1) {
    return { applied: false, info: "Candidate repeating table not found or has <= 1 rows" };
  }

  const loopTag = (mutation.loop_tag || compoundTable?.loop_tag || "items").replace(
    /^[#{/]+|[}]+$/g,
    ""
  );
  const openTag = `{#${loopTag}}`;
  const closeTag = `{/${loopTag}}`;

  const templateRowIndex = mutation.template_row_index ?? 1;
  if (templateRowIndex >= targetTable.getRowCount()) {
    return { applied: false, info: `Template row index ${templateRowIndex} out of bounds` };
  }

  const row1 = targetTable.getRow(templateRowIndex);
  if (!row1) return { applied: false, info: "Template row 1 not accessible" };
  const colCount = row1.getCellCount();

  // Apply column replacement tags if specified
  if (mutation.column_tags && mutation.column_tags.length > 0) {
    for (const ct of mutation.column_tags) {
      if (ct.col_index >= 0 && ct.col_index < colCount) {
        const cleanTag = ct.replacement_tag.startsWith("{")
          ? ct.replacement_tag
          : `{${ct.replacement_tag}}`;
        targetTable.setCell(templateRowIndex, ct.col_index, cleanTag);
      }
    }
  } else if (compoundTable?.columns && Array.isArray(compoundTable.columns)) {
    compoundTable.columns.forEach((col: any, idx: number) => {
      if (idx < colCount) {
        const colName = typeof col === "string" ? col : col.name || `col_${idx}`;
        const cleanName = colName.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
        targetTable!.setCell(templateRowIndex, idx, `{${cleanName}}`);
      }
    });
  }

  // Inject loop tags: opening in Cell 0, closing in last Cell of template row
  const cell0 = targetTable.getCell(templateRowIndex, 0);
  const cell0Text = cell0?.getText().trim() || "";
  if (!cell0Text.includes(openTag)) {
    targetTable.setCell(templateRowIndex, 0, `${openTag}${cell0Text}`);
  }

  const lastCol = colCount - 1;
  const lastCell = targetTable.getCell(templateRowIndex, lastCol);
  const lastCellText = lastCell?.getText().trim() || "";
  if (!lastCellText.includes(closeTag)) {
    targetTable.setCell(templateRowIndex, lastCol, `${lastCellText}${closeTag}`);
  }

  // Identify where summary footers start
  const deleteStartFrom = mutation.delete_sample_rows_from ?? 2;
  const summaryKeywords = [
    "subtotal",
    "tax",
    "total",
    "payment terms",
    "terms",
    "due",
    "balance",
  ];
  let summaryStartIndex = targetTable.getRowCount();

  for (let r = deleteStartFrom; r < targetTable.getRowCount(); r++) {
    const rowText = normalizeText(targetTable.getRow(r)?.getText() || "");
    if (summaryKeywords.some((kw) => rowText.includes(kw))) {
      summaryStartIndex = r;
      break;
    }
  }

  // Reverse-order deletion to preserve row indices and summary footers
  const lastSampleRowIndex = summaryStartIndex - 1;
  let deletedCount = 0;
  if (lastSampleRowIndex >= deleteStartFrom) {
    for (let r = lastSampleRowIndex; r >= deleteStartFrom; r--) {
      const removed = targetTable.removeRow(r);
      if (removed) deletedCount++;
    }
  }

  return {
    applied: true,
    info: `Collapsed Table ${targetIndex}: Row 1 wrapped with ${openTag}...${closeTag}, pruned ${deletedCount} sample rows (Rows ${deleteStartFrom}..${lastSampleRowIndex}) in reverse order`,
  };
}

/**
 * Main Orchestrator:
 * Ingests original quotation .docx, applies all confirmed mutations in-memory,
 * and saves template.docx into storage/<company_id>/template.docx.
 */
export async function mutateDocumentTemplate(companyId: string): Promise<MutationResult> {
  const db = getDatabase();
  const storageDir = getStorageDir();
  const companyDir = path.join(storageDir, companyId);
  const sourceFilePath = path.join(companyDir, "original_quotation.docx");
  const targetFilePath = path.join(companyDir, "template.docx");

  // Verify or locate original_quotation.docx
  let docBuffer: Buffer;
  if (fs.existsSync(sourceFilePath)) {
    docBuffer = fs.readFileSync(sourceFilePath);
  } else {
    // Check Mock Data fallback
    const mockFileMap: Record<string, string> = {
      co1_seo: "Proposal_Northstar_BloomAndCo.docx",
      co2_msp: "Proposal_FortressIT_WhitfieldAssociates.docx",
      co3_dev: "Proposal_Fieldstone_RosewoodHomeGoods.docx",
    };
    const mockFilename = mockFileMap[companyId];
    if (!mockFilename) {
      throw new Error(`Original quotation document not found for company "${companyId}"`);
    }

    const candidateMockDirs = [
      path.resolve(process.cwd(), "Mock Data/docx"),
      path.resolve(process.cwd(), "../Mock Data/docx"),
      path.resolve(process.cwd(), "prototypes/new-auto-proposal/Mock Data/docx"),
    ];
    const foundDir = candidateMockDirs.find((d) => fs.existsSync(path.join(d, mockFilename)));
    if (!foundDir) {
      throw new Error(`Quotation file "${mockFilename}" not found in storage or Mock Data.`);
    }

    const mockPath = path.join(foundDir, mockFilename);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    fs.copyFileSync(mockPath, sourceFilePath);
    docBuffer = fs.readFileSync(sourceFilePath);
  }

  // Load document into docxmlater DOM
  const doc = await Document.loadFromBuffer(docBuffer);

  // Retrieve confirmed active variables and compound tables
  const varStmt = db.prepare(`
    SELECT * FROM company_variables
    WHERE company_id = ? AND is_deleted = 0
    ORDER BY sort_order ASC, created_at ASC
  `);
  const rows = varStmt.all(companyId) as unknown as VariableRow[];

  let tagsPlacedCount = 0;
  let loopsCollapsedCount = 0;
  let conditionalRowsWrappedCount = 0;
  let mutationsAppliedCount = 0;
  const details: MutationLogEntry[] = [];

  for (const row of rows) {
    let descriptor: any = {};
    try {
      descriptor = JSON.parse(row.descriptor_json);
    } catch {
      descriptor = {};
    }

    const mutation: MutationAction | undefined = descriptor.mutation;
    if (!mutation || !mutation.action) continue;

    let applied = false;
    let info = "";

    switch (mutation.action) {
      case "replace_text_run": {
        const res = executeReplaceTextRun(doc, mutation, row.variable_name);
        applied = res.applied;
        info = res.info;
        if (applied) {
          tagsPlacedCount++;
          mutationsAppliedCount++;
        }
        break;
      }

      case "replace_table_cell": {
        const res = executeReplaceTableCell(doc, mutation, row.variable_name);
        applied = res.applied;
        info = res.info;
        if (applied) {
          tagsPlacedCount++;
          mutationsAppliedCount++;
        }
        break;
      }

      case "wrap_conditional_row": {
        const res = executeWrapConditionalRow(doc, mutation);
        applied = res.applied;
        info = res.info;
        if (applied) {
          conditionalRowsWrappedCount++;
          mutationsAppliedCount++;
        }
        break;
      }

      case "collapse_repeating_table": {
        const res = executeCollapseRepeatingTable(doc, mutation, descriptor);
        applied = res.applied;
        info = res.info;
        if (applied) {
          loopsCollapsedCount++;
          mutationsAppliedCount++;
        }
        break;
      }

      default:
        info = `Unknown mutation action: ${(mutation as any).action}`;
        break;
    }

    details.push({
      action: mutation.action,
      target: row.natural_name || row.variable_name,
      applied,
      info,
    });
  }

  // Save modified document to disk
  const mutatedBuffer = await doc.toBuffer();
  fs.writeFileSync(targetFilePath, mutatedBuffer);

  const relativePath = path.relative(process.cwd(), targetFilePath).replace(/\\/g, "/");

  return {
    success: true,
    template_path: relativePath,
    tags_placed_count: tagsPlacedCount,
    loops_collapsed_count: loopsCollapsedCount,
    conditional_rows_wrapped_count: conditionalRowsWrappedCount,
    mutations_applied_count: mutationsAppliedCount,
    details,
  };
}
