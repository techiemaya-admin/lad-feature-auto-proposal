import type { Company, CompanySummary } from "../types/company";
import type { Evaluation, PricingRules, PricingRulesState, ValidationError, Value } from "../types/pricing";
import type { ClarificationEmail, LeadFacts, ProposalResult } from "../types/proposal";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const pathPart = (value: string) => encodeURIComponent(value);

/**
 * Template-scoped workflow endpoints keep every mutable proposal artifact
 * (briefing, variables, pricing, generated documents, and logs) isolated to
 * the selected template. The legacy path is retained for callers outside the
 * template workspace.
 */
const workflowPath = (companyId: string, templateId: string | undefined, suffix: string) => {
  const company = pathPart(companyId);
  return templateId
    ? `${company}/templates/${pathPart(templateId)}/${suffix}`
    : `${company}/${suffix}`;
};

const workflowUrl = (companyId: string, templateId: string | undefined, suffix: string) =>
  `${API_BASE}/companies/${workflowPath(companyId, templateId, suffix)}`;

export async function fetchCompanies(): Promise<CompanySummary[]> {
  const res = await fetch(`${API_BASE}/companies`);
  if (!res.ok) {
    throw new Error(`Failed to fetch companies: ${res.statusText}`);
  }
  const data = await res.json();
  return data.companies;
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch company ${id}: ${res.statusText}`);
  }
  const data = await res.json();
  return data.company;
}

export async function updateCompanyProfile(
  id: string,
  payload: {
    pricing_spec?: string;
    company_basics?: Record<string, unknown>;
    company_details?: Record<string, unknown>;
    ideal_customer?: Record<string, unknown>;
    offer?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }
): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${id}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to update company profile: ${res.statusText}`);
  }

  const data = await res.json();
  return data.company;
}

export async function importCompanySettings(id: string): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${id}/import`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to import company settings: ${res.statusText}`);
  }

  const data = await res.json();
  return data.company;
}

export async function resetCompany(id: string): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${id}/reset`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to reset company: ${res.statusText}`);
  }

  const data = await res.json();
  return data.company;
}

export async function submitBriefing(
  companyId: string,
  prompt: string,
  file?: File | null,
  templateId?: string,
  notes?: string[]
): Promise<{
  company: Company;
  markdown: string;
  metadata: {
    filename: string;
    filesize: number;
    extracted_markdown: string;
    parsed_at: string;
  };
}> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  if (notes !== undefined && notes.length > 0) {
    formData.append("sample_review_notes", JSON.stringify(notes));
  }
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(workflowUrl(companyId, templateId, "briefing/submit"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to submit briefing: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    company: data.company,
    markdown: data.markdown,
    metadata: data.metadata,
  };
}

export async function generateSampleDraft(
  companyId: string,
  templateId: string,
  pricingSpec: string,
  sections?: import("../types/sample-proposal").SampleSection[]
): Promise<import("../types/sample-proposal").SampleDraftResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "briefing/sample-draft"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pricing_spec: pricingSpec, sections }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || "Could not generate sample proposal draft.");
  }

  return res.json();
}

export async function generateSampleDocument(
  companyId: string,
  templateId: string,
  payload: {
    draft: import("../types/sample-proposal").SampleDraft;
    customer: string;
    currency: string;
    confirmed: boolean;
    scenario?: string;
    questions?: string[];
    sections?: import("../types/sample-proposal").SampleSection[];
    lines: Array<{
      period: string;
      quantity: number | null;
      rate: number | null;
      discount: number | null;
      tax: number | null;
    }>;
  }
): Promise<Blob> {
  const res = await fetch(workflowUrl(companyId, templateId, "briefing/sample-document"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || "Could not generate sample document.");
  }

  return res.blob();
}

export async function generateSampleSection(
  companyId: string,
  templateId: string,
  payload: {
    pricing_spec: string;
    scenario: string;
    scope: string;
    sections?: import("../types/sample-proposal").SampleSection[];
    section: {
      title: string;
      position: string;
      instructions?: string;
    };
  }
): Promise<import("../types/sample-proposal").SampleSectionResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "briefing/sample-section"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || "Could not draft custom section.");
  }

  return res.json();
}

