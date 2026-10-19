import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  User,
  ChevronDown,
  ChevronRight,
  Check,
  Table2,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { RuleTableCard } from "../pricing/RuleTableCard";
import { LedgerTray } from "../pricing/LedgerTray";
import { CondRows } from "../pricing/CondRows";
import type {
  Cond,
  PricingRules,
  PricingRulesState,
  ReviewRule,
  RuleVariable,
  ValidationError,
} from "../../types/pricing";
import type { CompanyVariable, CompoundTable } from "../../types/variable";
import { updatePricingRules, RulesValidationError } from "../../services/api";
import { formatValue, readable, readableConds, readableDefault } from "../pricing/readable";

export interface RulesStatus {
  status: "idle" | "compiling" | "error";
  message?: string;
}

type EditableReviewRule = ReviewRule & { _id: string };

const newRuleId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const withRuleIds = (list: ReviewRule[]): EditableReviewRule[] =>
  list.map((r) =>
    "_id" in (r as EditableReviewRule) && typeof (r as EditableReviewRule)._id === "string"
      ? (r as EditableReviewRule)
      : ({ ...r, _id: newRuleId() } as EditableReviewRule),
  );

const normalizeRules = (rs: PricingRules): PricingRules => ({ ...rs, review_rules: withRuleIds(rs.review_rules ?? []) });

/** Strip client-only `_id` + `when: []` drafts: a half-created rule never reaches the backend. */
const stripForPayload = (rs: PricingRules): PricingRules => ({
  ...rs,
  review_rules: (rs.review_rules ?? [])
    .filter((r) => r.when.length > 0)
    .map((r) => {
      const { _id, ...rest } = r as EditableReviewRule;
      void _id;
      return rest as ReviewRule;
    }),
});

interface Stage4PricingEngineProps {
  companyId: string;
  templateId?: string;
  companyName: string;
  state: PricingRulesState | null;
  status?: RulesStatus;
  variables?: CompanyVariable[];
  compoundTables?: CompoundTable[];
  onStateChange: (state: PricingRulesState) => void;
  onProceed: () => void;
  onRegenerate: () => void;
  isProceeding?: boolean;
}

const INPUT_TYPE_LABEL: Record<string, string> = {
  integer: "number",
  choice: "single pick",
  multi_choice: "multiple picks",
  boolean: "yes / no",
  us_state: "US state",
  region: "region",
};

