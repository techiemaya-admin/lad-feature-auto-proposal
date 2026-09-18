import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, Download, FileText, Inbox, Mail, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { CustomDropdown } from "./ui/custom-dropdown";
import { draftClarification, extractLead, generateProposal } from "../services/api";
import type { Company } from "../types/company";
import type { Evaluation, PricingRulesState, Value } from "../types/pricing";
import type { ClarificationEmail, LeadFacts, LeadField, ProposalResult } from "../types/proposal";

/**
 * Stage 5: paste a lead message → facts (editable) → deterministic numbers → drafted proposal, previewed as PDF.
 * Two backend hops run back-to-back (extract, generate); a missing fact stops at the form and drafts a
 * clarification email; a review rule declines. Nothing is persisted, so a refresh clears the screen.
 * Design: docs/plans/06-lead-simulator.md §4.
 */

interface LeadSimulatorProps {
  company: Company;
  rules: PricingRulesState | null;
}

type Phase = "idle" | "extracting" | "facts" | "generating" | "done";
const PRIMARY = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile";
const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export const LeadSimulator: React.FC<LeadSimulatorProps> = ({ company, rules }) => {
  const [leadText, setLeadText] = useState(company.sample_lead_text || "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [facts, setFacts] = useState<LeadFacts | null>(null);
  const [clarification, setClarification] = useState<ClarificationEmail | null>(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync the prefill on company switch / reset (Stage 1 pattern); a switch also drops the on-screen run.
  const [prevSeed, setPrevSeed] = useState(company.sample_lead_text);
  if (company.sample_lead_text !== prevSeed) {
    setPrevSeed(company.sample_lead_text);
    setLeadText(company.sample_lead_text || "");
    setPhase("idle");
    setFacts(null);
    setClarification(null);
    setResult(null);
    setError(null);
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [leadText]);

  const busy = phase === "extracting" || phase === "generating";
  const missingNow = (f: LeadFacts) => f.fields.filter((x) => x.required && isBlank(f.inputs[x.name])).map((x) => x.name);

  const runGenerate = async (f: LeadFacts) => {
    setPhase("generating");
    setError(null);
    try {
      setResult(await generateProposal(company.company_id, f.inputs, leadText));
      setPhase("done");
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Generating the proposal failed.", retry: () => runGenerate(f) });
      setPhase("facts");
    }
  };

  const runClarify = async (f: LeadFacts) => {
    setIsClarifying(true);
    try {
      setClarification(await draftClarification(company.company_id, leadText, f.inputs, f.missing));
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Drafting the clarification email failed.", retry: () => runClarify(f) });
    } finally {
      setIsClarifying(false);
    }
  };

  const runExtract = async () => {
    setPhase("extracting");
    setError(null);
    setResult(null);
    setClarification(null);
    try {
      const f = await extractLead(company.company_id, leadText);
      setFacts(f);
      if (f.missing.length) {
        setPhase("facts");
        void runClarify(f);
      } else {
        await runGenerate(f);
      }
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Reading the lead failed.", retry: runExtract });
      setPhase(facts ? "facts" : "idle");
    }
  };

  const setInput = (name: string, value: Value) => {
    if (!facts) return;
    setFacts({ ...facts, inputs: { ...facts.inputs, [name]: value } });
  };

  const copyEmail = async () => {
    if (!clarification) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${clarification.subject}\n\n${clarification.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text is selectable on screen
    }
  };

  const stillMissing = facts ? missingNow(facts) : [];
  const done = result?.success === true;
  const declined = result?.success === false;

  return (
    <div className="relative bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      {(busy || isClarifying) && <div className="shimmer-bar" />}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <div className={`flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors duration-300 ${done ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
            {done ? <CheckCircle2 className="size-4" /> : <Inbox className="size-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Lead simulator</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {phase === "extracting" ? "Reading the message for the facts the calculator needs." : phase === "generating" ? `Calculating the numbers and drafting ${company.company_name}'s proposal.` : (
                <>Paste what a lead sent you. <span className="text-foreground font-medium">The numbers come from the rules above, the words from the drafter.</span></>
              )}
            </p>
          </div>
        </div>

        {/* Lead message (Stage 1 fluid textarea) */}
        <div className="rounded-2xl bg-card border border-border/80 shadow-xs p-4 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/40">
          <textarea
            ref={textareaRef}
            value={leadText}
            onChange={(e) => setLeadText(e.target.value)}
            disabled={busy}
            placeholder="Paste the lead's email or WhatsApp message here…"
            className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 p-1 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 resize-none overflow-y-auto block max-h-72"
            style={{ minHeight: "80px" }}
          />
          <div className="flex justify-end items-center pt-2">
            <Button size="sm" onClick={runExtract} disabled={busy || !rules || !leadText.trim()} className={`${PRIMARY} px-4`}>
              {busy ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
              {phase === "extracting" ? "Reading the lead" : phase === "generating" ? "Generating" : facts ? "Read again & generate" : "Generate proposal"}
              {!busy && <span className="ml-1.5">➔</span>}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error.message}</span>
            </div>
            <Button size="sm" variant="outline" onClick={error.retry} className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive">
              <RefreshCw className="size-3 mr-1" />
              Try again
            </Button>
          </div>
        )}

        {facts && phase !== "extracting" && (
          <div className={`grid gap-5 ${result ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
            {/* Left: facts, assumptions, numbers */}
            <div className="space-y-4 min-w-0">
              <FactsForm fields={facts.fields} inputs={facts.inputs} missing={stillMissing} disabled={busy} onChange={setInput} />

              {phase === "facts" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {stillMissing.length ? `The message didn't say ${stillMissing.length === 1 ? "one thing" : `${stillMissing.length} things`} the quote needs. Fill it in, or ask.` : "Everything the quote needs is here."}
                  </p>
                  <Button size="sm" onClick={() => runGenerate(facts)} disabled={busy || stillMissing.length > 0} className={`${PRIMARY} px-4 shrink-0`}>
                    Generate <span className="ml-1.5">➔</span>
                  </Button>
                </div>
              )}

              {(clarification || isClarifying) && phase !== "done" && (
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-2 relative overflow-hidden">
                  {isClarifying && <div className="shimmer-bar" />}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                      <span>{isClarifying ? "Drafting a reply to ask for it…" : "Reply to ask for it (not sent)"}</span>
                    </div>
                    {clarification && (
                      <Button variant="ghost" size="sm" onClick={copyEmail} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                        {copied ? <Check className="size-3 mr-1 text-emerald-500" /> : <Copy className="size-3 mr-1" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    )}
                  </div>
                  {clarification && (
                    <div className="text-xs space-y-1.5">
                      <p className="font-medium text-foreground">{clarification.subject}</p>
                      <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{clarification.body}</p>
                    </div>
                  )}
                </div>
              )}

              {facts.assumptions.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>Read between the lines:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-foreground/90 pl-5.5">
                    {facts.assumptions.map((a, i) => <li key={i} className="list-disc">{a}</li>)}
                  </ul>
                </div>
              )}

              {done && result.success && rules && <NumbersLedger rules={rules} evaluation={result.evaluation} payload={result.payload} />}

              {declined && result.declined && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>Declined to auto-quote</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Your rules say this one needs a person before a price goes out. No document was written.</p>
                  <ul className="space-y-1 text-xs text-foreground/90 pl-5.5">
                    {result.needs_review.map((r, i) => <li key={i} className="list-disc">{r.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: preview + downloads */}
            {done && result.success && (
              <div className="space-y-3 min-w-0">
                <div className="rounded-xl border border-border/80 bg-muted/30 overflow-hidden" style={{ height: "min(72vh, 820px)" }}>
                  {result.files.pdf ? (
                    <iframe src={result.files.pdf} title="Proposal preview" className="w-full h-full bg-white" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-6">
                      <FileText className="size-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">PDF preview unavailable</p>
                      <p className="text-xs text-muted-foreground max-w-xs">{result.pdf_error ?? "LibreOffice did not produce a PDF."} Download the .docx instead.</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <a href={result.files.docx} className={`${PRIMARY} inline-flex items-center px-4 py-2 text-sm font-medium`}>
                    <Download className="size-3.5 mr-1.5" /> Download .docx
                  </a>
                  {result.files.pdf && (
                    <a href={result.files.pdf} className={`${PRIMARY} inline-flex items-center px-4 py-2 text-sm font-medium`}>
                      <Download className="size-3.5 mr-1.5" /> Download .pdf
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Facts form: one control per field, by type; missing required fields glow amber.
// ---------------------------------------------------------------------------

const FIELD_CLASS = "h-8 w-full rounded-lg border bg-card px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 disabled:opacity-60";
const missingClass = (m: boolean) => (m ? "border-amber-500/60 ring-2 ring-amber-500/15" : "border-border/80");

const FactsForm: React.FC<{ fields: LeadField[]; inputs: Record<string, Value>; missing: string[]; disabled: boolean; onChange: (name: string, value: Value) => void }> = ({ fields, inputs, missing, disabled, onChange }) => (
  <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2.5">What the lead told us</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      {fields.map((f) => {
        const v = inputs[f.name];
        const isMissing = missing.includes(f.name);
        return (
          <label key={f.name} className="block space-y-1 min-w-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {f.label}
              {isMissing && <span className="text-amber-600 dark:text-amber-400 font-medium">· not in the message</span>}
              {!f.required && <span className="opacity-60">(optional)</span>}
            </span>
            {f.input_type === "boolean" ? (
              <div className={`flex rounded-lg border p-0.5 w-fit bg-card ${missingClass(isMissing)}`}>
                {[["Yes", true], ["No", false]].map(([label, val]) => (
                  <button key={String(label)} type="button" disabled={disabled} onClick={() => onChange(f.name, val as boolean)}
                    className={`h-6 px-2.5 rounded-md text-xs transition-colors ${v === val ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                    {label as string}
                  </button>
                ))}
              </div>
            ) : f.input_type === "choice" ? (
              <div className={`rounded-lg ${isMissing ? "ring-2 ring-amber-500/15" : ""}`}>
                <CustomDropdown value={typeof v === "string" ? v : ""} onChange={(val) => onChange(f.name, val)} options={f.options.map((o) => ({ value: o, label: o }))} placeholder="Pick one" size="sm" disabled={disabled} className="w-full" />
              </div>
            ) : f.input_type === "multi_choice" ? (
              <div className={`flex flex-wrap gap-1.5 rounded-lg border p-1.5 bg-card ${missingClass(isMissing)}`}>
                {f.options.map((o) => {
                  const chosen = Array.isArray(v) && (v as string[]).includes(o);
                  return (
                    <button key={o} type="button" disabled={disabled}
                      onClick={() => onChange(f.name, chosen ? (v as string[]).filter((x) => x !== o) : [...((v as string[]) ?? []), o])}
                      className={`h-6 px-2 rounded-md text-xs border transition-colors ${chosen ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {chosen && <Check className="size-3 inline mr-1 -mt-px" />}{o}
                    </button>
                  );
                })}
                {f.options.length === 0 && <span className="text-xs text-muted-foreground px-1">No options</span>}
              </div>
            ) : (
              <input
                type={f.input_type === "integer" ? "number" : "text"}
                inputMode={f.input_type === "integer" ? "numeric" : undefined}
                value={v === null || v === undefined ? "" : String(v)}
                disabled={disabled}
                placeholder={f.input_type === "us_state" ? "TX" : ""}
                maxLength={f.input_type === "us_state" ? 2 : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange(f.name, raw === "" ? null : f.input_type === "integer" ? Number(raw) : f.input_type === "us_state" ? raw.toUpperCase() : raw);
                }}
                className={`${FIELD_CLASS} ${missingClass(isMissing)} ${f.input_type === "integer" ? "font-mono tabular-nums" : ""}`}
              />
            )}
          </label>
        );
      })}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Numbers ledger: the in-document money / percent / integer values, in calculation order.
// ---------------------------------------------------------------------------

const NumbersLedger: React.FC<{ rules: PricingRulesState; evaluation: Evaluation; payload: Record<string, unknown> }> = ({ rules, evaluation, payload }) => {
  const byName = new Map(rules.rules.variables.map((v) => [v.name, v]));
  const rows = evaluation.order
    .map((n) => byName.get(n))
    .filter((v): v is NonNullable<typeof v> => Boolean(v && v.in_document && ["money", "percent", "integer"].includes(v.unit) && evaluation.present[v.name] && typeof payload[v.name] === "string" && payload[v.name] !== ""));
  const lastMoney = [...rows].reverse().find((v) => v.unit === "money")?.name;
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs p-3.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">The numbers</p>
      <dl className="divide-y divide-border/60">
        {rows.map((v) => (
          <div key={v.name} className={`flex items-baseline justify-between gap-3 py-1.5 ${v.name === lastMoney ? "text-foreground font-semibold" : "text-foreground/90"}`}>
            <dt className="text-xs truncate">{v.label}</dt>
            <dd className={`font-mono tabular-nums shrink-0 ${v.name === lastMoney ? "text-sm" : "text-xs"}`}>{String(payload[v.name])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default LeadSimulator;
