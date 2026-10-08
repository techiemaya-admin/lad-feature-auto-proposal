import React from "react";
import { X, Plus } from "lucide-react";
import { CustomDropdown } from "../ui/custom-dropdown";
import type { Cond, PricingRules, Where } from "../../types/pricing";
import { OP_SYMBOL, cellInputText, parseLiteral } from "./readable";
import { Commit as CommitBox } from "./RuleTableCard";

const OPS = Object.entries(OP_SYMBOL).map(([value, label]) => ({ value, label }));

const box =
  "h-7 w-full rounded-md border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20";

const Commit: React.FC<{
  value: string;
  onCommit: (s: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}> = ({ mono, className = "", ...rest }) => (
  <CommitBox {...rest} className={`${box} ${mono ? "font-mono tabular-nums" : ""} ${className}`} />
);

export interface CondRowsProps<T extends Where | Cond> {
  rules: PricingRules;
  items: T[];
  /** "column" (table filter) or "var" (variable test). */
  left: T extends Where ? "column" : "var";
  tableId?: string;
  /** Review rules hide non-comparable LHS units (text/rows). Ledger condition editors leave unset. */
  hideTextRows?: boolean;
  onChange: (items: T[]) => void;
}

export function CondRows<T extends Where | Cond>({ rules, items, left, tableId, hideTextRows, onChange }: CondRowsProps<T>) {
  const allVars = rules.variables;
  // One-line unit filter for review rules: text/rows variables are not comparable LHS. Prototype opinion:
  // the backend accepts text comparisons, so a rule on a text variable shows a placeholder in this picker.
  const lhsVars = hideTextRows ? allVars.filter((v) => v.unit !== "text" && v.unit !== "rows") : allVars;
  const leftOptions =
    left === "column"
      ? (rules.tables.find((t) => t.id === tableId)?.columns ?? []).map((c) => ({ value: c.key, label: c.label }))
      : lhsVars.map((v) => ({ value: v.name, label: v.label || v.name }));
  const varOptions = [{ value: "", label: "a value…" }, ...rules.variables.map((v) => ({ value: v.name, label: v.label || v.name }))];
  const update = (i: number, patch: Partial<Where & Cond>) => onChange(items.map((c, j) => (j === i ? ({ ...c, ...patch } as T) : c)));
  const rhsText = (c: Where | Cond) => (c.op === "in" ? (c.values ?? []).map((x) => cellInputText("text", x)).join(", ") : cellInputText("text", c.value));
  return (
    <div className="space-y-1.5">
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <CustomDropdown size="xs" className="min-w-28" value={(c as Where).column ?? (c as Cond).var ?? ""} options={leftOptions} onChange={(v) => update(i, { [left]: v } as Partial<Where & Cond>)} />
          <CustomDropdown size="xs" className="w-14" value={c.op} options={OPS} onChange={(v) => update(i, { op: v as Where["op"] })} />
          <CustomDropdown size="xs" className="min-w-24" value={c.value_var ?? ""} options={varOptions} onChange={(v) => update(i, v ? { value_var: v, value: undefined, values: undefined } : { value_var: undefined, value: null })} />
          {!c.value_var && (
            <Commit
              value={rhsText(c)}
              placeholder={c.op === "in" ? "a, b, c" : "value"}
              className="w-24"
              onCommit={(s) => update(i, c.op === "in" ? { values: s.split(",").map((x) => parseLiteral(x)) } : { value: parseLiteral(s) })}
            />
          )}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="size-6 rounded-md text-muted-foreground hover:text-destructive inline-flex items-center justify-center" title="Remove">
            <X className="size-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { [left]: leftOptions[0]?.value ?? "", op: "eq", value: null } as unknown as T])}
        className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] border border-dashed border-border text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" /> condition
      </button>
    </div>
  );
}

export default CondRows;