export async function unlockBriefing(companyId: string, templateId?: string): Promise<Company> {
  const res = await fetch(workflowUrl(companyId, templateId, "briefing/unlock"), {
    method: "POST",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to unlock briefing: ${res.statusText}`);
  }

  const data = await res.json();
  return data.company;
}

export async function fetchQuotationMarkdown(
  companyId: string,
  templateId?: string
): Promise<{
  filename: string | null;
  filesize: number | null;
  markdown: string | null;
  parsed_at: string | null;
  briefing_locked: boolean;
}> {
  const res = await fetch(workflowUrl(companyId, templateId, "briefing/markdown"));
  if (!res.ok) {
    throw new Error(`Failed to fetch quotation markdown: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchVariables(
  companyId: string,
  templateId?: string
): Promise<import("../types/variable").VariablesResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "variables"));
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch variables: ${res.statusText}`);
  }
  return res.json();
}

export async function extractVariables(
  companyId: string,
  templateId?: string
): Promise<import("../types/variable").VariablesResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "variables/extract"), {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to extract variables: ${res.statusText}`);
  }
  return res.json();
}

export async function updateVariables(
  companyId: string,
  payload: {
    variables?: unknown[];
    compound_tables?: unknown[];
  },
  templateId?: string
): Promise<{ success: boolean; updated_count: number }> {
  const res = await fetch(workflowUrl(companyId, templateId, "variables"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to update variables: ${res.statusText}`);
  }
  return res.json();
}

export async function addCustomVariable(
  companyId: string,
  payload: {
    natural_name: string;
    category: string;
    exact_quotation_snippet: string;
    context_anchor?: string;
    data_type?: string;
    description?: string;
  },
  templateId?: string
): Promise<{ success: boolean; variable: import("../types/variable").CompanyVariable }> {
  const res = await fetch(workflowUrl(companyId, templateId, "variables/custom"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to add custom variable: ${res.statusText}`);
  }
  return res.json();
}

export async function generateTemplate(
  companyId: string,
  templateId?: string
): Promise<import("../types/template").TemplateGenerationResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "template/generate"), {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to generate template: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTemplateStatus(
  companyId: string,
  templateId?: string
): Promise<import("../types/template").TemplateStatusResponse> {
  const res = await fetch(workflowUrl(companyId, templateId, "template/status"));
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch template status: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTemplateBlob(companyId: string, templateId?: string): Promise<Blob> {
  const res = await fetch(workflowUrl(companyId, templateId, "template/download"));
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch template: ${res.statusText}`);
  }
  return res.blob();
}

export function getTemplateDownloadUrl(companyId: string, templateId?: string): string {
  return workflowUrl(companyId, templateId, "template/download");
}

export interface AISettings {
  provider: "gemini" | "deepseek";
  model: string;
}

export async function fetchAISettings(): Promise<{
  settings: AISettings;
  models: Record<string, string[]>;
}> {
  const res = await fetch(`${API_BASE}/settings/ai`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI settings: ${res.statusText}`);
  }
  return res.json();
}

export async function updateAISettings(payload: Partial<AISettings>): Promise<AISettings> {
  const res = await fetch(`${API_BASE}/settings/ai`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to update AI settings: ${res.statusText}`);
  }
  const data = await res.json();
  return data.settings;
}

// ---------------------------------------------------------------------------
// Stage 4: pricing rules
// ---------------------------------------------------------------------------

/** A PUT the server refused: `errors` are the structural problems, nothing was persisted. */
export class RulesValidationError extends Error {
  public errors: ValidationError[];
  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.errors = errors;
  }
}

async function rulesRequest<T>(path: string, what: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/companies/${path}`, init);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    const message = errorData.error || `Failed to ${what}: ${res.statusText}`;
    throw Array.isArray(errorData.errors) ? new RulesValidationError(message, errorData.errors) : new Error(message);
  }
  return res.json();
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function compilePricingRules(companyId: string, templateId?: string): Promise<PricingRulesState> {
  const path = templateId ? `${pathPart(companyId)}/templates/${pathPart(templateId)}/rules/compile` : `${pathPart(companyId)}/rules/compile`;
  return (await rulesRequest<{ pricing_rules: PricingRulesState }>(path, "compile pricing rules", { method: "POST" })).pricing_rules;
}

export async function fetchPricingRules(companyId: string, templateId?: string): Promise<PricingRulesState> {
  const path = templateId ? `${pathPart(companyId)}/templates/${pathPart(templateId)}/rules` : `${pathPart(companyId)}/rules`;
  return (await rulesRequest<{ pricing_rules: PricingRulesState }>(path, "fetch pricing rules")).pricing_rules;
}

