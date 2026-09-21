import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { getStorageDir } from "../db/database.js";
import type { CompanyRow } from "../routes/companies.js";
import { logPipelineArtifact } from "./pipeline-log.js";
import { buildProposalPayload, evaluate } from "./pricing-calculator.js";
import type { Evaluation, PricingRules, Stage2Context, Stage2Variable, Value } from "./pricing-rules.types.js";
import { hydrateProposalTemplate, type TierMatrix } from "./template-mutator.service.js";
import { draftNarrative, type NarrativeResult } from "./narrative-drafter.service.js";

/**
 * Stage 5: lead facts → evaluate → payload → dates (code) → narrative (model, placeholders only) →
 * proposal.docx (easy-template-x) → proposal.pdf (LibreOffice). Nothing is persisted: the two files
 * overwrite storage/<id>/proposal.* on every run. Plan: docs/plans/06-lead-simulator.md §1.3–1.5.
 */

// ---------------------------------------------------------------------------
// Dates — computed, never extracted.
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// "September 7, 2026 (14 days)" → month, day, year, suffix. ponytail: US month-name-first only; the three mock
// quotations all use it. Add a day-first branch when a template needs "7 September 2026".
const SAMPLE_DATE = /^([A-Z][a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(.*)$/s;

/** The sample's date as UTC midnight plus whatever trails it ("" or " (14 days)"). */
export function parseSampleDate(sample: string): { utc: number; suffix: string } | null {
  const m = SAMPLE_DATE.exec(sample.trim());
  if (!m) return null;
  const month = MONTHS.findIndex((n) => n.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
  if (month < 0) return null;
  return { utc: Date.UTC(Number(m[3]), month, Number(m[2])), suffix: m[4] };
}

/** data_type "date", or (ponytail: fallback for extractions older than the date type) a string whose sample parses as one. */
export const isDateVariable = (v: Stage2Variable): boolean =>
  v.category === "customer_input" &&
  (v.data_type === "date" || ((!v.data_type || v.data_type === "string") && parseSampleDate(v.sample_value) !== null));

/**
 * Earliest sample date → today; every other date keeps its offset from that anchor (calendar days).
 * Output keeps the sample's spelling and any suffix verbatim. ponytail: a "(14 days)" suffix is copied,
 * not recomputed — parse it when a template's validity window differs from its sample's.
 */
export function fillDates(variables: Stage2Variable[], today = new Date()): Record<string, string> {
  const dated = variables
    .filter(isDateVariable)
    .map((v) => ({ name: v.variable_name, parsed: parseSampleDate(v.sample_value) }))
    .filter((d): d is { name: string; parsed: NonNullable<ReturnType<typeof parseSampleDate>> } => d.parsed !== null);
  if (dated.length === 0) return {};
  const anchor = Math.min(...dated.map((d) => d.parsed.utc));
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const out: Record<string, string> = {};
  for (const d of dated) {
    const t = new Date(todayUtc + (d.parsed.utc - anchor));
    out[d.name] = `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}, ${t.getUTCFullYear()}${d.parsed.suffix}`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const proposalFilePath = (companyId: string, ext: "docx" | "pdf") => path.join(getStorageDir(), companyId, `proposal.${ext}`);

/** Hard-reset hook: any earlier-stage change makes the last generated proposal stale. Never throws. */
export function clearProposalFiles(companyId: string): void {
  for (const ext of ["docx", "pdf"] as const) {
    try {
      fs.rmSync(proposalFilePath(companyId, ext), { force: true });
    } catch {
      // a locked file on Windows is not worth failing the reset over
    }
  }
}

type PdfConverter = (docx: Buffer) => Promise<Buffer>;
const SOFFICE_DEFAULTS: Record<string, string[]> = {
  win32: ["C:/Program Files/LibreOffice/program/soffice.exe", "C:/Program Files (x86)/LibreOffice/program/soffice.exe"],
  darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
  linux: ["/usr/bin/soffice", "/usr/bin/libreoffice", "/opt/libreoffice/program/soffice"],
};
const sofficePath = () =>
  [process.env.SOFFICE_PATH, ...(SOFFICE_DEFAULTS[process.platform] ?? [])].find((p) => p && fs.existsSync(p)) ??
  (() => { throw new Error("LibreOffice not found — set SOFFICE_PATH in backend/.env"); })();
/**
 * `soffice --headless --convert-to pdf` with a persistent profile in the temp dir: a fresh profile costs
 * 20-30 s and prints a harmless "parser error" to stderr (which libreoffice-convert mistakes for failure);
 * a warm one converts in ~2 s. ponytail: one process per run, no queue — two concurrent runs share the
 * profile and the second waits on LibreOffice's own lock. Production runs the same binary in a container.
 */
const libreOfficePdf: PdfConverter = async (docx) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "proposal-pdf-"));
  try {
    const src = path.join(work, "proposal.docx");
    fs.writeFileSync(src, docx);
    // In the temp dir, not storage/: soffice silently fails (exit 127) when the profile URL contains spaces, and this repo's path has them.
    const profile = path.join(os.tmpdir(), "auto-proposal-libreoffice-profile");
    await promisify(execFile)(sofficePath(), [`-env:UserInstallation=${pathToFileURL(profile).href}`, "--headless", "--convert-to", "pdf", "--outdir", work, src], { timeout: 120_000 });
    return fs.readFileSync(path.join(work, "proposal.pdf"));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
};
let pdfConverter: PdfConverter | null = null;
/** Test seam: replaces the LibreOffice spawn. null restores it. */
export function setPdfConverter(fn: PdfConverter | null): void {
  pdfConverter = fn;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerateInput {
  company: CompanyRow;
  rules: PricingRules;
  stage2: Stage2Context;
  tierMatrix?: TierMatrix;
  /** Which values the template reported as covered by a drafted paragraph: paragraph name → tags. */
  coveredBy: Record<string, string[]>;
  inputs: Record<string, Value>;
  /** Facts filled from a rule default rather than the lead's words; the drafter words them as "based on". */
  assumed?: string[];
  /** Drafter context only — never re-extracted. */
  leadText: string;
  today?: Date;
}

export type GenerateResult =
  | { declined: true; needs_review: Evaluation["needs_review"]; evaluation: Evaluation }
  | {
      declined: false;
      evaluation: Evaluation;
      payload: Record<string, unknown>;
      narrative: NarrativeResult;
      docx: Buffer;
      pdf: Buffer | null;
      pdf_error?: string;
    };

export async function generateProposal(input: GenerateInput): Promise<GenerateResult> {
  const { company, rules, stage2, inputs } = input;
  const companyId = company.company_id;

  // Dates are computed here and also offered to the sheet, in case a compile made a date an input anyway.
  const dates = fillDates(stage2.variables, input.today);
  const evaluation = evaluate(rules, { ...dates, ...inputs });
  if (evaluation.needs_review.length) {
    clearProposalFiles(companyId); // a declined lead must not leave the previous run downloadable
    return { declined: true, needs_review: evaluation.needs_review, evaluation };
  }

  const payload: Record<string, unknown> = buildProposalPayload(rules, evaluation, stage2, input.tierMatrix);

  // Customer inputs come straight from the facts and dates from the calendar — over whatever the sheet
  // computed for them (a live compile once defined client_name and the dates as inputs). Numeric facts the
  // sheet formats (seat counts) and seller-owned constants (validity days) keep the sheet's rendering.
  for (const v of stage2.variables) {
    if (v.category !== "customer_input" || isDateVariable(v)) continue;
    const raw = inputs[v.variable_name];
    if (raw === null || raw === undefined) {
      if (payload[v.variable_name] === undefined) payload[v.variable_name] = "";
    } else if (typeof raw === "string" || Array.isArray(raw)) {
      payload[v.variable_name] = Array.isArray(raw) ? raw.join(", ") : raw;
    } else if (payload[v.variable_name] === undefined) {
      payload[v.variable_name] = String(raw);
    }
  }
  Object.assign(payload, dates);

  const narrative = await draftNarrative({ ...input, payload });
  for (const [name, n] of Object.entries(narrative)) payload[name] = n.text;
  logPipelineArtifact(companyId, "proposal-payload.json", payload);

  const docx = await hydrateProposalTemplate(fs.readFileSync(path.join(getStorageDir(), companyId, "template.docx")), payload);
  fs.writeFileSync(proposalFilePath(companyId, "docx"), docx);

  let pdf: Buffer | null = null;
  let pdf_error: string | undefined;
  try {
    pdf = await (pdfConverter ?? libreOfficePdf)(docx);
    fs.writeFileSync(proposalFilePath(companyId, "pdf"), pdf);
  } catch (err) {
    pdf_error = err instanceof Error ? err.message : String(err);
    fs.rmSync(proposalFilePath(companyId, "pdf"), { force: true });
  }
  return { declined: false, evaluation, payload, narrative, docx, pdf, pdf_error };
}
