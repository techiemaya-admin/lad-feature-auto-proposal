import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Calculator,
  Building,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { Company } from "../types/company";
import {
  SampleSectionsEditor,
  newSampleSection,
  type SampleSection,
} from "./SampleSectionsEditor";
import {
  emptySampleLine,
  type SampleDraft,
  type SampleLine,
} from "../types/sample-proposal";
import * as api from "../services/api";

interface SampleProposalBuilderProps {
  company: Company;
  pricingBrief: string;
  disabled?: boolean;
  onFile: (file: File, notes: string[]) => void;
  onOpenChange?: (open: boolean) => void;
}

export const SampleProposalBuilder: React.FC<SampleProposalBuilderProps> = ({
  company,
  pricingBrief,
  disabled = false,
  onFile,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SampleDraft | null>(null);
  const [lines, setLines] = useState<SampleLine[]>([]);
  const [customer, setCustomer] = useState("Acme Corporation");
  const [currency, setCurrency] = useState("USD");
  const [scenario, setScenario] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [sourceBrief, setSourceBrief] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [totals, setTotals] = useState<{ period: string; amount: string }[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [sections, setSections] = useState<SampleSection[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const briefRef = useRef(pricingBrief);
  briefRef.current = pricingBrief;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const changeOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  const sectionsValid = sections.every(
    (section) => section.title.trim() && section.content.trim()
  );

  const linesValid =
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.quantity.trim() !== "" &&
        line.rate.trim() !== "" &&
        line.discount.trim() !== "" &&
        line.tax.trim() !== ""
    );

  const canAttach =
    !busy &&
    !disabled &&
    draft !== null &&
    confirmed &&
    sectionsValid &&
    linesValid &&
    customer.trim().length > 0 &&
    currency.trim().length === 3 &&
    sourceBrief === pricingBrief;

  const templateId = company.template_id || "default";

  // 1. Generate full sample draft from pricing brief & profile
  const handleGenerate = async (): Promise<boolean> => {
    changeOpen(true);
    setBusy(true);
    setError("");
    setReady(false);
    setQuestions([]);

    try {
      const result = await api.generateSampleDraft(
        company.company_id,
        templateId,
        pricingBrief,
        sections
      );

      if (!mounted.current) return false;
      if (briefRef.current !== pricingBrief) {
        throw new Error(
          "The pricing brief changed during generation. Generate again to use the updated brief."
        );
      }

      setDraft(result.draft);
      setLines(
        result.lines.map((line) => ({
          quantity: line.quantity === null ? "" : String(line.quantity),
          rate: line.rate === null ? "" : String(line.rate),
          discount: line.discount === null ? "" : String(line.discount),
          tax: line.tax === null ? "" : String(line.tax),
          period: String(line.period || "one-time"),
        }))
      );
      setCustomer(result.customer || "Acme Corporation");
      setCurrency(result.currency || "USD");
      setScenario(result.scenario || "");
      setQuestions(result.questions || []);
      setTotals(result.totals || []);
      setSources(result.pricing_sources || []);
      setConfirmed(false);
      setSourceBrief(pricingBrief);

      if (result.document_base64) {
        const bytes = Uint8Array.from(atob(result.document_base64), (c) =>
          c.charCodeAt(0)
        );
        const file = new File([bytes], "generated_sample_proposal.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        const url = URL.createObjectURL(file);
        setDownloadUrl(url);

        onFile(file, result.questions || []);
        setReady(true);
        changeOpen(false);
      }
      return true;
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Generation failed.");
      }
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  // 2. Add new custom section and open editor
  const handleAddSection = async () => {
    if (!draft) {
      const ok = await handleGenerate();
      if (!ok || !mounted.current) return;
    }
    setSections((current) => [...current, newSampleSection()]);
    changeOpen(true);
    setConfirmed(false);
  };

  // 3. Generate individual custom section content via AI
  const handleGenerateSection = async (section: SampleSection) => {
    setGeneratingSectionId(section.id);
    setError("");
    try {
      const result = await api.generateSampleSection(
        company.company_id,
        templateId,
        {
          pricing_spec: pricingBrief,
          scenario,
          scope: draft?.scope || "",
          sections,
          section: {
            title: section.title,
            position: section.position,
            instructions: section.instructions,
          },
        }
      );

      if (!mounted.current) return;
      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...s, content: result.section.content } : s
        )
      );
      setConfirmed(false);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Section generation failed.");
      }
    } finally {
      if (mounted.current) setGeneratingSectionId(null);
    }
  };

  // 4. Attach confirmed edited sample
  const handleAttach = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");

    try {
      const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);
      const parsedLines = lines.map((line) => ({
        period: line.period,
        quantity: line.quantity.trim() === "" ? null : Number(line.quantity),
        rate: line.rate.trim() === "" ? null : Number(line.rate),
        discount: line.discount.trim() === "" ? null : Number(line.discount),
        tax: line.tax.trim() === "" ? null : Number(line.tax),
      }));

      const blob = await api.generateSampleDocument(
        company.company_id,
        templateId,
        {
          draft,
          customer,
          currency,
          confirmed,
          scenario,
          sections,
          questions: cleanQuestions,
          lines: parsedLines,
        }
      );

      if (!mounted.current) return;
      if (briefRef.current !== sourceBrief) {
        throw new Error(
          "The pricing brief changed. Regenerate the sample before attaching it."
        );
      }

      const file = new File([blob], "generated_sample_proposal.docx", {
        type: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const url = URL.createObjectURL(file);
      setDownloadUrl(url);

      onFile(file, cleanQuestions);
      setReady(true);
      setTotals([]);
      changeOpen(false);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Document creation failed.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const isBriefStale = ready && draft && sourceBrief !== pricingBrief;

  return (
    <div className="space-y-4 rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4 sm:p-5 transition-all shadow-xs">
      {/* Top Banner: Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>No Quotation Document? AI Sample Proposal Generator</span>
              <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30">
                Word .docx
              </Badge>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Generate an offer-specific sample proposal with deterministic pricing, custom sections, and styled Word export.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy || !pricingBrief.trim() || !sectionsValid}
            onClick={handleGenerate}
            className="h-8 px-3.5 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{draft ? "Regenerate Sample" : "Generate Sample Proposal"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy || sections.length >= 8 || !pricingBrief.trim()}
            onClick={handleAddSection}
            className="h-8 px-3 text-xs font-medium gap-1 text-foreground border-border/80 hover:bg-muted cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Section</span>
          </Button>
        </div>
      </div>

      {!draft && (
        <p className="text-[11px] text-muted-foreground/80 pl-1">
          💡 <strong>Tip:</strong> If you don't have an existing .docx quotation, clicking <em>Generate Sample Proposal</em> uses your pricing brief to create a complete Word document with real pricing tables.
        </p>
      )}

      {/* Error Banner */}
      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stale Brief Warning */}
      {isBriefStale && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>The pricing brief changed. Regenerate the sample proposal to ensure numbers and scopes match before sending.</span>
        </div>
      )}

      {/* Ready / Generated Status Summary */}
      {ready && (
        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <div>
                <span className="text-xs font-bold text-foreground">
                  Sample Word Proposal Attached ({customer})
                </span>
                <span className="text-[11px] text-muted-foreground ml-2">
                  Ready to lock &amp; discover variables
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download="generated_sample_proposal.docx"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Download className="size-3.5" />
                  <span>Download .docx</span>
                </a>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || disabled}
                onClick={() => {
                  changeOpen(!open);
                  setConfirmed(false);
                }}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span>{open ? "Hide Editor" : "Edit Sample (optional)"}</span>
                {open ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
              </Button>
            </div>
          </div>

          {/* Totals Strip */}
          {totals.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Calculated Totals:
              </span>
              {totals.map((total) => (
                <Badge
                  key={total.period}
                  variant="secondary"
                  className="text-xs font-mono font-bold px-2.5 py-1 gap-1"
                >
                  <DollarSign className="size-3 text-emerald-500" />
                  <span>{total.amount}</span>
                  <span className="text-[10px] font-normal text-muted-foreground font-sans">
                    ({total.period})
                  </span>
                </Badge>
              ))}
            </div>
          )}

          {/* Pricing Sources Accordion */}
          {sources.length > 0 && (
            <details className="text-xs text-muted-foreground rounded-lg bg-muted/30 p-2.5 border border-border/40">
              <summary className="cursor-pointer font-medium hover:text-foreground">
                Pricing rules used from your brief ({sources.length})
              </summary>
              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-blue-500/30">
                {[...new Set(sources)].map((src, i) => (
                  <p key={i} className="text-[11px] whitespace-pre-wrap text-foreground/80 font-mono">
                    {src}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Assumptions & Accuracy Notes Callout */}
      {questions.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Sample Assumptions &amp; Accuracy Notes</span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-foreground/85 leading-relaxed text-[11px]">
            {questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
            The sample is fully calculated. Where the brief omitted seller inputs, illustrative assumptions were used. These review notes remain in your UI for variable review and do not leak into the exported Word document.
          </p>
        </div>
      )}

      {/* Expandable Interactive Sample Proposal Editor */}
      {open && (
        <div className="space-y-4 pt-2 animate-in fade-in duration-200">
          {busy && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-blue-500" />
                <span>{draft ? "Preparing tailored Word sample..." : "Drafting sample proposal from pricing brief..."}</span>
              </div>
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-5/6 bg-muted rounded" />
            </div>
          )}

          {draft && (
            <fieldset
              disabled={busy || disabled}
              className="space-y-4"
              onChange={() => setConfirmed(false)}
            >
              {/* Proposal Metadata: Customer, Currency, Scenario */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/40">
                  <Building className="size-3.5 text-primary" />
                  <span>Client &amp; Requirements Context</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-foreground block space-y-1">
                    <span>Sample Customer Name</span>
                    <input
                      type="text"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none"
                      maxLength={200}
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                    />
                  </label>

                  <label className="text-xs font-medium text-foreground block space-y-1">
                    <span>Currency Code</span>
                    <input
                      type="text"
                      className="w-full h-8 px-2.5 text-xs font-mono uppercase rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none"
                      placeholder="e.g. USD, EUR, GBP"
                      maxLength={3}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    />
                  </label>
                </div>

                <label className="text-xs font-medium text-foreground block space-y-1">
                  <span>Customer Requirements / Lead Scenario</span>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none leading-relaxed"
                    maxLength={3000}
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                  />
                </label>
              </div>

              {/* Core Prose Sections: Title, Overview, Scope, Terms */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/40">
                  <FileText className="size-3.5 text-primary" />
                  <span>Core Proposal Narrative</span>
                </div>

                <label className="text-xs font-medium text-foreground block space-y-1">
                  <span>Document Title</span>
                  <input
                    type="text"
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none font-semibold"
                    maxLength={200}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-foreground block space-y-1">
                    <span>Executive Overview</span>
                    <textarea
                      rows={3}
                      maxLength={6000}
                      className="w-full p-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none leading-relaxed"
                      value={draft.overview}
                      onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
                    />
                  </label>

                  <label className="text-xs font-medium text-foreground block space-y-1">
                    <span>Scope of Work</span>
                    <textarea
                      rows={3}
                      maxLength={6000}
                      className="w-full p-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none leading-relaxed"
                      value={draft.scope}
                      onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                    />
                  </label>
                </div>

                <label className="text-xs font-medium text-foreground block space-y-1">
                  <span>Commercial Terms &amp; Policies</span>
                  <textarea
                    rows={2}
                    maxLength={6000}
                    className="w-full p-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 outline-none leading-relaxed"
                    value={draft.terms}
                    onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
                  />
                </label>
              </div>

              {/* Line Items Pricing Table */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Calculator className="size-4 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Services &amp; Pricing Line Items
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Deterministic line items compiled into the Word proposal table.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={lines.length >= 8}
                    onClick={() => {
                      setLines([...lines, emptySampleLine()]);
                      setDraft({ ...draft, items: [...draft.items, ""] });
                      setConfirmed(false);
                    }}
                    className="h-7 text-xs gap-1 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Service</span>
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 hover:border-border transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <label className="flex-1 text-[11px] font-medium text-foreground">
                          <span>Service Name</span>
                          <input
                            type="text"
                            maxLength={200}
                            className="w-full h-7 px-2 mt-1 text-xs rounded-md border border-border bg-background outline-none font-medium"
                            value={draft.items[index] || ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                items: draft.items.map((it, i) =>
                                  i === index ? e.target.value : it
                                ),
                              })
                            }
                          />
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={lines.length === 1}
                          aria-label={`Remove service ${index + 1}`}
                          onClick={() => {
                            setLines(lines.filter((_, i) => i !== index));
                            setDraft({
                              ...draft,
                              items: draft.items.filter((_, i) => i !== index),
                            });
                            setConfirmed(false);
                          }}
                          className="size-7 p-0 mt-5 text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <label className="text-[11px] text-muted-foreground">
                          Quantity
                          <input
                            type="number"
                            min={1}
                            max={10000}
                            step={1}
                            className="w-full h-7 px-2 mt-0.5 text-xs font-mono rounded-md border border-border bg-background outline-none"
                            value={line.quantity}
                            onChange={(e) =>
                              setLines(
                                lines.map((old, i) =>
                                  i === index ? { ...old, quantity: e.target.value } : old
                                )
                              )
                            }
                          />
                        </label>

                        <label className="text-[11px] text-muted-foreground">
                          Unit Rate ({currency})
                          <input
                            type="number"
                            min={0}
                            max={1000000}
                            step={0.01}
                            className="w-full h-7 px-2 mt-0.5 text-xs font-mono rounded-md border border-border bg-background outline-none"
                            value={line.rate}
                            onChange={(e) =>
                              setLines(
                                lines.map((old, i) =>
                                  i === index ? { ...old, rate: e.target.value } : old
                                )
                              )
                            }
                          />
                        </label>

                        <label className="text-[11px] text-muted-foreground">
                          Discount %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-full h-7 px-2 mt-0.5 text-xs font-mono rounded-md border border-border bg-background outline-none"
                            value={line.discount}
                            onChange={(e) =>
                              setLines(
                                lines.map((old, i) =>
                                  i === index ? { ...old, discount: e.target.value } : old
                                )
                              )
                            }
                          />
                        </label>

                        <label className="text-[11px] text-muted-foreground">
                          Tax %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-full h-7 px-2 mt-0.5 text-xs font-mono rounded-md border border-border bg-background outline-none"
                            value={line.tax}
                            onChange={(e) =>
                              setLines(
                                lines.map((old, i) =>
                                  i === index ? { ...old, tax: e.target.value } : old
                                )
                              )
                            }
                          />
                        </label>

                        <label className="text-[11px] text-muted-foreground">
                          Billing Period
                          <select
                            className="w-full h-7 px-1.5 mt-0.5 text-xs rounded-md border border-border bg-background outline-none cursor-pointer"
                            value={line.period}
                            onChange={(e) =>
                              setLines(
                                lines.map((old, i) =>
                                  i === index ? { ...old, period: e.target.value } : old
                                )
                              )
                            }
                          >
                            <option value="one-time">One-time</option>
                            <option value="monthly">Monthly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Sections Component */}
              <SampleSectionsEditor
                sections={sections}
                onChange={(value) => {
                  setSections(value);
                  setConfirmed(false);
                }}
                onGenerate={handleGenerateSection}
                generatingSectionId={generatingSectionId}
                disabled={busy || disabled}
              />

              {/* Review Notes Editor */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Review Notes &amp; Estimate Basis (one per line)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Persisted with briefing submission
                  </span>
                </label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-background outline-none leading-relaxed font-sans"
                  value={questions.join("\n")}
                  onChange={(e) => setQuestions(e.target.value.split("\n"))}
                  placeholder="e.g. Setup fee estimated based on standard discovery scope&#10;Discounts apply before local sales tax"
                />
              </div>

              {/* Confirmation Checkbox */}
              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="sample-confirm-check"
                  className="mt-0.5 size-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <label
                  htmlFor="sample-confirm-check"
                  className="text-xs text-foreground leading-relaxed cursor-pointer select-none"
                >
                  <strong>I confirm:</strong> I reviewed the content, sample rates, billing periods, discounts, and taxes against my pricing brief.
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => changeOpen(false)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={!canAttach}
                  onClick={handleAttach}
                  className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      <span>Generating Word Sample...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="size-3.5 mr-1.5" />
                      <span>Create &amp; Attach Word Sample</span>
                    </>
                  )}
                </Button>
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
};

export default SampleProposalBuilder;
