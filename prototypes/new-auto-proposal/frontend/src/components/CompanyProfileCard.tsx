import React, { useState } from "react";
import { RotateCcw, DownloadCloud, Building2 } from "lucide-react";
import type { Company } from "../types/company";
import type { CompanyVariable, CompoundTable } from "../types/variable";
import type { TemplateStats } from "../types/template";
import { Button } from "./ui/button";
import { PromptDocCapsule } from "./PromptDocCapsule";
import { VariableReviewDeck } from "./VariableReviewDeck";
import { TemplateCheckpointCard } from "./TemplateCheckpointCard";

interface CompanyProfileCardProps {
  company: Company;
  isLoading: boolean;
  isSubmittingBriefing?: boolean;
  onSaveSpec: (newSpec: string) => Promise<void>;
  onImportSettings: () => Promise<void>;
  onResetDefault: () => Promise<void>;
  onSubmitBriefing: (prompt: string, file: File | null) => Promise<void>;
  onUnlockBriefing: () => Promise<void>;
  onVariablesChange?: (variables: CompanyVariable[], tables: CompoundTable[]) => void;
  onVariablesEdited?: () => void;
  onGenerateTemplate?: () => void;
  templateStats?: TemplateStats | null;
  templateFilesize?: number | null;
  isGeneratingTemplate?: boolean;
  onProceedToPricing?: () => void;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  company,
  isLoading,
  isSubmittingBriefing,
  onImportSettings,
  onResetDefault,
  onSubmitBriefing,
  onUnlockBriefing,
  onVariablesChange,
  onVariablesEdited,
  onGenerateTemplate,
  templateStats,
  templateFilesize,
  isGeneratingTemplate = false,
  onProceedToPricing,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  // Chips and template warnings share names: tapping a warning opens that chip's tray
  const [naturalNames, setNaturalNames] = useState<Record<string, string>>({});
  const [focusRequest, setFocusRequest] = useState<{ target: string } | null>(null);

  const handleVariablesChange = (variables: CompanyVariable[], tables: CompoundTable[]) => {
    setNaturalNames(
      Object.fromEntries([
        ...variables.map((v) => [v.variable_name, v.natural_name]),
        ...tables.map((t) => [t.loop_tag, t.natural_name]),
      ])
    );
    onVariablesChange?.(variables, tables);
  };
  const attentionTargets = (templateStats?.details ?? [])
    .filter((d) => !d.applied || d.info?.includes("skipped"))
    .map((d) => d.target);

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

  const basics = company.data?.company_basics || {
    company_name: company.company_name,
    location: company.location || "",
  };
  const industry = company.industry || company.data?.company_details?.industry;

  return (
    <div className="space-y-3">
      {/* Discreet Ambient Context Strip */}
      <div className="flex items-center justify-between gap-3 px-0.5 py-0 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="size-3.5 text-muted-foreground/60 shrink-0" />
          <span className="font-semibold text-foreground/80 truncate">
            {basics.company_name}
          </span>
          {[basics.location, industry].filter(Boolean).length > 0 && (
            <span className="hidden sm:inline text-[11px] text-muted-foreground/60 truncate">
              • {[basics.location, industry].filter(Boolean).join(" • ")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImport}
            disabled={isImporting || isLoading}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 btn-tactile font-normal"
            title="Import mock settings and spec"
          >
            <DownloadCloud className={`size-3 mr-1 ${isImporting ? "animate-bounce" : ""}`} />
            {isImporting ? "Importing..." : "Import"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isLoading}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 btn-tactile font-normal"
            title="Reset company to default mock settings"
          >
            <RotateCcw className={`size-3 mr-1 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "Resetting..." : "Reset"}
          </Button>
        </div>
      </div>

      {/* Stage 1: Pricing Briefing (Prompt + Docked Dropzone) */}
      <PromptDocCapsule
        key={`${company.company_id}_${company.updated_at || ""}`}
        company={company}
        isSubmitting={isSubmittingBriefing}
        onSubmit={onSubmitBriefing}
        onUnlock={onUnlockBriefing}
      />

      {/* Stage 2: Variable Discovery & Interactive Review Deck */}
      {company.briefing_locked && (
        <VariableReviewDeck
          key={`vars_${company.company_id}_${company.updated_at || ""}`}
          companyId={company.company_id}
          companyName={basics.company_name}
          quotationMarkdown={company.document_metadata?.extracted_markdown}
          isGenerating={isGeneratingTemplate}
          isComplete={Boolean(templateStats)}
          attentionTargets={attentionTargets}
          focusRequest={focusRequest}
          onVariablesChange={handleVariablesChange}
          onVariablesEdited={onVariablesEdited}
          onGenerateTemplate={onGenerateTemplate}
        />
      )}

      {/* Stage 3: Minimal Template Checkpoint Preview */}
      {company.briefing_locked && templateStats && (
        <TemplateCheckpointCard
          key={`checkpoint_${company.company_id}_${company.updated_at || ""}`}
          companyId={company.company_id}
          companyName={basics.company_name}
          stats={templateStats}
          filesize={templateFilesize}
          naturalNames={naturalNames}
          onProceedToPricing={onProceedToPricing}
          onRegenerate={onGenerateTemplate}
          onFixVariable={(target) => setFocusRequest({ target })}
          isRegenerating={isGeneratingTemplate}
        />
      )}
    </div>
  );
};

export default CompanyProfileCard;
