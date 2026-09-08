import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Clock,
  RotateCcw,
  DownloadCloud,
  Save,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Code2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
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

  // Synchronize local spec text when company tab switches or data updates
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
    } catch {
      // handled by parent or toast
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
        `Are you sure you want to reset "${company.company_name}" to baseline default settings? Any custom edits will be reverted.`
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
    email: company.email || "",
    phone: company.phone || "",
    website: company.website || "",
  };
  const details = company.data?.company_details;

  return (
    <div className="space-y-6">
      {/* Top Header Card: Identity & Primary Actions */}
      <Card className="border-border/60 bg-gradient-to-br from-card/80 via-card to-secondary/30 backdrop-blur-xs shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      {basics.company_name}
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                      {company.company_id}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                    {company.industry || details?.industry || "Commercial Agency"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                disabled={isImporting || isLoading}
                className="border-border/80 hover:bg-primary/5 hover:text-primary transition-colors"
                title="Import preset company profile and baseline spec from mock dataset"
              >
                <DownloadCloud className={`size-3.5 mr-1.5 ${isImporting ? "animate-bounce" : ""}`} />
                {isImporting ? "Importing..." : "Import Settings"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isResetting || isLoading}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Re-seed this company to initial baseline mock dataset"
              >
                <RotateCcw className={`size-3.5 mr-1.5 ${isResetting ? "animate-spin" : ""}`} />
                {isResetting ? "Resetting..." : "Reset to Default"}
              </Button>
            </div>
          </div>

          {/* Quick Details Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border/40">
            {basics.location && (
              <span className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-md">
                <MapPin className="size-3 text-primary/70" />
                {basics.location}
              </span>
            )}
            {basics.email && (
              <span className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Mail className="size-3 text-primary/70" />
                {basics.email}
              </span>
            )}
            {basics.phone && (
              <span className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Phone className="size-3 text-primary/70" />
                {basics.phone}
              </span>
            )}
            {basics.website && (
              <span className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Globe className="size-3 text-primary/70" />
                {basics.website}
              </span>
            )}
            {basics.timings && (
              <span className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Clock className="size-3 text-primary/70" />
                {basics.timings}
              </span>
            )}
          </div>
        </CardHeader>

        {details?.value_proposition && (
          <CardContent className="pt-0 pb-4">
            <div className="rounded-lg bg-primary/5 p-3.5 border border-primary/15 text-xs text-foreground/90">
              <span className="font-semibold text-primary block mb-0.5">Value Proposition:</span>
              <p className="italic text-muted-foreground leading-relaxed">&ldquo;{details.value_proposition}&rdquo;</p>
              {details.target_customers && (
                <p className="mt-2 text-foreground/80">
                  <span className="font-medium text-muted-foreground">Target Audience:</span> {details.target_customers}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Pricing Spec Section */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                Natural Language Pricing Spec
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Describe packages, hourly/seat formulas, volume discounts, taxes, and add-ons in everyday plain English.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {saveStatus === "unsaved" && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/5 text-xs flex items-center gap-1">
                  <AlertCircle className="size-3" /> Unsaved changes
                </Badge>
              )}
              {saveStatus === "saved" && (
                <Badge variant="success" className="text-xs flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Saved to SQLite
                </Badge>
              )}

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="transition-all"
              >
                <Save className="size-3.5 mr-1.5" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="relative">
            <Textarea
              value={specText}
              onChange={handleSpecChange}
              rows={6}
              className="font-mono text-sm leading-relaxed p-3.5 bg-background/50 border-border/80 focus-visible:ring-primary resize-y"
              placeholder="e.g. Essential is $45/seat/mo. Standard is $65/seat/mo. Volume discount: 25+ seats gets $5/seat off..."
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Info className="size-3" />
                Edits automatically persist in the database and carry over when switching tabs.
              </span>
              <span>{specText.length} characters</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviewer Dropdown: Collapsible Raw JSON Viewer */}
      <Card className="border-border/50 bg-secondary/15">
        <div
          onClick={() => setIsJsonExpanded(!isJsonExpanded)}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors rounded-xl select-none"
        >
          <div className="flex items-center gap-2.5">
            <Code2 className="size-4 text-primary/80" />
            <span className="text-sm font-semibold text-foreground">Reviewer Dropdown: Raw Company Profile JSON</span>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {company.company_id}.json
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isJsonExpanded ? "Collapse" : "Expand to inspect"}
            </span>
            {isJsonExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {isJsonExpanded && (
          <CardContent className="pt-0 pb-4 border-t border-border/40">
            <div className="mt-3 relative">
              <div className="absolute right-3 top-3 z-10">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleCopyJson}
                  className="bg-card/90 hover:bg-card text-xs flex items-center gap-1 border-border/70 shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 text-muted-foreground" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>

              <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 dark:bg-black/80 font-mono text-xs leading-relaxed overflow-x-auto max-h-96 border border-border/30">
                <code>{JSON.stringify(company.data, null, 2)}</code>
              </pre>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
