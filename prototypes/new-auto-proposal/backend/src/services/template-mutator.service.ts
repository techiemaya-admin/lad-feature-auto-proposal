import { Document, Table, TableRow, Paragraph } from "docxmlater";
import fs from "node:fs";
import path from "node:path";
import { TemplateHandler } from "easy-template-x";
import { getStorageDir, getDatabase } from "../db/database.js";
import type { MutationAction } from "./gemini.service.js";
import type { VariableRow } from "../routes/variables.js";

export interface CollapseTableOptions {
  tableIndex?: number;
  rowIdentifier?: string;
  loopTag: string;
  templateRowIndex?: number;
  columnTags?: Array<{ col_index: number; replacement_tag: string }>;
  deleteSampleRowsFrom?: number;
  deleteSampleRowsCount?: number;
}

export interface ProposalHydrationPayload {
  client_name?: string;
  proposal_date?: string;
  proposal_valid_until?: string;
  selected_tier?: string;

  // Repeating Milestones Loop
  milestones?: Array<{
    phase_number?: number | string;
    milestone_title?: string;
    deliverable_summary?: string;
    [key: string]: any;
  }>;

  // Repeating Add-ons Loop
  has_addons?: boolean;
  addon_items?: Array<{
    addon_name?: string;
    addon_fee?: string;
    [key: string]: any;
  }>;
  has_bundle_discount?: boolean;
  bundle_discount_amount?: string;

  // Repeating Payment Schedule Loop
  payment_milestones?: Array<{
    milestone_name?: string;
    trigger_description?: string;
    payment_amount?: string;
    [key: string]: any;
  }>;

  // Financial Summary
  subtotal_amount?: string;
  has_tax?: boolean;
  tax_amount?: string;
  total_investment_amount?: string;
  [key: string]: any;
}

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
 * Detects whether a table row functions as a column header row.
 * Checks for Word's native isHeader flag, common column header tokens (Date, Amount, Line Item, Phase, etc.),
 * and tier package headers (Standard, Growth, Essential, etc.).
 */
export function isColumnHeaderRow(row: TableRow | null | undefined): boolean {
  if (!row) return false;
  if (row.getFormatting()?.isHeader) return true;

  const cellCount = row.getCellCount();
  if (cellCount === 0) return false;

  const text = normalizeText(row.getText());
  if (!text) return false;

  // Known column header titles and comparison tier packages
  const headerKeywords = [
    "date",
    "prepared by",
    "proposal valid until",
    "valid until",
    "line item",
    "amount",
    "phase",
    "milestone",
    "deliverable",
    "trigger",
    "description",
    "unit price",
    "quantity",
    "total investment",
    "essential",
    "standard",
    "premium",
    "local",
    "growth",
    "authority",
  ];

  // If cells contain numbers or currency values, it's typically a data row (e.g. "Total employees / seats | 42" or "$3,150.00")
  const cells = row.getCells();
  const hasPureNumericCell = cells.some((c) => {
    const cText = c.getText().trim();
    return /^\d+$/.test(cText) || /^\$[\d,]+(\.\d{2})?$/.test(cText);
  });

  if (hasPureNumericCell) {
    return false;
  }

  return headerKeywords.some((kw) => text.includes(kw));
}

/**
 * Verifies whether Table Row 0 matches expected column header tokens semantically.
 */
export function tableMatchesHeaders(
  table: Table,
  expectedHeaders: string[] | string
): boolean {
  if (table.getRowCount() === 0) return false;
  const row0Text = normalizeText(table.getRow(0)?.getText() || "");
  if (!row0Text) return false;

  const tokens: string[] = Array.isArray(expectedHeaders)
    ? expectedHeaders.map(normalizeText).filter(Boolean)
    : expectedHeaders
        .split(/[|,;\t\n]+/)
        .map(normalizeText)
        .filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.every((tok) => row0Text.includes(tok));
}

export interface FindTableAndRowOptions {
  allowHeaderRow?: boolean;
  templateRowIndex?: number;
  expectedHeaders?: string[] | string;
}

