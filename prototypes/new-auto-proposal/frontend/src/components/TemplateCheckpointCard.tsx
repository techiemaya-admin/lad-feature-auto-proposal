import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  FileText,
  Download,
  Eye,
  ChevronRight,
  RefreshCw,
  X,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { renderAsync } from "docx-preview";
import { Button } from "./ui/button";
import type { TemplateStats } from "../types/template";
import { fetchTemplateBlob, getTemplateDownloadUrl } from "../services/api";

interface TemplateCheckpointCardProps {
  companyId: string;
  companyName: string;
  stats: TemplateStats;
  filesize?: number | null;
  onProceedToPricing?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const TemplateCheckpointCard: React.FC<TemplateCheckpointCardProps> = ({
  companyId,
  companyName,
  stats,
  filesize,
  onProceedToPricing,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  // Load preview blob and render via docx-preview
  const handleOpenPreview = async () => {
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const blob = await fetchTemplateBlob(companyId);
      setPreviewBlob(blob);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to load template for preview"
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Render docx-preview whenever blob is loaded and container is available
  useEffect(() => {
    if (isPreviewOpen && previewBlob && previewContainerRef.current) {
      previewContainerRef.current.innerHTML = "";
      renderAsync(previewBlob, previewContainerRef.current, undefined, {
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
      }).catch((err) => {
        setPreviewError(
          err instanceof Error ? err.message : "Failed to render document preview"
        );
      });
    }
  }, [isPreviewOpen, previewBlob]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPreviewOpen) {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

  const downloadUrl = getTemplateDownloadUrl(companyId);
  // The engine never drops a variable silently: misses and context-skips arrive here as details[].
  const warnings = (stats.details ?? []).filter((d) => !d.applied || d.info?.includes("skipped"));

  return (
    <>
      {/* Elevated Confirmation Checkpoint Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-bottom-2">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0 mt-0.5">
              <CheckCircle2 className="size-5.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-foreground">
                Dynamic Template Generated Successfully
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.tags_placed_count} dynamic fields
                {stats.loops_collapsed_count > 0 ? ` and ${stats.loops_collapsed_count} repeating table` : ""}
                {stats.conditional_rows_wrapped_count > 0
                  ? ` with ${stats.conditional_rows_wrapped_count} conditional rows`
                  : ""}{" "}
                configured for {companyName}.
              </p>
            </div>
          </div>

          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="Regenerate template from current variables"
            >
              <RefreshCw className={`size-3 mr-1.5 ${isRegenerating ? "animate-spin" : ""}`} />
              <span>Regenerate</span>
            </Button>
          )}
        </div>

        {/* Tactile Meta & Tag Placements Tray */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Document Status Chip (Inspired by PromptDocCapsule) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 text-xs font-mono text-foreground select-none border border-border/40">
            <FileText className="size-3.5 text-primary shrink-0" />
            <span className="font-medium">template.docx</span>
            {filesize ? (
              <span className="text-muted-foreground text-[11px]">({formatBytes(filesize)})</span>
            ) : null}
            <span className="size-1 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans font-medium">
              AST Validated
            </span>
          </div>

          {/* Tag Count Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 text-[11px] border border-border/30 text-muted-foreground font-mono">
            <span className="text-foreground font-semibold">{stats.tags_placed_count}</span>
            <span>tags placed</span>
          </div>

          {/* Loops Pill */}
          {stats.loops_collapsed_count > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 text-[11px] border border-border/30 text-muted-foreground font-mono">
              <Layers className="size-3 text-sky-500" />
              <span className="text-foreground font-semibold">{stats.loops_collapsed_count}</span>
              <span>loop table collapsed</span>
            </div>
          )}

          {/* Conditional Rows Pill */}
          {stats.conditional_rows_wrapped_count > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 text-[11px] border border-border/30 text-muted-foreground font-mono">
              <Sparkles className="size-3 text-emerald-500" />
              <span className="text-foreground font-semibold">
                {stats.conditional_rows_wrapped_count}
              </span>
              <span>conditional rows</span>
            </div>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              <span>{warnings.length} variable{warnings.length > 1 ? "s" : ""} need attention — fix the chip or the sample text, then regenerate</span>
            </div>
            <ul className="space-y-0.5 text-[11px] font-mono text-muted-foreground">
              {warnings.map((d) => (
                <li key={d.target} className="flex gap-2">
                  <span className={d.applied ? "text-amber-600" : "text-red-500"}>{d.applied ? "partial" : "missed"}</span>
                  <span className="text-foreground">{d.target}</span>
                  <span className="truncate">{d.info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Controls & Primary CTA */}
        <div className="pt-2 flex items-center justify-between border-t border-border/40">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPreview}
              className="h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/60 btn-tactile"
            >
              <Eye className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>Quick Preview (.docx)</span>
            </Button>

            <a
              href={downloadUrl}
              download="template.docx"
              className="inline-flex items-center"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 btn-tactile"
              >
                <Download className="size-3.5 mr-1.5" />
                <span>Download Template .docx</span>
              </Button>
            </a>
          </div>

          <Button
            onClick={onProceedToPricing}
            size="sm"
            className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
          >
            <span>Proceed to Pricing Engine</span>
            <ChevronRight className="size-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* In-Browser docx-preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
          <div
            className="bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-primary" />
                <div>
                  <h4 className="font-semibold text-xs tracking-tight">
                    Template Preview — {companyName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    In-browser OpenXML rendering with injected variable tags
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a href={downloadUrl} download="template.docx">
                  <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
                    <Download className="size-3 mr-1" />
                    Download
                  </Button>
                </a>

                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center text-sm transition-colors"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Canvas Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 bg-zinc-200/50 dark:bg-zinc-950/60 flex justify-center">
              {isLoadingPreview ? (
                <div className="py-24 text-center space-y-2.5 text-muted-foreground">
                  <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-xs">Rendering Word document in browser...</p>
                </div>
              ) : previewError ? (
                <div className="p-6 text-center max-w-md my-auto space-y-3 bg-destructive/5 rounded-xl border border-destructive/20 text-destructive">
                  <p className="text-xs">{previewError}</p>
                  <Button size="sm" variant="outline" onClick={handleOpenPreview}>
                    Retry Preview
                  </Button>
                </div>
              ) : (
                <div
                  ref={previewContainerRef}
                  className="bg-white text-zinc-900 rounded-lg shadow-md p-6 sm:p-10 max-w-2xl w-full min-h-125 overflow-x-auto text-xs"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/60 bg-muted/20 shrink-0 text-[11px] text-muted-foreground">
              <span>
                Rendered via <code className="font-mono text-foreground">docx-preview</code>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
                className="h-7 px-3 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TemplateCheckpointCard;
