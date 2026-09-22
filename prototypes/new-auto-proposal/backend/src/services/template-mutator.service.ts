import { templateDirectory } from "./template-storage.js";
import { Document, Paragraph, TableCell, TableRow } from "docxmlater";
import fs from "node:fs";
import path from "node:path";
import { TemplateHandler } from "easy-template-x";
import { getStorageDir, getDatabase } from "../db/database.js";
import type { VariableRow } from "../routes/variables.js";

/**
 * Turns the original quotation .docx into a template.docx with {tags}.
 *
 * The engine owns ALL location logic. A variable is just "this exact text is
 * dynamic" (+ optional context / condition flag); the engine finds every
 * paragraph containing it — in the body or inside any table cell — and swaps it.
 * Which mutation to perform is derived from the variable itself:
 *   category "paragraph"  -> replace the whole paragraph block (bullets pruned); a sub-span sample only replaces
 *                            that span; mode "fixed" leaves the text and lets values inside it tag inline
 *   condition_flag set    -> replace the value AND wrap its table row (or the paragraph itself) in {#flag}…{/flag}
 *   otherwise             -> replace the text in place, everywhere it occurs
 * Loop tables are located by their header texts and their data rows by cell-0 labels.
 * A tier comparison matrix is located by the tier selector's enum_options in a header row.
 */

export interface TemplateVariable {
  variable_name: string;
  category: string;
  sample_text: string;
  context_text?: string;
  condition_flag?: string;
  /** All tiers offered; the variable whose sample is one of them selects the tier and locates the comparison matrix. */
  enum_options?: string[];
  /** Paragraphs only: "fixed" keeps the text in place (values inside it still tag inline); default = drafted per client. */
  mode?: "fixed" | "ai_generated";
}

/** Text a block/loop mutation removed, keyed by the tag that replaced it — so a value that lived inside is reported as covered, not lost. */
type Consumed = { tag: string; text: string }[];

/** Captured from the sample document so hydration can rotate the selected tier into the highlighted column. */
export interface TierMatrix {
  /** variable_name of the tier selector (its value picks the tier at hydration). */
  selector: string;
  /** Index (among tier columns, 0-based) of the column the sample document marked as recommended. */
  recommended_index: number;
  /** One entry per tier column, left to right: header name + every cell below it, top to bottom. */
  tiers: { name: string; cells: string[] }[];
}

export interface LoopTable {
  loop_tag: string;
  header_texts: string[];
  column_tags: string[];
  /** First-cell text of every row that belongs to the loop (first one becomes the template row). */
  row_labels: string[];
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
  tier_matrix?: TierMatrix;
}

const norm = (s: string) => s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** norm plus the dash/quote tolerance of sampleRegex, for prefix comparisons. */
const loose = (s: string) => norm(s).replace(/[-−–]/g, "-").replace(/['’‘]/g, "'").replace(/["“”]/g, '"');

/**
 * Lines of a sample as they read in the Word file. Models copy from markdown, so they add list markers
 * ("- ", "• ", "1. "), emphasis ("**✓**", "*note*") and escapes ("\\_") the document never had.
 */
function sampleLines(sample: string): string[] {
  return sample
    .split(/\r?\n/)
    .map((s) =>
      s
        .trim()
        .replace(/^([-*•]|\d+[.)])\s+/, "")
        .replace(/\\_/g, "_")
        .replace(/(?<!\w)(\*\*|\*|__|_)(?=\S)(.+?)(?<=\S)\1(?!\w)/g, "$2")
    )
    .filter(Boolean);
}

/**
 * Matches `sample` inside real document text: tolerant of NBSP / run-on whitespace and of the
 * dash/quote normalisation LLMs do ("-" for "−"/"–", straight for curly quotes); whole-word when word-bounded.
 */
function sampleRegex(sample: string, flags: string): RegExp {
  const body = sample
    .trim()
    .split(/\s+/)
    .map((w) => esc(w).replace(/[-−–]/g, "[-−–]").replace(/['’‘]/g, "['’‘]").replace(/["“”]/g, '["“”]'))
    .join("[\\s\\u00A0]+");
  const wholeWord = /^\w/.test(sample) && /\w$/.test(sample);
  return new RegExp(wholeWord ? `(?<!\\w)${body}(?!\\w)` : body, flags);
}

const parentRow = (p: Paragraph): TableRow | undefined =>
  (p as any)._getParentCell?.()?._getParentRow?.();