export const Stage4PricingEngine: React.FC<Stage4PricingEngineProps> = ({
  companyId,
  templateId,
  companyName,
  state,
  status = { status: "idle" },
  variables = [],
  compoundTables = [],
  onStateChange,
  onProceed,
  onRegenerate,
  isProceeding = false,
}) => {
  const [rules, setRules] = useState<PricingRules | null>(() => (state?.rules ? normalizeRules(state.rules) : null));
  const [errors, setErrors] = useState<ValidationError[]>(state?.validation_errors ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<string | null>(null); // client-only _id
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [lastSaved, setLastSaved] = useState<PricingRules | null>(null);
  const [syncedRules, setSyncedRules] = useState(state?.rules);
  const [showAssumptions, setShowAssumptions] = useState(false);

  if (state?.rules !== syncedRules) {
    setSyncedRules(state?.rules);
    if (state?.rules !== lastSaved) {
      setRules(state?.rules ? normalizeRules(state.rules) : null);
      setErrors(state?.validation_errors ?? []);
    }
  }

  // Auto-save debounced PUT on user edits (300ms debounce)
  useEffect(() => {
    if (!rules || rules === state?.rules) return;
    if (state?.rules && JSON.stringify(stripForPayload(rules)) === JSON.stringify(stripForPayload(state.rules))) return;
    const timer = setTimeout(async () => {
      setIsSavingRules(true);
      try {
        const next = await updatePricingRules(companyId, stripForPayload(rules), templateId);
        setRules(normalizeRules(next.rules));
        setLastSaved(rules);
        setErrors(next.validation_errors);
        onStateChange({ ...next, rules });
        setSaveStatus("Recalculated & Saved");
        setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
        setErrors(
          err instanceof RulesValidationError
            ? err.errors
            : [{ path: "", message: err instanceof Error ? err.message : String(err) }]
        );
      } finally {
        setIsSavingRules(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [rules, companyId, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelected(null);
      setSelectedRule(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editVariable = (name: string, v: RuleVariable) => {
    if (!rules) return;
    setRules({
      ...rules,
      variables: rules.variables.map((x) => (x.name === name ? v : x)),
    });
  };

  const addHelper = () => {
    if (!rules) return;
    let n = 1;
    while (rules.variables.some((v) => v.name === `helper_${n}`)) n++;
    const name = `helper_${n}`;
    setRules({
      ...rules,
      variables: [
        ...rules.variables,
        {
          name,
          label: `Helper Variable ${n}`,
          in_document: false,
          unit: "money",
          condition_flag: "",
          kind: "constant",
          value: 0,
        },
      ],
    });
    setSelected(name);
  };

  const editReviewRule = (id: string, r: EditableReviewRule) =>
    rules && setRules({ ...rules, review_rules: rules.review_rules.map((x) => ((x as EditableReviewRule)._id === id ? r : x)) });

  const deleteReviewRule = (id: string) => {
    if (!rules) return;
    setRules({ ...rules, review_rules: rules.review_rules.filter((x) => (x as EditableReviewRule)._id !== id) });
    setSelectedRule(null);
  };

  const addReviewRule = () => {
    if (!rules) return;
    const r: EditableReviewRule = { _id: newRuleId(), when: [], reason: "" };
    setRules({ ...rules, review_rules: [...rules.review_rules, r] });
    setSelectedRule(r._id);
  };

  const samples = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of variables) {
      if (v.descriptor?.sample_value !== undefined) m[v.variable_name] = v.descriptor.sample_value;
    }
    for (const t of compoundTables) {
      m[t.loop_tag] = `${t.row_labels?.length || 0} rows`;
    }
    return m;
  }, [variables, compoundTables]);

  const { errorByPath, reviewErrorByIndex } = useMemo(() => {
    const m = new Map<number, string[]>();
    const rm = new Map<number, string[]>();
    for (const e of errors) {
      const i = /^variables\[(\d+)\]/.exec(e.path);
      if (i) m.set(Number(i[1]), [...(m.get(Number(i[1])) ?? []), e.message]);
      const ri = /^review_rules\[(\d+)\]/.exec(e.path);
      if (ri) rm.set(Number(ri[1]), [...(rm.get(Number(ri[1])) ?? []), e.message]);
    }
    return { errorByPath: m, reviewErrorByIndex: rm };
  }, [errors]);

  const reviewBlocked = Boolean(
    rules?.review_rules.some((r) => r.when.length === 0 || r.reason.trim() === "")
  );

  const generalErrors = errors.filter((e) => !/^variables\[\d+\]/.test(e.path) && !/^review_rules\[\d+\]/.test(e.path));

  const isCompiling = status.status === "compiling";
  const values = state?.evaluation?.values ?? {};
  const order = state?.evaluation?.order ?? rules?.variables.map((v) => v.name) ?? [];
  const ledger = rules
    ? order
        .map((n) => rules.variables.find((v) => v.name === n)!)
        .filter((v) => v && v.kind !== "input")
    : [];
  const inputs = rules?.variables.filter((v) => v.kind === "input") ?? [];
  const checks = state?.sample_check ?? [];
  const matched = checks.filter((c) => c.ok).length;
  const allGreen = checks.length > 0 && matched === checks.length;
  const selectedVar = rules?.variables.find((v) => v.name === selected) ?? null;
  const hasUnsavedRules = Boolean(rules && rules !== state?.rules);

  return (
    <div className="stage-arrival relative rounded-3xl border border-[#E2E8F0] dark:border-[#262831] bg-white dark:bg-[#000724] p-5 sm:p-7 space-y-6 shadow-sm overflow-hidden">
      {isCompiling && <div className="shimmer-bar" />}

      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#262831] pb-5">
        <div className="flex items-start gap-4">
          <div
            className={`size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border transition-colors ${
              allGreen && !isCompiling
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/30"
                : "bg-blue-50 dark:bg-blue-950/40 text-[#0B1957] dark:text-[#2B7CFF] border-blue-200/80 dark:border-[#2B7CFF]/40"
            }`}
          >
            {allGreen && !isCompiling ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Calculator className="size-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 flex-wrap">
              <span>Stage 4: Pricing Rules &amp; Deterministic Engine</span>
              {saveStatus && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                  <Check className="size-3" />
                  {saveStatus}
                </span>
              )}
              {allGreen && !isCompiling && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  100% Benchmark Match
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isCompiling ? (
                `Deriving mathematical formulas and rate tables from ${companyName}'s pricing notes...`
              ) : (
                <>
                  Every formula is verified against {companyName}&apos;s quotation benchmark.{" "}
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    Edit rates in tables or click any calculation row to customize formulas.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isCompiling}
          className="h-9 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border-[#E2E8F0] dark:border-[#262831] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
          title="Re-compile rules from pricing briefing"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${isCompiling ? "animate-spin" : ""}`} />
          <span>{isCompiling ? "Compiling..." : "Re-compile"}</span>
        </Button>
      </div>

      {status.status === "error" && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-rose-950/30 border border-red-200 dark:border-rose-900/40 text-red-700 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>{status.message || "Failed to compile pricing rules."}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRegenerate} className="h-7 text-xs border-red-300">
            Try again
          </Button>
        </div>
      )}

      {isCompiling && !rules ? (
        <div className="p-12 rounded-2xl border border-dashed border-[#2B7CFF]/40 bg-blue-50/30 dark:bg-[#000724]/40 text-center space-y-3 animate-pulse">
          <Loader2 className="size-7 animate-spin text-[#2B7CFF] mx-auto" />
          <div className="text-sm font-bold font-heading text-slate-900 dark:text-white">Compiling Deterministic Pricing Model...</div>
          <p className="text-xs text-slate-500">AI is deriving mathematical formulas and tables.</p>
        </div>
      ) : rules ? (
        <>
          {/* Compiler Assumptions Accordion */}
          {rules.assumptions && rules.assumptions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAssumptions((open) => !open)}
                aria-expanded={showAssumptions}
                className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-amber-100/40 dark:hover:bg-amber-950/30 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Compiler Assumptions Resolved ({rules.assumptions.length})</span>
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-amber-700 dark:text-amber-400 transition-transform duration-200 ${
                    showAssumptions ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showAssumptions && (
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 px-5 pb-4 pl-10 animate-in fade-in slide-in-from-top-1 duration-200">
                  {rules.assumptions.map((a, i) => (
                    <li key={i} className="list-disc text-xs leading-relaxed">
                      <span className="text-slate-500 dark:text-slate-400">{a.text}</span>{" "}
                      <span className="text-amber-600 dark:text-amber-400 font-bold">→ {a.resolved_as}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {generalErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-rose-950/30 border border-red-200 dark:border-rose-900/40 text-red-700 dark:text-rose-400 text-xs space-y-1">
              {generalErrors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </div>
          )}

          {/* Rate Tables Grid with Live In-Place Editing */}
          {rules.tables && rules.tables.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase">
                <span className="flex items-center gap-2">
                  <Table2 className="size-4 text-[#0B1957] dark:text-[#2B7CFF]" />
                  <span>Rate Matrices &amp; Tier Tables</span>
                </span>
                <span className="text-[11px] font-mono normal-case">
                  {rules.tables.length} {rules.tables.length === 1 ? "table" : "tables"} • Click cell to edit
                </span>
              </div>
              <div className="grid gap-4.5 sm:grid-cols-2">
                {rules.tables.map((t, i) => (
                  <RuleTableCard
                    key={t.id}
                    table={t}
                    onChange={(updatedTable) =>
                      setRules({
                        ...rules,
                        tables: rules.tables.map((x, j) => (j === i ? updatedTable : x)),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Client Lead Inputs */}
          {inputs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase">
                <span className="flex items-center gap-2">
                  <User className="size-4 text-[#0B1957] dark:text-[#2B7CFF]" />
                  <span>
                    Client Lead Inputs ({inputs.length})
                    {inputs.some((v) => v.default !== undefined) && (
                      <span className="text-[11px] font-normal normal-case ml-1.5 text-amber-600 dark:text-amber-400">
                        • {inputs.filter((v) => v.default !== undefined).length} assumed
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-[11px] font-mono normal-case">Click chip to inspect</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {inputs.map((v) => {
                  const isSel = selected === v.name;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSelected(isSel ? null : v.name)}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer select-none shadow-2xs ${
                        isSel
                          ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white dark:text-[#000724] border-transparent shadow-xs ring-2 ring-[#2B7CFF]/40"
                          : "bg-white dark:bg-[#000724] border-[#E2E8F0] dark:border-[#262831] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span>{v.label || v.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                          isSel
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-[#E2E8F0] dark:border-slate-700"
                        }`}
                      >
                        {INPUT_TYPE_LABEL[v.input_type] || v.input_type}
                      </span>
                      {v.required && (
                        <span
                          className={`size-1.5 rounded-full ${isSel ? "bg-white" : "bg-blue-600 dark:bg-blue-400"}`}
                          title="Required field"
                        />
                      )}
                      {v.default !== undefined && (
                        <span
                          className="text-[10px] px-1.5 py-px rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-sans"
                          title="Assumed when the lead does not say it"
                        >
                          assumes {readableDefault(v)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Calculation Ledger & Quotation Benchmark Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase">
              <div className="flex items-center gap-2">
                <Calculator className="size-4 text-[#0B1957] dark:text-[#2B7CFF]" />
                <span>Calculation Ledger &amp; Quotation Benchmark Verification</span>
              </div>
              <span className="text-[11px] font-mono normal-case">
                {matched} of {checks.length} benchmark targets verified
              </span>
            </div>

            {/* Table Container */}
            <div className="bg-white dark:bg-[#000724] rounded-2xl border border-[#E2E8F0] dark:border-[#262831] shadow-sm overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#000724] border-b border-[#E2E8F0] dark:border-[#262831] text-[11px] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="text-left font-bold px-4 py-3">Variable</th>
                      <th className="text-left font-bold px-4 py-3 hidden sm:table-cell">
                        Formula Logic
                      </th>
                      <th className="text-right font-bold px-4 py-3 whitespace-nowrap">
                        Computed Value
                      </th>
                      <th className="text-right font-bold px-4 py-3 hidden md:table-cell whitespace-nowrap">
                        Quotation Target
                      </th>
                      <th className="w-16 text-center font-bold px-3 py-3">
                        Match
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#262831] font-mono">
                    {ledger.map((v) => {
                      const rawVal = values[v.name];
                      const check = checks.find((c) => c.name === v.name);
                      const idx = rules.variables.indexOf(v);
                      const rowErrors = errorByPath.get(idx);
                      const isSel = selected === v.name;
                      const formattedComputed = check?.computed ?? formatValue(v.unit, rawVal);
                      const formattedTarget = check?.expected ?? samples[v.name] ?? "—";

                      return (
                        <tr
                          key={v.name}
                          onClick={() => setSelected(isSel ? null : v.name)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSel
                              ? "bg-blue-50/70 dark:bg-[#14233a]"
                              : "hover:bg-[#F8FAFC]/80 dark:hover:bg-[#1a2a43]/40"
                          } ${rowErrors ? "bg-red-50/40 dark:bg-rose-950/20" : ""}`}
                        >
                          <td className="px-4 py-3 font-sans">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {v.label || v.name}
                              </span>
                              {!v.in_document && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                  custom helper
                                </span>
                              )}
                              {v.condition_flag && (
                                <span className="text-[10px] text-slate-400">
                                  only when {rules.variables.find((x) => x.name === v.condition_flag)?.label || v.condition_flag}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{v.name}</div>
                            {rowErrors && (
                              <div className="text-[11px] text-red-600 dark:text-rose-400 mt-1">
                                {rowErrors.join("; ")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-300 font-sans text-xs">
                            {readable(rules, v)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold text-xs ${
                              check && !check.ok
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {formattedComputed}
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell text-slate-500 text-xs">
                            {formattedTarget}
                          </td>
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {check ? (
                              check.ok ? (
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto">
                                  <Check className="size-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex size-6 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold mx-auto cursor-help"
                                  title={check.note || "Value does not match sample quotation"}
                                >
                                  !
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Calculation / Helper Variable Button */}
              <button
                type="button"
                onClick={addHelper}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-dashed border-[#E2E8F0] dark:border-[#262831] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <Plus className="size-4 text-[#0B1957] dark:text-[#2B7CFF]" />
                <span>Add Custom Calculation / Helper Variable</span>
              </button>
            </div>
          </div>

            {/* Selected Variable Interactive Editor Tray */}
            {selectedVar && (
              <div className="relative mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="rounded-2xl bg-white dark:bg-[#14233a] border border-[#E2E8F0] dark:border-[#262831] p-5 shadow-sm">
                  <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#E2E8F0] dark:border-[#262831]">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg flex items-center justify-center bg-blue-50 text-[#0B1957] dark:bg-blue-950/40 dark:text-[#2B7CFF]">
                        <Calculator className="size-4" />
                      </div>
                      <span className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                        Editing Variable: {selectedVar.label || selectedVar.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="size-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                      title="Close editor"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <LedgerTray
                    rules={rules}
                    variable={selectedVar}
                    sample={samples[selectedVar.name]}
                    onChange={(updatedVar) => editVariable(selectedVar.name, updatedVar)}
                    onDelete={
                      selectedVar.in_document
                        ? undefined
                        : () => {
                            setRules({
                              ...rules,
                              variables: rules.variables.filter((x) => x.name !== selectedVar.name),
                            });
                            setSelected(null);
                          }
                    }
                    onClose={() => setSelected(null)}
                  />
                </div>
              </div>
            )}

          {/* Held For Review Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                <span>Held for Manual Review When ({rules.review_rules.length})</span>
              </div>
              <button
                type="button"
                onClick={addReviewRule}
                className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" /> Add review rule
              </button>
            </div>

            {rules.review_rules.length === 0 ? (
              <p className="text-xs text-slate-500 italic px-1">
                No review rules yet — the AI found none. Add one if a scenario needs a human check before sending.
              </p>
            ) : (
              <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 overflow-hidden divide-y divide-amber-200/60 dark:divide-amber-900/30 bg-white dark:bg-[#000724]">
                {(rules.review_rules as EditableReviewRule[]).map((r, i) => {
                  const isSel = selectedRule === r._id;
                  const noConditions = r.when.length === 0;
                  const noReason = r.reason.trim() === "";
                  const rowErrors = reviewErrorByIndex.get(i);
                  return (
                    <React.Fragment key={r._id}>
                      {/* Row — click to toggle tray */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRule(isSel ? null : r._id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedRule(isSel ? null : r._id)}
                        className={`flex items-start gap-2.5 px-4 py-2.5 cursor-pointer transition-colors text-xs
                          ${isSel ? "bg-amber-50/70 dark:bg-amber-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}
                          ${noConditions ? "bg-amber-500/10" : ""}
                          ${rowErrors ? "bg-red-50/50 dark:bg-rose-950/20 ring-1 ring-inset ring-red-400/50" : ""}`}
                      >
                        {noConditions ? (
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-500 mt-0.5" />
                        ) : (
                          <ShieldAlert className="size-3.5 shrink-0 text-amber-600/70 mt-0.5" />
                        )}
                        <span className="text-slate-500 dark:text-slate-400 shrink-0 min-w-0 font-mono">
                          {r.when.length
                            ? readableConds(rules, r.when)
                            : <span className="italic opacity-60">no conditions</span>}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 ml-1 font-medium">
                          → {r.reason || <span className="italic opacity-60">no reason</span>}
                        </span>
                      </div>

                      {/* Inline tray — expand-below pattern */}
                      {isSel && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="bg-slate-50/80 dark:bg-[#14233a] p-4 space-y-3.5 border-t border-amber-200/60 dark:border-amber-900/40">
                            {noConditions && (
                              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="size-3.5 shrink-0" />
                                No conditions — this rule will flag every proposal until you add at least one condition.
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">When (all conditions must hold)</div>
                              <CondRows
                                rules={rules}
                                items={r.when as Cond[]}
                                left="var"
                                hideTextRows
                                onChange={(when) => editReviewRule(r._id, { ...r, when: when as Cond[] })}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Reason shown to the reviewer</div>
                              <input
                                type="text"
                                value={r.reason}
                                maxLength={200}
                                onChange={(e) => editReviewRule(r._id, { ...r, reason: e.target.value })}
                                placeholder="e.g. Franchise-scale — needs custom pricing approval"
                                className="h-8 w-full rounded-lg border border-[#E2E8F0] dark:border-[#262831] bg-white dark:bg-[#000724] px-3 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#2B7CFF]/30"
                              />
                              {noReason && (
                                <p className="text-[11px] text-red-500 dark:text-rose-400">Reason required — shown to the reviewer in the Draft box.</p>
                              )}
                            </div>

                            {rowErrors && (
                              <div className="text-[11px] text-red-500 dark:text-rose-400">{rowErrors.join("; ")}</div>
                            )}

                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => deleteReviewRule(r._id)}
                                className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-rose-400 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" /> Delete rule
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#262831] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className={`text-xs ${reviewBlocked ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500"}`}>
              {reviewBlocked
                ? "Finish the review rules above to proceed"
                : checks.length
                ? `${matched} of ${checks.length} match quotation benchmark`
                : errors.length
                ? `${errors.length} validation item${errors.length === 1 ? "" : "s"} to review`
                : "Pricing engine certified"}
            </span>
            <Button
              onClick={onProceed}
              disabled={isProceeding || isSavingRules || hasUnsavedRules || errors.length > 0 || reviewBlocked}
              size="sm"
              className="h-10 px-6 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-98"
            >
              {isProceeding ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  <span>Locking Rules &amp; Preparing Simulation...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Stage 5: Lead Simulation</span>
                  <ChevronRight className="size-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Stage4PricingEngine;
