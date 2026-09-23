/**
 * PricingRules — a spreadsheet whose cells are the Stage 2 variable names.
 *
 * Every Stage 2 `pricing` variable gets one definition written in terms of other
 * variables; pricing-only helpers live here too with `in_document: false`. The
 * calculator (pricing-calculator.ts) evaluates the sheet; the AI only writes it.
 * Design: docs/plans/05-pricing-engine.md §1.
 */

export type Unit =
  | "money"
  | "percent"
  | "integer"
  | "text"
  | "boolean"
  | "rows";
export type CellUnit = Exclude<Unit, "rows">;
export type CompareOp = "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in";
/** null in an integer column = unbounded (a cap of ∞). */
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
/** null = a looked-up unbounded cell (e.g. no product cap). */
export type Value = number | string | boolean | string[] | Row[] | null;

export type TableKind =
  | "packages"
  | "bands"
  | "addons"
  | "taxes"
  | "splits"
  | "other";
export interface RuleColumn {
  key: string;
  label: string;
  unit: CellUnit;
}
export interface RuleTable {
  id: string;
  label: string;
  kind: TableKind;
  columns: RuleColumn[];
  rows: Row[];
}

/** Row filter: `column <op> (value_var | value | values)`. `values` only for "in". */
export interface Where {
  column: string;
  op: CompareOp;
  value_var?: string;
  value?: Cell;
  values?: Cell[];
}
/** Variable test: `var <op> (value_var | value | values)`. */
export interface Cond {
  var: string;
  op: CompareOp;
  value_var?: string;
  value?: Cell;
  values?: Cell[];
}

export type FormulaOp = "add" | "sub" | "mul" | "div" | "min" | "max";
/** One flat operation. add/mul/min/max are n-ary (≥1); sub/div take exactly 2. "col:<key>" allowed inside rows.map. */
export interface Formula {
  op: FormulaOp;
  args: (string | number)[];
}

export type InputType =
  | "integer"
  | "choice"
  | "multi_choice"
  | "boolean"
  /** A geography answer (state, county, country, zone). Open, never a closed list: a lead outside the
   * seller's table must be allowed to match no row — that is the correct "not taxed here" outcome. */
  | "region";

interface VariableBase {
  name: string;
  label: string;
  in_document: boolean;
  unit: Unit;
  /** "" = none; when the flag is false the variable is skipped. */ condition_flag: string;
}

export type RuleVariable = VariableBase &
  (
    | {
        kind: "input";
        input_type: InputType;
        options_table?: string;
        options_column?: string;
        options?: string[];
        /** When the lead is silent: required → ask; default set → assume it; neither → leave blank. */
        required: boolean;
        default?: Cell | string[];
        /** One line telling the extractor how to read the lead's words for this field. */
        assume_when?: string;
      }
    | { kind: "constant"; value: Cell }
    | {
        kind: "lookup";
        table: string;
        where: Where[];
        take: string;
        /** No matching row: undefined → stop and flag for review; set → use this value instead. */
        fallback?: Cell;
      }
    | ({ kind: "formula" } & Formula)
    | { kind: "condition"; all: Cond[] }
    | {
        kind: "aggregate";
        fn: "sum" | "count";
        table: string;
        rows: "selected" | "all";
        selected_var?: string;
        key_column: string;
        column?: string;
        where?: Where[];
      }
    | {
        kind: "rows";
        table: string;
        rows: "selected" | "all";
        selected_var?: string;
        key_column: string;
        where?: Where[];
        map: Record<string, string | Formula>;
      }
  );

export type RuleKind = RuleVariable["kind"];

export interface ReviewRule {
  when: Cond[];
  reason: string;
}
export interface Assumption {
  text: string;
  resolved_as: string;
}

export interface PricingRules {
  version: 1;
  tables: RuleTable[];
  variables: RuleVariable[];
  /** Explicit "decline to auto-quote" conditions. */
  review_rules: ReviewRule[];
  assumptions: Assumption[];
  /** The lead facts behind the sample quotation; drive the sample check. */
  sample_inputs: Record<string, Value>;
}

export interface Evaluation {
  values: Record<string, Value>;
  present: Record<string, boolean>;
  needs_review: { reason: string; source?: string }[];
  order: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}
export interface SampleCheckEntry {
  name: string;
  computed: string;
  expected: string;
  ok: boolean;
  note?: string;
}