function setCellText(cell: TableCell, text: string): void {
  const paras = cell.getParagraphs();
  if (paras.length === 0) {
    cell.createParagraph(text);
    return;
  }
  paras[0].setText(text, paras[0].getRuns()[0]?.getFormatting());
  for (let i = paras.length - 1; i >= 1; i--) cell.removeParagraph(i);
}

/** Every paragraph (body or table cell) containing `sample`; narrowed by `context` only when ambiguous. */
function findParagraphs(doc: Document, sample: string, context?: string): { hits: Paragraph[]; skipped: number } {
  const all = doc.getAllParagraphs();
  let hits = all.filter((p) => sampleRegex(sample, "").test(p.getText()));
  if (hits.length === 0) hits = all.filter((p) => sampleRegex(sample, "i").test(p.getText()));
  let skipped = 0;
  if (hits.length > 1 && context?.trim()) {
    const ctx = norm(context);
    const narrowed = hits.filter((p) => norm(parentRow(p)?.getText() ?? p.getText()).includes(ctx));
    if (narrowed.length > 0) {
      skipped = hits.length - narrowed.length;
      hits = narrowed;
    }
  }
  return { hits, skipped };
}

/** Replaces every occurrence of `sample` in one paragraph, preserving run formatting. */
function replaceInParagraph(p: Paragraph, sample: string, tag: string): number {
  const re = sampleRegex(sample, "gi");
  const text = p.getText();
  const actual = new Set<string>();
  for (let m = re.exec(text); m; m = re.exec(text)) actual.add(m[0]);

  let count = 0;
  for (const found of actual) {
    // replaceText is run-local but honours word boundaries; cross-run is the fallback for split runs.
    let n = p.replaceText(found, tag, { caseSensitive: true, wholeWord: /^\w/.test(found) && /\w$/.test(found) });
    if (n === 0) n = p.replaceTextCrossRun(found, tag, { caseSensitive: true });
    count += n;
  }
  return count;
}

/** Replaces a prose block: the hit paragraph plus following siblings that are in the same list or listed in `lines`. */
function replaceBlock(doc: Document, first: Paragraph, lines: string[], tag: string, flag: string | undefined, consumed: Consumed): number {
  const body = doc.getBodyElements();
  const start = body.indexOf(first);
  const removed: Paragraph[] = [];

  if (start >= 0) {
    const numId = first.getNumbering()?.numId;
    const rest = lines.slice(1).map(norm);
    for (let j = start + 1; j < body.length; j++) {
      const el = body[j];
      if (!(el instanceof Paragraph)) break;
      const t = norm(el.getText());
      const sameList = numId !== undefined && el.getNumbering()?.numId === numId;
      const listed = t !== "" && rest.some((l) => l.includes(t) || t.includes(l));
      if (!sameList && !listed) break;
      removed.push(el);
    }
  }

  for (const p of [first, ...removed]) consumed.push({ tag, text: p.getText() });
  // Keep italics/bold only when the paragraph is uniformly formatted (a bold "✓" prefix must not bleed into the tag).
  const runs = first.getRuns();
  first.setText(flag ? `{#${flag}}${tag}{/${flag}}` : tag, runs.length === 1 ? runs[0].getFormatting() : undefined);
  first.removeNumbering();
  for (const p of removed) doc.removeParagraph(p);
  return 1 + removed.length;
}

function wrapRow(row: TableRow, flag: string): void {
  const cells = row.getCells();
  const first = cells[0]?.getParagraphs()[0];
  const lastParas = cells[cells.length - 1]?.getParagraphs() ?? [];
  const last = lastParas[lastParas.length - 1];
  if (first && !first.getText().includes(`{#${flag}}`)) first.wrap(`{#${flag}}`, "");
  if (last && !last.getText().includes(`{/${flag}}`)) last.wrap("", `{/${flag}}`);
}