/**
 * Checks whether a variable name or template tag represents a high-entropy entity (e.g. client or company name)
 */
function isHighEntropyEntity(varName?: string, tag?: string): boolean {
  const candidate = (varName || tag || "").replace(/[{}]/g, "").trim().toLowerCase();
  if (!candidate) return false;
  return (
    candidate === "client_name" ||
    candidate === "client_company_name" ||
    candidate === "company_name" ||
    candidate === "customer_name" ||
    candidate === "client_business_name" ||
    candidate === "prospective_client_name" ||
    candidate.endsWith("_client_name") ||
    candidate.endsWith("_company_name")
  );
}

/**
 * Hybrid table and row locator:
 * 1. Verifies candidate table_index against expectedHeaders semantically, falling back to all tables
 * 2. If row_identifier is not found, falls back to semantic search across all tables in the document
 * 3. Defaults allowHeaderRow to false, permanently protecting Row 0 from being targeted as a data row
 */
export function findTableAndRow(
  doc: Document,
  tableIndex?: number,
  rowIdentifier?: string,
  options?: FindTableAndRowOptions
): { table: Table; row: TableRow; rowIndex: number; tableIndex: number } | null {
  const allowHeader = options?.allowHeaderRow ?? false;
  const expectedHeaders = options?.expectedHeaders;
  const allTables = doc.getTables();

  // 1. Semantic header table resolution if expectedHeaders provided
  let targetTable: Table | undefined;
  let resolvedTableIndex = tableIndex;

  if (expectedHeaders) {
    // Check candidate tableIndex first
    if (tableIndex !== undefined && tableIndex >= 0 && tableIndex < allTables.length) {
      if (tableMatchesHeaders(allTables[tableIndex], expectedHeaders)) {
        targetTable = allTables[tableIndex];
        resolvedTableIndex = tableIndex;
      }
    }
    // If not matched at tableIndex, scan all tables in the document
    if (!targetTable) {
      for (let i = 0; i < allTables.length; i++) {
        if (tableMatchesHeaders(allTables[i], expectedHeaders)) {
          targetTable = allTables[i];
          resolvedTableIndex = i;
          break;
        }
      }
    }
  } else if (tableIndex !== undefined && tableIndex >= 0 && tableIndex < allTables.length) {
    targetTable = allTables[tableIndex];
    resolvedTableIndex = tableIndex;
  }

  // 2. If row_identifier is absent or empty, respect template_row_index (never Row 0 when !allowHeader)
  if (!rowIdentifier || !rowIdentifier.trim()) {
    const table =
      targetTable ||
      (tableIndex !== undefined && tableIndex >= 0 ? doc.getTableAt(tableIndex) : undefined);
    const tIdx = resolvedTableIndex ?? tableIndex ?? 0;

    if (table && table.getRowCount() > 0) {
      const rowCount = table.getRowCount();
      let targetRowIdx: number;

      if (!allowHeader) {
        if (options?.templateRowIndex !== undefined && options.templateRowIndex > 0) {
          targetRowIdx = options.templateRowIndex;
        } else {
          targetRowIdx = 1;
        }
        if (targetRowIdx >= rowCount) {
          return null;
        }
      } else {
        targetRowIdx = options?.templateRowIndex ?? 0;
        if (targetRowIdx >= rowCount) {
          targetRowIdx = 0;
        }
      }

      const row = table.getRow(targetRowIdx);
      if (row) {
        return { table, row, rowIndex: targetRowIdx, tableIndex: tIdx };
      }
    }
    return null;
  }

  // 3. Search by rowIdentifier
  const target = normalizeText(rowIdentifier);

  const scanTable = (table: Table, tIdx: number) => {
    const rows = table.getRows();
    if (rows.length === 0) return null;

    // First pass: Scan data rows (1..N) first
    for (let r = 1; r < rows.length; r++) {
      if (normalizeText(rows[r].getText()).includes(target)) {
        return {
          table,
          row: rows[r],
          rowIndex: r,
          tableIndex: tIdx,
        };
      }
    }

    // Second pass: Check Row 0 only if allowHeader is true, OR if Row 0 is NOT a column header row (e.g. key-value table)
    const row0 = rows[0];
    const isColHeader = isColumnHeaderRow(row0);

    if (allowHeader || !isColHeader) {
      if (normalizeText(row0.getText()).includes(target)) {
        return {
          table,
          row: row0,
          rowIndex: 0,
          tableIndex: tIdx,
        };
      }
    }

    return null;
  };

  // Check targetTable / candidate table first
  if (targetTable && resolvedTableIndex !== undefined) {
    const match = scanTable(targetTable, resolvedTableIndex);
    if (match) return match;
  }

  // Fallback path: scan all tables in document
  for (let tIdx = 0; tIdx < allTables.length; tIdx++) {
    if (targetTable && tIdx === resolvedTableIndex) continue;
    const match = scanTable(allTables[tIdx], tIdx);
    if (match) return match;
  }

  return null;
}

