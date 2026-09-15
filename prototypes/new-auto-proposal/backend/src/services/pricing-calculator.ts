import { buildTierMatrixPayload, type TierMatrix } from "./template-mutator.service.js";
import type {
  Cell, Cond, Evaluation, Formula, PricingRules, Row, RuleTable, RuleVariable, SampleCheckEntry,
  Stage2Context, Unit, ValidationError, Value, Where,
} from "./pricing-rules.types.js";

/**
 * Pure evaluator for PricingRules (docs/plans/05-pricing-engine.md §1).
 * No I/O, no LLM: the sheet is data, this file is the arithmetic.
 *
 * Guarantees: topological evaluation (declaration order breaks ties, so the ledger is stable);
 * money rounded to cents right after each money variable; percent kept as a fraction; text compares
 * whitespace-normalised + case-insensitive; a null cell means "unbounded" (+∞) in numeric compares;
 * a `condition_flag` on a variable is a skip guard (value zeroed, present=false, no review fired);
 * splits get the rounding remainder on the last row; missing required input / lookup miss / ÷0 /
 * matching review rule → needs_review, never a silent 0.
 */

const norm = (s: string) => s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
/** Half-up to cents. ponytail: no banker's rounding; every benchmark is exact so it never matters here. */
const cents = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

const ZERO: Record<Unit, Value> = { money: 0, percent: 0, integer: 0, text: "", boolean: false, rows: [] };

/** Arithmetic view of a value: booleans count as 1/0, null (unbounded) and text as 0. */
const num = (v: Value | Cell | Cell[] | undefined): number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") { const n = Number(v.replace(/[$,%\s]/g, "")); return Number.isNaN(n) ? 0 : n; }
  return 0;
};

/** `left <op> right` with the sheet's semantics: null = +∞, text loose, "in" against a list. */
function compare(left: Value | Cell | undefined, op: string, right: Value | Cell | Cell[] | undefined): boolean {
  if (op === "in") {
    const list = Array.isArray(right) ? (right as Cell[]) : [right as Cell];
    return list.some((r) => compare(left, "eq", r));
  }
  if (op === "eq" || op === "neq") {
    let same: boolean;
    if (typeof left === "string" || typeof right === "string") same = norm(String(left ?? "")) === norm(String(right ?? ""));
    else if (typeof left === "boolean" || typeof right === "boolean") same = Boolean(left) === Boolean(right);
    else same = num(left) === num(right);
    return op === "eq" ? same : !same;
  }
  const l = left === null || left === undefined ? Infinity : num(left);
  const r = right === null || right === undefined ? Infinity : num(right);
  switch (op) {
    case "gte": return l >= r;
    case "gt": return l > r;
    case "lte": return l <= r;
    case "lt": return l < r;
  }
  return false;
}

/** Names a variable depends on (condition_flag ∪ every referenced name; col: refs excluded). */
export function dependencies(v: RuleVariable): string[] {
  const out = new Set<string>();
  if (v.condition_flag) out.add(v.condition_flag);
  const fromWhere = (w?: (Where | Cond)[]) => w?.forEach((c) => { if ("var" in c && c.var) out.add(c.var); if (c.value_var) out.add(c.value_var); });
  const fromFormula = (f: Formula) => f.args.forEach((a) => { if (typeof a === "string" && !a.startsWith("col:")) out.add(a); });
  switch (v.kind) {
    case "lookup": fromWhere(v.where); break;
    case "formula": fromFormula(v); break;
    case "condition": fromWhere(v.all); break;
    case "aggregate": fromWhere(v.where); if (v.selected_var) out.add(v.selected_var); break;
    case "rows": fromWhere(v.where); if (v.selected_var) out.add(v.selected_var); Object.values(v.map).forEach((m) => { if (typeof m !== "string") fromFormula(m); }); break;
  }
  out.delete(v.name);
  return [...out];
}

/** Kahn's sort; ties go to declaration order so the ledger reads top-down. Leftovers are in a cycle. */
export function topoOrder(variables: RuleVariable[]): { order: string[]; cyclic: string[] } {
  const names = new Set(variables.map((v) => v.name));
  const deps = new Map(variables.map((v) => [v.name, dependencies(v).filter((d) => names.has(d))]));
  const done = new Set<string>();
  const order: string[] = [];
  // ponytail: O(n²) scan — a sheet has tens of variables, not thousands.
  for (;;) {
    const next = variables.find((v) => !done.has(v.name) && deps.get(v.name)!.every((d) => done.has(d)));
    if (!next) break;
    done.add(next.name);
    order.push(next.name);
  }
  return { order, cyclic: variables.map((v) => v.name).filter((n) => !done.has(n)) };
}