/** Throws RulesValidationError on a 400. */
export async function updatePricingRules(companyId: string, rules: PricingRules, templateId?: string): Promise<PricingRulesState> {
  const path = templateId ? `${pathPart(companyId)}/templates/${pathPart(templateId)}/rules` : `${pathPart(companyId)}/rules`;
  return (await rulesRequest<{ pricing_rules: PricingRulesState }>(path, "update pricing rules", { ...json({ rules }), method: "PUT" })).pricing_rules;
}

export function calculatePricing(companyId: string, inputs: Record<string, Value>, templateId?: string): Promise<{ evaluation: Evaluation; payload: Record<string, unknown> }> {
  const path = templateId ? `${pathPart(companyId)}/templates/${pathPart(templateId)}/rules/calculate` : `${pathPart(companyId)}/rules/calculate`;
  return rulesRequest(path, "calculate pricing", json({ inputs }));
}

export function extractLead(
  companyId: string,
  leadText: string,
  templateId?: string,
  proposalPrompt?: string
): Promise<LeadFacts> {
  return rulesRequest(
    workflowPath(companyId, templateId, "lead/extract"),
    "read the lead",
    json({ lead_text: leadText, template_id: templateId, proposal_prompt: proposalPrompt })
  );
}

export function draftClarification(
  companyId: string,
  leadText: string,
  inputs: Record<string, Value>,
  missing: string[],
  assumed: string[],
  templateId?: string,
  proposalPrompt?: string
): Promise<ClarificationEmail> {
  return rulesRequest(
    workflowPath(companyId, templateId, "lead/clarify"),
    "draft the clarification email",
    json({ lead_text: leadText, inputs, missing, assumed, template_id: templateId, proposal_prompt: proposalPrompt })
  );
}

export function draftLeadReply(
  companyId: string,
  leadText: string,
  templateId?: string,
  proposalPrompt?: string
): Promise<ClarificationEmail> {
  return rulesRequest(
    workflowPath(companyId, templateId, "lead/reply"),
    "draft the lead's reply",
    json({ lead_text: leadText, template_id: templateId, proposal_prompt: proposalPrompt })
  );
}

export function generateProposal(
  companyId: string,
  inputs: Record<string, Value>,
  leadText: string,
  assumed: string[],
  templateId?: string,
  proposalPrompt?: string
): Promise<ProposalResult> {
  return rulesRequest(
    workflowPath(companyId, templateId, "proposal/generate"),
    "generate the proposal",
    json({ inputs, lead_text: leadText, assumed, template_id: templateId, proposal_prompt: proposalPrompt })
  );
}

export async function proceedToLeadSimulation(companyId: string, templateId?: string): Promise<Company> {
  const data = await rulesRequest<{ company?: Company }>(
    workflowPath(companyId, templateId, "rules/proceed"),
    "lock pricing rules",
    { method: "POST" }
  );
  if (!data.company) {
    throw new Error("The backend did not return the updated company after locking pricing rules.");
  }
  return data.company;
}

export async function sendProposal(
  companyId: string,
  proposalId: string,
  templateId?: string
): Promise<{ success: boolean; message?: string }> {
  return rulesRequest<{ success: boolean; message?: string }>(
    workflowPath(companyId, templateId, "proposal/send"),
    "send proposal",
    json({ proposal_id: proposalId })
  );
}

export async function sendInboxReply(
  companyId: string,
  payload: { lead_id: string; body: string },
  templateId?: string
): Promise<{ success: boolean; message?: string }> {
  return rulesRequest<{ success: boolean; message?: string }>(
    workflowPath(companyId, templateId, "inbox/reply"),
    "send inbox reply",
    json(payload)
  );
}

// ---------------------------------------------------------------------------
// Ambient shell: per-company configuration, inbox connection, pipeline logs
// ---------------------------------------------------------------------------

export interface CompanyConfiguration {
  company_id: string;
  style_notes: string;
  reference_proposal_text: string;
  clarification_notes: string;
  email_connected: boolean;
  email_address: string | null;
  email_connected_at: string | null;
  updated_at: string | null;
}

export type ConfigurationPatch = Partial<
  Pick<CompanyConfiguration, "style_notes" | "reference_proposal_text" | "clarification_notes">
>;