export interface Stage2Variable {
  variable_name: string;
  natural_name?: string;
  category: string;
  data_type?: string;
  sample_value: string;
  condition_flag?: string;
  enum_options?: string[];
  paragraph_mode?: string;
}
export interface Stage2Context {
  variables: Stage2Variable[];
  loop_tables: { loop_tag: string; columns: string[]; row_labels: string[] }[];
}

export interface PricingRulesState {
  rules: PricingRules;
  compiled_at: string;
  validation_errors: ValidationError[];
  sample_check: SampleCheckEntry[];
  evaluation: Evaluation | null;
}

// ---------------------------------------------------------------------------
// Wire shape — what the model returns. Gemini's responseSchema has no unions and
// no dynamic keys, so every variable carries every kind's fields ("" / [] / false
// when unused), rows are cell lists, and maps / sample inputs are entry lists.
// ---------------------------------------------------------------------------

export interface AiCell {
  column: string;
  text: string;
}
export interface AiTable {
  id: string;
  label: string;
  kind: string;
  columns: { key: string; label: string; unit: string }[];
  rows: { cells: AiCell[] }[];
}
export interface AiWhere {
  column: string;
  op: string;
  value_var: string;
  value: string;
  values: string[];
}
export interface AiCond {
  var: string;
  op: string;
  value_var: string;
  value: string;
  values: string[];
}
export interface AiMapEntry {
  loop_column: string;
  column: string;
  op: string;
  args: string[];
}
export interface AiVariable {
  name: string;
  label: string;
  in_document: boolean;
  unit: string;
  condition_flag: string;
  kind: string;
  input_type: string;
  options_table: string;
  options_column: string;
  options: string[];
  required: boolean;
  default: string;
  default_values: string[];
  assume_when: string;
  value: string;
  table: string;
  where: AiWhere[];
  take: string;
  fallback: string;
  op: string;
  args: string[];
  all: AiCond[];
  fn: string;
  rows: string;
  selected_var: string;
  key_column: string;
  column: string;
  map: AiMapEntry[];
}
export interface AiPricingRules {
  version: number;
  tables: AiTable[];
  variables: AiVariable[];
  review_rules: { when: AiCond[]; reason: string }[];
  assumptions: Assumption[];
  sample_inputs: { name: string; value: string; values: string[] }[];
}

const isBlank = (s: unknown) => s === undefined || s === null || s === "";

/** Types a wire cell by its column unit; lenient to native numbers/booleans the model may emit. */
export function parseCell(text: unknown, unit: string): Cell {
  if (typeof text === "number" || typeof text === "boolean") {
    if (unit === "text") return String(text);
    if (unit === "boolean")
      return typeof text === "boolean" ? text : text !== 0;
    return typeof text === "number" ? text : text ? 1 : 0;
  }
  const s = String(text ?? "").trim();
  if (unit === "text") return s;
  if (s === "") return null;
  if (unit === "boolean") return /^(true|yes|1)$/i.test(s);
  const isPercent = /%$/.test(s);
  const n = Number(s.replace(/[$,%\s]/g, ""));
  if (Number.isNaN(n)) return null;
  if (unit === "percent") return isPercent ? n / 100 : n;
  if (unit === "integer") return Math.round(n);
  return n;
}

const parseArg = (a: unknown): string | number => {
  if (typeof a === "number") return a;
  const s = String(a ?? "").trim();
  return s !== "" && !Number.isNaN(Number(s)) && !/^col:/.test(s)
    ? Number(s)
    : s;
};

/** Untyped wire literal → Cell: numbers, booleans, else text. */
const parseLiteral = (s: unknown): Cell => {
  if (typeof s === "number" || typeof s === "boolean" || s === null) return s;
  const t = String(s).trim();
  if (t === "") return null;
  if (/^(true|false)$/i.test(t)) return /^true$/i.test(t);
  const n = Number(t.replace(/[$,\s]/g, ""));
  return Number.isNaN(n)
    ? t
    : /%$/.test(t)
      ? Number(t.replace(/[%,\s]/g, "")) / 100
      : n;
};

const fromWireCond = <K extends "column" | "var">(
  key: K,
  c: AiWhere | AiCond,
): any => {
  const out: any = { [key]: (c as any)[key] ?? "", op: c.op };
  if (!isBlank(c.value_var)) out.value_var = c.value_var;
  else if (c.op === "in") out.values = (c.values ?? []).map(parseLiteral);
  else out.value = parseLiteral(c.value);
  return out;
};