const tableOf = (rules: PricingRules, id: string) => rules.tables.find((t) => t.id === id);
const columnUnit = (t: RuleTable | undefined, key: string) => t?.columns.find((c) => c.key === key)?.unit;

/** A lead's answer, coerced by input type; choices are canonicalised to the option's own spelling. */
function coerceInput(v: Extract<RuleVariable, { kind: "input" }>, raw: Value | undefined, rules: PricingRules): Value | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const options = (): string[] => {
    if (v.options?.length) return v.options;
    const t = v.options_table ? tableOf(rules, v.options_table) : undefined;
    return t && v.options_column ? t.rows.map((r) => String(r[v.options_column!] ?? "")) : [];
  };
  const canon = (s: string) => options().find((o) => norm(o) === norm(s));
  switch (v.input_type) {
    case "integer": return Math.round(num(raw));
    case "boolean": return typeof raw === "string" ? /^(true|yes|1)$/i.test(raw) : Boolean(raw);
    case "us_state": return String(raw).trim().toUpperCase();
    case "choice": return canon(String(raw)) ?? String(raw);
    case "multi_choice": return (Array.isArray(raw) ? raw : [raw]).map((x) => canon(String(x)) ?? String(x));
  }
}

export function evaluate(rules: PricingRules, inputs: Record<string, Value>): Evaluation {
  const values: Record<string, Value> = {};
  const present: Record<string, boolean> = {};
  const needs_review: Evaluation["needs_review"] = [];
  const review = (reason: string, source: string) => needs_review.push({ reason, source });
  const { order } = topoOrder(rules.variables);
  const byName = new Map(rules.variables.map((v) => [v.name, v]));

  const resolveRight = (c: Where | Cond) => (c.value_var ? values[c.value_var] : c.op === "in" ? c.values : c.value);
  const rowMatches = (row: Row, where?: Where[]) => (where ?? []).every((w) => compare(row[w.column], w.op, resolveRight(w)));
  const holds = (conds: Cond[]) => conds.every((c) => compare(values[c.var], c.op, resolveRight(c)));

  /** Rows of a table: all (optionally filtered) or the ones whose key_column matches the selected choice(s). */
  const selectRows = (v: Extract<RuleVariable, { kind: "aggregate" | "rows" }>): Row[] => {
    const t = tableOf(rules, v.table);
    if (!t) return [];
    let rows = t.rows.filter((r) => rowMatches(r, v.where));
    if (v.rows === "selected") {
      const sel = v.selected_var ? values[v.selected_var] : undefined;
      const chosen = (Array.isArray(sel) ? sel : [sel]).filter((x) => x !== undefined && x !== "") as Cell[];
      rows = rows.filter((r) => chosen.some((c) => compare(r[v.key_column], "eq", c)));
    }
    return rows;
  };

  const formula = (f: Formula, name: string, row?: Row): number | undefined => {
    const args = f.args.map((a) => (typeof a === "number" ? a : a.startsWith("col:") ? num(row?.[a.slice(4)]) : num(values[a])));
    switch (f.op) {
      case "add": return args.reduce((s, x) => s + x, 0);
      case "mul": return args.reduce((s, x) => s * x, 1);
      case "min": return Math.min(...args);
      case "max": return Math.max(...args);
      case "sub": return args[0] - args[1];
      case "div":
        if (args[1] === 0) { review(`${name}: division by zero`, name); return undefined; }
        return args[0] / args[1];
    }
  };

  for (const name of order) {
    const v = byName.get(name)!;
    let value: Value | undefined;
    let isPresent = true;

    if (v.condition_flag && !values[v.condition_flag]) {
      values[name] = ZERO[v.unit];
      present[name] = false;
      continue;
    }

    switch (v.kind) {
      case "input":
        value = coerceInput(v, inputs[name], rules);
        if (value === undefined) {
          if (v.required) review(`${v.label || name} is required but was not provided`, name);
          isPresent = false;
        }
        break;
      case "constant":
        value = v.value;
        break;
      case "lookup": {
        const t = tableOf(rules, v.table);
        const row = t?.rows.find((r) => rowMatches(r, v.where));
        if (!row) { review(`${v.label || name}: no row in ${t?.label ?? v.table} matches`, name); isPresent = false; }
        else value = row[v.take];
        break;
      }
      case "formula":
        value = formula(v, name);
        if (value === undefined) isPresent = false;
        break;
      case "condition":
        value = holds(v.all);
        break;
      case "aggregate": {
        const rows = selectRows(v);
        value = v.fn === "count" ? rows.length : rows.reduce((s, r) => s + num(r[v.column ?? ""]), 0);
        break;
      }
      case "rows": {
        const t = tableOf(rules, v.table);
        const rows = selectRows(v).map((r) => {
          const out: Row = {};
          for (const [tag, m] of Object.entries(v.map)) {
            if (typeof m === "string") out[tag] = r[m] ?? null;
            else { const x = formula(m, name, r); out[tag] = x === undefined ? null : cents(x); }
          }
          return out;
        });
        // A split must add up to its total: the last row absorbs the cents lost to rounding.
        if (t?.kind === "splits" && rows.length) {
          for (const [tag, m] of Object.entries(v.map)) {
            if (typeof m === "string" || m.op !== "mul") continue;
            const totalVar = m.args.find((a): a is string => typeof a === "string" && !a.startsWith("col:"));
            if (!totalVar) continue;
            const total = cents(num(values[totalVar]));
            const sum = cents(rows.reduce((s, r) => s + num(r[tag]), 0));
            const last = rows[rows.length - 1];
            last[tag] = cents(num(last[tag]) + (total - sum));
          }
        }
        value = rows;
        break;
      }
    }

    if (value === undefined || value === null) {
      values[name] = value === null ? null : ZERO[v.unit];
    } else if (v.unit === "money" && typeof value !== "object") {
      values[name] = cents(num(value));
    } else if (v.unit === "integer" && typeof value !== "object") {
      values[name] = Math.round(num(value));
    } else {
      values[name] = value;
    }
    present[name] = isPresent;
  }

  for (const r of rules.review_rules) if (holds(r.when)) review(r.reason, "review_rules");

  return { values, present, needs_review, order };
}

