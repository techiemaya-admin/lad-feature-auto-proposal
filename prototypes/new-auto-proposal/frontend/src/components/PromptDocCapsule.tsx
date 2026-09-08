import React, { useState, useEffect, useRef } from "react";
import {
  FileUp,
  FileText,
  Send,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { Company } from "../types/company";
import { Button } from "./ui/button";

interface PromptDocCapsuleProps {
  company: Company;
  isSubmitting?: boolean;
  onSubmit: (prompt: string, file: File | null) => Promise<void>;
  onUnlock: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const PromptDocCapsule: React.FC<PromptDocCapsuleProps> = ({
  company,
  isSubmitting = false,
  onSubmit,
  onUnlock,
}) => {
  const [promptText, setPromptText] = useState(company.pricing_spec || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLockedExpanded, setIsLockedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with active company
  useEffect(() => {
    setPromptText(company.pricing_spec || "");
    setSelectedFile(null);
    setShowResetModal(false);
    setIsLockedExpanded(false);
  }, [company.company_id, company.pricing_spec]);

  const isLocked = Boolean(company.briefing_locked);
  const hasExistingDoc = Boolean(company.document_metadata?.filename);
  const hasDocument = Boolean(selectedFile) || hasExistingDoc;
  const isPromptValid = promptText.trim().length > 0;
  const canSubmit = isPromptValid && hasDocument && !isSubmitting;

  // Realistic placeholders matching the company's domain
  const getPlaceholder = () => {
    if (company.company_id === "co1_seo") {
      return "Describe your tiers, packages, and taxes (e.g. Local is $1,000/mo, Growth is $3,000/mo up to 3 locations, Authority is $8,000/mo. Annual prepay gets 10% off. Texas sales tax 8.25%)...";
    } else if (company.company_id === "co2_msp") {
      return "Describe your seat tiers, volume discounts, and device addons (e.g. Essential $45/seat, Standard $65/seat, Premium $85/seat. 25-49 seats gets $5/seat volume discount. Extra servers $12/mo. Ohio tax 6% on recurring only)...";
    } else if (company.company_id === "co3_dev") {
      return "Describe your project scope, add-on menu, and payment milestones (e.g. E-Commerce Build base is $9,500. Copywriting is $600, Basic SEO is $450. Selecting 2+ add-ons gets 10% off add-ons. 50% deposit on signing, 50% on delivery)...";
    }
    return "Describe your pricing model, tiers, volume rules, add-ons, and taxes in natural language...";
  };

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

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(promptText.trim(), selectedFile);
  };

  const handleConfirmUnlock = async () => {
    setIsResetting(true);
    try {
      await onUnlock();
      setShowResetModal(false);
    } finally {
      setIsResetting(false);
    }
  };

  // LOCKED STATE: Smooth collapsed read-only ribbon (<200ms)
  if (isLocked) {
    const docMeta = company.document_metadata;
    return (
      <div className="relative rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/70 p-5 transition-all duration-200 ease-out">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stage 1
                </span>
                <span className="size-1 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Compound Briefing Capsule
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Locked & Active
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetModal(true)}
            className="text-xs h-7 self-start sm:self-auto gap-1 text-muted-foreground hover:text-foreground btn-tactile"
          >
            <Edit3 className="size-3" />
            <span>Edit / Reset ✎</span>
          </Button>
        </div>

        {/* Document Status Chip */}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-300/40 dark:bg-zinc-800/60 text-xs font-mono text-foreground select-none">
            <FileText className="size-3.5 text-primary shrink-0" />
            <span className="font-medium truncate max-w-[240px] sm:max-w-md">
              {docMeta?.filename || "original_quotation.docx"}
            </span>
            {docMeta?.filesize ? (
              <span className="text-muted-foreground text-[11px]">
                ({formatBytes(docMeta.filesize)})
              </span>
            ) : null}
            <span className="size-1 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
              Parsed via AnyDoc
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLockedExpanded(!isLockedExpanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto transition-colors"
          >
            <span>{isLockedExpanded ? "Collapse Notes" : "View Full Notes"}</span>
            {isLockedExpanded ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        </div>

        {/* Prompt Preview */}
        <div className="mt-3">
          <p
            className={`text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap ${
              isLockedExpanded ? "" : "line-clamp-2"
            }`}
          >
            {promptText}
          </p>
        </div>

        {/* Hard Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Reset Downstream Pipeline?
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Editing your pricing prompt or quotation will re-extract variables and regenerate downstream templates and pricing rules. Your current text will be preserved in the prompt box.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmUnlock}
                  disabled={isResetting}
                  className="text-xs h-8 btn-tactile"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="size-3 mr-1.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Unlock & Reset Pipeline"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EDITABLE STATE: Fused Prompt Textarea + Docked Dropzone
  return (
    <div className="rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/80 p-5 space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Stage 1: Compound Briefing Capsule
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Prompt + Quotation Document
        </span>
      </div>

      {/* Recessed Darker Well (Anti "Box-in-Box" Tonal Container) */}
      <div className="rounded-xl bg-zinc-300/40 dark:bg-zinc-950/70 p-4 space-y-3 shadow-inner">
        {/* Multiline Prompt Textarea (Enter = newline, never submits) */}
        <div className="space-y-1">
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            disabled={isSubmitting}
            placeholder={getPlaceholder()}
            className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 p-0 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 resize-y"
          />
          <div className="flex justify-end text-[10px] text-muted-foreground/70">
            {promptText.length} characters
          </div>
        </div>

        {/* Docked Dropzone directly underneath the prompt */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-lg p-3.5 cursor-pointer transition-all duration-150 border border-dashed select-none ${
            isDragging
              ? "ring-2 ring-primary/60 bg-primary/10 border-primary/50"
              : selectedFile || hasExistingDoc
              ? "bg-zinc-200/70 dark:bg-zinc-900/90 border-border/80"
              : "bg-zinc-200/30 dark:bg-zinc-900/40 border-border/60 hover:border-primary/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            /* Attached File Badge (Pop-in animation) */
            <div className="flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatBytes(selectedFile.size)} • Ready for AnyDoc parsing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearFile}
                className="size-6 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-800 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                title="Remove attached file"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : hasExistingDoc ? (
            /* Previously Uploaded File Badge */
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-md bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {company.document_metadata?.filename}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Existing quotation on disk • Click to replace (.docx)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Idle Dropzone Call to Action */
            <div className="flex flex-col items-center justify-center py-2 text-center space-y-1">
              <FileUp className="size-5 text-muted-foreground/70" />
              <p className="text-xs font-medium text-foreground">
                Drop your quotation (.docx) here, or click to browse
              </p>
              <p className="text-[10px] text-muted-foreground">
                Microsoft Word (.docx) files only • Auto-converted to Markdown via @firecrawl/anydoc
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Validation Caption & Tactile CTA Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="text-[11px] text-muted-foreground">
          {!isPromptValid && !hasDocument ? (
            <span>Please provide pricing details and attach a sample quotation (.docx) to continue.</span>
          ) : !isPromptValid ? (
            <span>Please write your pricing guidelines above.</span>
          ) : !hasDocument ? (
            <span>Please attach a sample Microsoft Word (.docx) quotation.</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Ready to submit briefing and parse quotation
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`h-9 px-4 text-xs font-medium rounded-lg gap-2 btn-tactile transition-all duration-200 ${
            canSubmit
              ? "bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 active:scale-[0.98]"
              : "opacity-50 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Parsing Quotation...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <Send className="size-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PromptDocCapsule;
