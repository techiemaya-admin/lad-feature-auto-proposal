import type { Evaluation, InputType, Value } from "./pricing";

/**
 * Stage 5 contracts — mirror of backend routes/proposal.ts (types only).
 * Design: docs/plans/06-lead-simulator.md §1.
 */

/** One fact the calculator needs, built per company from the rules' inputs + the undefined customer inputs. */
export interface LeadField {
  name: string;
  label: string;
  input_type: InputType | "text";
  options: string[];
  required: boolean;
  /** Filled in by the backend when the lead does not say it. */
  default?: Value;
  /** Seller-authorised reading of the lead's words for this field. */
  assume_when?: string;
}

export interface LeadFacts {
  fields: LeadField[];
  inputs: Record<string, Value>;
  /** Required fields the message did not answer. */
  missing: string[];
  /** Interpretations the extractor made of the lead's own words (range picked, option matched). */
  assumptions: string[];
  /** Fields the lead left blank that code filled from the seller's default. */
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

export type ProposalResult =
  | {
      success: true;
      declined?: false;
      evaluation: Evaluation;
      payload: Record<string, unknown>;
      narrative: Record<string, NarrativeParagraph>;
      files: { docx: string; pdf: string | null };
      pdf_error?: string;
    }
  | { success: false; declined: true; needs_review: Evaluation["needs_review"]; evaluation: Evaluation };
