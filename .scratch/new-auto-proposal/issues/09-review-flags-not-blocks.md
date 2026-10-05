# 09: Review Flags a Proposal, It Does Not Block It

**What to build:** Today `POST /proposal/generate` declines as soon as `evaluation.needs_review` is non-empty: no document, previous files cleared, a "Declined to auto-quote" panel (`proposal-generator.service.ts:154-157`). That models a system that sends proposals by itself. The real product never does: every proposal goes to a human who checks it, edits it and sends it. So a review reason should tell that human *what to check*, and the document should still be built — with only the values the problem makes unknowable left blank, so the human fills those few places by hand instead of writing the whole proposal.

**Blocked by:** 06 (completed)

**Status:** completed (2026-10-01).

**Decisions (2026-09-23, with the user):**
- Always build the document; `needs_review` travels alongside it (success shape + `needs_review`), shown as a review panel above the PDF.
- Blank **what is broken**, nothing more. A missing required fact, a lookup with no matching row, or a division by zero blanks that value and everything computed from it (no state → tax line and total blank). A matching `review_rules[]` entry blanks **nothing**: every number prints, the rule's reason is the flag.
- Never a silent 0: a blank is a blank, not `$0.00`.

**Decisions (2026-10-01, grill session, with the user):**
- **Two states.** *Ready*: `needs_review` empty → normal view; the confirm step (the agent emails/WhatsApps the human) is a later ticket. *Draft*: reasons present → red box above the PDF, title "Draft: not ready to send. Check these first:", reasons listed; DOCX and PDF downloads still work. No DRAFT watermark in the file.
- **No `declined` field anywhere.** Ready vs Draft is read from `evaluation.needs_review`, which the success response already carries.
- **Broken vs skipped.** *Broken* = the engine itself raised a review on the value (required input missing, lookup miss with no fallback, ÷0), or anything computed from a broken value, including through a condition (`has_tax`). *Skipped* = `condition_flag` legitimately false (co1 in CA): not broken, totals still print. A broken condition counts as "no" (its section hides; the reason says what to add). An optional input left out is neither: dependents use 0, as today, so every blank has a reason in the box.
- **Marker.** A broken value prints `[to confirm]` (visible, searchable in Word); a skipped value stays `""`. AI paragraphs keep the marker where a blank number lands; the drafter is not told the marker as a fact.
- Probe that confirmed the bug: co2 with no state printed `total_monthly_recurring = 2580, present = true`, a total silently missing tax.

## Ground truth (anchors)
- Decline branch: `proposal-generator.service.ts:154-157`; route: `routes/proposal.ts:123-124`; frontend: `LeadSimulator.tsx:156`, `:297-305`; types: `frontend/src/types/proposal.ts:46-53`.
- Blanks already exist for one case: `present[name] = false` → payload `""` (`pricing-calculator.ts:554`); the `condition_flag` skip sets it (`:278-281`). **Check first** whether a missing input / lookup miss / ÷0 sets `present = false` on the value *and* on everything computed from it — if a dependent computes on with 0, that is the bug to fix, in `evaluate`, once.
- Missing *required* fact stays a 400 + clarification email (ticket 08) — that is a question for the lead, not a review.

## Steps
- [x] Engine: a `broken` set in `evaluate`; broken values and their dependents come out `present: false` and print `[to confirm]`; skipped stays `""` (tests: co2 no state → tax and total blank, every other value printed; co1 CA prints its total; co1 monthly discount stays `""`).
- [x] Generator + route: drop the decline branch and `declined`; the document is always written.
- [x] Drafter: don't list `[to confirm]` values as facts.
- [x] Stage 5 UI: red Draft box above the PDF when `needs_review` is non-empty; downloads stay.
- [x] Doc drift (show diff, wait for OK): remove the "today: declined" markers from `AGENTS.md` §4, `docs/design.md` §3.5, `docs/plan.md`, `docs/plans/06-lead-simulator.md` §1, `spec.md` §5.