const fromWireValue = (v: { value?: unknown; values?: unknown[] }): Value => {
  if (Array.isArray(v.values) && v.values.length) return v.values.map(String);
  const lit = parseLiteral(v.value);
  return lit === null ? "" : lit;
};

/** Wire (model) shape → typed PricingRules. Never throws on shape drift; `validate` reports what's wrong. */
export function fromWire(w: AiPricingRules): PricingRules {
  const tables: RuleTable[] = (w.tables ?? []).map((t) => {
    const columns = (t.columns ?? []).map((c) => ({
      key: c.key,
      label: c.label ?? c.key,
      unit: c.unit as CellUnit,
    }));
    const unitOf = new Map(columns.map((c) => [c.key, c.unit as string]));
    return {
      id: t.id,
      label: t.label ?? t.id,
      kind: t.kind as TableKind,
      columns,
      rows: (t.rows ?? []).map((r) => {
        const row: Row = {};
        for (const c of columns) row[c.key] = null;
        for (const cell of r.cells ?? [])
          row[cell.column] = parseCell(
            cell.text,
            unitOf.get(cell.column) ?? "text",
          );
        return row;
      }),
    };
  });

  const variables: RuleVariable[] = (w.variables ?? []).map(
    (v): RuleVariable => {
      const base = {
        name: v.name,
        label: v.label ?? v.name,
        in_document: Boolean(v.in_document),
        unit: v.unit as Unit,
        condition_flag: v.condition_flag ?? "",
      };
      const where = () =>
        (v.where ?? []).map((c) => fromWireCond("column", c) as Where);
      const sel = () => ({
        rows: (v.rows as "selected" | "all") ?? "all",
        ...(isBlank(v.selected_var) ? {} : { selected_var: v.selected_var }),
        key_column: v.key_column ?? "",
        ...(v.where?.length ? { where: where() } : {}),
      });
      switch (v.kind) {
        case "input": {
          const def = fromWireValue({ value: v.default, values: v.default_values });
          return {
            ...base,
            kind: "input",
            input_type: v.input_type as InputType,
            required: Boolean(v.required),
            ...(def === "" ? {} : { default: def as Cell | string[] }),
            ...(isBlank(v.assume_when) ? {} : { assume_when: v.assume_when }),
            ...(isBlank(v.options_table)
              ? {}
              : { options_table: v.options_table }),
            ...(isBlank(v.options_column)
              ? {}
              : { options_column: v.options_column }),
            ...(v.options?.length ? { options: v.options } : {}),
          };
        }
        case "constant":
          return {
            ...base,
            kind: "constant",
            value: parseCell(v.value, v.unit),
          };
        case "lookup":
          return {
            ...base,
            kind: "lookup",
            table: v.table ?? "",
            where: where(),
            take: v.take ?? "",
            ...(isBlank(v.fallback)
              ? {}
              : { fallback: parseCell(v.fallback, base.unit) }),
          };
        case "formula":
          return {
            ...base,
            kind: "formula",
            op: v.op as FormulaOp,
            args: (v.args ?? []).map(parseArg),
          };
        case "condition":
          return {
            ...base,
            kind: "condition",
            all: (v.all ?? []).map((c) => fromWireCond("var", c) as Cond),
          };
        case "aggregate":
          return {
            ...base,
            kind: "aggregate",
            fn: v.fn as "sum" | "count",
            table: v.table ?? "",
            ...sel(),
            ...(isBlank(v.column) ? {} : { column: v.column }),
          };
        case "rows": {
          const map: Record<string, string | Formula> = {};
          for (const m of v.map ?? [])
            map[m.loop_column] = isBlank(m.op)
              ? m.column
              : { op: m.op as FormulaOp, args: (m.args ?? []).map(parseArg) };
          return { ...base, kind: "rows", table: v.table ?? "", ...sel(), map };
        }
        default:
          return { ...base, kind: v.kind as any } as RuleVariable;
      }
    },
  );

  const sample_inputs: Record<string, Value> = {};
  for (const s of w.sample_inputs ?? [])
    sample_inputs[s.name] = fromWireValue(s);

  return {
    version: 1,
    tables,
    variables,
    review_rules: (w.review_rules ?? []).map((r) => ({
      when: (r.when ?? []).map((c) => fromWireCond("var", c) as Cond),
      reason: r.reason,
    })),
    assumptions: (w.assumptions ?? []).map((a) => ({
      text: a.text ?? "",
      resolved_as: a.resolved_as ?? "",
    })),
    sample_inputs,
  };
}