export function applyVariable(doc: Document, v: TemplateVariable, consumed: Consumed = []): MutationLogEntry {
  const tag = `{${v.variable_name}}`;
  const target = v.variable_name;
  const lines = sampleLines(v.sample_text);
  if (lines.length === 0) return { action: "replace", target, applied: false, info: "empty sample_text" };

  // Paragraph blocks: the model may have trimmed a long first line, so a ~60-char prefix (cut at a word boundary) is enough to locate it.
  const key = v.category === "paragraph" && lines[0].length > 60 ? lines[0].slice(0, 60).replace(/\s+\S*$/, "") : lines[0];
  const found = findParagraphs(doc, key, v.context_text);
  let hits = found.hits;
  if (hits.length === 0) {
    return { action: "replace", target, applied: false, info: `"${lines[0]}" not found in document` };
  }
  const skippedNote = found.skipped ? `; ${found.skipped} other occurrence(s) skipped by context_text` : "";

  // ponytail: a bare number ("5", "42") with no context is a table value, not the "5" in "within 5 business days".
  // Ceiling: a bare number that only ever appears in prose still replaces everywhere; give it context_text.
  if (/^\d+$/.test(lines[0]) && !v.context_text?.trim() && hits.some(parentRow)) hits = hits.filter(parentRow);

  const flag = v.condition_flag?.trim();
  const flagNote = flag ? `, wrapped in {#${flag}}` : "";
  if (v.category === "paragraph") {
    const p = hits[0];
    // Fixed text stays as written; the client name / numbers inside it are separate variables and tag inline.
    if (v.mode === "fixed") {
      if (flag) p.wrap(`{#${flag}}`, `{/${flag}}`);
      return { action: "keep_paragraph", target, applied: true, info: `fixed text kept in place; values inside it tag inline${flagNote}` };
    }
    // The whole block when the sample is the paragraph (or a trimmed head of it). A sub-span sample — one sentence of a
    // paragraph — replaces only that span, so the numbers in the sentence around it keep their own deterministic tags.
    const whole = lines.length > 1 || loose(p.getText()).startsWith(loose(lines[0]));
    if (!whole && replaceInParagraph(p, lines[0], flag ? `{#${flag}}${tag}{/${flag}}` : tag) > 0) {
      return { action: "replace_text", target, applied: true, info: `${tag} placed inline; the rest of the paragraph stays${flagNote}` };
    }
    const n = replaceBlock(doc, p, lines, tag, flag, consumed);
    return { action: "replace_paragraph", target, applied: true, info: `${tag} replaced ${n} paragraph(s)${flagNote}` };
  }

  let count = 0;
  const rows = new Set<TableRow>();
  for (const p of hits) {
    count += replaceInParagraph(p, lines[0], tag);
    const row = parentRow(p);
    if (row) rows.add(row);
  }
  if (flag) for (const row of rows) wrapRow(row, flag);

  return {
    action: flag ? "wrap_conditional_row" : "replace_text",
    target,
    applied: count > 0,
    info: `${tag} placed ${count}×` + (flag ? `, ${rows.size} row(s) wrapped in {#${flag}}` : "") + skippedNote,
  };
}

export function collapseLoopTable(doc: Document, t: LoopTable, consumed: Consumed = []): MutationLogEntry {
  const target = t.loop_tag;
  const want = t.header_texts.map(norm).filter(Boolean);
  const table = doc.getTables().find((tb) => {
    const cells = tb.getRow(0)?.getCells().map((c) => norm(c.getText())) ?? [];
    return want.length > 0 && want.every((h, i) => cells[i]?.includes(h));
  });
  if (!table) {
    return { action: "collapse_loop", target, applied: false, info: `no table with header [${t.header_texts.join(" | ")}]` };
  }

  const labels = new Set(t.row_labels.map(norm).filter(Boolean));
  const rows = table.getRows();
  let loopIdx = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i > 0 && labels.has(norm(r.getCell(0)?.getText() ?? "")))
    .map(({ i }) => i);
  if (loopIdx.length === 0) loopIdx = rows.map((_, i) => i).slice(1); // no labels given: every data row

  for (const i of loopIdx) consumed.push({ tag: `{#${t.loop_tag}}`, text: rows[i].getText() });
  const templateIdx = loopIdx[0];
  const row = rows[templateIdx];
  const cells = row.getCells();
  t.column_tags.forEach((tagName, c) => {
    if (c < cells.length && tagName.trim()) setCellText(cells[c], `{${tagName.trim().replace(/^[{]|[}]$/g, "")}}`);
  });
  wrapRow(row, t.loop_tag);

  for (const i of loopIdx.slice(1).reverse()) table.removeRow(i);

  return {
    action: "collapse_loop",
    target,
    applied: true,
    info: `{#${t.loop_tag}} on row ${templateIdx}, ${loopIdx.length - 1} sample row(s) removed`,
  };
}

/**
 * A tier comparison matrix (columns = tiers, rows = features) cannot be a loop — easy-template-x has no
 * column loops — and its "recommended" highlight is cell shading we never touch. So every cell becomes a
 * positional tag ({tier2_name}, {tier2_r1}, …) and the grid is captured; buildTierMatrixPayload later
 * rotates the selected tier's column into the highlighted position. Columns whose header names no tier
 * (a "Feature" label column) stay static.
 */
