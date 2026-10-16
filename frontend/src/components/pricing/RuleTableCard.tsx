import React from "react";
import { Package, BarChart3, Puzzle, Landmark, PieChart, Table2, Plus, X } from "lucide-react";
import type { Cell, Row, RuleTable, TableKind } from "../../types/pricing";
import { cellInputText, parseCellInput } from "./readable";

/** One editable grid per compiled table (packages, bands, add-ons, taxes, splits). Cells are typed by column unit. */

const KIND_ICON: Record<TableKind, React.ComponentType<{ className?: string }>> = {
  packages: Package,
  bands: BarChart3,
  addons: Puzzle,
  taxes: Landmark,
  splits: PieChart,
  other: Table2,
};

/** Text box that commits on blur / Enter, so half-typed numbers ("12.") are never reformatted mid-keystroke. */
export const Commit: React.FC<{ value: string; onCommit: (s: string) => void; placeholder?: string; inputMode?: "decimal" | "text"; className?: string }> = ({ value, onCommit, placeholder, inputMode, className = "" }) => (
  <input
    key={value}
    defaultValue={value}
    placeholder={placeholder}
    inputMode={inputMode}
    onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    className={className}
  />
);

const UNIT_HINT: Record<string, string> = { money: "$", percent: "%", integer: "#", boolean: "✓", text: "" };
const isNumeric = (unit: string) => unit === "money" || unit === "percent" || unit === "integer";

interface RuleTableCardProps {
  table: RuleTable;
  onChange: (table: RuleTable) => void;
}

export const RuleTableCard: React.FC<RuleTableCardProps> = ({ table, onChange }) => {
  const Icon = KIND_ICON[table.kind] ?? Table2;

  const setCell = (ri: number, key: string, value: Cell) =>
    onChange({ ...table, rows: table.rows.map((r, i) => (i === ri ? { ...r, [key]: value } : r)) });
  const addRow = () => {
    const blank: Row = {};
    for (const c of table.columns) blank[c.key] = c.unit === "text" ? "" : c.unit === "boolean" ? false : null;
    onChange({ ...table, rows: [...table.rows, blank] });
  };
  const removeRow = (ri: number) => onChange({ ...table, rows: table.rows.filter((_, i) => i !== ri) });

  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#262831] bg-white dark:bg-[#000724] shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-[#262831] bg-[#F8FAFC] dark:bg-[#000724]">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-[#0B1957] dark:text-[#2B7CFF]">
            <Icon className="size-4" />
          </div>
          <span className="text-xs font-bold font-heading text-slate-800 dark:text-white">{table.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {table.rows.length} {table.rows.length === 1 ? "row" : "rows"}
          </span>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] text-white dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] dark:text-[#000724] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Add row"
          >
            <Plus className="size-3" />
            <span>Add</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F8FAFC] dark:bg-[#1a2a43]/70 text-[11px] text-slate-600 dark:text-slate-300 border-b border-[#E2E8F0] dark:border-[#262831]">
              {table.columns.map((c) => (
                <th key={c.key} className={`px-3.5 py-2 font-semibold whitespace-nowrap ${isNumeric(c.unit) ? "text-right" : "text-left"}`}>
                  {c.label}
                  {UNIT_HINT[c.unit] && <span className="ml-1 text-slate-400 dark:text-slate-500 font-mono">({UNIT_HINT[c.unit]})</span>}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#262831]">
            {table.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-[#F8FAFC]/80 dark:hover:bg-[#1a2a43]/40 transition-colors group">
                {table.columns.map((c) => (
                  <td key={c.key} className="px-2 py-1">
                    {c.unit === "boolean" ? (
                      <label className="flex items-center justify-center h-8 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(row[c.key])}
                          onChange={(e) => setCell(ri, c.key, e.target.checked)}
                          className="size-4 rounded border-[#E2E8F0] accent-[#0B1957] dark:accent-[#2B7CFF]"
                        />
                      </label>
                    ) : (
                      <Commit
                        value={cellInputText(c.unit, row[c.key])}
                        placeholder={c.unit === "integer" ? "∞" : "—"}
                        inputMode={isNumeric(c.unit) ? "decimal" : "text"}
                        onCommit={(s) => setCell(ri, c.key, parseCellInput(c.unit, s))}
                        className={`h-8 w-full min-w-18 rounded-lg border border-transparent bg-transparent px-2 text-xs text-foreground hover:border-[#E2E8F0] dark:hover:border-slate-700 focus:border-[#2B7CFF] focus:bg-white dark:focus:bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all ${
                          isNumeric(c.unit) ? "font-mono tabular-nums text-right font-medium" : ""
                        }`}
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    title="Remove row"
                    className="size-7 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center transition-all cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RuleTableCard;
