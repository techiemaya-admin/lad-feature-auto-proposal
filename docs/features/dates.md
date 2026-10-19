# Dates in proposals

Every date in a proposal (proposal date, valid-until, start, delivery, payment due) is a Stage 4 sheet value. The model writes the date's formula (`proposal_valid_until = add_days(today, validity_days)`), code does the date maths, and the user edits the day counts in Stage 4. Every date and every gap comes from code.

A date is never a lead input; lead-given dates ("we want to start Nov 1") are out of scope.

Paths relative to repo root. Pipeline overview: [../architecture.md](../architecture.md). Pricing contract: [pricing-engine.md](pricing-engine.md).

## Design decisions

- Covers every date in a template, including kinds the mock quotations don't have yet.
- Date maths = calendar days and simple months. No business days, no date comparisons, no date differences as sheet values.
- **date-fns** does all date work: maths, reading, printing. No Temporal, no chrono-node. A date value is its ISO string `"2026-10-02"`, read with `parseISO` (never `new Date(iso)`: that is UTC midnight, the previous day west of UTC).
- `today` is a **reserved sheet name** supplied by code (§3). Two formula ops: `add_days(date, n)`, `add_months(date, n)`; `add_days(today, 0)` = "this date is today".
- The extraction model returns each date's `date_format`; code verifies it (§6).
- **A date variable holds only the date.** A duration beside it ("September 21, 2026 (14 days)") is a separate number variable: template `{proposal_valid_until} ({validity_days} days)`.
- No string-date fallback: sheets and extractions created before the date type are unsupported (demo data).

## 1. Date helpers (`backend/src/services/dates.ts`)

The calculator, the compiler, Stage 2 and the lead extractor all need it; keeping it out of `proposal-generator` avoids an import cycle.

- `DEFAULT_DATE_FORMAT = "MMMM d, yyyy"` (the style of all three mock quotations).
- `readDate(sample, format)` → ISO string or `null`: date-fns `parse` + `isValid`, inside try/catch (date-fns throws on `D` / `YYYY`).
- `writeDate(iso, format)` → text via date-fns `format`. A weekday token prints the new date's weekday.
- `checkFormat(sample, format)` → `readDate` succeeds and `writeDate` gives the sample back exactly. Catches every wrong format tried during review: `MMMM D, YYYY` (throws), `MMMM dd, yyyy` ("September 07"), a duration left in the sample (no parse), a wrong weekday.
- `dateFormatOf(v)` → `v.date_format` when `checkFormat` passes, else `DEFAULT_DATE_FORMAT`.
- `sampleDate(v)` → the sample as an ISO date, or `null` when neither its format nor the default reads it ("TBC").
- `hasDay(format)` → the format prints a day (`d`, `do`, `dd`, `E…`). A month-only date (`December 2026`) reads as the 1st of its month; the compiler gaps (§5) and `today` (§3) use this to treat it at month precision.
- `isDateVariable(v)` = `isCustomerOrFixed(v) && v.data_type === "date"`.
- `localToday()` → the server's local date as ISO; Stage 5 passes it as `today` (§3).

`pricing-rules.types.ts`: `Unit` gains `"date"`; `FormulaOp` gains `"add_days" | "add_months"`.

## 2. Calculator (`pricing-calculator.ts`)

- `evaluate`: `add_days` → `addDays(parseISO(a), n)`, `add_months` → `addMonths(...)` (month ends clamp: Jan 31 + 1 month = Feb 28). Result stored as ISO string. `ZERO.date = null`.
- A day count that is not a finite whole number (14.5, NaN) marks the date `broken` with a `needs_review` reason, never a throw. Its dependants blank through the existing `broken` spread.
- `today` is read from `inputs.today` like any input, never defined by the sheet.
- `buildProposalPayload`: a `date`-unit value prints through the module's `printDate` (`writeDate` with `dateFormatOf` of its Stage 2 variable), taking precedence over the generic `formatLike` path. `formatLike` itself has no date branch.
- `sampleCheck`: a `date` value is compared as it prints, `writeDate(value, dateFormatOf(v)) === sample`, so each date is checked at the precision its document shows (the day, or only the month for `December 2026`). A sample that reads with neither its format nor the default (`TBC`) is **skipped**; the Variable Ledger warns on it.

