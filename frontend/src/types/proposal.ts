import type { CompanyVariable, CompoundTable } from "./variable";
import type { TemplateStats } from "./template";
import type { Evaluation, InputType, PricingRulesState, Value } from "./pricing";
import type { ProposalReceipt } from "./receipt";

export type ProposalStage = 1 | 2 | 3 | 4 | 5;

export interface StageMeta {
  id: ProposalStage;
  name: string;
  shortLabel: string;
  description: string;
  status: "locked" | "active" | "completed" | "error";
  badge?: string;
}

export interface InboundLeadSimulation {
  lead_id: string;
  source: "whatsapp" | "email" | "linkedin" | "web_form";
  received_at: string;
  sender_name: string;
  sender_title: string;
  sender_company: string;
  raw_message: string;
  extracted_params: {
    locations?: number;
    seats?: number;
    tier_requested?: string;
    extra_devices?: number;
    products_count?: number;
    addons_requested?: string[];
    is_annual_prepay?: boolean;
    is_rush_delivery?: boolean;
    client_state: string;
  };
  tailored_sales_copy: {
    executive_overview: string;
    deliverables_scope: string;
    guarantee_and_sla: string;
  };
}

export interface SingleScreenWorkflowState {
  currentStage: ProposalStage;
  completedStages: ProposalStage[];
  activeCompanyId: string;
  briefingText: string;
  sampleFileName?: string;
  isBriefingLocked: boolean;
  variables: CompanyVariable[];
  compoundTables: CompoundTable[];
  templateStats: TemplateStats | null;
  pricingRulesState: PricingRulesState | null;
  activeLeadSimulation: InboundLeadSimulation | null;
  currentReceipt: ProposalReceipt | null;
  isProcessing: boolean;
  errorMessage?: string;
}

export interface LeadField {
  name: string;
  label: string;
  input_type: InputType | "text";
  options: string[];
  required: boolean;
  default?: Value;
  assume_when?: string;
}

export interface LeadFacts {
  fields: LeadField[];
  inputs: Record<string, Value>;
  missing: string[];
  assumptions: string[];
  assumed: string[];
}

export interface ClarificationEmail {
  subject: string;
  body: string;
}

export interface NarrativeParagraph {
  text: string;
  tags_placed: string[];
  unknown_tags: string[];
}

/** Always a document; a non-empty `evaluation.needs_review` makes it a draft the human fixes before sending. */
export type ProposalResult = {
  success: true;
  declined?: false;
  evaluation: Evaluation;
  payload: Record<string, unknown>;
  narrative: Record<string, NarrativeParagraph>;
  files: { docx: string; pdf: string | null };
  pdf_error?: string;
};

export type Stage5PricingState = PricingRulesState;
