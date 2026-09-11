import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";

/**
 * The AI contract is TEXT-ONLY on purpose.
 *
 * Gemini is reliable at reading a document and saying "this exact text is the
 * client's name / the tax amount / a client-specific paragraph". It is not
 * reliable at positional bookkeeping (table 2, row "Subtotal", column 1), and
 * every locator it emits is something the mutation engine has to re-verify
 * against the real .docx anyway. So the model only tells us WHAT is dynamic
 * and the verbatim text; the engine (template-mutator.service.ts) finds WHERE.
 */

export interface ParagraphConfig {
  mode: "fixed" | "ai_generated";
  purpose?: string;
  tone?: string;
  length_guideline?: string;
}

export interface ExtractedVariable {
  variable_name: string;
  natural_name: string;
  category: "customer_input" | "pricing" | "paragraph";
  data_type: "string" | "number" | "currency" | "enum" | "paragraph";
  /** Verbatim text copied from the quotation. Multi-line for paragraph blocks. */
  sample_text: string;
  description: string;
  /**
   * Only when the same sample_text appears elsewhere with a different meaning:
   * the row label / nearby words that identify the right occurrence. "" = replace everywhere.
   */
  context_text: string;
  /** "has_tax", "has_annual_discount"… wraps the containing table row in {#flag}…{/flag}. "" = always shown. */
  condition_flag: string;
  enum_options?: string[];
  paragraph_config?: ParagraphConfig;
}

export interface ExtractedLoopTable {
  loop_tag: string;
  natural_name: string;
  /** Exact header cell texts of the table's first row, left to right. Used to find the table. */
  header_texts: string[];
  /** One tag name per column, left to right. */
  column_tags: string[];
  /** Exact first-cell text of every row that repeats (not subtotal/total rows). */
  row_labels: string[];
}

export interface ExtractionResponse {
  document_summary: string;
  variables: ExtractedVariable[];
  loop_tables: ExtractedLoopTable[];
}

// Gemini reliably fills `required` fields and routinely skips optional ones, so
// anything the engine depends on is required (empty string = "not applicable").
export const extractionResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    document_summary: { type: SchemaType.STRING },
    variables: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          variable_name: { type: SchemaType.STRING },
          natural_name: { type: SchemaType.STRING },
          category: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["customer_input", "pricing", "paragraph"],
          },
          data_type: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["string", "number", "currency", "enum", "paragraph"],
          },
          sample_text: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          context_text: { type: SchemaType.STRING },
          condition_flag: { type: SchemaType.STRING },
          enum_options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          paragraph_config: {
            type: SchemaType.OBJECT,
            properties: {
              mode: { type: SchemaType.STRING, format: "enum", enum: ["fixed", "ai_generated"] },
              purpose: { type: SchemaType.STRING },
              tone: { type: SchemaType.STRING },
              length_guideline: { type: SchemaType.STRING },
            },
            required: ["mode"],
          },
        },
        required: [
          "variable_name",
          "natural_name",
          "category",
          "data_type",
          "sample_text",
          "description",
          "context_text",
          "condition_flag",
        ],
      },
    },
    loop_tables: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          loop_tag: { type: SchemaType.STRING },
          natural_name: { type: SchemaType.STRING },
          header_texts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          column_tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          row_labels: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["loop_tag", "natural_name", "header_texts", "column_tags", "row_labels"],
      },
    },
  },
  required: ["document_summary", "variables", "loop_tables"],
};

export interface ExtractVariablesParams {
  markdown: string;
  pricingSpec: string;
  companyName: string;
  companyBasics?: {
    company_name: string;
    location?: string;
    email?: string;
    phone?: string | null;
    website?: string;
  };
  industry?: string | null;
}

