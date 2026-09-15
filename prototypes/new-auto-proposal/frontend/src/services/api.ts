import type { Company, CompanySummary } from "../types/company";
import type { Evaluation, PricingRules, PricingRulesState, SampleCheckEntry, ValidationError, Value } from "../types/pricing";

const API_BASE = "/api";

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
  file?: File | null
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
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(`${API_BASE}/companies/${companyId}/briefing/submit`, {
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

export async function unlockBriefing(companyId: string): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/briefing/unlock`, {
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
  companyId: string
): Promise<{
  filename: string | null;
  filesize: number | null;
  markdown: string | null;
  parsed_at: string | null;
  briefing_locked: boolean;
}> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/briefing/markdown`);
  if (!res.ok) {
    throw new Error(`Failed to fetch quotation markdown: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchVariables(
  companyId: string
): Promise<import("../types/variable").VariablesResponse> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/variables`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch variables: ${res.statusText}`);
  }
  return res.json();
}

export async function extractVariables(
  companyId: string
): Promise<import("../types/variable").VariablesResponse> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/variables/extract`, {
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
    variables?: any[];
    compound_tables?: any[];
  }
): Promise<{ success: boolean; updated_count: number }> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/variables`, {
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
  }
): Promise<{ success: boolean; variable: import("../types/variable").CompanyVariable }> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/variables/custom`, {
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
  companyId: string
): Promise<import("../types/template").TemplateGenerationResponse> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/template/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to generate template: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTemplateStatus(
  companyId: string
): Promise<import("../types/template").TemplateStatusResponse> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/template/status`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch template status: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTemplateBlob(companyId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/template/download`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to fetch template: ${res.statusText}`);
  }
  return res.blob();
}

export function getTemplateDownloadUrl(companyId: string): string {
  return `${API_BASE}/companies/${companyId}/template/download`;
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

async function unwrapRules(res: Response, what: string): Promise<PricingRulesState> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(errorData.error || `Failed to ${what}: ${res.statusText}`) as Error & { errors?: ValidationError[] };
    if (Array.isArray(errorData.errors)) err.errors = errorData.errors;
    throw err;
  }
  return (await res.json()).pricing_rules;
}

export async function compilePricingRules(companyId: string): Promise<PricingRulesState> {
  return unwrapRules(await fetch(`${API_BASE}/companies/${companyId}/rules/compile`, { method: "POST" }), "compile pricing rules");
}

export async function fetchPricingRules(companyId: string): Promise<PricingRulesState> {
  return unwrapRules(await fetch(`${API_BASE}/companies/${companyId}/rules`), "fetch pricing rules");
}

/** A 400 carries `errors: ValidationError[]` on the thrown Error. */
export async function updatePricingRules(companyId: string, rules: PricingRules): Promise<PricingRulesState> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules }),
  });
  return unwrapRules(res, "update pricing rules");
}

export async function calculatePricing(
  companyId: string,
  inputs: Record<string, Value>
): Promise<{ evaluation: Evaluation; payload: Record<string, unknown>; sample_check: SampleCheckEntry[] }> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/rules/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to calculate pricing: ${res.statusText}`);
  }
  return res.json();
}

export async function proceedToLeadSimulation(companyId: string): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/rules/proceed`, { method: "POST" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Failed to proceed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.company;
}
