import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  User,
  ChevronRight,
  Check,
  Table2,
  Loader2,
  Plus,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { RuleTableCard } from "../pricing/RuleTableCard";
import { LedgerTray } from "../pricing/LedgerTray";
import type {
  PricingRules,
  PricingRulesState,
  RuleVariable,
  ValidationError,
} from "../../types/pricing";
import type { CompanyVariable, CompoundTable } from "../../types/variable";
import { updatePricingRules, RulesValidationError } from "../../services/api";
import { formatValue, readable, readableConds } from "../pricing/readable";

export interface RulesStatus {
  status: "idle" | "compiling" | "error";
  message?: string;
}

interface Stage4PricingEngineProps {
  companyId: string;
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
};

export const Stage4PricingEngine: React.FC<Stage4PricingEngineProps> = ({
  companyId,
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
  const [rules, setRules] = useState<PricingRules | null>(state?.rules ?? null);
  const [errors, setErrors] = useState<ValidationError[]>(state?.validation_errors ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<PricingRules | null>(null);
  const [syncedRules, setSyncedRules] = useState(state?.rules);

  if (state?.rules !== syncedRules) {
    setSyncedRules(state?.rules);
    if (state?.rules !== lastSaved) {
      setRules(state?.rules ?? null);
      setErrors(state?.validation_errors ?? []);
    }
  }

  // Auto-save debounced PUT on user edits (300ms debounce)
  useEffect(() => {
    if (!rules || rules === state?.rules) return;
    const timer = setTimeout(async () => {
      try {
        const next = await updatePricingRules(companyId, rules);
        setLastSaved(rules);
        setErrors([]);
        onStateChange({ ...next, rules });
        setSaveStatus("Recalculated & Saved");
        setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
        setErrors(
          err instanceof RulesValidationError
            ? err.errors
            : [{ path: "", message: err instanceof Error ? err.message : String(err) }]
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [rules, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
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

  const errorByPath = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const e of errors) {
      const i = /^variables\[(\d+)\]/.exec(e.path);
      if (i) m.set(Number(i[1]), [...(m.get(Number(i[1])) ?? []), e.message]);
    }
    return m;
  }, [errors]);

  const generalErrors = errors.filter((e) => !/^variables\[\d+\]/.test(e.path));

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

  return (
    <div className="relative rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-xs animate-in fade-in duration-200 overflow-hidden">
      {isCompiling && <div className="shimmer-bar" />}

      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`size-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors ${
              allGreen && !isCompiling
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/30"
                : "bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border-blue-200/80 dark:border-[#2B7CFF]/40"
            }`}
          >
            {allGreen && !isCompiling ? (
              <CheckCircle2 className="size-4.5" />
            ) : (
              <Calculator className="size-4.5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Stage 4: Pricing Rules &amp; Deterministic Engine</span>
              {saveStatus && (
                <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1 animate-in fade-in">
                  <Check className="size-3" />
                  {saveStatus}
                </span>
              )}
              {allGreen && !isCompiling && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  100% Benchmark Match
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCompiling ? (
                `Deriving mathematical formulas and rate tables from ${companyName}'s pricing notes...`
              ) : (
                <>
                  Every formula is verified against {companyName}&apos;s quotation benchmark.{" "}
                  <span className="text-foreground font-semibold">
                    Edit rates in tables or tap any calculation row to customize formulas.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={isCompiling}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title="Re-compile rules from pricing briefing"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${isCompiling ? "animate-spin" : ""}`} />
          <span>{isCompiling ? "Compiling..." : "Re-compile"}</span>
        </Button>
      </div>

      {status.status === "error" && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{status.message || "Failed to compile pricing rules."}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRegenerate} className="h-7 text-xs border-destructive/30">
            Try again
          </Button>
        </div>
      )}

      {isCompiling && !rules ? (
        <div className="p-10 rounded-xl border border-dashed border-[#2B7CFF]/40 bg-blue-50/20 dark:bg-[#000724]/30 text-center space-y-3 animate-pulse">
          <Loader2 className="size-6 animate-spin text-[#2B7CFF] mx-auto" />
          <div className="text-xs font-bold text-foreground">Compiling Deterministic Pricing Model...</div>
          <p className="text-[11px] text-muted-foreground">AI is deriving mathematical formulas and tables.</p>
        </div>
      ) : rules ? (
        <>
          {/* Compiler Assumptions Warning Alert */}
          {rules.assumptions && rules.assumptions.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>Compiler Assumptions Resolved ({rules.assumptions.length})</span>
              </div>
              <ul className="space-y-1 text-xs text-foreground/90 pl-5">
                {rules.assumptions.map((a, i) => (
                  <li key={i} className="list-disc text-[11px]">
                    <span className="text-muted-foreground">{a.text}</span> →{" "}
                    <strong className="text-foreground">{a.resolved_as}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generalErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-0.5">
              {generalErrors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </div>
          )}

          {/* Rate Tables Grid with Live In-Place Editing */}
          {rules.tables && rules.tables.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Table2 className="size-3.5 text-[#2B7CFF]" />
                  <span>Rate Matrices &amp; Tier Tables</span>
                </span>
                <span className="text-[10px] font-mono">
                  {rules.tables.length} {rules.tables.length === 1 ? "table" : "tables"} • Click cell to edit
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <User className="size-3.5 text-[#2B7CFF]" />
                  <span>Client Lead Inputs ({inputs.length})</span>
                </span>
                <span className="text-[10px] font-mono">Tap input to inspect</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {inputs.map((v) => {
                  const isSel = selected === v.name;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSelected(isSel ? null : v.name)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer select-none ${
                        isSel
                          ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white border-transparent shadow-xs ring-2 ring-[#2B7CFF]/40"
                          : "bg-muted/30 dark:bg-[#14233a] border-border/80 text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span>{v.label || v.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${
                          isSel
                            ? "bg-white/20 text-white"
                            : "bg-card text-muted-foreground border border-border/50"
                        }`}
                      >
                        {INPUT_TYPE_LABEL[v.input_type] || v.input_type}
                      </span>
                      {v.required && (
                        <span
                          className={`size-1.5 rounded-full ${isSel ? "bg-white" : "bg-[#2B7CFF]"}`}
                          title="Required field"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calculation Ledger & Quotation Benchmark Verification */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Calculator className="size-3.5 text-[#2B7CFF]" />
                <span>Calculation Ledger &amp; Quotation Benchmark Verification</span>
              </div>
              <span className="text-[10px] font-mono">
                {matched} of {checks.length} benchmark targets verified
              </span>
            </div>

            <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[11px] text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-left font-bold px-4 py-2.5">Variable</th>
                    <th className="text-left font-bold px-4 py-2.5 hidden sm:table-cell">
                      Formula Logic
                    </th>
                    <th className="text-right font-bold px-4 py-2.5">Computed Value</th>
                    <th className="text-right font-bold px-4 py-2.5 hidden md:table-cell">
                      Quotation Target
                    </th>
                    <th className="w-12 text-center font-bold px-2 py-2.5">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
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
                        className={`cursor-pointer transition-colors ${
                          isSel
                            ? "bg-blue-50/60 dark:bg-[#14233a]"
                            : "hover:bg-muted/30"
                        } ${rowErrors ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-sans">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-foreground">{v.label || v.name}</span>
                            {!v.in_document && (
                              <span className="text-[10px] px-1.5 py-px rounded border border-dashed border-border text-muted-foreground font-mono">
                                custom helper
                              </span>
                            )}
                            {v.condition_flag && (
                              <span className="text-[10px] text-muted-foreground">
                                only when {rules.variables.find((x) => x.name === v.condition_flag)?.label || v.condition_flag}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{v.name}</div>
                          {rowErrors && (
                            <div className="text-[11px] text-destructive font-sans mt-0.5">
                              {rowErrors.join("; ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-sans text-[11px] hidden sm:table-cell">
                          {readable(rules, v)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold ${
                            check && !check.ok
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                          }`}
                        >
                          {formattedComputed}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground hidden md:table-cell">
                          {formattedTarget}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {check ? (
                            check.ok ? (
                              <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3 stroke-[2.5]" />
                              </span>
                            ) : (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold"
                                title={check.note || "Value does not match sample quotation"}
                              >
                                !
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addHelper}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-dashed border-border/70 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <Plus className="size-3.5 text-[#2B7CFF]" />
                <span>Add Custom Calculation / Helper Variable</span>
              </button>
            </div>

            {/* Selected Variable Interactive Editor Tray */}
            {selectedVar && (
              <div className="relative mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="rounded-xl bg-muted/50 dark:bg-[#14233a] border border-border/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Calculator className="size-4 text-[#2B7CFF]" />
                      <span className="text-xs font-bold text-foreground">
                        Editing Variable: {selectedVar.label || selectedVar.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="size-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                    >
                      <X className="size-3.5" />
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
          </div>

          {/* Held For Review Rules */}
          {rules.review_rules && rules.review_rules.length > 0 && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <ShieldAlert className="size-3.5 text-amber-500" />
                <span>Proposal Held for Manual Review When:</span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {rules.review_rules.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono text-muted-foreground shrink-0 text-[11px]">
                      {readableConds(rules, r.when)}
                    </span>
                    <span className="text-foreground font-sans">→ {r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {checks.length
                ? `${matched} of ${checks.length} match quotation benchmark`
                : errors.length
                ? `${errors.length} validation item${errors.length === 1 ? "" : "s"} to review`
                : "Pricing engine certified"}
            </span>
            <Button
              onClick={onProceed}
              disabled={isProceeding || errors.length > 0}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isProceeding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Locking Rules &amp; Preparing Simulation...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Stage 5: Lead Simulation</span>
                  <ChevronRight className="size-3.5 ml-1" />
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