// ---------------------------------------------------------------------------
// Formatting: values are written back in the quotation's own notation.
// ---------------------------------------------------------------------------

const SAMPLE_NUMBER = /^(.*?)(\d[\d,]*(?:\.(\d+))?)(.*)$/s;

const fixed = (v: number, d: number, grouping: boolean) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: grouping });

/** Render `value` the way `sample` is written: "$3,000/mo" → "$", thousands, 0 dp, "/mo"; "8.25%" → ×100, 2 dp. */
export function formatLike(sample: string, value: Value | Cell | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return "";
  const m = SAMPLE_NUMBER.exec(sample ?? "");
  if (!m) return String(value);
  const [, pre, numStr, frac = "", post] = m;
  const percent = post.trimStart().startsWith("%");
  const v = percent ? value * 100 : value;
  // Keep the sample's decimals unless they would lose precision ("10%" vs 8.25%), then the fewest that don't (≤ 4).
  let decimals = frac.length;
  while (decimals < 4 && Math.abs(Number(v.toFixed(decimals)) - v) > 1e-9) decimals++;
  return `${pre}${fixed(v, decimals, numStr.includes(","))}${post}`;
}

/** Inverse of formatLike for the sample check: "$36,000.00" → 36000, "8.25%" → 0.0825, "Growth" → null. */
export function parseSampleNumber(sample: string): number | null {
  const m = SAMPLE_NUMBER.exec(sample ?? "");
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  return m[4].trimStart().startsWith("%") ? n / 100 : n;
}

/** Default notation for cells that have no sample to imitate (loop rows). */
const formatUnit = (unit: string, value: Cell): string => {
  if (value === null || value === undefined) return "";
  if (unit === "money") return `$${fixed(num(value), 2, true)}`;
  if (unit === "percent") return formatLike("0%", num(value));
  if (unit === "boolean") return value ? "Yes" : "No";
  return String(value);
};

/**
 * Per-variable ✓/✗ against the sample quotation: every document variable must reproduce its
 * Stage 2 sample under `sample_inputs`, every flag must hold, every loop must have the sample's row count.
 */
