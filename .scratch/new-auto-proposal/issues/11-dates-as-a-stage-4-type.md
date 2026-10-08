# 11: Dates as a Stage 4 Type

**What to build:** A proposal's dates follow the pricing sheet. Today every date is filled at generate time from the quotation's samples, so changing validity from 14 to 30 days in Stage 4 prints "(30 days)" next to a date 14 days away, and only "Month D, YYYY" samples can be read. After this ticket a date is a sheet value like money: the model writes its formula from a reserved `today` (`proposal_valid_until = add_days(today, validity_days)`), code does the maths, the user edits the day counts in Stage 4, and each date prints in its own document's style (`07/09/2026`, `September 7th, 2026`, `December 2026`, …).

Full design, decisions and edge cases: [`prototypes/new-auto-proposal/docs/plans/07-date-type.md`](../../../prototypes/new-auto-proposal/docs/plans/07-date-type.md). Replaces the former ticket 11 (valid-until date follows Stage 4).

**Blocked by:** None (can start immediately)

**Status:** completed (2026-10-08).

**Decisions (2026-10-05, plan review with the user):**
- Every date in a template is covered; dates the lead gives are out of scope (a date is never a lead input).
- date-fns does all date work (maths, reading, printing); no Temporal, no chrono-node.
- The extraction model returns each date's date-fns format (day-first when day and month are ambiguous). Code accepts it only if the sample prints back exactly; otherwise the default `MMMM d, yyyy` plus a warning in Variable Review. The format stays editable there.
- Month-only dates are checked as printed and get their gaps in months.
- `fillDates` and the string-date fallback are deleted; old saved sheets are not supported.
- This changes guardrail 2 in `AGENTS.md` (the model derives `date_format` rather than copying text); the wording is shown to the user before it is applied.

## Acceptance criteria
- [x] Before any change: generate a proposal for co1, co2 and co3 and keep the payloads as the baseline.
- [x] Date helpers, calculator and validator (plan §1–4), with the test fixtures updated so the 11 tests that rely on the old fallback pass again; new offline checks for date maths, formats, validator rules and the sample check (plan §10).
- [x] Stage 2: the extraction model returns `date_format`; it is saved with the variable, checked, and Variable Review shows a format field and a warning when the check fails (plan §6).
- [x] Stage 4: the compiler prompt lists each date with its gap computed by code; every date compiles into the sheet and the sample check is green (plan §5).
- [x] Stage 5: `fillDates` deleted; dates come out of the sheet with the real `today` (plan §8).
- [x] Ledger: `add_days` / `add_months` in the formula menu, `today` in the variable list, a date picker for date constants (plan §7).
- [x] `npm test` green: the three benchmark totals to the cent and the golden mutator test unchanged.
- [x] After: with validity left at 14, co1/co2/co3 dates equal the baseline; with validity set to 30, the valid-until date moves to today + 30 and the number beside it reads 30.
- [x] Human runs `npm run test:live` (the Stage 2 and Stage 4 prompts change).
- [x] Doc drift (show diff, wait for OK, after tests pass): `AGENTS.md` guardrails 2 and 4, `docs/plan.md`, `docs/plans/06-lead-simulator.md` §1.4.

## Comments

**2026-10-08, close-out (implementation `98cd330`, preview `d049ef4`, verified by user + agent):**
- Offline: `npm test` 86/86 green in `prototypes/new-auto-proposal/backend` (three benchmark totals to the cent and the golden mutator test unchanged); `fillDates` and the string-date fallback deleted, old saved sheets need a Stage 4 recompile.
- Before/after through the full routes to a generated `.docx`: at validity 14 the dates equal the pre-change baseline (October 5 / October 19); at 30 the valid-until reads November 4, 2026 (30 days), per the implementation commit.
- Live: user ran `npm run test:live` green (Stage 2 `date_format` + Stage 4 compile prompts changed).
- Follow-up preview: Variable Review format field now previews today's date in what is typed (empty = default format) with the backend D / Y guard; `docs/plans/07-date-type.md` §6 updated to match.
