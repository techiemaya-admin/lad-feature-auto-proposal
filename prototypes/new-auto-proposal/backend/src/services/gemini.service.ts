import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";

export type MutationAction =
  | {
      action: "replace_text_run";
      sample_text: string;
      context_anchor?: string;
      template_tag?: string;
    }
  | {
      action: "replace_table_cell";
      table_index?: number;
      row_identifier?: string;
      col_index?: number;
      sample_text?: string;
      template_tag?: string;
    }
  | {
      action: "wrap_conditional_row";
      table_index?: number;
      row_identifier?: string;
      condition_tag?: string;
      cells?: Array<{
        col_index: number;
        preserve_existing_label?: boolean;
        template_tag: string;
      }>;
    }
  | {
      action: "collapse_repeating_table";
      table_index?: number;
      loop_tag?: string;
      template_row_index?: number;
      column_tags?: Array<{
        col_index: number;
        replacement_tag: string;
      }>;
      delete_sample_rows_from?: number;
    };

export interface VisibilityRule {
  condition_flag?: string;
  show_when?: string;
}

export interface ParagraphConfig {
  mode: "fixed" | "ai_generated";
  purpose?: string;
  tone?: string;
  length_guideline?: string;
}

export interface ExtractionVariable {
  variable_name: string;
  natural_name: string;
  category: "customer_input" | "pricing" | "paragraph";
  data_type: "string" | "number" | "currency" | "enum" | "paragraph";
  sample_value: string;
  description: string;
  enum_options?: string[];
  default_value?: string;
  visibility_rule?: VisibilityRule;
  paragraph_config?: ParagraphConfig;
  mutation: MutationAction;
}

export interface CompoundTableExtraction {
  table_id: string;
  natural_name: string;
  table_index: number;
  type: "comparison_matrix" | "repeating_loop";
  loop_tag?: string;
  enum_options?: string[];
  default_value?: string;
  columns?: string[];
  mutation?: MutationAction;
}

export interface ExtractionResponse {
  document_summary: string;
  variables: ExtractionVariable[];
  compound_tables: CompoundTableExtraction[];
}

// Flattened schema to prevent 400 discriminated union errors in Gemini structured output
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
          sample_value: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          enum_options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          default_value: { type: SchemaType.STRING },
          visibility_rule: {
            type: SchemaType.OBJECT,
            properties: {
              condition_flag: { type: SchemaType.STRING },
              show_when: { type: SchemaType.STRING },
            },
          },
          paragraph_config: {
            type: SchemaType.OBJECT,
            properties: {
              mode: { type: SchemaType.STRING, format: "enum", enum: ["fixed", "ai_generated"] },
              purpose: { type: SchemaType.STRING },
              tone: { type: SchemaType.STRING },
              length_guideline: { type: SchemaType.STRING },
            },
          },
          mutation: {
            type: SchemaType.OBJECT,
            properties: {
              action: {
                type: SchemaType.STRING,
                format: "enum",
                enum: [
                  "replace_text_run",
                  "replace_table_cell",
                  "wrap_conditional_row",
                  "collapse_repeating_table",
                ],
              },
              sample_text: { type: SchemaType.STRING },
              context_anchor: { type: SchemaType.STRING },
              template_tag: { type: SchemaType.STRING },
              table_index: { type: SchemaType.NUMBER },
              row_identifier: { type: SchemaType.STRING },
              col_index: { type: SchemaType.NUMBER },
              condition_tag: { type: SchemaType.STRING },
              loop_tag: { type: SchemaType.STRING },
              template_row_index: { type: SchemaType.NUMBER },
              delete_sample_rows_from: { type: SchemaType.NUMBER },
            },
            required: ["action"],
          },
        },
        required: [
          "variable_name",
          "natural_name",
          "category",
          "data_type",
          "sample_value",
          "description",
          "mutation",
        ],
      },
    },
    compound_tables: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          table_id: { type: SchemaType.STRING },
          natural_name: { type: SchemaType.STRING },
          table_index: { type: SchemaType.NUMBER },
          type: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["comparison_matrix", "repeating_loop"],
          },
          loop_tag: { type: SchemaType.STRING },
        },
        required: ["table_id", "natural_name", "table_index", "type"],
      },
    },
  },
  required: ["document_summary", "variables", "compound_tables"],
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

