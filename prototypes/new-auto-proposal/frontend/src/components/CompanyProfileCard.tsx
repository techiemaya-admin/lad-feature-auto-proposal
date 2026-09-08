import React, { useState } from "react";
import {
  RotateCcw,
  DownloadCloud,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Code2,
} from "lucide-react";
import type { Company } from "../types/company";
import { Button } from "./ui/button";
import { PromptDocCapsule } from "./PromptDocCapsule";

interface CompanyProfileCardProps {
  company: Company;
  isLoading: boolean;
  isSubmittingBriefing?: boolean;
  onSaveSpec: (newSpec: string) => Promise<void>;
  onImportSettings: () => Promise<void>;
  onResetDefault: () => Promise<void>;
  onSubmitBriefing: (prompt: string, file: File | null) => Promise<void>;
  onUnlockBriefing: () => Promise<void>;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  company,
  isLoading,
  isSubmittingBriefing,
  onImportSettings,
  onResetDefault,
  onSubmitBriefing,
  onUnlockBriefing,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onImportSettings();
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = async () => {
    if (
      window.confirm(
        `Reset "${company.company_name}" to default mock settings?`
      )
    ) {
      setIsResetting(true);
      try {
        await onResetDefault();
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(company.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const basics = company.data?.company_basics || {
    company_name: company.company_name,
    location: company.location || "",
  };
  const industry = company.industry || company.data?.company_details?.industry;

  return (
    <div className="space-y-6">
      {/* Sleek Company Info & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {basics.company_name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[basics.location, industry].filter(Boolean).join(" • ")}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={isImporting || isLoading}
            className="text-xs h-8 btn-tactile"
          >
            <DownloadCloud className={`size-3.5 mr-1.5 ${isImporting ? "animate-bounce" : ""}`} />
            {isImporting ? "Importing..." : "Import Settings"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isLoading}
            className="text-xs h-8 text-muted-foreground hover:text-destructive btn-tactile"
          >
            <RotateCcw className={`size-3.5 mr-1.5 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "Resetting..." : "Reset"}
          </Button>
        </div>
      </div>

      {/* Stage 1: Compound Briefing Capsule (Prompt + Docked Dropzone) */}
      <PromptDocCapsule
        company={company}
        isSubmitting={isSubmittingBriefing}
        onSubmit={onSubmitBriefing}
        onUnlock={onUnlockBriefing}
      />

      {/* Reviewer Dropdown: Raw Profile JSON on subtle darker surface */}
      <div className="rounded-xl bg-zinc-200/40 dark:bg-zinc-900/50 overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => setIsJsonExpanded(!isJsonExpanded)}
          className="w-full flex items-center justify-between py-3 px-4 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Code2 className="size-3.5 text-primary/70" />
            <span>Reviewer Dropdown: Raw Profile JSON</span>
            <span className="font-mono text-[10px] text-muted-foreground/80 bg-zinc-300/60 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded-sm">
              {company.company_id}
            </span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-[11px]">{isJsonExpanded ? "Hide" : "Show"}</span>
            {isJsonExpanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </div>
        </button>

        {isJsonExpanded && (
          <div className="p-4 pt-1 relative">
            <Button
              size="xs"
              variant="outline"
              onClick={handleCopyJson}
              className="absolute right-6 top-3 z-10 text-[11px] h-6 bg-background/90 backdrop-blur-xs"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-500 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3 mr-1 text-muted-foreground" /> Copy
                </>
              )}
            </Button>
            <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-200 dark:bg-black font-mono text-[11px] leading-relaxed overflow-x-auto max-h-80 border-0">
              <code>{JSON.stringify(company.data, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