const cellText = (c: Cell): string =>
  c === null || c === undefined ? "" : String(c);

const toWireCond = (c: Where | Cond): AiWhere & AiCond => ({
  column: (c as Where).column ?? "",
  var: (c as Cond).var ?? "",
  op: c.op,
  value_var: c.value_var ?? "",
  value: c.value === undefined ? "" : cellText(c.value),
  values: (c.values ?? []).map(cellText),
});

const EMPTY_VAR: Omit<
  AiVariable,
  "name" | "label" | "in_document" | "unit" | "condition_flag" | "kind"
> = {
  input_type: "",
  options_table: "",
  options_column: "",
  options: [],
  required: false,
  default: "",
  default_values: [],
  assume_when: "",
  value: "",
  table: "",
  where: [],
  take: "",
  fallback: "",
  op: "",
  args: [],
  all: [],
  fn: "",
  rows: "",
  selected_var: "",
  key_column: "",
  column: "",
  map: [],
};

/** Typed PricingRules → wire shape (retry prompts, test stubs). Inverse of fromWire. */
export function toWire(r: PricingRules): AiPricingRules {
  return {
    version: r.version,
    tables: r.tables.map((t) => ({
      id: t.id,
      label: t.label,
      kind: t.kind,
      columns: t.columns.map((c) => ({ ...c })),
      rows: t.rows.map((row) => ({
        cells: t.columns.map((c) => ({
          column: c.key,
          text: cellText(row[c.key] ?? null),
        })),
      })),
    })),
    variables: r.variables.map((v): AiVariable => {
      const out: AiVariable = {
        ...EMPTY_VAR,
        name: v.name,
        label: v.label,
        in_document: v.in_document,
        unit: v.unit,
        condition_flag: v.condition_flag,
        kind: v.kind,
      };
      switch (v.kind) {
        case "input":
          Object.assign(out, {
            input_type: v.input_type,
            options_table: v.options_table ?? "",
            options_column: v.options_column ?? "",
            options: v.options ?? [],
            required: v.required,
            default: Array.isArray(v.default) ? "" : cellText(v.default ?? null),
            default_values: Array.isArray(v.default) ? v.default : [],
            assume_when: v.assume_when ?? "",
          });
          break;
        case "constant":
          out.value = cellText(v.value);
          break;
        case "lookup":
          Object.assign(out, {
            table: v.table,
            where: v.where.map(toWireCond),
            take: v.take,
            fallback: v.fallback === undefined ? "" : cellText(v.fallback),
          });
          break;
        case "formula":
          Object.assign(out, { op: v.op, args: v.args.map(String) });
          break;
        case "condition":
          out.all = v.all.map(toWireCond);
          break;
        case "aggregate":
          Object.assign(out, {
            fn: v.fn,
            table: v.table,
            rows: v.rows,
            selected_var: v.selected_var ?? "",
            key_column: v.key_column,
            column: v.column ?? "",
            where: (v.where ?? []).map(toWireCond),
          });
          break;
        case "rows":
          Object.assign(out, {
            table: v.table,
            rows: v.rows,
            selected_var: v.selected_var ?? "",
            key_column: v.key_column,
            where: (v.where ?? []).map(toWireCond),
            map: Object.entries(v.map).map(([loop_column, m]) =>
              typeof m === "string"
                ? { loop_column, column: m, op: "", args: [] }
                : {
                    loop_column,
                    column: "",
                    op: m.op,
                    args: m.args.map(String),
                  },
            ),
          });
          break;
      }
      return out;
    }),
    review_rules: r.review_rules.map((x) => ({
      when: x.when.map(toWireCond),
      reason: x.reason,
    })),
    assumptions: r.assumptions.map((a) => ({ ...a })),
    sample_inputs: Object.entries(r.sample_inputs).map(([name, v]) =>
      Array.isArray(v)
        ? { name, value: "", values: (v as unknown[]).map(String) }
        : { name, value: String(v), values: [] },
    ),
  };
}