export function tagTierMatrix(doc: Document, selector: TemplateVariable): { matrix?: TierMatrix; entry: MutationLogEntry } {
  const target = `${selector.variable_name} matrix`;
  const options = selector.enum_options ?? [];
  const optionIn = (text: string) => options.find((o) => o.trim() && norm(text).includes(norm(o)));

  for (const table of doc.getTables()) {
    const header = table.getRow(0)?.getCells() ?? [];
    const tierCols = header.map((c, i) => ({ i, name: optionIn(c.getText()) })).filter((x): x is { i: number; name: string } => Boolean(x.name));
    const recommended_index = tierCols.findIndex((x) => norm(x.name) === norm(selector.sample_text));
    if (tierCols.length < 2 || recommended_index < 0) continue;

    const rows = table.getRows().slice(1);
    const tiers = tierCols.map(({ i, name }, n) => {
      for (const p of header[i].getParagraphs()) replaceInParagraph(p, name, `{tier${n + 1}_name}`);
      const cells = rows.map((r, ri) => {
        const cell = r.getCell(i);
        const text = cell?.getText().trim() ?? "";
        if (cell) setCellText(cell, `{tier${n + 1}_r${ri + 1}}`);
        return text;
      });
      return { name, cells };
    });
    return {
      matrix: { selector: selector.variable_name, recommended_index, tiers },
      entry: { action: "tag_tier_matrix", target, applied: true, info: `${tiers.length} tier columns × ${rows.length} rows tagged; column ${recommended_index + 1} is the highlighted one` },
    };
  }
  return { entry: { action: "tag_tier_matrix", target, applied: true, info: `no table whose header row lists "${selector.sample_text}" and another of [${options.join(", ")}]` } };
}

/** Flat {tierN_name, tierN_rM} values: the selected tier sits in the highlighted column, the others keep their order. */
export function buildTierMatrixPayload(m: TierMatrix, selectedTier: string): Record<string, string> {
  const selected = m.tiers.find((t) => norm(t.name) === norm(selectedTier));
  const ordered = m.tiers.filter((t) => t !== selected);
  if (selected) ordered.splice(m.recommended_index, 0, selected);
  const out: Record<string, string> = {};
  ordered.forEach((t, n) => {
    out[`tier${n + 1}_name`] = t.name;
    t.cells.forEach((c, r) => (out[`tier${n + 1}_r${r + 1}`] = c));
  });
  return out;
}

const MOCK_DOCX: Record<string, string> = {
  co1_seo: "Co1_Proposal_Northstar_BloomAndCo.docx",
  co2_msp: "Co2_Proposal_FortressIT_WhitfieldAssociates.docx",
  co3_dev: "Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx",
};

/** storage/<company>/original_quotation.docx, seeded from Mock Data on first use. */
export function resolveQuotationPath(companyId: string, templateId?: string): string {
  const companyDir = templateId ? templateDirectory(companyId, templateId) : path.join(getStorageDir(), companyId);
  const sourceFilePath = path.join(companyDir, "original_quotation.docx");
  if (fs.existsSync(sourceFilePath)) return sourceFilePath;

  if (templateId && templateId !== `default-${companyId}`) throw new Error("Upload a quotation for this template first");
  const mockFilename = MOCK_DOCX[companyId];
  const mockDir = [
    path.resolve(process.cwd(), "Mock Data/docx"),
    path.resolve(process.cwd(), "../Mock Data/docx"),
    path.resolve(process.cwd(), "prototypes/new-auto-proposal/Mock Data/docx"),
  ].find((d) => mockFilename && fs.existsSync(path.join(d, mockFilename)));
  if (!mockDir) throw new Error(`Original quotation document not found for company "${companyId}"`);

  fs.mkdirSync(companyDir, { recursive: true });
  fs.copyFileSync(path.join(mockDir, mockFilename), sourceFilePath);
  return sourceFilePath;
}

/** Longest sample first so "12 months × $3,000/mo" is placed before "$3,000/mo"; a context-narrowed variable beats an equal-length global one. */
export function orderVariables<T extends TemplateVariable>(vars: T[]): T[] {
  return [...vars].sort(
    (a, b) =>
      b.sample_text.length - a.sample_text.length ||
      Number(Boolean(b.context_text?.trim())) - Number(Boolean(a.context_text?.trim()))
  );
}