/**
 * Replaces text runs in body paragraphs using two-tier replacement logic:
 * 1. High-Entropy Entities (client_name, client_company_name): Replaced globally across all paragraphs without early stopping.
 * 2. Low-Entropy Terms (Numbers, Enums, Currency): Scoped to context_anchor paragraphs using strict regex word boundaries (\b).
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

  // Tier 0: Multi-bullet scope / narrative list container detection and collapsing
  const isExplicitScopeVar =
    varName === "scope_deliverables_summary" ||
    varName === "scope_inclusions_narrative" ||
    tag.includes("scope_deliverables_summary") ||
    tag.includes("scope_inclusions_narrative");

  const isMultiLineBullet =
    /\r?\n\s*[-*•]\s+/.test(sample) ||
    (sample.split(/\r?\n/).filter(Boolean).length > 1 && /^\s*[-*•]\s+/.test(sample));

  const isListContainer = isExplicitScopeVar || isMultiLineBullet;

  if (isListContainer) {
    const lines = sample.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const firstBulletText = (lines[0] || sample)
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();
    const normFirstBullet = normalizeText(firstBulletText);

    const bodyElements = (doc as any).bodyElements as any[];
    let targetIndex = -1;
    let targetPara: Paragraph | undefined;

    if (bodyElements && Array.isArray(bodyElements)) {
      for (let i = 0; i < bodyElements.length; i++) {
        const el = bodyElements[i];
        if (el instanceof Paragraph) {
          const text = normalizeText(el.getText());
          if (normFirstBullet && text.includes(normFirstBullet)) {
            targetPara = el;
            targetIndex = i;
            break;
          }
        }
      }
    }

    if (targetPara && targetIndex >= 0) {
      const listNumId = targetPara.getNumbering()?.numId;
      targetPara.clearContent();
      targetPara.addText(tag);
      targetPara.removeNumbering();

      const toPrune: Paragraph[] = [];
      for (let j = targetIndex + 1; j < bodyElements.length; j++) {
        const sibling = bodyElements[j];
        if (!(sibling instanceof Paragraph)) {
          // Reached a Table or non-Paragraph element -> boundary reached
          break;
        }

        const sText = sibling.getText().trim();
        const sNorm = normalizeText(sText);

        const isNumberedSection = /^\s*\d{2}\s+[A-Z]/.test(sText);
        const isKnownSection =
          sNorm.startsWith("your investment") ||
          sNorm.startsWith("payment schedule") ||
          sNorm.startsWith("next steps") ||
          sNorm.startsWith("room to grow") ||
          sNorm.startsWith("total project");

        const headingLvl =
          typeof (sibling as any).detectHeadingLevel === "function"
            ? (sibling as any).detectHeadingLevel()
            : null;
        const styleName = (sibling as any).getStyle?.() || (sibling.getFormatting() as any)?.style || "";
        const isHeading =
          headingLvl !== null ||
          styleName.toLowerCase().includes("heading") ||
          isNumberedSection ||
          isKnownSection;

        if (isHeading) {
          break;
        }

        const hasSameNumId = listNumId !== undefined && sibling.getNumbering()?.numId === listNumId;
        const isNumberedListContinuation = listNumId !== undefined && sibling.getNumbering()?.numId !== undefined;
        const hasBulletPrefix = /^[-*•]\s+/.test(sText);

        if (hasSameNumId || isNumberedListContinuation || hasBulletPrefix) {
          toPrune.push(sibling);
        } else {
          const matchesSampleLine = lines.some((l) => {
            const cleanLine = l.replace(/^[-*•]\s*/, "").trim();
            return cleanLine && sNorm.includes(normalizeText(cleanLine));
          });
          if (matchesSampleLine) {
            toPrune.push(sibling);
          } else {
            break;
          }
        }
      }

      for (const p of toPrune) {
        doc.removeParagraph(p);
      }

      return {
        applied: true,
        info: `Collapsed scope container into "${tag}" and pruned ${toPrune.length} sibling bullet paragraphs`,
      };
    }
  }

  // Tier 1: High-Entropy Entities (client_name, client_company_name) -> Global replacement across all paragraphs
  if (isHighEntropyEntity(varName, tag)) {
    let globalReplacements = 0;
    const normSample = normalizeText(sample);

    for (const para of allParagraphs) {
      if (normalizeText(para.getText()).includes(normSample)) {
        const count = para.replaceTextCrossRun(sample, tag, { caseSensitive: false });
        if (count > 0) {
          globalReplacements += count;
        }
      }
    }

    if (globalReplacements > 0) {
      return {
        applied: true,
        info: `Replaced entity "${sample}" globally across ${globalReplacements} occurrence(s) in document`,
      };
    }

    return { applied: false, info: `No matching paragraph found for entity "${sample}"` };
  }

  // Tier 2: Low-Entropy Terms (enums, numbers, currency) -> Scoped by context_anchor with strict word boundaries (\b)
  const escaped = sample.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isStartWordChar = /^\w/.test(sample);
  const isEndWordChar = /\w$/.test(sample);
  const prefixBoundary = isStartWordChar ? "\\b" : "";
  const suffixBoundary = isEndWordChar ? "\\b" : "";
  const wordRegex = new RegExp(`${prefixBoundary}${escaped}${suffixBoundary}`, "i");

  // Determine candidate paragraphs
  let candidateParas = allParagraphs;
  if (anchor) {
    const normAnchor = normalizeText(anchor);
    const matched = allParagraphs.filter((p) =>
      normalizeText(p.getText()).includes(normAnchor)
    );
    if (matched.length > 0) {
      candidateParas = matched;
    }
  }

  let wordReplacements = 0;
  for (const para of candidateParas) {
    if (!wordRegex.test(para.getText())) continue;

    let count = 0;
    if (isStartWordChar && isEndWordChar) {
      count = para.replaceText(sample, tag, { caseSensitive: false, wholeWord: true });
      if (count === 0) {
        para.consolidateRuns();
        count = para.replaceText(sample, tag, { caseSensitive: false, wholeWord: true });
      }
    } else {
      count = para.replaceTextCrossRun(sample, tag, { caseSensitive: false });
    }

    if (count > 0) {
      wordReplacements += count;
    }
  }

  if (wordReplacements > 0) {
    return {
      applied: true,
      info: `Replaced low-entropy term "${sample}" with word boundary (${wordReplacements} match)`,
    };
  }

  return { applied: false, info: `No matching word-bounded paragraph found for "${sample}"` };
}

