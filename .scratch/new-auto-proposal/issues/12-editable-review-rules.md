# 12: Editable "Held for review" rules

**What to build:** The Stage 4 `Held for review when` section becomes fully editable — add, edit conditions + reason, and delete review rules — with the same expand-below-row UX as the ledger variable editor. Edits auto-save through the existing 300 ms debounced `updatePricingRules` PUT. No backend changes.

Full design, decisions and edge cases: [`prototypes/new-auto-proposal/docs/plans/08-editable-review-rules.md`](../../../prototypes/new-auto-proposal/docs/plans/08-editable-review-rules.md) (Q1–Q6 resolved with the user, 2026-10-08).

**Blocked by:** None (can start immediately)

**Status:** done (merged into `new-auto-proposal-demo`, 2026-10-08)

**Decisions (2026-10-08, grilling with the user):**
- Q1 stale: soft stale banner — old Stage 5 result stays, flagged "rules changed — regenerate". No wipe, no rewind.
- Q2 empty `when: []`: stripped before PUT + Proceed blocked while one exists. A half-created rule can never Draft-block proposals.
- Q3 empty `reason`: required (`trim(reason) !== ""`), `maxLength={200}` attr only, no counter UI. Empty → inline hint + Proceed blocked.
- Q4 `CondRows`: extract to shared `CondRows.tsx` with a one-line unit filter hiding `text`/`rows` for review rules. No LedgerTray → Deck cross-import.
- Q5 identity: client-only `_id` (`crypto.randomUUID()` on load-normalize + on add, stripped before PUT). No backend/type change.
- Q6 errors: top band + red-border + auto-expand offending row via `review_rules[N]` path parse (~5 lines next to `errorByPath`).
- Simplicity guardrail: no new state machine, no new dependencies, no backend touch.

## Acceptance criteria
- [x] Empty state: section always visible with header + "Add rule" button and hint text when `review_rules` is empty.
- [x] Add: new row appears, tray auto-opens, amber "no conditions" warning shows.
- [x] Conditions: `CondRows` shared module used with `left="var"`; `text`/`rows` units hidden; save fires within ~300 ms.
- [x] Reason: required inline; `maxLength={200}` with no counter UI; Proceed blocked while blank.
- [x] Empty-`when` drafts stripped from PUT payload; Proceed blocked while one exists.
- [x] Delete: row removed, selection cleared, save fires; deleting the only rule restores empty state.
- [x] Row errors: a `review_rules[N].when` validator error red-borders and auto-expands row N in addition to the top band.
- [x] Selection survives add/delete/reorder (keyed by `_id`, not index).
- [x] Stage 5: editing a rule flags the displayed proposal stale (banner, no wipe); regenerating shows updated `reason` in the Draft box.
- [x] `npm test` green in `prototypes/new-auto-proposal/backend` (backend untouched).

## Comments
