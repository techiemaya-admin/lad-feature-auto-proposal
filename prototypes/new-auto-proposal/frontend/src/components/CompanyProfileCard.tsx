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
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";

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

      {/* Primary Focus: Pricing Engine Spec Editor */}
      <Card className="border-border/60 shadow-2xs">
        <CardHeader className="py-3 px-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              Pricing Engine Specification
            </CardTitle>

            <div className="flex items-center gap-2">
              {saveStatus === "unsaved" && (
                <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-amber-500" />
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
                className="text-xs h-7 px-3"
              >
                <Save className="size-3 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-2">
          <Textarea
            value={specText}
            onChange={handleSpecChange}
            rows={8}
            className="font-sans text-sm leading-relaxed p-3.5 bg-muted/20 border-border/60 focus-visible:ring-primary resize-y"
            placeholder="Describe your packages, rates, volume discounts, taxes, and add-ons in natural language..."
          />
          <div className="flex justify-end text-[11px] text-muted-foreground/70 pr-1">
            {specText.length} characters
          </div>
        </CardContent>
      </Card>

      {/* Reviewer Dropdown: Collapsible Raw JSON */}
      <div className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsJsonExpanded(!isJsonExpanded)}
          className="w-full flex items-center justify-between py-2.5 px-3.5 hover:bg-muted/30 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Code2 className="size-3.5" />
            <span>Reviewer Dropdown: Raw Profile JSON</span>
            <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 h-4">
              {company.company_id}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px]">{isJsonExpanded ? "Hide" : "Show"}</span>
            {isJsonExpanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </div>
        </button>

        {isJsonExpanded && (
          <div className="p-3 border-t border-border/30 relative">
            <Button
              size="xs"
              variant="outline"
              onClick={handleCopyJson}
              className="absolute right-5 top-5 z-10 text-[11px] h-6 bg-card/80 backdrop-blur-xs"
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
            <pre className="p-3.5 rounded-md bg-zinc-950 text-zinc-200 dark:bg-black font-mono text-[11px] leading-relaxed overflow-x-auto max-h-80 border border-border/20">
              <code>{JSON.stringify(company.data, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
