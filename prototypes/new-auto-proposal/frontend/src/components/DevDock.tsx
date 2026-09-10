import React, { useState } from "react";
import {
  Code2,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Braces,
  Calculator,
  Activity,
  Maximize2,
  Minimize2,
  Building2,
} from "lucide-react";
import type { Company } from "../types/company";
import type { CompanyVariable, CompoundTable } from "../types/variable";
import type { TemplateStats } from "../types/template";
import { Button } from "./ui/button";

interface DevDockProps {
  company: Company | null;
  variables?: CompanyVariable[];
  compoundTables?: CompoundTable[];
  templateStats?: TemplateStats | null;
}

type TabKey = "profile" | "anydoc" | "variables" | "rules" | "logs";

export const DevDock: React.FC<DevDockProps> = ({
  company,
  variables,
  compoundTables,
  templateStats,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [viewMode, setViewMode] = useState<"raw" | "preview">("raw");
  const [copied, setCopied] = useState(false);

  const docMeta = company?.document_metadata;
  const markdown = docMeta?.extracted_markdown || "";

  const resolvedTemplateStats =
    templateStats || company?.working_state?.template_stats || null;

  const isBriefingLocked = Boolean(company?.briefing_locked);

  const variablesPayload = isBriefingLocked
    ? variables && variables.length > 0
      ? { variables, compound_tables: compoundTables || [] }
      : company?.working_state?.extracted_variables || {
          status: "extracting_variables",
          info: "Variable extraction in progress...",
          working_state: company?.working_state,
        }
    : {
        status: "awaiting_stage_2",
        info: "Gemini variable extraction runs in Stage 2 upon briefing confirmation.",
        working_state: company?.working_state ?? null,
      };

  const handleCopy = () => {
    let content = "";
    if (activeTab === "profile") {
      content = JSON.stringify(company?.data || {}, null, 2);
    } else if (activeTab === "anydoc") {
      content = markdown;
    } else if (activeTab === "variables") {
      content = JSON.stringify(variablesPayload, null, 2);
    } else if (activeTab === "rules") {
      content = JSON.stringify(company?.data?.pricing_engine_spec || {}, null, 2);
    } else if (activeTab === "logs") {
      content = JSON.stringify(
        {
          company_id: company?.company_id,
          briefing_locked: company?.briefing_locked,
          document_metadata: company?.document_metadata,
          updated_at: company?.updated_at,
          pipeline_stage: resolvedTemplateStats
            ? "Stage 3: Template Checkpoint"
            : company?.briefing_locked
            ? "Stage 2: Variable Review"
            : "Stage 1: Pricing Briefing",
          template_status: resolvedTemplateStats ? "generated" : "awaiting_generation",
          template_stats: resolvedTemplateStats,
        },
        null,
        2
      );
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = markdown ? markdown.split("\n").length : 0;
  const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : 0;

  return (
    <>
      {/* Floating Trigger Pill when closed */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card text-foreground shadow-lg hover:shadow-xl transition-all duration-150 text-xs font-mono font-medium hover:scale-105 active:scale-95 btn-tactile border border-border"
          >
            <Code2 className="size-3.5 text-primary shrink-0" />
            <span>Dev Inspector</span>
            {markdown ? (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : null}
          </button>
        </div>
      )}

      {/* Docked Inspector Tray when open */}
      {isOpen && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-card/95 text-foreground border-t border-border shadow-2xl backdrop-blur-md transition-all duration-200 flex flex-col ${
            isExpanded ? "h-[90vh]" : "h-72 sm:h-80"
          }`}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40 shrink-0 select-none">
            <div className="flex items-center gap-3 overflow-x-auto">
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground shrink-0">
                <Code2 className="size-3.5 text-primary" />
                <span>Dev Inspector</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {company?.company_name}
                </span>
              </div>

              {/* Tabs */}
              <nav className="flex items-center rounded-lg bg-muted p-0.5 border border-border/70 text-xs">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "profile"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="size-3 text-indigo-500" />
                  <span>Profile JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("anydoc")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "anydoc"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="size-3 text-primary" />
                  <span>Quotation Markdown</span>
                  {markdown && (
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("variables")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "variables"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Braces className="size-3 text-sky-500" />
                  <span>Variables JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("rules")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "rules"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calculator className="size-3 text-emerald-500" />
                  <span>Rule Schema</span>
                </button>

                <button
                  onClick={() => setActiveTab("logs")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "logs"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="size-3 text-amber-500" />
                  <span>Pipeline State</span>
                </button>
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {activeTab === "anydoc" && markdown && (
                <div className="hidden sm:flex items-center gap-1 text-xs font-mono text-muted-foreground mr-2 bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                  <span>{lineCount} lines</span>
                  <span>•</span>
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>{docMeta?.filesize ? `${(docMeta.filesize / 1024).toFixed(1)} KB` : ""}</span>
                </div>
              )}

              {activeTab === "anydoc" && markdown && (
                <div className="flex items-center rounded-md bg-muted p-0.5 border border-border/60 text-xs font-mono mr-1">
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`px-2 py-0.5 rounded ${
                      viewMode === "raw" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`px-2 py-0.5 rounded ${
                      viewMode === "preview" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title="Copy contents"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title={isExpanded ? "Collapse height" : "Expand to 80% height"}
              >
                {isExpanded ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title="Close Inspector"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content Body: Constrained readable width, auto wrap, no horizontal scroll */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs leading-relaxed">
            <div className="max-w-6xl mx-auto w-full">
            {activeTab === "profile" && (
              <div>
                <div className="text-xs font-sans text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Raw Company Profile JSON:</span>
                  <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border/60">
                    {company?.company_id}
                  </span>
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>{JSON.stringify(company?.data || {}, null, 2)}</code>
                </pre>
              </div>
            )}

            {activeTab === "anydoc" && (
              <div>
                {markdown ? (
                  viewMode === "raw" ? (
                    <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all select-text">
                      <code>{markdown}</code>
                    </pre>
                  ) : (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                      <pre className="whitespace-pre-wrap wrap-break-word break-all">
                        {markdown}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center text-muted-foreground space-y-2 font-sans">
                    <FileText className="size-8 mx-auto opacity-30 text-primary" />
                    <p className="text-xs font-medium text-foreground">
                      No quotation document parsed yet for this company.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attach a Microsoft Word quotation (.docx) in Stage 1 and click Send to inspect the extracted Markdown.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "variables" && (
              <div>
                <div className="text-xs font-sans text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Taxonomy and variable anchors (Stage 2):</span>
                  {isBriefingLocked && variables && variables.length > 0 && (
                    <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border/60">
                      {variables.length} active • {compoundTables?.length || 0} tables
                    </span>
                  )}
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>{JSON.stringify(variablesPayload, null, 2)}</code>
                </pre>
              </div>
            )}

            {activeTab === "rules" && (
              <div>
                <div className="text-xs font-sans text-muted-foreground mb-2">
                  Pricing Rule Schema (Stage 4 preview):
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>
                    {JSON.stringify(
                      company?.data?.pricing_engine_spec || {
                        status: "awaiting_stage_4",
                        info: "Pricing rule schema compiles in Stage 4.",
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}

            {activeTab === "logs" && (
              <div>
                <div className="flex items-center justify-between text-xs font-sans text-muted-foreground mb-2">
                  <span>Pipeline execution telemetry & mutation logs:</span>
                  {resolvedTemplateStats && (
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {resolvedTemplateStats.tags_placed_count} tags • {resolvedTemplateStats.loops_collapsed_count} loops
                    </span>
                  )}
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>
                    {JSON.stringify(
                      {
                        company_id: company?.company_id,
                        briefing_locked: company?.briefing_locked,
                        pipeline_stage: resolvedTemplateStats
                          ? "Stage 3: Template Checkpoint (Mutated .docx ready)"
                          : company?.briefing_locked
                          ? "Stage 2: Variable Review"
                          : "Stage 1: Pricing Briefing",
                        template_status: resolvedTemplateStats ? "generated" : "awaiting_generation",
                        template_stats: resolvedTemplateStats,
                        document_metadata: company?.document_metadata,
                        updated_at: company?.updated_at,
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default DevDock;