async function configurationCall(path: string, init?: RequestInit): Promise<CompanyConfiguration> {
  const res = await fetch(`${API_BASE}/companies/${path}`, init);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Request failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.configuration;
}

export function fetchConfiguration(companyId: string): Promise<CompanyConfiguration> {
  return configurationCall(`${companyId}/configurations`);
}

export function updateConfiguration(companyId: string, patch: ConfigurationPatch): Promise<CompanyConfiguration> {
  return configurationCall(`${companyId}/configurations`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function connectEmail(companyId: string): Promise<CompanyConfiguration> {
  return configurationCall(`${companyId}/email/connect`, { method: "POST" });
}

export function disconnectEmail(companyId: string): Promise<CompanyConfiguration> {
  return configurationCall(`${companyId}/email/disconnect`, { method: "POST" });
}

export interface LogArtifact {
  file: string;
  kind: string;
  logged_at: string;
  size: number;
}

export async function fetchLogArtifacts(companyId: string, templateId?: string): Promise<LogArtifact[]> {
  const res = await fetch(workflowUrl(companyId, templateId, "logs"));
  if (!res.ok) {
    throw new Error(`Failed to fetch pipeline logs: ${res.statusText}`);
  }
  const data = await res.json();
  return data.artifacts;
}

export async function fetchLogArtifact(companyId: string, file: string, templateId?: string): Promise<string> {
  const res = await fetch(workflowUrl(companyId, templateId, `logs/${encodeURIComponent(file)}`));
  if (!res.ok) {
    throw new Error(`Failed to fetch artifact: ${res.statusText}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Multi-template workspace
// ---------------------------------------------------------------------------

export interface ProposalTemplateSummary {
  template_id: string;
  name: string;
  description: string;
  pricing_spec: string;
  updated_at: string;
}

export interface EmailRoutingResult {
  version: number;
  template_id: string | null;
  reason: string;
  email: string;
  email_id: string;
  source: string;
  routed_at: string | null;
}

async function templateRequest(companyId: string, suffix = "", init?: RequestInit) {
  const res = await fetch(
    `${API_BASE}/companies/${pathPart(companyId)}/templates${suffix}`,
    init
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Template request failed: ${res.statusText}`);
  }
  return data;
}

export async function listTemplates(companyId: string): Promise<ProposalTemplateSummary[]> {
  return (await templateRequest(companyId)).templates;
}

export async function fetchProposalTemplate(companyId: string, templateId: string): Promise<Company> {
  return (await templateRequest(companyId, `/${pathPart(templateId)}`)).company;
}

export async function createProposalTemplate(
  companyId: string,
  name: string,
  description = "",
  pricing_spec = ""
): Promise<Company> {
  return (
    await templateRequest(companyId, "", {
      ...json({ name, description, pricing_spec }),
      method: "POST",
    })
  ).company;
}

export async function renameProposalTemplate(
  companyId: string,
  templateId: string,
  name: string
): Promise<Company> {
  return (
    await templateRequest(companyId, `/${pathPart(templateId)}`, {
      ...json({ name }),
      method: "PATCH",
    })
  ).company;
}

export async function deleteProposalTemplate(companyId: string, templateId: string): Promise<void> {
  await templateRequest(companyId, `/${pathPart(templateId)}`, { method: "DELETE" });
}

export async function resetProposalTemplate(companyId: string, templateId: string): Promise<Company> {
  return (await templateRequest(companyId, `/${pathPart(templateId)}/reset`, { method: "POST" })).company;
}

export async function importIcpTemplates(companyId: string): Promise<ProposalTemplateSummary[]> {
  return (await templateRequest(companyId, "/import-icp", { method: "POST" })).templates;
}

export async function fetchMockEmail(companyId: string): Promise<EmailRoutingResult> {
  return (await templateRequest(companyId, "/mock-email")).routing;
}

export async function routeMockEmail(companyId: string): Promise<EmailRoutingResult> {
  return (await templateRequest(companyId, "/route-email", { method: "POST" })).routing;
}

export async function assignMockEmail(companyId: string, templateId: string): Promise<EmailRoutingResult> {
  return (await templateRequest(companyId, "/route-email", { ...json({ template_id: templateId }), method: "PUT" })).routing;
}

export async function saveRoutingEmail(companyId: string, email: string, version: number): Promise<EmailRoutingResult> {
  return (await templateRequest(companyId, "/mock-email", { ...json({ email, version }), method: "PUT" })).routing;
}

