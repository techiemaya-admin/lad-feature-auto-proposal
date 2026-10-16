export type SectionPosition =
  | "before_scope"
  | "before_pricing"
  | "before_terms"
  | "after_terms";

export interface SampleSection {
  id: string;
  title: string;
  content: string;
  position: SectionPosition | string;
  instructions: string;
}

export const newSampleSection = (): SampleSection => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  title: "Room to grow",
  content: "",
  position: "before_terms",
  instructions: "",
});

export interface SampleDraft {
  title: string;
  overview: string;
  scope: string;
  terms: string;
  items: string[];
}

export interface SampleLine {
  quantity: string;
  rate: string;
  discount: string;
  tax: string;
  period: "one-time" | "monthly" | "annual" | string;
}

export const emptySampleLine = (): SampleLine => ({
  quantity: "1",
  rate: "",
  discount: "",
  tax: "",
  period: "one-time",
});

export interface SampleDraftResponse {
  draft: SampleDraft;
  customer: string;
  currency: string;
  scenario: string;
  questions: string[];
  lines: Array<{
    quantity: number | null;
    rate: number | null;
    discount: number | null;
    tax: number | null;
    period: string;
  }>;
  pricing_sources: string[];
  totals: Array<{ period: string; amount: string }>;
  document_base64?: string;
}

export interface SampleSectionResponse {
  section: {
    title: string;
    content: string;
    position: string;
  };
}
