import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, Download, FileText, Inbox, Mail, Maximize2, RefreshCw, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { draftClarification, draftLeadReply, extractLead, generateProposal } from "../services/api";
import type { Company } from "../types/company";
import type { Evaluation, PricingRulesState, Value } from "../types/pricing";
import type { LeadFacts, LeadField, ProposalResult } from "../types/proposal";

/**
 * Stage 5: paste a lead message → facts (read-only) → deterministic numbers → drafted proposal, previewed as PDF.
 * A missing fact drafts a clarification email and opens a reply box; the reply (typed, or drafted by the model
 * playing the lead) joins the thread, which is re-read whole until nothing is missing, then it generates.
 * The lead's words are the only source of facts. A review rule declines. Nothing is persisted.
 * Design: docs/plans/06-lead-simulator.md §4.
 */

interface LeadSimulatorProps {
  company: Company;
  rules: PricingRulesState | null;
}

type Phase = "idle" | "extracting" | "facts" | "generating" | "done";
/** One message of the thread; `us` messages are the drafted asks, `lead` messages the customer's words. */
interface Msg { from: "lead" | "us"; subject?: string; text: string }
const PRIMARY = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile";
const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export const LeadSimulator: React.FC<LeadSimulatorProps> = ({ company, rules }) => {
  const [leadText, setLeadText] = useState(company.sample_lead_text || "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [facts, setFacts] = useState<LeadFacts | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [isClarifying, setIsClarifying] = useState(false);
  const [isDraftingReply, setIsDraftingReply] = useState(false);
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync the prefill on company switch / reset (Stage 1 pattern); a switch also drops the on-screen run.
  const [prevSeed, setPrevSeed] = useState(company.sample_lead_text);
  if (company.sample_lead_text !== prevSeed) {
    setPrevSeed(company.sample_lead_text);
    setLeadText(company.sample_lead_text || "");
    setPhase("idle");
    setFacts(null);
    setThread([]);
    setReply("");
    setResult(null);
    setError(null);
  }

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsPreviewOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [leadText]);

  const busy = phase === "extracting" || phase === "generating";
  // The thread as one transcript: what the backend reads, drafts against and re-reads (the prompts know the headings).
  const transcript = (t: Msg[]) =>
    t.map((m) => `From: ${m.from === "lead" ? "the lead" : company.company_name}\n${m.subject ? `Subject: ${m.subject}\n` : ""}${m.text}`).join("\n\n");

  const runGenerate = async (f: LeadFacts, t: Msg[]) => {
    setPhase("generating");
    setError(null);
    try {
      setResult(await generateProposal(company.company_id, f.inputs, transcript(t)));
      setPhase("done");
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Generating the proposal failed.", retry: () => runGenerate(f, t) });
      setPhase("facts");
    }
  };

  const runClarify = async (f: LeadFacts, t: Msg[]) => {
    setIsClarifying(true);
    try {
      const email = await draftClarification(company.company_id, transcript(t), f.inputs, f.missing);
      setThread([...t, { from: "us", subject: email.subject, text: email.body }]);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Drafting the clarification email failed.", retry: () => runClarify(f, t) });
    } finally {
      setIsClarifying(false);
    }
  };

  // Re-read the whole thread: facts are replaced outright (the lead's latest word wins), then ask again or generate.
  const readThread = async (t: Msg[]) => {
    setThread(t);
    setPhase("extracting");
    setError(null);
    setResult(null);
    try {
      const f = await extractLead(company.company_id, transcript(t));
      setFacts(f);
      if (f.missing.length) {
        setPhase("facts");
        void runClarify(f, t);
      } else {
        await runGenerate(f, t);
      }
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Reading the lead failed.", retry: () => readThread(t) });
      setPhase(facts ? "facts" : "idle");
    }
  };

  const runExtract = () => readThread([{ from: "lead", text: leadText }]);

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    setReply("");
    void readThread([...thread, { from: "lead", text }]);
  };

  const simulateReply = async () => {
    setIsDraftingReply(true);
    setError(null);
    try {
      setReply((await draftLeadReply(company.company_id, transcript(thread))).body);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Drafting the lead's reply failed.", retry: simulateReply });
    } finally {
      setIsDraftingReply(false);
    }
  };

  const latestAsk = thread.at(-1)?.from === "us" ? thread[thread.length - 1] : null;
  const awaitingReply = phase === "facts" && !!latestAsk;

  const copyEmail = async () => {
    if (!latestAsk) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${latestAsk.subject}\n\n${latestAsk.text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text is selectable on screen
    }
  };

  const done = result?.success === true;
  const declined = result?.success === false;

  const pdfUrl = result?.success ? result.files.pdf : null;

  return (
    <>
    <div className="relative bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      {(busy || isClarifying) && <div className="shimmer-bar" />}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <div className={`flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors duration-300 ${done ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
            {done ? <CheckCircle2 className="size-4" /> : <Inbox className="size-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Check & Generate Proposal</h2>
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
          /* One column, read top to bottom: what we read -> what we assumed -> what it costs -> the document. */
          <div className="space-y-4">
            <FactsForm fields={facts.fields} inputs={facts.inputs} missing={facts.missing} />

            {facts.assumptions.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>Read between the lines:</span>
                </div>
                <ul className="space-y-1 text-xs text-foreground/90 pl-5.5 max-w-prose">
                  {facts.assumptions.map((a, i) => <li key={i} className="list-disc">{a}</li>)}
                </ul>
              </div>
            )}

            {phase === "facts" && (
              <p className="text-xs text-muted-foreground">
                {facts.missing.length ? `The lead hasn't said ${facts.missing.length === 1 ? "one thing" : `${facts.missing.length} things`} the quote needs. Ask below; it generates once they answer.` : "Everything the quote needs is here."}
              </p>
            )}

            {/* The conversation after the first message: our asks, their answers, and the reply box while an ask is open. */}
            {(thread.length > 1 || isClarifying) && phase !== "done" && (
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-3 relative overflow-hidden">
                {isClarifying && <div className="shimmer-bar" />}
                {thread.slice(1).map((m, i) => {
                  const isLatestAsk = m === latestAsk;
                  return (
                    <div key={i} className={`text-xs space-y-1.5 max-w-prose ${m.from === "lead" ? "pl-3 border-l-2 border-blue-500/40" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          {m.from === "us" ? <Mail className="size-3.5 shrink-0 text-muted-foreground" /> : <Inbox className="size-3.5 shrink-0 text-blue-500" />}
                          <span>{m.from === "us" ? "We asked" : "The lead replied"}</span>
                        </div>
                        {isLatestAsk && (
                          <Button variant="ghost" size="sm" onClick={copyEmail} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                            {copied ? <Check className="size-3 mr-1 text-emerald-500" /> : <Copy className="size-3 mr-1" />}
                            {copied ? "Copied" : "Copy"}
                          </Button>
                        )}
                      </div>
                      {m.subject && <p className="font-medium text-foreground">{m.subject}</p>}
                      <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{m.text}</p>
                    </div>
                  );
                })}
                {isClarifying && (
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>Drafting a reply to ask for it…</span>
                  </div>
                )}

                {awaitingReply && (
                  <div className="rounded-xl bg-card border border-border/80 shadow-xs p-3 relative overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/40">
                    {isDraftingReply && <div className="shimmer-bar" />}
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      disabled={busy || isDraftingReply}
                      placeholder="What the lead wrote back…"
                      rows={3}
                      className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 p-1 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 resize-none block"
                    />
                    <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
                      <Button variant="ghost" size="sm" onClick={simulateReply} disabled={busy || isDraftingReply} className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                        {isDraftingReply ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
                        {isDraftingReply ? "Writing as the lead" : "Let the model answer as the lead"}
                      </Button>
                      <Button size="sm" onClick={sendReply} disabled={busy || isDraftingReply || !reply.trim()} className={`${PRIMARY} h-8 px-3.5 text-xs`}>
                        <Send className="size-3.5 mr-1.5" />
                        Send reply & re-read
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {done && result.success && rules && <NumbersLedger rules={rules} evaluation={result.evaluation} payload={result.payload} />}

            {declined && result.declined && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>Declined to auto-quote</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-prose">Your rules say this one needs a person before a price goes out. No document was written.</p>
                <ul className="space-y-1 text-xs text-foreground/90 pl-5.5 max-w-prose">
                  {result.needs_review.map((r, i) => <li key={i} className="list-disc">{r.reason}</li>)}
                </ul>
              </div>
            )}

            {/* The document closes the run: one card, its actions in the header, the page itself below. */}
            {done && result.success && (
              <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">The Proposal</p>
                      <p className="text-[11px] text-muted-foreground">Drafted, not sent. Read it before it goes out.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={result.files.docx}>
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
                        <Download className="size-3.5 mr-1.5" />
                        DOCX
                      </Button>
                    </a>
                    {pdfUrl && (
                      <a href={`${pdfUrl}&download=1`}>
                        <Button size="sm" className={`${PRIMARY} h-8 px-3.5 text-xs`}>
                          <Download className="size-3.5 mr-1.5" />
                          Download PDF
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {pdfUrl ? (
                  /* Same shape as the template checkpoint's docx thumbnail: the page on a muted backdrop, click to open full. */
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="group relative block w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    style={{ height: "min(70vh, 760px)" }}
                    aria-label="Open proposal preview"
                  >
                    <div className="absolute inset-0 flex justify-center px-4 pt-5">
                      <iframe
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        title="Proposal preview"
                        tabIndex={-1}
                        className="w-full max-w-3xl h-full bg-white shadow-md border-0 pointer-events-none"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-zinc-100 dark:from-zinc-900 to-transparent pointer-events-none" />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-card/90 border border-border/60 rounded-md px-2 py-1 shadow-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <Maximize2 className="size-3" />
                      Open preview
                    </span>
                  </button>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-center p-10 bg-muted/20">
                    <FileText className="size-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No PDF this time</p>
                    <p className="text-xs text-muted-foreground max-w-xs">{result.pdf_error ?? "LibreOffice did not produce a PDF."} The .docx above has the same content.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {isPreviewOpen && pdfUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
        <div
          className="bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-4xl w-full h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20 shrink-0">
            <div>
              <h4 className="font-semibold text-xs tracking-tight">Proposal preview</h4>
              <p className="text-[11px] text-muted-foreground">
                {company.company_name}. The numbers came from your rules, the words from the drafter.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* No Download here: the PDF viewer's own toolbar already carries one. */}
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <iframe
            src={`${pdfUrl}#view=FitH`}
            title="Proposal preview"
            className="flex-1 w-full bg-white border-0"
          />
        </div>
      </div>
    )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Facts panel: what the thread said, one line per field; missing required fields glow amber.
// Read-only on purpose: the lead's words are the only way a fact gets in.
// ---------------------------------------------------------------------------

const showValue = (v: Value | undefined) => (typeof v === "boolean" ? (v ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : String(v));

const FactsForm: React.FC<{ fields: LeadField[]; inputs: Record<string, Value>; missing: string[] }> = ({ fields, inputs, missing }) => (
  <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2.5">What the lead told us</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      {fields.map((f) => {
        const v = inputs[f.name];
        const isMissing = missing.includes(f.name);
        return (
          <div key={f.name} className="space-y-1 min-w-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {f.label}
              {!f.required && <span className="opacity-60">(optional)</span>}
            </span>
            <p className={`h-8 flex items-center rounded-lg border bg-card px-2.5 text-xs truncate ${isMissing ? "border-amber-500/60 ring-2 ring-amber-500/15 text-amber-600 dark:text-amber-400 font-medium" : "border-border/80 text-foreground"} ${f.input_type === "integer" ? "font-mono tabular-nums" : ""}`}>
              {isMissing ? "not in the message" : isBlank(v) ? "—" : showValue(v)}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Numbers ledger: the in-document money / percent / integer values, in calculation order.
// ---------------------------------------------------------------------------

const NumbersLedger: React.FC<{ rules: PricingRulesState; evaluation: Evaluation; payload: Record<string, unknown> }> = ({ rules, evaluation, payload }) => {
  const byName = new Map(rules.rules.variables.map((v) => [v.name, v]));
  const rows = evaluation.order
    .map((n) => byName.get(n))
    .filter((v): v is NonNullable<typeof v> => Boolean(v && v.in_document && ["money", "percent", "integer"].includes(v.unit) && evaluation.present[v.name] && typeof payload[v.name] === "string" && payload[v.name] !== ""));
  // The bottom line is what anyone looks for first, so it leaves the list and gets its own row.
  const total = [...rows].reverse().find((v) => v.unit === "money");
  const steps = rows.filter((v) => v !== total);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs p-3.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">The numbers</p>
      <div className="max-w-full">
        <dl className="divide-y divide-border/60">
          {steps.map((v) => (
            <div key={v.name} className="flex items-baseline justify-between gap-6 py-1.5 text-foreground/90">
              <dt className="text-xs truncate">{v.label}</dt>
              <dd className="font-mono tabular-nums shrink-0 text-xs">{String(payload[v.name])}</dd>
            </div>
          ))}
          {total && (
            <div className="flex items-baseline justify-between gap-6 pt-2.5 mt-1 border-t-2 border-border">
              <dt className="text-xs font-medium text-foreground">{total.label}</dt>
              <dd className="font-mono tabular-nums shrink-0 text-lg font-semibold text-foreground">{String(payload[total.name])}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
};

export default LeadSimulator;
