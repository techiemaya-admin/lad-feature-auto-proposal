import React, { useState } from "react";
import { RotateCcw, DownloadCloud } from "lucide-react";
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
            className="text-xs h-8 btn-tactile bg-card hover:bg-muted"
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

      {/* Stage 1: Pricing Briefing (Prompt + Docked Dropzone) */}
      <PromptDocCapsule
        key={`${company.company_id}_${company.updated_at || ""}`}
        company={company}
        isSubmitting={isSubmittingBriefing}
        onSubmit={onSubmitBriefing}
        onUnlock={onUnlockBriefing}
      />
    </div>
  );
};

export default CompanyProfileCard;
