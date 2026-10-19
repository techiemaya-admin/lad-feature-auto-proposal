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
  Download,
  AlertTriangle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/confirm-dialog";
import type { Company } from "../../types/company";
import { SampleProposalBuilder } from "../SampleProposalBuilder";

interface Stage1BriefingProps {
  company: Company;
  isLocked: boolean;
  isSubmitting?: boolean;
  onSubmit: (prompt: string, file: File | null, notes?: string[]) => Promise<void> | void;
  onGeneratePrompt?: () => Promise<string> | string;
  onUnlock: () => Promise<void> | void;
  onProceed: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
  const [reviewNotes, setReviewNotes] = useState<string[]>(
    company.working_state?.sample_review_notes ?? []
  );
  const [sampleOpen, setSampleOpen] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<string | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string>("");
  const [docSourceMode, setDocSourceMode] = useState<"upload" | "ai_generate">("upload");

  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [invalidFileAlertOpen, setInvalidFileAlertOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if pricing_spec changes on company switch or reset
  useEffect(() => {
    setPromptText(company.pricing_spec || "");
  }, [company.pricing_spec, company.company_id, company.template_id]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFileUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setSelectedFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const hasExistingDoc = Boolean(company.document_metadata?.filename || company.quotation_filename);
  const hasDocument = Boolean(selectedFile) || hasExistingDoc;
  const isPromptValid = promptText.trim().length > 0;
  const isBriefStale = Boolean(
    selectedFile && generatedBrief !== null && generatedBrief !== promptText
  );
  const canSubmit =
    isPromptValid &&
    hasDocument &&
    !isSubmitting &&
    !sampleOpen &&
    !isBriefStale;

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
        setGeneratedBrief(null);
        setReviewNotes([]);
      } else {
        setInvalidFileAlertOpen(true);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(file);
        setGeneratedBrief(null);
        setReviewNotes([]);
      } else {
        setInvalidFileAlertOpen(true);
      }
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setGeneratedBrief(null);
    setReviewNotes(company.working_state?.sample_review_notes ?? []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(promptText.trim(), selectedFile, reviewNotes);
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

  const isAiGenerated = generatedBrief !== null;

  return (
    <div className="stage-arrival rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-xs">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            {isLocked ? (
              <CheckCircle2 className="size-4.5 text-emerald-500" />
            ) : (
              <Sparkles className="size-4.5" />
            )}
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
              Input natural language pricing logic and attach a Microsoft Word (.docx) proposal or generate one with AI.
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
              <span>Upload / Replace .docx</span>
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

          {/* Persisted Sample Review Notes if generated */}
          {reviewNotes.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Information to Confirm (Sample Assumptions)</span>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-foreground/85 text-xs leading-relaxed">
                {reviewNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground pt-1">
                These accuracy notes remain in your UI for variable review and were excluded from the Word proposal document.
              </p>
            </div>
          )}

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
                  Verified proposal document • Extracted via @firecrawl/anydoc
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
        <div className="space-y-6">
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

          {/* ========================================================= */}
          {/* PRO DOCUMENT ADD SECTION: DUAL-MODE WORKSPACE             */}
          {/* ========================================================= */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-[#2B7CFF]" />
                  <span>Proposal Document Source (.docx)</span>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Upload an existing quotation or generate an offer-specific Word proposal with AI.
                </p>
              </div>

              {/* Seamless Segmented Mode Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDocSourceMode("upload")}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    docSourceMode === "upload"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="size-3.5" />
                  <span>Upload .docx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDocSourceMode("ai_generate")}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    docSourceMode === "ai_generate"
                      ? "bg-blue-600 text-white shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  <span>AI Generate Proposal</span>
                </button>
              </div>
            </div>

            {/* If a file is attached: Show rich Verified Document Capsule */}
            {selectedFile ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      <FileCheck className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground truncate max-w-64 sm:max-w-md">
                          {selectedFile.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0 ${
                            isAiGenerated
                              ? "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                              : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          }`}
                        >
                          {isAiGenerated ? "AI Generated Sample" : "Uploaded Quotation"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatBytes(selectedFile.size)} • Ready for semantic extraction &amp; variable discovery
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedFileUrl && (
                      <a
                        href={selectedFileUrl}
                        download={selectedFile.name}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-semibold rounded-lg border border-border/80 text-[#0B1957] dark:text-[#2B7CFF] hover:bg-muted transition-colors"
                      >
                        <Download className="size-3.5" />
                        <span>Download .docx</span>
                      </a>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isAiGenerated) {
                          setDocSourceMode("ai_generate");
                          setSampleOpen(true);
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                      className="h-7 px-2.5 text-xs text-foreground cursor-pointer"
                    >
                      {isAiGenerated ? "Edit Sample" : "Change File"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFile}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Remove attached file"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stale Brief Alert */}
                {isBriefStale && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>The pricing brief was edited after generating this sample. Please regenerate the sample to keep rates and scope consistent.</span>
                  </div>
                )}
              </div>
            ) : hasExistingDoc ? (
              /* Previously uploaded backend document badge */
              <div className="rounded-xl border border-emerald-500/30 bg-card p-3.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <FileText className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {company.document_metadata?.filename || company.quotation_filename}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Existing quotation active in pipeline • Click Upload or AI Generate to replace
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2.5 text-xs"
                >
                  Replace File
                </Button>
              </div>
            ) : null}

            {/* TAB CONTENT: Mode 1 - Upload Area */}
            {docSourceMode === "upload" && !selectedFile && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed p-6 transition-all text-center cursor-pointer ${
                  isDragging
                    ? "border-[#2B7CFF] bg-[#2B7CFF]/5"
                    : "border-border/80 hover:border-[#2B7CFF]/50 bg-muted/20 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <div className="space-y-2 py-1">
                  <div className="size-11 rounded-full bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center mx-auto border border-blue-200/60 dark:border-[#2B7CFF]/30 shadow-2xs">
                    <Upload className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0B1957] dark:text-[#2B7CFF] hover:underline cursor-pointer">
                      Upload quotation .docx
                    </span>
                    <span className="text-xs text-muted-foreground"> or drag &amp; drop file here</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Microsoft Word (.docx) • Converted to structured markdown AST via @firecrawl/anydoc
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocSourceMode("ai_generate");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <Sparkles className="size-3.5" />
                      <span>Don't have a quotation? Generate an AI Word sample with real pricing →</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Mode 2 - AI Sample Proposal Generator Workspace */}
            {(docSourceMode === "ai_generate" || (docSourceMode === "upload" && selectedFile && isAiGenerated)) && (
              <div className="pt-1">
                <SampleProposalBuilder
                  key={company.template_id || "default"}
                  company={company}
                  pricingBrief={promptText}
                  disabled={isSubmitting}
                  onFile={(file, notes) => {
                    setSelectedFile(file);
                    setGeneratedBrief(promptText);
                    setReviewNotes(notes);
                  }}
                  onOpenChange={setSampleOpen}
                />
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {hasDocument
                ? "Document attached and ready to discover dynamic variables."
                : "Attach a .docx quotation or generate a sample proposal above to continue."}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
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

      <ConfirmDialog
        open={invalidFileAlertOpen}
        title="Invalid file format"
        description="Please upload a Microsoft Word document (.docx)."
        confirmLabel="OK"
        cancelLabel={null}
        onConfirm={() => setInvalidFileAlertOpen(false)}
        onCancel={() => setInvalidFileAlertOpen(false)}
      />
    </div>
  );
};

export default Stage1Briefing;
