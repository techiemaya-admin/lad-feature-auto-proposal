export type VariableCategory =
  | "customer_input"
  | "pricing"
  | "paragraph"
  | "table_loop"
  | "comparison_matrix"
  | "compound_table";

export type VariableDataType =
  | "string"
  | "number"
  | "currency"
  | "enum"
  | "paragraph"
  | "table";

export interface VisibilityRule {
  condition_flag?: string;
  show_when?: string;
}

export interface ParagraphConfig {
  mode: "fixed" | "ai_generated";
  purpose?: string;
  tone?: string;
  length_guideline?: string;
  guidance?: string;
}

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

export interface VariableDescriptor {
  sample_value?: string;
  description?: string;
  enum_options?: string[];
  default_value?: string;
  visibility_rule?: VisibilityRule;
  paragraph_config?: ParagraphConfig;
  mutation?: MutationAction;
  columns?: string[];
}

export interface CompanyVariable {
  id: string;
  company_id: string;
  variable_name: string;
  natural_name: string;
  category: VariableCategory;
  data_type: VariableDataType;
  is_custom: boolean;
  is_deleted: boolean;
  sort_order: number;
  descriptor: VariableDescriptor;
  created_at: string;
  updated_at: string;
}

export interface CompoundTable {
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

export interface VariablesResponse {
  success: boolean;
  company_id: string;
  extracted_count?: number;
  variables: CompanyVariable[];
  compound_tables: CompoundTable[];
  document_summary?: string;
}
