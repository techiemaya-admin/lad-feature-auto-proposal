import React, { useState } from "react";
import type { Company } from "../types/company";
import type { CompanyVariable, CompoundTable } from "../types/variable";
import type { TemplateStats } from "../types/template";
import type { PricingRulesState } from "../types/pricing";
import { PromptDocCapsule } from "./PromptDocCapsule";
import { VariableReviewDeck } from "./VariableReviewDeck";
import { TemplateCheckpointCard } from "./TemplateCheckpointCard";
import { PricingEngineDeck, type RulesStatus } from "./pricing/PricingEngineDeck";
import { LeadSimulator } from "./LeadSimulator";

interface CompanyProfileCardProps {
  company: Company;
  isSubmittingBriefing?: boolean;
  onSubmitBriefing: (prompt: string, file: File | null) => Promise<void>;
  onUnlockBriefing: () => Promise<void>;
  onVariablesChange?: (variables: CompanyVariable[], tables: CompoundTable[]) => void;
  onVariablesEdited?: () => void;
  onGenerateTemplate?: () => void;
  templateStats?: TemplateStats | null;
  templateFilesize?: number | null;
  isGeneratingTemplate?: boolean;
  onProceedToPricing?: () => void;
  pricingRules?: PricingRulesState | null;
  rulesStatus?: RulesStatus;
  onRulesChange?: (state: PricingRulesState) => void;
  onProceedToLeadSimulation?: () => void;
  isProceeding?: boolean;
  variables?: CompanyVariable[];
  compoundTables?: CompoundTable[];
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  company,
  isSubmittingBriefing,
  onSubmitBriefing,
  onUnlockBriefing,
  onVariablesChange,
  onVariablesEdited,
  onGenerateTemplate,
  templateStats,
  templateFilesize,
  isGeneratingTemplate = false,
  onProceedToPricing,
  pricingRules = null,
  rulesStatus = { status: "idle" },
  onRulesChange,
  onProceedToLeadSimulation,
  isProceeding = false,
  variables = [],
  compoundTables = [],
}) => {
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
    .filter((d) => !d.applied)
    .map((d) => d.target);

  const basics = company.data?.company_basics || {
    company_name: company.company_name,
    location: company.location || "",
  };

  return (
    <div className="space-y-3">
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
          templateId={company.template_id!}
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
          templateId={company.template_id!}
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

      {/* Stage 4: Pricing Engine — tables, lead inputs, calculation ledger */}
      {company.briefing_locked && templateStats && (pricingRules || rulesStatus.status !== "idle") && (
        <PricingEngineDeck
          companyId={company.company_id}
          templateId={company.template_id!}
          companyName={basics.company_name}
          state={pricingRules}
          status={rulesStatus}
          variables={variables}
          compoundTables={compoundTables}
          onStateChange={(s) => onRulesChange?.(s)}
          onRegenerate={() => onProceedToPricing?.()}
          onProceed={() => onProceedToLeadSimulation?.()}
          isProceeding={isProceeding}
        />
      )}

      {/* Stage 5: Check & Generate Proposal — a lead message in, a proposal out */}
      {company.working_state?.stage === "lead_simulation" && pricingRules && (
        <LeadSimulator company={company} rules={pricingRules} />
      )}
    </div>
  );
};

export default CompanyProfileCard;