export function sampleCheck(rules: PricingRules, evaluation: Evaluation, stage2: Stage2Context): SampleCheckEntry[] {
  const out: SampleCheckEntry[] = [];
  const s2 = new Map(stage2.variables.map((v) => [v.variable_name, v]));
  const byName = new Map(rules.variables.map((v) => [v.name, v]));
  const { values, present } = evaluation;

  for (const name of evaluation.order) {
    const v = byName.get(name)!;
    const s = s2.get(name);
    if (!v.in_document || !s || v.unit === "rows") continue;
    const value = values[name];
    const expected = s.sample_value;
    const computed = formatLike(expected, value);
    let ok: boolean;
    const target = parseSampleNumber(expected);
    if ((v.unit === "money" || v.unit === "percent" || v.unit === "integer") && target !== null && typeof value === "number") {
      ok = Math.abs(value - target) <= (v.unit === "money" ? 0.005 : v.unit === "percent" ? 1e-6 : 0);
    } else {
      ok = norm(computed) === norm(expected);
    }
    const entry: SampleCheckEntry = { name, computed, expected, ok };
    if (!present[name]) {
      entry.ok = false;
      entry.note = v.condition_flag ? `hidden: ${v.condition_flag} is false under the sample inputs` : "not computed under the sample inputs";
    }
    out.push(entry);
  }

  for (const s of stage2.variables) {
    if (s.category === "pricing" && !byName.has(s.variable_name)) out.push({ name: s.variable_name, computed: "—", expected: s.sample_value, ok: false, note: "no definition" });
  }
  for (const flag of new Set(stage2.variables.map((v) => v.condition_flag).filter((f): f is string => Boolean(f)))) {
    const holds = values[flag] === true;
    out.push({ name: flag, computed: String(values[flag] ?? "—"), expected: "true", ok: holds, note: holds ? undefined : "this flag must be true for the sample lead" });
  }
  for (const loop of stage2.loop_tables) {
    const rows = values[loop.loop_tag];
    const n = Array.isArray(rows) ? rows.length : 0;
    out.push({ name: loop.loop_tag, computed: `${n} rows`, expected: `${loop.row_labels.length} rows`, ok: n === loop.row_labels.length });
  }
  return out;
}

/**
 * What Stage 5 hands to easy-template-x: document variables in the quotation's notation (""
 * when hidden), loops as formatted row arrays, every condition as a boolean, plus the tier matrix.
 */
export function buildProposalPayload(rules: PricingRules, evaluation: Evaluation, stage2: Stage2Context, tierMatrix?: TierMatrix): Record<string, string | boolean | Row[]> {
  const payload: Record<string, string | boolean | Row[]> = {};
  const s2 = new Map(stage2.variables.map((v) => [v.variable_name, v]));
  const { values, present } = evaluation;

  for (const v of rules.variables) {
    const value = values[v.name];
    if (v.kind === "condition") {
      payload[v.name] = value === true;
    } else if (v.kind === "rows") {
      const t = tableOf(rules, v.table);
      payload[v.name] = (Array.isArray(value) ? (value as Row[]) : []).map((row) => {
        const out: Row = {};
        for (const [tag, m] of Object.entries(v.map)) out[tag] = formatUnit(typeof m === "string" ? columnUnit(t, m) ?? "text" : "money", row[tag] ?? null);
        return out;
      });
    } else if (v.in_document) {
      const sample = s2.get(v.name)?.sample_value;
      payload[v.name] = !present[v.name] ? "" : sample !== undefined ? formatLike(sample, value) : formatUnit(v.unit, value as Cell);
    }
  }
  if (tierMatrix) Object.assign(payload, buildTierMatrixPayload(tierMatrix, String(values[tierMatrix.selector] ?? "")));
  return payload;
}

const IDENT = /^[a-z][a-z0-9_]*$/;
const UNITS = new Set(["money", "percent", "integer", "text", "boolean", "rows"]);
const OPS = new Set(["eq", "neq", "gte", "lte", "gt", "lt", "in"]);
const FORMULA_OPS = new Set(["add", "sub", "mul", "div", "min", "max"]);

/**
 * Structural + domain checks. Every message names the variable and what is wrong, so the
 * compiler can hand the list straight back to the model and the deck can show it inline.
 */
