# 09: Review Flags a Proposal, It Does Not Block It

**What to build:** Today `POST /proposal/generate` declines as soon as `evaluation.needs_review` is non-empty: no document, previous files cleared, a "Declined to auto-quote" panel (`proposal-generator.service.ts:154-157`). That models a system that sends proposals by itself. The real product never does: every proposal goes to a human who checks it, edits it and sends it. So a review reason should tell that human *what to check*, and the document should still be built — with only the values the problem makes unknowable left blank, so the human fills those few places by hand instead of writing the whole proposal.

**Blocked by:** 06 (completed)

**Status:** open — docs already describe the target (2026-09-23), marked "ticket 09; today: declined".

**Decisions (2026-09-23, with the user):**
- Always build the document; `needs_review` travels alongside it (success shape + `needs_review`), shown as a review panel above the PDF.
- Blank **what is broken**, nothing more. A missing required fact, a lookup with no matching row, or a division by zero blanks that value and everything computed from it (no state → tax line and total blank). A matching `review_rules[]` entry blanks **nothing**: every number prints, the rule's reason is the flag.
- Never a silent 0: a blank is a blank, not `$0.00`.

## Ground truth (anchors)
- Decline branch: `proposal-generator.service.ts:154-157`; route: `routes/proposal.ts:123-124`; frontend: `LeadSimulator.tsx:156`, `:297-305`; types: `frontend/src/types/proposal.ts:46-53`.
- Blanks already exist for one case: `present[name] = false` → payload `""` (`pricing-calculator.ts:554`); the `condition_flag` skip sets it (`:278-281`). **Check first** whether a missing input / lookup miss / ÷0 sets `present = false` on the value *and* on everything computed from it — if a dependent computes on with 0, that is the bug to fix, in `evaluate`, once.
- Missing *required* fact stays a 400 + clarification email (ticket 08) — that is a question for the lead, not a review.

## Steps
- [ ] Engine: a broken value and its dependents come out `present: false` (one test: co2 with no state → tax and total blank, every other value printed).
- [ ] Generator + route: drop the decline branch; return the document plus `needs_review`.
- [ ] Stage 5 UI: review panel above the PDF listing the reasons; blanks visible in the document.
- [ ] Doc drift (show diff, wait for OK): remove the "today: declined" markers from `AGENTS.md` §4, `docs/design.md` §3.5, `docs/plan.md`, `docs/plans/06-lead-simulator.md` §1, `spec.md` §5.