/**
 * Matrix first so the tier name / rate inside it are already tags when the global replacements run.
 * Afterwards every placed tag is checked against the final text: one a later paragraph/loop mutation swallowed, or a
 * value that only ever lived inside such a block, is reported as covered by that block — the per-client draft of the
 * block receives it as an input — and a tag that vanished for any other reason is flipped back to a miss.
 */
export function applyTemplate(
  doc: Document,
  variables: TemplateVariable[],
  loops: LoopTable[]
): { details: MutationLogEntry[]; tier_matrix?: TierMatrix } {
  const selector = variables.find((v) => v.enum_options?.some((o) => norm(o) === norm(v.sample_text)));
  const matrix = selector ? tagTierMatrix(doc, selector) : undefined;
  const consumed: Consumed = [];
  const details = [
    ...(matrix ? [matrix.entry] : []),
    ...orderVariables(variables).map((v) => applyVariable(doc, v, consumed)),
    ...loops.map((t) => collapseLoopTable(doc, t, consumed)),
  ];

  const text = doc.getAllParagraphs().map((p) => p.getText()).join("\n");
  const byName = new Map(variables.map((v) => [v.variable_name, v]));
  for (const d of details) {
    const v = byName.get(d.target);
    if (!v || !/^(replace|wrap_conditional_row)/.test(d.action)) continue;
    const tag = `{${v.variable_name}}`;
    if (text.includes(tag)) continue;
    const first = sampleLines(v.sample_text)[0] ?? "";
    const owner = consumed.find((c) => c.text.includes(tag) || (first && sampleRegex(first, "i").test(c.text)));
    if (owner) {
      Object.assign(d, { action: "covered", applied: true, info: `${tag} lives inside ${owner.tag}, which is drafted per client — no separate tag needed` });
    } else if (d.applied) {
      Object.assign(d, { applied: false, info: `${tag} was placed but a later mutation removed it` });
    }
  }
  return { tier_matrix: matrix?.matrix, details };
}

/** Loads the company's active variables from SQLite, mutates the quotation, writes template.docx. */
export async function mutateDocumentTemplate(companyId: string, templateId = `default-${companyId}`): Promise<MutationResult> {
  const sourceFilePath = resolveQuotationPath(companyId, templateId);
  const targetFilePath = path.join(path.dirname(sourceFilePath), "template.docx");
  const doc = await Document.loadFromBuffer(fs.readFileSync(sourceFilePath));

  const rows = getDatabase()
    .prepare(
      `SELECT * FROM company_variables WHERE company_id = ? AND template_id = ? AND is_deleted = 0 ORDER BY sort_order ASC, created_at ASC`
    )
    .all(companyId, templateId) as unknown as VariableRow[];

  const variables: TemplateVariable[] = [];
  const loops: LoopTable[] = [];
  for (const row of rows) {
    let d: any = {};
    try {
      d = JSON.parse(row.descriptor_json);
    } catch {
      /* corrupt descriptor: treated as empty */
    }
    if (row.category === "table_loop") {
      loops.push({
        loop_tag: d.loop_tag || row.variable_name,
        header_texts: d.header_texts ?? [],
        column_tags: d.columns ?? [],
        row_labels: d.row_labels ?? [],
      });
    } else if (typeof d.sample_value === "string") {
      variables.push({
        variable_name: row.variable_name,
        category: row.category,
        sample_text: d.sample_value,
        context_text: d.context_text,
        condition_flag: d.visibility_rule?.condition_flag,
        enum_options: d.enum_options,
        mode: d.paragraph_config?.mode,
      });
    }
  }

  const { details, tier_matrix } = applyTemplate(doc, variables, loops);
  fs.writeFileSync(targetFilePath, await doc.toBuffer());

  const applied = details.filter((e) => e.applied);
  return {
    success: true,
    template_path: path.relative(process.cwd(), targetFilePath).replace(/\\/g, "/"),
    tags_placed_count: applied.filter((e) => e.action.startsWith("replace")).length,
    loops_collapsed_count: applied.filter((e) => e.action === "collapse_loop").length,
    conditional_rows_wrapped_count: applied.filter((e) => e.action === "wrap_conditional_row").length,
    mutations_applied_count: applied.length,
    details,
    tier_matrix,
  };
}

/** Fills a template.docx with proposal data (easy-template-x). */
export async function hydrateProposalTemplate(
  templateBuffer: Buffer,
  payload: Record<string, any>
): Promise<Buffer> {
  return Buffer.from(await new TemplateHandler().process(templateBuffer, payload));
}