export function validate(rules: PricingRules, stage2: Stage2Context): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const tables = new Map<string, RuleTable>();
  const vars = new Map<string, RuleVariable>();

  (rules.tables ?? []).forEach((t, i) => {
    const p = `tables[${i}]`;
    if (!t.id || !IDENT.test(t.id)) err(`${p}.id`, `table id "${t.id}" must be a snake_case identifier`);
    if (tables.has(t.id)) err(`${p}.id`, `duplicate table id "${t.id}"`);
    tables.set(t.id, t);
    const keys = new Set<string>();
    (t.columns ?? []).forEach((c, j) => {
      if (!c.key || !IDENT.test(c.key)) err(`${p}.columns[${j}].key`, `column key "${c.key}" in table "${t.id}" must be a snake_case identifier`);
      if (keys.has(c.key)) err(`${p}.columns[${j}].key`, `duplicate column key "${c.key}" in table "${t.id}"`);
      keys.add(c.key);
      if (!UNITS.has(c.unit) || (c.unit as string) === "rows") err(`${p}.columns[${j}].unit`, `column "${c.key}" in table "${t.id}" has unknown unit "${c.unit}"`);
    });
  });

  (rules.variables ?? []).forEach((v, i) => {
    const p = `variables[${i}]`;
    if (!v.name || !IDENT.test(v.name)) err(`${p}.name`, `variable name "${v.name}" must be a snake_case identifier`);
    if (vars.has(v.name)) err(`${p}.name`, `duplicate variable name "${v.name}"`);
    vars.set(v.name, v);
    if (!UNITS.has(v.unit)) err(`${p}.unit`, `${v.name}: unknown unit "${v.unit}"`);
  });

  const column = (p: string, v: RuleVariable, tableId: string, key: string | undefined, what: string) => {
    const t = tables.get(tableId);
    if (t && key !== undefined && !t.columns.some((c) => c.key === key)) err(p, `${v.name}: ${what} column "${key}" does not exist in table "${tableId}"`);
  };
  const table = (p: string, v: RuleVariable, id: string) => {
    if (!tables.get(id)) err(p, `${v.name}: table "${id}" does not exist`);
    return tables.get(id);
  };
  const ref = (p: string, v: RuleVariable, name: string) => {
    if (!vars.has(name)) err(p, `${v.name}: refers to "${name}", which is not a defined variable`);
  };
  const conds = (p: string, v: RuleVariable, list: (Where | Cond)[] | undefined, tableId?: string) =>
    (list ?? []).forEach((c, j) => {
      const cp = `${p}[${j}]`;
      if (!OPS.has(c.op)) err(`${cp}.op`, `${v.name}: unknown operator "${c.op}"`);
      if ("var" in c && c.var !== undefined) ref(`${cp}.var`, v, c.var);
      if ("column" in c && tableId) column(`${cp}.column`, v, tableId, c.column, "filter");
      if (c.value_var) ref(`${cp}.value_var`, v, c.value_var);
      else if (c.op === "in" && !Array.isArray(c.values)) err(`${cp}.values`, `${v.name}: "in" needs a values list`);
      else if (c.op !== "in" && c.value === undefined) err(`${cp}.value`, `${v.name}: comparison needs a value or value_var`);
    });
  const formula = (p: string, v: RuleVariable, f: Formula, allowCol: string | undefined) => {
    if (!FORMULA_OPS.has(f.op)) err(`${p}.op`, `${v.name}: unknown formula op "${f.op}"`);
    const n = f.args?.length ?? 0;
    if ((f.op === "sub" || f.op === "div") && n !== 2) err(`${p}.args`, `${v.name}: "${f.op}" takes exactly 2 arguments, got ${n}`);
    else if (n < 1) err(`${p}.args`, `${v.name}: "${f.op}" needs at least one argument`);
    (f.args ?? []).forEach((a, j) => {
      if (typeof a === "number") return;
      if (a.startsWith("col:")) {
        if (!allowCol) err(`${p}.args[${j}]`, `${v.name}: "col:" references are only allowed inside a rows map`);
        else column(`${p}.args[${j}]`, v, allowCol, a.slice(4), "map");
        return;
      }
      ref(`${p}.args[${j}]`, v, a);
      const u = vars.get(a)?.unit;
      if (u === "text" || u === "rows") err(`${p}.args[${j}]`, `${v.name}: "${a}" is ${u}, not a number`);
    });
  };

  (rules.variables ?? []).forEach((v, i) => {
    const p = `variables[${i}]`;
    if (v.condition_flag) {
      const f = vars.get(v.condition_flag);
      if (!f) err(`${p}.condition_flag`, `${v.name}: condition_flag "${v.condition_flag}" is not a defined variable`);
      else if (f.kind !== "condition") err(`${p}.condition_flag`, `${v.name}: condition_flag "${v.condition_flag}" is not a condition variable`);
    }
    switch (v.kind) {
      case "input":
        if (v.input_type === "choice" || v.input_type === "multi_choice") {
          if (v.options_table) { table(`${p}.options_table`, v, v.options_table); column(`${p}.options_column`, v, v.options_table, v.options_column ?? "", "options"); }
          else if (!v.options?.length) err(`${p}.options`, `${v.name}: a ${v.input_type} input needs options or an options_table + options_column`);
        }
        break;
      case "constant":
        break;
      case "lookup":
        if (table(`${p}.table`, v, v.table)) { conds(`${p}.where`, v, v.where, v.table); column(`${p}.take`, v, v.table, v.take, "take"); }
        break;
      case "formula":
        formula(p, v, v, undefined);
        break;
      case "condition":
        conds(`${p}.all`, v, v.all);
        break;
      case "aggregate":
      case "rows": {
        const t = table(`${p}.table`, v, v.table);
        if (!t) break;
        conds(`${p}.where`, v, v.where, v.table);
        // key_column only matters when rows are picked by the lead; models leave it "" for rows: "all".
        if (v.rows === "selected" || v.key_column) column(`${p}.key_column`, v, v.table, v.key_column, "key");
        if (v.rows === "selected") {
          const s = v.selected_var ? vars.get(v.selected_var) : undefined;
          if (!v.selected_var) err(`${p}.selected_var`, `${v.name}: rows "selected" needs a selected_var`);
          else if (!s) ref(`${p}.selected_var`, v, v.selected_var);
          else if (s.kind !== "input" || !["choice", "multi_choice"].includes(s.input_type)) err(`${p}.selected_var`, `${v.name}: selected_var "${v.selected_var}" must be a choice or multi_choice input`);
        }
        if (v.kind === "aggregate") {
          if (v.fn === "sum") { if (!v.column) err(`${p}.column`, `${v.name}: sum needs a column`); else column(`${p}.column`, v, v.table, v.column, "sum"); }
          else if (v.fn !== "count") err(`${p}.fn`, `${v.name}: unknown aggregate "${v.fn}"`);
        } else {
          Object.entries(v.map ?? {}).forEach(([tag, m]) => {
            if (typeof m === "string") column(`${p}.map.${tag}`, v, v.table, m, "map");
            else formula(`${p}.map.${tag}`, v, m, v.table);
          });
        }
        break;
      }
      default:
        err(`${p}.kind`, `${(v as RuleVariable).name}: unknown kind "${(v as RuleVariable).kind}"`);
    }
  });

  (rules.review_rules ?? []).forEach((r, i) => conds(`review_rules[${i}].when`, { name: "review rule" } as RuleVariable, r.when));

  const { cyclic } = topoOrder(rules.variables ?? []);
  if (cyclic.length) {
    const i = rules.variables.findIndex((v) => v.name === cyclic[0]);
    err(`variables[${i}]`, `circular definition: ${cyclic.join(", ")} cannot be computed because they depend on each other (directly or through one another)`);
  }

  // The sheet must cover the document: every Stage 2 pricing cell, flag, and loop.
  const s2 = stage2.variables.filter((v) => v.category !== "table_loop");
  for (const v of s2) {
    if (v.category !== "pricing") continue;
    const d = vars.get(v.variable_name);
    if (!d) err("variables", `${v.variable_name}: this document variable has no definition`);
    else if (!d.in_document) err(`variables[${rules.variables.indexOf(d)}].in_document`, `${v.variable_name} is in the document and must have in_document: true`);
  }
  for (const flag of new Set(s2.map((v) => v.condition_flag).filter((f): f is string => Boolean(f)))) {
    const d = vars.get(flag);
    if (!d || d.kind !== "condition") err("variables", `${flag}: this document flag must be defined as a condition variable`);
  }
  for (const loop of stage2.loop_tables) {
    const d = vars.get(loop.loop_tag);
    if (!d || d.kind !== "rows") { err("variables", `${loop.loop_tag}: this document loop has no rows definition`); continue; }
    const missing = loop.columns.filter((c) => !(c in d.map));
    const extra = Object.keys(d.map).filter((c) => !loop.columns.includes(c));
    if (missing.length || extra.length) err(`variables[${rules.variables.indexOf(d)}].map`, `${loop.loop_tag}: map keys must be exactly [${loop.columns.join(", ")}]${missing.length ? `; missing ${missing.join(", ")}` : ""}${extra.length ? `; unexpected ${extra.join(", ")}` : ""}`);
  }
  return errors;
}
