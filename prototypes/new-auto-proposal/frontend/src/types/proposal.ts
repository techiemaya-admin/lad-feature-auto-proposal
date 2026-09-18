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
}

export interface LeadFacts {
  fields: LeadField[];
  inputs: Record<string, Value>;
  /** Required fields the message did not answer. */
  missing: string[];
  /** Judgement calls the extractor made (range picked, inferred choice, counted devices). */
  assumptions: string[];
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
