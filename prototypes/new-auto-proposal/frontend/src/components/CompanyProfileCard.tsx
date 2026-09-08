import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  DownloadCloud,
  Save,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Code2,
  Sparkles,
} from "lucide-react";
import type { Company } from "../types/company";
import { Button } from "./ui/button";

interface CompanyProfileCardProps {
  company: Company;
  isLoading: boolean;
  onSaveSpec: (newSpec: string) => Promise<void>;
  onImportSettings: () => Promise<void>;
  onResetDefault: () => Promise<void>;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  company,
  isLoading,
  onSaveSpec,
  onImportSettings,
  onResetDefault,
}) => {
  const [specText, setSpecText] = useState(company.pricing_spec || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "unsaved">("idle");

  useEffect(() => {
    setSpecText(company.pricing_spec || "");
    setSaveStatus("idle");
  }, [company.company_id, company.pricing_spec]);

  const hasUnsavedChanges = specText !== (company.pricing_spec || "");

  const handleSpecChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSpecText(e.target.value);
    setSaveStatus(e.target.value !== company.pricing_spec ? "unsaved" : "idle");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSpec(specText);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onImportSettings();
      setSaveStatus("idle");
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
        setSaveStatus("idle");
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
    <div className="space-y-5">
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
            className="text-xs h-8"
          >
            <DownloadCloud className={`size-3.5 mr-1.5 ${isImporting ? "animate-bounce" : ""}`} />
            {isImporting ? "Importing..." : "Import Settings"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isLoading}
            className="text-xs h-8 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className={`size-3.5 mr-1.5 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "Resetting..." : "Reset"}
          </Button>
        </div>
      </div>

      {/* Primary Focus: Pricing Engine Spec Editor (Darker Shaded Surface, No Nested Boxes) */}
      <div className="rounded-2xl bg-zinc-200/60 dark:bg-zinc-900/80 p-5 space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Pricing Engine Specification
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            {saveStatus === "unsaved" && (
              <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="size-3" />
                Saved
              </span>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="text-xs h-7 px-3 shadow-xs"
            >
              <Save className="size-3 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Seamless Textarea: directly on the shaded surface, no inner border box */}
        <textarea
          value={specText}
          onChange={handleSpecChange}
          rows={8}
          className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 p-0 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 resize-y"
          placeholder="Describe your packages, rates, volume discounts, taxes, and add-ons in natural language..."
        />

        <div className="flex justify-end text-[11px] text-muted-foreground/70 pt-1">
          {specText.length} characters
        </div>
      </div>

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