## 3. Today

- Sample check: `buildRulesState` evaluates with `{ ...sample_inputs, today: sampleToday }`, where `sampleToday` = the sample date of the variable whose formula is `add_days(today, 0)`; with none, the earliest readable Stage 2 date sample whose format `hasDay`. A template whose earliest date is before the proposal date ("RFP received Aug 30") needs the proposal date defined as today; a lead-given date like that is out of scope anyway.
- Stage 5 evaluates with `today` = the server's local date as ISO (single-machine demo; a deployed version takes the user's zone).
- `GenerateInput.today` is the test seam, an ISO string, so tests never depend on the clock.

## 4. Validator (`pricing-calculator.ts` `validate`)

- `"date"` added to `UNITS`. `add_days` / `add_months`: exactly 2 args; arg 1 a `date` variable or `today`; arg 2 an `integer`-unit variable or a whole-number literal; result unit `date`.
- A date (or `today`) is rejected in `add` `sub` `mul` `div` `min` `max`, in any `where` / `Cond`, and as a table cell. Reason: numeric coercion silently returns 0, so `add(proposal_date, 5)` would print 5 with no error.
- Every Stage 2 date variable must be defined as a `date`-unit variable, under the same rule as "cells you must define". Missing after the auto-repair retry → validation error in Stage 4; the user adds it by hand; proceed stays 409.
- `today` can't be defined as a variable name; the unknown-reference check accepts it.
- Date **inputs** stay rejected (lead dates out of scope); the validator message names that reason.

## 5. Compiler prompt (`pricing-compiler.service.ts`)

- Dates leave the customer-inputs list (and the "names, dates and free text are NOT yours" line) and get their own section, gaps computed by code:

  ```
  Dates to define (unit "date"; build each from the reserved name `today` or another date):
  - proposal_date         sample "September 7, 2026"   (the earliest date)
  - proposal_valid_until  sample "September 21, 2026"  (14 days after proposal_date)
  - delivery_date         sample "October 7, 2026"     (30 days / 1 month after proposal_date)
  - project_start         sample "December 2026"       (3 months after proposal_date)
  ```

  "N months" is shown beside the days only when the day of the month matches. A date whose format has no day gets its gap in months alone, so the model reaches for `add_months`.
- Rule 2 (units) adds `date`; rule 3 (formula) adds `add_days` / `add_months`. One line: "`today` is reserved; the proposal date is `add_days(today, 0)`; link each gap to the number variable the document prints for it (`validity_days`), or add a constant helper with `in_document: false` when it prints none."

## 6. Stage 2: extraction and variables

- Response schema: a **required** `date_format` field in the Gemini schema and the DeepSeek JSON shape; `""` for non-dates.
- Extraction prompt: "for a `date`, give its date-fns format (`MMMM d, yyyy`); when day and month order is unclear, use day-first (`dd/MM/yyyy`)". A date's `sample_text` is the date alone; a duration next to it ("(14 days)") is its own `number` variable, placed with `context_text` as `validity_days` is. The co1 and co2 samples split it; the prompt line reinforces that.
- `routes/variables.ts`: `date_format` is saved into the descriptor JSON in the extract insert. No derive step, no DB migration. Custom-added dates and rows extracted before `date_format` existed have none and use the default.
- The variables GET adds a computed `date_format_ok` per date variable (worked out on read, so never stale).
- `VariableReviewDeck.tsx`: a format text field beside the sample for date variables, saved through the existing `patchDescriptor`; a warning on the date when `date_format_ok` is false. The field previews today's date in what is typed so far (empty = the default format), with the same D / Y guard as the backend instead of letting date-fns throw.

