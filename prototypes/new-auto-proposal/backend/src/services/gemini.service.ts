import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { Document } from "docxmlater";

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
      col_index?: number;
      sample_text?: string;
      template_tag?: string;
      cells?: Array<{
        col_index: number;
        preserve_existing_label?: boolean;
        template_tag: string;
      }>;
    }
  | {
      action: "collapse_repeating_table";
      table_index?: number;
      row_identifier?: string;
      loop_tag?: string;
      template_row_index?: number;
      column_tags?: Array<{
        col_index: number;
        replacement_tag: string;
      }>;
      delete_sample_rows_from?: number;
      delete_sample_rows_count?: number;
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
              delete_sample_rows_count: { type: SchemaType.NUMBER },
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
          columns: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["table_id", "natural_name", "table_index", "type"],
      },
    },
  },
  required: ["document_summary", "variables", "compound_tables"],
};

function normalizeManifestText(text: string): string {
  return text.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Pre-inspects an OpenXML Word Document (.docx) buffer or Document instance
 * to generate a ground-truth Table Manifest for Gemini context grounding.
 */
export async function generateTableManifest(docInput: Buffer | Document): Promise<string> {
  const doc = docInput instanceof Document ? docInput : await Document.loadFromBuffer(docInput);
  const tables = doc.getTables();
  if (!tables || tables.length === 0) {
    return "No tables detected in document.";
  }

  const manifestLines: string[] = [];
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const rowCount = table.getRowCount();
    const rows = table.getRows();
    const headerCells = rows[0]?.getCells().map((c) => normalizeManifestText(c.getText())) || [];
    const colCount = rows[0]?.getCellCount() || headerCells.length;
    const headerStr = headerCells.join(" | ");

    manifestLines.push(`- Table ${i}: [${headerStr}] (${rowCount} rows, ${colCount} cols)`);

    const sampleRows: string[] = [];
    const maxSampleRows = Math.min(rowCount, 8);
    for (let r = 1; r < maxSampleRows; r++) {
      const row = rows[r];
      if (!row) continue;
      const col0Text = normalizeManifestText(row.getCell(0)?.getText() || "");
      if (colCount === 2) {
        const col1Text = normalizeManifestText(row.getCell(1)?.getText() || "");
        if (col0Text || col1Text) {
          sampleRows.push(`  Row ${r}: "${col0Text}" -> "${col1Text}"`);
        }
      } else {
        const cellsText = row.getCells().map((c) => normalizeManifestText(c.getText())).filter(Boolean);
        if (cellsText.length > 0) {
          sampleRows.push(`  Row ${r}: [${cellsText.join(" | ")}]`);
        }
      }
    }

    if (sampleRows.length > 0) {
      manifestLines.push(...sampleRows);
    }
    if (rowCount > maxSampleRows) {
      manifestLines.push(`  ... (${rowCount - maxSampleRows} more rows)`);
    }
  }

  return manifestLines.join("\n");
}

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
  tableManifest?: string;
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
LAYER 1.5: DOCUMENT TABLE MANIFEST (WORD OPENXML AST)
======================================================================
${params.tableManifest || "No explicit Word AST table manifest available."}

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

1. CRITICAL AGENCY IDENTITY COLLISION GUARD (STRICT NEGATIVE CONSTRAINT):
   - The quotation was authored by the service agency: "${params.companyName}".
   - DO NOT extract variables for "${params.companyName}" or its staff, team names ("Northstar Digital Strategy Team"), email, address, or phone numbers (e.g. "${params.companyBasics?.phone || ""}").
   - Any mention of "${params.companyName}" and its company details must remain STATIC original text in the Word document.
   - The proposal disclaimer at the bottom (*"This document is a proposal, not a signed contract..."*) is static boilerplate and must NEVER be extracted.
   - ONLY extract variables for the PROSPECTIVE CLIENT / BUYER (e.g. client company name, contact person, client locations/seats, project start date).

2. CRITICAL GROUND-TRUTH TABLE INDEXING (STRICT CONSTRAINT):
   - You MUST use the exact 0-based OpenXML table indexes provided in LAYER 1.5: DOCUMENT TABLE MANIFEST for all "table_index" fields in both "mutation" and "compound_tables".
   - Table 0 in the manifest is table_index 0, Table 1 is table_index 1, Table 2 is table_index 2, Table 3 is table_index 3.
   - Example: Proposal metadata fields (such as Proposal Date, Prepared By, Proposal Valid Until) located in Table 0 of LAYER 1.5 MUST use table_index: 0 (NEVER table_index: 1).
   - Never guess or offset table indexes.

3. TIER-AGNOSTIC VARIABLE NAMING:
   - When tiered packages exist (e.g. Local/Growth/Authority or Essential/Standard/Premium):
     a) Extract "selected_tier" as an enum variable with all tier options and the default anchor tier.
     b) DO NOT embed a specific tier name into dynamic pricing variables (e.g. avoid "growth_package_monthly_rate").
     c) Use canonical role-based variable names: "selected_tier_rate" (or "monthly_rate"), "tier_base_investment", and "total_investment".
     d) In table calculations, template the line item label dynamically: "{selected_tier} Package — {billing_period_description}".

4. DYNAMIC SCOPE INCLUSIONS VS. FIXED BOILERPLATE:
   - If a bulleted list or paragraph describes scope deliverables, included features, or SLA response times that vary by tier or headcount (e.g. "Included vs. Not Included — Growth Tier" or "04 What's Included This Cycle"):
     - You MUST classify it as category: "paragraph".
     - You MUST set paragraph_config: { mode: "ai_generated" }.
     - You MUST set purpose: "Draft scope deliverables, SLA commitments, and location coverage strictly aligned with {selected_tier} and the lead's device/headcount footprint."
   - Standard static business legal terms remain mode: "fixed".

