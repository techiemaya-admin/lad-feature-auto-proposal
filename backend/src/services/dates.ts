import { format, isValid, parse, parseISO } from "date-fns";
import { isCustomerOrFixed, type Stage2Variable } from "./pricing-rules.types.js";

/**
 * Dates as sheet values (docs/plans/07-date-type.md §1). A date value is its ISO string "2026-10-02";
 * a date's look in the document is its Stage 2 `date_format` (a date-fns pattern), checked against its sample.
 * Always `parseISO`, never `new Date(iso)`: that is UTC midnight, the previous day west of UTC.
 */

/** The style of all three mock quotations. */
export const DEFAULT_DATE_FORMAT = "MMMM d, yyyy";

const ISO = "yyyy-MM-dd";
/** A format's tokens, without its quoted literals ("d 'de' MMMM" → "d  MMMM"). */
const tokens = (fmt: string) => fmt.replace(/'[^']*'/g, "");

/** Sample text → ISO date, or null when the format does not read it. */
export function readDate(sample: string, fmt: string): string | null {
  // date-fns warns on the console and throws on D / YYYY (day of year, week year): a wrong format, not a date.
  if (!fmt || /[DY]/.test(tokens(fmt))) return null;
  try {
    const d = parse(sample.trim(), fmt, new Date(2000, 0, 1));
    return isValid(d) ? format(d, ISO) : null;
  } catch {
    return null;
  }
}

/** ISO date → text in `fmt`. A weekday token prints the new date's weekday. */
export const writeDate = (iso: string, fmt: string): string => format(parseISO(iso), fmt);

/** The format reads the sample and prints it back exactly — the only proof a model-given format is right. */
export function checkFormat(sample: string, fmt: string | undefined): boolean {
  const iso = fmt ? readDate(sample, fmt) : null;
  return iso !== null && writeDate(iso, fmt!) === sample.trim();
}

/** The format a date prints with: its own when it passes the check, else the default (Variable Review warns). */
export const dateFormatOf = (v: Pick<Stage2Variable, "sample_value" | "date_format">): string =>
  checkFormat(v.sample_value, v.date_format) ? v.date_format! : DEFAULT_DATE_FORMAT;

/** The sample as an ISO date, or null when neither its format nor the default reads it ("TBC"). */
export const sampleDate = (v: Pick<Stage2Variable, "sample_value" | "date_format">): string | null =>
  readDate(v.sample_value, dateFormatOf(v));

/** The format prints a day; a month-only date ("December 2026") reads as the 1st and is gapped in months. */
export const hasDay = (fmt: string): boolean => /[dE]/.test(tokens(fmt));

export const isDateVariable = (v: Stage2Variable): boolean => isCustomerOrFixed(v) && v.data_type === "date";

/** Stage 5's `today`. ponytail: the server's local date — fine for a single-machine demo; a deployed version takes the user's zone. */
export const localToday = (): string => format(new Date(), ISO);
