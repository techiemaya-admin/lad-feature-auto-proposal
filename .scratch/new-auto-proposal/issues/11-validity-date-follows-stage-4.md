# 11: Valid-Until Date Follows the Stage 4 Validity Period

> **Not fully discussed yet.** This ticket records a problem found on 2026-10-01 so it is not lost. The approach, the scope and the edge cases below are **open** and need a grill session with the user before any code. Do not implement from this file as written.

**What to build:** A proposal's "valid until" date and its validity period can disagree. The quotation often has two separate variables, e.g. co3: `validity_period_days` = 14 and `proposal_valid_until` = a date. Stage 4 turns the validity days into a seller constant the user can edit. The date is filled at generate time by the calendar step, which keeps the **quotation's** gap between the proposal date and the valid-until date — it never reads Stage 4. Change validity to 30 days in Stage 4 and the proposal says "valid for 30 days" but prints a date 14 days away. Nothing flags it, so a reviewer can miss it. A "(14 days)" suffix inside a date's own sample is also copied, never recomputed (already marked with a `ponytail:` comment in the date code).

Goal: when the user sets the validity period in Stage 4, the valid-until date (and any days text beside it) follows it.

**Blocked by:** 10 (both touch the date-handling code; do this after the new box ships)

**Status:** needs-info

**Known so far (verified in code and logs, 2026-10-01):**
- Stage 4 has no date type (money, percent, integer, text, boolean, rows), so it cannot compute a date today.
- Dates are filled by the calendar step from the quotation's samples: earliest date → today, every other date keeps its sample offset.
- The two variables are not linked anywhere.

**Open — to discuss with the user:**
- **Where the fix lives:** (a) the calendar step reads the validity days from Stage 4, or (b) Stage 4 learns dates ("current date + validity period" as a formula). (b) is a much larger engine change.
- **Linking:** how the system knows which number is the validity period for which date — by name, by Stage 4, or by asking the user.
- **Shapes to cover:** a template with only a valid-until date (no separate days value); a days count inside the date's own text ("September 21, 2026 (14 days)"); validity stated in weeks or months; several dates in one template.
- **Fallback:** what happens when the link is missing or ambiguous — keep today's behaviour, or flag it for review.
- **Tests and checks:** which companies prove it, and whether the before/after comparison from ticket 10 applies.