5. EMBEDDED CALCULATIONS IN TABLE LABELS:
   - If a table row label cell contains arithmetic (e.g. "Seat subtotal (42 seats × $60.00)" or "Growth Package — 12 months × $3,000/mo"):
     - Specify a composite template pattern for the label cell:
       e.g. sample_text: "42 seats × $60.00", template_tag: "{seat_count} seats × {adjusted_seat_rate}".

6. DERIVED VISIBILITY RULES & CONDITIONAL ROWS:
   - Do NOT extract standalone technical booleans like "has_tax" or "has_volume_discount".
   - Instead, attach a visibility_rule directly on the monetary variable:
     e.g., for sales tax: variable_name: "sales_tax_amount", category: "pricing", visibility_rule: { condition_flag: "has_tax", show_when: "value > 0" }.
     e.g., for annual prepay discount: variable_name: "annual_discount_amount", category: "pricing", visibility_rule: { condition_flag: "has_annual_discount", show_when: "value > 0" }.
   - MANDATORY CONDITIONAL ROW MUTATION: Any variable that carries a visibility_rule (such as sales taxes, state taxes, prepay discounts, or bundle discounts) MUST use mutation action: "wrap_conditional_row" (NEVER "replace_table_cell").
   - For every "wrap_conditional_row" mutation, you MUST provide:
     a) condition_tag: The exact flag name matching visibility_rule.condition_flag (e.g. "has_tax", "has_annual_discount", "has_bundle_discount").
     b) table_index: The exact 0-based table index from LAYER 1.5 containing this row.
     c) row_identifier: The exact text of the Row's Column 0 label (e.g. "Texas Sales Tax (8.25%)" or "Annual prepay discount (10%)").
     d) col_index: The 0-based column index of the amount cell to replace (e.g. 1).
     e) template_tag: The tag for the variable (e.g. "{sales_tax_amount}" or "{annual_discount_amount}").
     f) sample_text: The exact amount text from the quotation (e.g. "$2,673.00" or "−$3,600.00").

7. COMPOUND TABLES & REPEATING LOOPS:
   - Multi-tier comparison package matrix tables MUST be extracted in compound_tables with type: "comparison_matrix".
   - Repeating sample deliverables or milestone tables MUST be extracted in compound_tables with type: "repeating_loop" and loop_tag: "milestones" (or "items").
     * You MUST provide columns: string[] containing the exact variable tag names for each column in left-to-right order:
       e.g., for Phase | Milestone | Deliverable -> columns: ["phase_number", "milestone_title", "deliverable_summary"].
   - Dynamic optional add-on sections in tables MUST be modeled as repeating loops with type: "repeating_loop" and loop_tag: "addon_items" (using collapse_repeating_table) rather than static conditional rows:
     * You MUST provide columns: ["addon_name", "addon_fee"].
     * table_index must be the exact table index from LAYER 1.5 containing the add-on rows (e.g. Table 2).
   - Repeating payment schedule tables MUST be extracted in compound_tables with type: "repeating_loop" and loop_tag: "payment_milestones":
     * You MUST provide columns: ["milestone_name", "trigger_description", "payment_amount"].

8. DETERMINISTIC MUTATION LOCATORS (FOR WORD MUTATION):
   - For every variable, specify a valid mutation action ("replace_text_run", "replace_table_cell", "wrap_conditional_row", or "collapse_repeating_table").
   - Include sample_text (the exact snippet from the markdown), context_anchor, and template_tag (e.g. "{client_name}" or "{monthly_total}").
   - CRITICAL REQUIREMENT FOR TABLE MUTATIONS ("replace_table_cell" and "wrap_conditional_row"):
     You MUST ALWAYS include BOTH "row_identifier" AND "col_index":
     a) table_index MUST strictly match the OpenXML Table index from LAYER 1.5: DOCUMENT TABLE MANIFEST.
     b) row_identifier: MUST be provided as the Column 0 label or header text of the target row (e.g. "Proposal Valid Until", "Date", "Subtotal", "Total employees / seats", "Texas Sales Tax (8.25%)", "Annual prepay discount (10%)"). NEVER omit row_identifier.
     c) col_index: MUST be provided as the 0-based column number containing the cell to mutate (e.g. 1 for value cells in 2-column tables, or 0/2 for column 1/3). NEVER omit col_index.
     d) sample_text: The exact sample text from the cell (e.g. "$2,673.00", "−$3,600.00", "September 7, 2026").
   - Concrete Examples:
     * replace_table_cell: { "action": "replace_table_cell", "table_index": 2, "row_identifier": "Subtotal", "col_index": 1, "sample_text": "$32,400.00", "template_tag": "{subtotal_amount}" }
     * wrap_conditional_row: { "action": "wrap_conditional_row", "condition_tag": "has_annual_discount", "table_index": 2, "row_identifier": "Annual prepay discount (10%)", "col_index": 1, "sample_text": "−$3,600.00", "template_tag": "{annual_discount_amount}" }
     * metadata replace_table_cell: { "action": "replace_table_cell", "table_index": 0, "row_identifier": "Date", "col_index": 0, "sample_text": "September 7, 2026", "template_tag": "{proposal_date}" }
   - For variables in body paragraphs outside tables (like client name in intro headings or paragraphs), use action: "replace_text_run".
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

