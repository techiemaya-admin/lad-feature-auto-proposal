import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Upload,
  Lock,
  Edit2,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  WandSparkles,
  FileCheck,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import type { Company } from "../../types/company";

interface Stage1BriefingProps {
  company: Company;
  isLocked: boolean;
  isSubmitting?: boolean;
  onSubmit: (prompt: string, file: File | null) => Promise<void> | void;
  onGeneratePrompt?: () => Promise<string> | string;
  onUnlock: () => Promise<void> | void;
  onProceed: () => void;
}

export const Stage1Briefing: React.FC<Stage1BriefingProps> = ({
  company,
  isLocked,
  isSubmitting = false,
  onSubmit,
  onGeneratePrompt,
  onUnlock,
  onProceed,
}) => {
  const [promptText, setPromptText] = useState(company.pricing_spec || "");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if pricing_spec changes on company switch or reset
  useEffect(() => {
    setPromptText(company.pricing_spec || "");
  }, [company.pricing_spec, company.company_id, company.template_id]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a Microsoft Word document (.docx)");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a Microsoft Word document (.docx)");
      }
    }
  };

  const handleSubmit = async () => {
    if (!promptText.trim()) return;
    if (!selectedFile && !company.document_metadata?.filename && !company.quotation_filename) {
      alert("Please upload a Microsoft Word (.docx) quotation document before proceeding.");
      return;
    }
    await onSubmit(promptText.trim(), selectedFile);
  };

  const handleGeneratePrompt = async () => {
    if (!onGeneratePrompt) return;
    setIsGeneratingPrompt(true);
    try {
      const generated = await onGeneratePrompt();
      if (generated.trim()) {
        setPromptText(generated);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  return (
    <div className="stage-arrival rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-xs">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            {isLocked ? <CheckCircle2 className="size-4.5 text-emerald-500" /> : <Sparkles className="size-4.5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Stage 1: Pricing Briefing &amp; Quotation Ingestion</span>
              {isLocked && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Locked &amp; Ingested
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Input natural language pricing logic and upload your sample .docx quotation document.
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onUnlock}
              className="h-8 px-3 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
            >
              <Upload className="size-3.5 mr-1.5 text-[#2B7CFF]" />
              <span>Upload New .docx</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnlock}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <Edit2 className="size-3.5 mr-1.5" />
              <span>Unlock &amp; Edit</span>
            </Button>
          </div>
        )}
      </div>

      {isLocked ? (
        /* Read-only Locked View */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 dark:bg-[#14233a] border border-border/80 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-emerald-500" />
              <span>Confirmed Pricing Briefing Spec</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
              {promptText}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center border border-blue-200/50 dark:border-[#2B7CFF]/30">
                <FileText className="size-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  {selectedFile?.name || company.document_metadata?.filename || "Primary_Quotation.docx"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Verified sample quotation • Extracted via @firecrawl/anydoc
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              Ingested &amp; Ready
            </span>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Quotation parsed into semantic markdown AST
            </span>
            <Button
              onClick={onProceed}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
            >
              <span>View Variable Ledger</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        /* Active Editable Form */
        <div className="space-y-5">
          {/* Prompt Section with AI generation actions */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-foreground">
                Describe your pricing logic, tiers, volume rules, and taxes
              </label>
              {onGeneratePrompt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePrompt}
                  disabled={isGeneratingPrompt}
                  className="h-8 px-3 text-xs font-semibold border-[#2B7CFF]/30 text-[#0B1957] hover:bg-[#2B7CFF]/5 dark:text-[#2B7CFF] cursor-pointer"
                >
                  {isGeneratingPrompt ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <WandSparkles className="size-3.5 mr-1.5" />
                  )}
                  <span>{isGeneratingPrompt ? "Generating..." : "AI Generate Prompt"}</span>
                </Button>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={5}
              className="w-full text-xs p-3.5 rounded-xl border border-border/80 bg-card text-foreground focus:ring-2 focus:ring-[#2B7CFF]/30 outline-hidden leading-relaxed shadow-inner"
              placeholder="e.g. We have 3 packages: Local ($1000/mo), Growth ($3000/mo), Authority ($8000/mo)..."
            />
          </div>

          {/* Primary Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!selectedFile) {
                fileInputRef.current?.click();
              }
            }}
            className={`relative rounded-xl border-2 border-dashed p-4 transition-all text-center ${
              !selectedFile ? "cursor-pointer" : ""
            } ${
              isDragging
                ? "border-[#2B7CFF] bg-[#2B7CFF]/5"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-border/80 hover:border-[#2B7CFF]/40 bg-muted/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileSelect}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <FileCheck className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for extraction
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="h-7 px-2.5 text-[11px] cursor-pointer"
                  >
                    Change File
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="size-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="size-10 rounded-full bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center mx-auto border border-blue-200/60 dark:border-[#2B7CFF]/30">
                  <Upload className="size-5" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="text-xs font-bold text-[#0B1957] dark:text-[#2B7CFF] hover:underline cursor-pointer"
                  >
                    Upload quotation .docx
                  </button>
                  <span className="text-xs text-muted-foreground"> or drag &amp; drop file here</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Microsoft Word (.docx) • Auto-scanned into semantic markdown
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ready to parse document &amp; extract dynamic variables
            </span>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !promptText.trim()}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Parsing Quotation via AnyDoc...</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Discover Variables</span>
                  <ChevronRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