/**
 * Replaces text in a specific table cell using hybrid resolution:
 * - When sample_text is supplied, it must match within the targeted cell or adjacent data cells in the same row.
 * - If no match is found, cell text is preserved, applied: false is returned, and a warning is logged.
 * - Direct cell substitution (table.setCell) is strictly limited to cases where sample_text was omitted and Col 0 matched row_identifier.
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
  if (!tag.startsWith("{") && !tag.includes("{")) tag = `{${tag}}`;

  const match = findTableAndRow(doc, mutation.table_index, mutation.row_identifier, {
    allowHeaderRow: false,
    templateRowIndex: mutation.template_row_index,
    expectedHeaders: mutation.expected_headers,
  });

  if (!match) {
    return {
      applied: false,
      info: `Table data row "${mutation.row_identifier || mutation.table_index}" not found`,
    };
  }

  const { table, row, rowIndex, tableIndex } = match;

  // Header Protection: Refuse to mutate column header row 0
  if (rowIndex === 0 && isColumnHeaderRow(row)) {
    return {
      applied: false,
      info: `Safety guard: Refusing to mutate column header row 0 in Table ${tableIndex}`,
    };
  }

  const cellCount = row.getCellCount();
  const colIndex = mutation.col_index ?? 1;
  let targetCol = Math.min(Math.max(0, colIndex), cellCount - 1);

  // Smart column selection if col_index was not provided and sample_text is in another column
  if (mutation.col_index === undefined && mutation.sample_text) {
    const normSample = normalizeText(mutation.sample_text);
    for (let c = 0; c < cellCount; c++) {
      const candidateCell = row.getCell(c);
      if (candidateCell && normalizeText(candidateCell.getText()).includes(normSample)) {
        targetCol = c;
        break;
      }
    }
  }

  const cell = row.getCell(targetCol);
  if (!cell) {
    return { applied: false, info: `Cell at column ${targetCol} not found in row` };
  }

  // Case A: Sample text provided -> strict match-or-fail contract
  if (mutation.sample_text) {
    // 1. Check primary targeted cell
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
        info: `Replaced snippet in Table ${tableIndex}, Row ${rowIndex}, Col ${targetCol} (${replacedCount} matches)`,
      };
    }

    // 2. Check adjacent data cells in that specific row
    const normSample = normalizeText(mutation.sample_text);
    for (let c = 0; c < cellCount; c++) {
      if (c === targetCol) continue;
      const adjacentCell = row.getCell(c);
      if (adjacentCell && normalizeText(adjacentCell.getText()).includes(normSample)) {
        let adjReplaced = 0;
        for (const para of adjacentCell.getParagraphs()) {
          const count = para.replaceTextCrossRun(mutation.sample_text, tag, {
            caseSensitive: false,
          });
          if (count > 0) adjReplaced += count;
        }
        if (adjReplaced > 0) {
          return {
            applied: true,
            info: `Replaced snippet in adjacent Table ${tableIndex}, Row ${rowIndex}, Col ${c} (${adjReplaced} matches)`,
          };
        }
      }
    }

    // Strict non-destructive contract: Preserve cell text, return applied: false, and log warning
    console.warn(
      `[template-mutator] Sample text "${mutation.sample_text}" not found in Table ${tableIndex} Row ${rowIndex}. Preserving original cell text.`
    );
    return {
      applied: false,
      info: `Sample text "${mutation.sample_text}" not found in Table ${tableIndex}, Row ${rowIndex}; preserved original cell text`,
    };
  }

  // Case B: Direct cell substitution (permitted ONLY when sample_text was omitted and Col 0 matched row_identifier)
  const cell0Text = row.getCell(0)?.getText() || "";
  const rowIdMatchesCol0 =
    mutation.row_identifier &&
    normalizeText(cell0Text).includes(normalizeText(mutation.row_identifier));

  if (rowIdMatchesCol0 && (!isColumnHeaderRow(row) || rowIndex > 0)) {
    table.setCell(rowIndex, targetCol, tag);
    return {
      applied: true,
      info: `Set cell text to "${tag}" in Table ${tableIndex}, Row ${rowIndex}, Col ${targetCol}`,
    };
  }

  return {
    applied: false,
    info: `Direct cell substitution rejected: sample_text omitted and no verified row_identifier match on Col 0`,
  };
}

/**
 * Wraps a calculation row across cells ({#condition_tag} in Cell 0, {/condition_tag} in last Cell)
 */