export async function extractVariablesWithGemini(
  params: ExtractVariablesParams
): Promise<ExtractionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: extractionResponseSchema,
      temperature: 0.1,
    },
  });

  const prompt = `
You are an expert document analysis and quotation templating engine.
Analyze the quotation markdown and natural pricing specification to extract all dynamic variables,
table structures, and mutation instructions needed to convert this document into a reusable Word proposal template.

======================================================================
LAYER 1: QUOTATION MARKDOWN (PARSED FROM WORD DOCUMENT)
======================================================================
${params.markdown}

======================================================================
LAYER 2: NATURAL PRICING SPECIFICATION
======================================================================
${params.pricingSpec}

======================================================================
LAYER 3: SELLING AGENCY IDENTITY CONTEXT (CRITICAL NEGATIVE CONSTRAINT)
======================================================================
Agency Name: "${params.companyName}"
Location: "${params.companyBasics?.location || ""}"
Email: "${params.companyBasics?.email || ""}"
Phone: "${params.companyBasics?.phone || ""}"
Industry: "${params.industry || ""}"

### MANDATORY EXTRACTION DIRECTIVES & RULES:

1. CRITICAL AGENCY IDENTITY COLLISION GUARD:
   - The quotation was authored by the service agency: "${params.companyName}".
   - DO NOT extract variables for "${params.companyName}" or its staff, email, address, or phone numbers.
   - Any mention of "${params.companyName}" and its company details must remain STATIC original text in the Word document.
   - ONLY extract variables for the PROSPECTIVE CLIENT / BUYER (e.g. client company name, contact person, client location, seat count, dates, project scope).

2. TAXONOMY CATEGORIES (Strictly 3 buckets for variables):
   - "customer_input": Values that vary per prospective client inquiry (e.g. client company name, contact person, number of seats/locations, project start date).
   - "pricing": Computed financial line items, unit rates, setup fees, subtotals, taxes, and totals.
     - FIRST-CLASS selected_tier ENUM: If the quotation or pricing spec features tiered packages (e.g., Local/Growth/Authority or Essential/Standard/Premium), you MUST extract a variable named "selected_tier" of category "pricing" and data_type "enum", with enum_options listing the available packages and default_value set to the recommended/anchor package.
   - "paragraph": Multi-sentence narrative statements or project overview clauses.
     - By default, paragraph mode is "fixed" (verbatim quote text).
     - If the clause is a dynamic executive pitch or client-tailored problem statement, set mode to "ai_generated" with a clear purpose and length guideline in paragraph_config.

3. DERIVED VISIBILITY RULES (CONDITIONAL ROWS):
   - Do NOT extract technical booleans like "has_tax" or "has_volume_discount" as standalone variables.
   - Instead, attach a visibility_rule directly on the monetary variable:
     e.g., for sales tax: variable_name: "sales_tax_amount", category: "pricing", visibility_rule: { condition_flag: "has_tax", show_when: "value > 0" }.

4. COMPOUND TABLES & REPEATING LOOPS:
   - Multi-tier comparison package matrix tables MUST be extracted in compound_tables with type: "comparison_matrix".
   - Repeating sample deliverables or milestone tables MUST be extracted in compound_tables with type: "repeating_loop" and loop_tag: "items".

5. DETERMINISTIC MUTATION LOCATORS (FOR WORD MUTATION):
   - For every variable, specify a valid mutation action ("replace_text_run", "replace_table_cell", "wrap_conditional_row", or "collapse_repeating_table").
   - Include sample_text (the exact snippet from the markdown), context_anchor, and template_tag (e.g. "{client_name}" or "{monthly_total}").
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const parsed = JSON.parse(responseText) as ExtractionResponse;
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini structured output JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