export function buildExtractionPrompt(params: ExtractVariablesParams): string {
  const b = params.companyBasics;
  return `
You are converting a one-off sales quotation into a reusable proposal template.
List every piece of text that would change for a different client, so the engine can replace it with a {tag}.
You only identify WHAT changes and copy its exact text. You never describe WHERE it is — the engine locates text itself.

==================== QUOTATION (markdown parsed from the Word file) ====================
${params.markdown}

==================== AGENCY PRICING NOTES ====================
${params.pricingSpec}

==================== THE SELLING AGENCY (never a variable) ====================
Name: "${params.companyName}"  Location: "${b?.location || ""}"  Email: "${b?.email || ""}"  Phone: "${b?.phone || ""}"  Industry: "${params.industry || ""}"

==================== RULES ====================
1. sample_text must be copied character-for-character from the quotation: same punctuation, currency symbols, dashes (— vs -), minus signs (−), "/mo" suffixes. The engine does an exact search; if the text is not verbatim the variable is silently lost.

2. Never extract the agency's own name, team name, address, phone, email, the "Next Steps" paragraph, or the closing legal disclaimer. Only extract things about the CLIENT, the chosen package, prices, dates, and client-specific prose.

3. category:
   - "customer_input": facts the client supplies — client company name, dates, headcount/seat count, number of locations, number of products, servers, etc.
   - "pricing": every money amount, rate, percentage, and the selected tier/package name.
     * The chosen tier gets variable_name "selected_tier", data_type "enum", enum_options = all tiers offered. Its sample_text is just the tier name (e.g. "Growth"). Do not create tier-specific names like "growth_monthly_rate" — use role names like "selected_tier_rate".
   - "paragraph": prose written for THIS client — the intro describing their situation, why the recommended tier fits, their payment preference, the upgrade path, an add-on menu with ✓/○ selections, a "what's included" bullet list, tax or minimum-commitment notes that depend on their numbers. If a salesperson would rewrite it for the next lead, it is a paragraph variable. Set data_type "paragraph" and paragraph_config { mode: "ai_generated", purpose, tone, length_guideline }.
     * For a block of several lines or bullets, sample_text is the WHOLE block: one line per paragraph/bullet, each copied exactly, joined with newlines.
     * Static boilerplate that reads identically for any client is NOT a variable.

4. condition_flag: set it on the amount variable of any table row that may not apply to every client — sales tax ("has_tax"), prepay/bundle/volume discounts ("has_annual_discount", "has_bundle_discount", "has_volume_adjustment"), optional fees ("has_extra_devices"). The engine wraps that whole row so it disappears when the flag is false. Otherwise "".

5. Labels that contain arithmetic, e.g. "Seat subtotal (42 seats × $60.00)" or "Growth Package — 12 months × $3,000/mo": do NOT extract the label. Extract each number inside it as its own variable ("42" → seat_count, "$60.00" → adjusted_seat_rate, "12" → contract_months). Each value is extracted ONCE and the engine replaces every occurrence, so the label becomes "Seat subtotal ({seat_count} seats × {adjusted_seat_rate})" automatically.
   * When a cell reads "$65.00 / seat / mo", sample_text is "$65.00", not the whole cell.
   * Money ALWAYS keeps its currency symbol in sample_text ("$2,520.00", never "2,520.00"); percentages keep "%" ("8.25%").
   * A leading minus/dash ("−$5.00") is NOT part of the value: sample_text is "$5.00".

6. context_text: almost always "". An empty context means "replace this text everywhere it appears", which is what you want for the client name, the tier name, seat counts, rates that are reused in labels, etc. "selected_tier" MUST have context_text "".
   Fill it ONLY when the identical text also appears somewhere else with a DIFFERENT meaning. Two cases:
   * A value that collides with another variable: "$60.00" is both the adjusted seat rate and the managed-devices subtotal → the managed-devices one gets context_text "Managed devices beyond 1:1"; the seat-rate one stays "".
   * A bare small number that also occurs in ordinary sentences: "5" (servers) also appears in "within 5 business days" → context_text "Managed devices beyond 1:1".
   Give the row label or a few words from the same table row / sentence. Never invent context for values that appear only once.

7. loop_tables: tables whose data rows are repeated line items of the same shape — project milestones, payment schedules, itemised add-on lines. Give:
   * header_texts = the exact header cell texts of the table, left to right.
   * loop_tag ("milestones", "payment_milestones", "addon_items").
   * column_tags = one snake_case tag per column, left to right.
   * row_labels = the exact FIRST-cell text of every row that repeats (e.g. ["1","2","3","4","5"] or ["Copywriting add-on","Basic SEO Setup add-on"]). Base-fee, subtotal, discount and total rows in the same table are NOT repeating rows — leave them out and they stay as-is.
   * Amounts inside loop rows are covered by the loop's column_tags — do not also extract them as variables.
   * A tier comparison matrix (columns = tiers, rows = features) is NOT a loop table. Do not extract its cells; the selected tier's rate is already covered by "selected_tier_rate".

8. Never extract the same text twice. One variable per distinct value. Never extract a lone symbol or checkmark ("✓", "○", "—") — a selected/unselected add-on menu is ONE paragraph variable (rule 3), not per-line checkbox variables.
`;
}

export async function extractVariablesWithGemini(
  params: ExtractVariablesParams,
  modelName = "gemini-2.5-flash"
): Promise<ExtractionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: extractionResponseSchema,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent(buildExtractionPrompt(params));
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText) as ExtractionResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini structured output JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