export function executeWrapConditionalRow(
  doc: Document,
  mutation: MutationAction,
  fallbackConditionTag?: string
): { applied: boolean; info: string } {
  if (mutation.action !== "wrap_conditional_row") {
    return { applied: false, info: "Not a wrap_conditional_row mutation" };
  }

  const match = findTableAndRow(doc, mutation.table_index, mutation.row_identifier, {
    allowHeaderRow: false,
  });

  if (!match) {
    return {
      applied: false,
      info: `Data row "${mutation.row_identifier}" not found for conditional wrap`,
    };
  }

  const { table, row, rowIndex, tableIndex } = match;

  if (rowIndex === 0) {
    return {
      applied: false,
      info: `Safety guard: Refusing to wrap header row 0 in Table ${tableIndex}`,
    };
  }

  const cellCount = row.getCellCount();
  if (cellCount === 0) {
    return { applied: false, info: "Row has 0 cells" };
  }

  const rawTag = (
    mutation.condition_tag ||
    fallbackConditionTag ||
    "condition"
  ).replace(/^[#{/]+|[}]+$/g, "");
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
    info: `Safely wrapped data row ${rowIndex} with ${openTag}...${closeTag} in Table ${tableIndex}`,
  };
}

/**
 * Collapses a repeating line-item or mid-table add-on section into a single loop row:
 * - Row 0 / prior rows: Preserved
 * - Target row: Converted to {#loop_tag}...{/loop_tag} loop row
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

  // Find table via candidate index or row identifier
  let targetTable: Table | undefined;
  let targetIndex = mutation.table_index ?? -1;

  const match = findTableAndRow(doc, mutation.table_index, mutation.row_identifier, {
    allowHeaderRow: true,
  });

  if (match) {
    targetTable = match.table;
    targetIndex = match.tableIndex;
  } else if (mutation.table_index !== undefined && mutation.table_index >= 0) {
    targetTable = doc.getTableAt(mutation.table_index);
  }

  // Fallback: discover table with >= 2 rows if index was offset or not found
  if (!targetTable) {
    const tables = doc.getTables();
    for (let i = 0; i < tables.length; i++) {
      if (tables[i].getRowCount() >= 2) {
        targetTable = tables[i];
        targetIndex = i;
        break;
      }
    }
  }

  if (!targetTable) {
    return { applied: false, info: "Table not found for repeating collapse" };
  }

  const rowCount = targetTable.getRowCount();
  if (rowCount < 2) {
    return { applied: false, info: "Table has fewer than 2 rows; cannot collapse" };
  }

  const loopTag = (mutation.loop_tag || compoundTable?.loop_tag || "items").replace(
    /^[#{/]+|[}]+$/g,
    ""
  );
  const openTag = `{#${loopTag}}`;
  const closeTag = `{/${loopTag}}`;

  let templateRowIdx = mutation.template_row_index;
  if (templateRowIdx === undefined) {
    if (match && match.rowIndex > 0) {
      templateRowIdx = match.rowIndex;
    } else if (loopTag === "addon_items" || loopTag.includes("addon")) {
      // Auto-resolve to first add-on data row in table (excluding summary rows)
      const rows = targetTable.getRows();
      for (let r = 1; r < rows.length; r++) {
        const text = normalizeText(rows[r].getText());
        if (
          (text.includes("add-on") || text.includes("addon")) &&
          !text.includes("subtotal") &&
          !text.includes("discount") &&
          !text.includes("total")
        ) {
          templateRowIdx = r;
          break;
        }
      }
    }
  }
  if (templateRowIdx === undefined || templateRowIdx <= 0) {
    templateRowIdx = 1;
  }

  const targetRow = targetTable.getRow(templateRowIdx);

  if (!targetRow) {
    return { applied: false, info: `Template row index ${templateRowIdx} not found in table` };
  }

  const cellCount = targetRow.getCellCount();

  // 1. InRow Loop Boundary Placement & Dynamic Column Tag Replacement
  if (mutation.column_tags && Array.isArray(mutation.column_tags) && mutation.column_tags.length > 0) {
    for (const col of mutation.column_tags) {
      if (col.col_index >= 0 && col.col_index < cellCount) {
        let tag = col.replacement_tag.trim();
        if (!tag.startsWith("{") && !tag.includes("{")) tag = `{${tag}}`;
        targetTable.setCell(templateRowIdx, col.col_index, tag);
      }
    }
  } else {
    // Derive from compoundTable.columns or intelligent defaults
    let columns = compoundTable?.columns;
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      if (loopTag === "project_phases" || loopTag === "milestones" || targetIndex === 1) {
        columns = ["phase_number", "milestone_title", "deliverable_summary"];
      } else if (loopTag === "addon_items" || loopTag.includes("addon")) {
        columns = ["addon_name", "addon_fee"];
      } else if (loopTag === "payment_milestones" || targetIndex === 3) {
        columns = ["milestone_name", "trigger_description", "payment_amount"];
      }
    }

    if (columns && Array.isArray(columns)) {
      const canonicalTagMap: Record<string, string> = {
        phase: "phase_number",
        phase_number: "phase_number",
        milestone: "milestone_title",
        milestone_title: "milestone_title",
        milestone_name: "milestone_name",
        deliverable: "deliverable_summary",
        deliverable_summary: "deliverable_summary",
        description: "deliverable_summary",
        line_item: "addon_name",
        item: "addon_name",
        addon_name: "addon_name",
        amount: loopTag === "payment_milestones" ? "payment_amount" : "addon_fee",
        fee: "addon_fee",
        addon_fee: "addon_fee",
        trigger: "trigger_description",
        trigger_description: "trigger_description",
        payment_amount: "payment_amount",
      };

      columns.forEach((col: any, idx: number) => {
        if (idx < cellCount) {
          const rawName = typeof col === "string" ? col : col.name || `col_${idx}`;
          const cleanKey = rawName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").trim();
          const canonical = canonicalTagMap[cleanKey] || cleanKey;
          targetTable!.setCell(templateRowIdx, idx, `{${canonical}}`);
        }
      });
    }
  }

  // Inject opening loop tag into first cell
  const firstCell = targetRow.getCell(0);
  const firstCellText = firstCell?.getText().trim() || "";
  if (!firstCellText.includes(openTag)) {
    const separator = firstCellText.startsWith("{") ? "" : " ";
    targetTable.setCell(templateRowIdx, 0, `${openTag}${separator}${firstCellText}`.trim());
  }

  // Inject closing loop tag into last cell
  const lastColIdx = cellCount - 1;
  const lastCell = targetRow.getCell(lastColIdx);
  const lastCellText = lastCell?.getText().trim() || "";
  if (!lastCellText.includes(closeTag)) {
    const separator = lastCellText.endsWith("}") ? "" : " ";
    targetTable.setCell(templateRowIdx, lastColIdx, `${lastCellText}${separator}${closeTag}`.trim());
  }

  // 2. Reverse-Order Redundant Sample Row Deletion
  const deleteFrom = mutation.delete_sample_rows_from ?? (templateRowIdx + 1);
  let deleteUntil = targetTable.getRowCount();

  if (mutation.delete_sample_rows_count !== undefined) {
    deleteUntil = Math.min(targetTable.getRowCount(), deleteFrom + mutation.delete_sample_rows_count);
  } else if (compoundTable?.summary_start_index !== undefined) {
    deleteUntil = compoundTable.summary_start_index;
  } else {
    const summaryKeywords = [
      "subtotal",
      "tax",
      "total",
      "payment terms",
      "terms",
      "due",
      "balance",
    ];
    for (let r = deleteFrom; r < targetTable.getRowCount(); r++) {
      const rowText = normalizeText(targetTable.getRow(r)?.getText() || "");
      if (summaryKeywords.some((kw) => rowText.includes(kw))) {
        deleteUntil = r;
        break;
      }
    }
  }

  let deletedCount = 0;
  // Crucial: delete from bottom up to avoid index shifting collisions!
  for (let r = deleteUntil - 1; r >= deleteFrom; r--) {
    if (r > templateRowIdx && r < targetTable.getRowCount()) {
      targetTable.removeRow(r);
      deletedCount++;
    }
  }

  return {
    applied: true,
    info: `Collapsed Table ${targetIndex}: Row ${templateRowIdx} wrapped with ${openTag}...${closeTag}, pruned ${deletedCount} sample rows (Rows ${deleteFrom}..${deleteUntil - 1}) in reverse order`,
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

  // Partition mutations into 3 deterministic phases:
  // Phase 1: Text run replacements
  // Phase 2: Scalar cell replacements and conditional row wrapping
  // Phase 3: Table loop collapsing (executed last to prevent row index shifting)
  interface PendingMutation {
    row: VariableRow;
    descriptor: any;
    mutation: MutationAction;
    phase: 1 | 2 | 3;
  }

  const pending: PendingMutation[] = [];

  for (const row of rows) {
    let descriptor: any = {};
    try {
      descriptor = JSON.parse(row.descriptor_json);
    } catch {
      descriptor = {};
    }

    let mutation: MutationAction | undefined = descriptor.mutation;
    if (!mutation && (row.category === "table_loop" || descriptor.type === "repeating_loop")) {
      mutation = {
        action: "collapse_repeating_table",
        table_index: descriptor.table_index,
        loop_tag: descriptor.loop_tag,
      };
    }
    if (!mutation || !mutation.action) continue;

    let phase: 1 | 2 | 3 = 1;
    if (mutation.action === "replace_text_run") {
      phase = 1;
    } else if (mutation.action === "replace_table_cell" || mutation.action === "wrap_conditional_row") {
      phase = 2;
    } else if (mutation.action === "collapse_repeating_table") {
      phase = 3;
    }

    pending.push({ row, descriptor, mutation, phase });
  }

  // Sort by phase so Phase 1 runs first, Phase 2 second, Phase 3 last
  const sortedPending = pending.sort((a, b) => a.phase - b.phase);

  for (const item of sortedPending) {
    const { row, descriptor, mutation } = item;
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
        const fallbackTag =
          descriptor.visibility_rule?.condition_flag ||
          (row.variable_name.startsWith("has_") ? row.variable_name : `has_${row.variable_name}`);
        const res = executeWrapConditionalRow(doc, mutation, fallbackTag);
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

/**
 * Hydrates a Word template with dynamic proposal data using easy-template-x
 */
export async function hydrateProposalTemplate(
  templateBuffer: Buffer,
  payload: ProposalHydrationPayload | Record<string, any>
): Promise<Buffer> {
  const normalizedPayload: Record<string, any> = { ...payload };

  // Alias bridging for seamless template compatibility
  if (!normalizedPayload.project_phases && normalizedPayload.milestones) {
    normalizedPayload.project_phases = normalizedPayload.milestones;
  }
  if (!normalizedPayload.milestones && normalizedPayload.project_phases) {
    normalizedPayload.milestones = normalizedPayload.project_phases;
  }

  if (!normalizedPayload.scope_deliverables_summary && normalizedPayload.scope_inclusions_narrative) {
    normalizedPayload.scope_deliverables_summary = normalizedPayload.scope_inclusions_narrative;
  }
  if (!normalizedPayload.scope_inclusions_narrative && normalizedPayload.scope_deliverables_summary) {
    normalizedPayload.scope_inclusions_narrative = normalizedPayload.scope_deliverables_summary;
  }

  if (normalizedPayload.has_addons === undefined && Array.isArray(normalizedPayload.addon_items)) {
    normalizedPayload.has_addons = normalizedPayload.addon_items.length > 0;
  }

  const handler = new TemplateHandler();
  const doc = await handler.process(templateBuffer, normalizedPayload);
  return Buffer.from(doc);
}
