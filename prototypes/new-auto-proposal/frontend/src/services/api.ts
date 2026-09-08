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
