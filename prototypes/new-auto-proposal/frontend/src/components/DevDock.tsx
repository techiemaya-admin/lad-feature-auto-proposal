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
} from "lucide-react";
import type { Company } from "../types/company";
import { Button } from "./ui/button";

interface DevDockProps {
  company: Company | null;
}

type TabKey = "anydoc" | "variables" | "rules" | "logs";

export const DevDock: React.FC<DevDockProps> = ({ company }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("anydoc");
  const [viewMode, setViewMode] = useState<"raw" | "preview">("raw");
  const [copied, setCopied] = useState(false);

  const docMeta = company?.document_metadata;
  const markdown = docMeta?.extracted_markdown || "";

  const handleCopy = () => {
    let content = "";
    if (activeTab === "anydoc") {
      content = markdown;
    } else if (activeTab === "variables") {
      content = JSON.stringify(company?.working_state || {}, null, 2);
    } else if (activeTab === "rules") {
      content = JSON.stringify(company?.data?.pricing_engine_spec || {}, null, 2);
    } else if (activeTab === "logs") {
      content = JSON.stringify(
        {
          company_id: company?.company_id,
          briefing_locked: company?.briefing_locked,
          document_metadata: company?.document_metadata,
          updated_at: company?.updated_at,
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-lg hover:shadow-xl transition-all duration-150 text-xs font-mono font-medium hover:scale-105 active:scale-95 btn-tactile border border-border/40"
          >
            <Code2 className="size-3.5 text-indigo-400 dark:text-indigo-600" />
            <span>&lt;/&gt; Dev Inspector</span>
            {markdown ? (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : null}
          </button>
        </div>
      )}

      {/* Docked HUD Tray when open */}
      {isOpen && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 dark:bg-black/95 text-zinc-200 border-t border-zinc-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 flex flex-col ${
            isExpanded ? "h-[75vh]" : "h-72 sm:h-80"
          }`}
        >
          {/* HUD Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0 select-none">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-300">
                <Code2 className="size-4 text-indigo-400" />
                <span>Dev HUD</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 text-[11px]">{company?.company_name}</span>
              </div>

              {/* Tabs */}
              <nav className="flex items-center rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 text-xs">
                <button
                  onClick={() => setActiveTab("anydoc")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === "anydoc"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FileText className="size-3 text-indigo-400" />
                  <span>AnyDoc Markdown</span>
                  {markdown && (
                    <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("variables")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === "variables"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Braces className="size-3 text-sky-400" />
                  <span>Variables JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("rules")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === "rules"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Calculator className="size-3 text-emerald-400" />
                  <span>Rule Schema</span>
                </button>

                <button
                  onClick={() => setActiveTab("logs")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === "logs"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Activity className="size-3 text-amber-400" />
                  <span>Pipeline Logs</span>
                </button>
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5">
              {activeTab === "anydoc" && markdown && (
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-zinc-400 mr-2 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  <span>{lineCount} lines</span>
                  <span>•</span>
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>{docMeta?.filesize ? `${(docMeta.filesize / 1024).toFixed(1)} KB` : ""}</span>
                </div>
              )}

              {activeTab === "anydoc" && markdown && (
                <div className="flex items-center rounded-md bg-zinc-900 p-0.5 border border-zinc-800 text-[10px] font-mono mr-1">
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`px-2 py-0.5 rounded ${
                      viewMode === "raw" ? "bg-zinc-800 text-white" : "text-zinc-400"
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`px-2 py-0.5 rounded ${
                      viewMode === "preview" ? "bg-zinc-800 text-white" : "text-zinc-400"
                    }`}
                  >
                    Formatted
                  </button>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="size-6 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                title="Copy contents"
              >
                {copied ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="size-6 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                title={isExpanded ? "Collapse height" : "Expand height"}
              >
                {isExpanded ? (
                  <Minimize2 className="size-3" />
                ) : (
                  <Maximize2 className="size-3" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-6 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                title="Close Dev Dock"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
            {activeTab === "anydoc" && (
              <div>
                {markdown ? (
                  viewMode === "raw" ? (
                    <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap select-text">
                      <code>{markdown}</code>
                    </pre>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none space-y-2 text-zinc-200">
                      <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] whitespace-pre-wrap">
                        {markdown}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center text-zinc-500 space-y-2 font-sans">
                    <FileText className="size-8 mx-auto opacity-30 text-indigo-400" />
                    <p className="text-xs text-zinc-400">
                      No quotation document parsed yet for this company.
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      Attach a Microsoft Word quotation (.docx) in Stage 1 and click Send to inspect the extracted AnyDoc Markdown.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "variables" && (
              <div>
                <div className="text-[11px] text-zinc-400 mb-2 font-sans">
                  Taxonomy and variable anchors (Stage 2 preview):
                </div>
                <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                  <code>
                    {JSON.stringify(
                      company?.working_state?.extracted_variables || {
                        status: "awaiting_stage_2",
                        info: "Gemini variable extraction runs in Issue 03 upon briefing confirmation.",
                        working_state: company?.working_state,
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}

            {activeTab === "rules" && (
              <div>
                <div className="text-[11px] text-zinc-400 mb-2 font-sans">
                  Pricing Rule Schema (Stage 4 preview):
                </div>
                <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                  <code>
                    {JSON.stringify(
                      company?.data?.pricing_engine_spec || {
                        status: "awaiting_stage_4",
                        info: "Pricing rule schema compiles in Issue 05.",
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
                <div className="text-[11px] text-zinc-400 mb-2 font-sans">
                  Pipeline execution telemetry & session state:
                </div>
                <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                  <code>
                    {JSON.stringify(
                      {
                        company_id: company?.company_id,
                        briefing_locked: company?.briefing_locked,
                        document_metadata: company?.document_metadata,
                        updated_at: company?.updated_at,
                        parser: "@firecrawl/anydoc (native Rust binding)",
                        pipeline_stage: company?.briefing_locked
                          ? "Stage 2: Variable Review"
                          : "Stage 1: Briefing Capsule",
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
      )}
    </>
  );
};

export default DevDock;
