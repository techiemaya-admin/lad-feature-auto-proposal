import type { Company, CompanySummary } from "../types/company";

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