## 7. Stage 4 UI (`frontend/src/components/pricing/`)

- `types/pricing.ts`: `Unit` + `FormulaOp` additions mirroring the backend.
- `readable.ts`: `UNIT_LABEL.date`; `add_days` / `add_months` readable as "proposal_date + validity_days days" / "+ N months".
- `LedgerTray.tsx`: the two ops in `FORMULA_OPS`; `today` in the variable dropdown (`varOptions`); a date constant uses `<input type="date">` (ISO in, ISO out). Days stay ordinary integer constants, edited in the ledger.

## 8. Stage 5

- `proposal-generator.service.ts` evaluates with `today` (§3); dates come out of `buildProposalPayload`. A broken days value already blanks the dates computed from it: `[to confirm]` through the existing `broken` spread.
- `lead-extractor.service.ts` imports `isDateVariable` from `dates.ts`; a date is never asked, even when a sheet lacks one.
- Narrative drafter: no change; dates reach it as tags in the payload.

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Date with no printed duration (delivery date only) | Compiler adds a hidden constant `delivery_days = 30`; editable in Stage 4. |
| Duration in weeks ("valid for 2 weeks") | Helper `mul(validity_weeks, 7)` → `add_days`. No extra op. |
| Duration attached to the date's text | Extraction splits it; if not, the format fails the check → default format + warning. |
| Ambiguous `07/09/2026` | The model picks day-first; the format is editable in the Variable Ledger. Code can't check this choice (both readings print back). |
| Ordinal, weekday, two-digit year | date-fns tokens `do`, `EEEE`, `yy`; the weekday is recomputed for the new date. |
| Month-only (`December 2026`, `12/2026`, `Q4 2026`) | Formats `MMMM yyyy`, `MM/yyyy`, `QQQ yyyy`; gap given in months (§5), checked as printed (§2). |
| Wrong model format (`D` / `YYYY`, `dd` vs `d`) | Fails `checkFormat` → default format + warning. |
| `Sept.` | date-fns only knows "Sep": fails the check → default + warning. Accepted. |
| Unreadable date sample (`TBC`) | Default format + warning; skipped by the sample check; still required in the sheet. |
| Day count not a whole number | Validator error; at run time the date is `broken`, never a crash. |
| Model puts a date in number maths | Validator error → auto-repair retry. |
| Compile leaves a date undefined | Validation error; proceed blocked; user adds it in the ledger. |
| Jan 31 + 1 month | Feb 28. |

## 10. Verification

Offline (`npm test`):

1. Date ops: `add_days`, `add_months` incl. Jan 31 + 1 month; a 14.5 day count is broken, not a crash.
2. Formats: the §9 styles (incl. `December 2026`) pass `checkFormat` and print back; a wrong format falls back to the default.
3. Validator: `add(proposal_date, 5)` rejected; missing date variable rejected; `today` as a variable name rejected.
4. Sample check: `today` = the sample of the `add_days(today, 0)` date; a sheet setting validity to 14 reproduces the sample's valid-until date; `add_months(proposal_date, 3)` passes against a `December 2026` sample.

Fixtures: `backend/src/tests/fixtures/*.variables.json` hold dates as `data_type: "date"`; `proposal_valid_until` is `"September 21, 2026"` plus a fixed `validity_days` `"14"`, so the cell reads `{proposal_valid_until} ({validity_days} days)`. `fixtures/*.rules.json` add `proposal_date = add_days(today, 0)`, `proposal_valid_until = add_days(proposal_date, validity_days)` and a constant `validity_days = 14`.

Unchanged and must stay green: the three benchmark totals to the cent and the golden mutator test.

Live (`npm run test:live`, all three companies):

- Every date gets a `date_format` that passes the check, compiles into the sheet, and the sample check is green.
- With validity left at 14, every generated date equals today's output.
- Validity set to 30: the valid-until date moves to today + 30 and the number beside it reads 30.
