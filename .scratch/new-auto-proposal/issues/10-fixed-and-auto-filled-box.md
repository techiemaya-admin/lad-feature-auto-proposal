# 10: "Fixed & auto-filled" Box in Variable Review

**What to build:** Variable Review (Stage 2) sorts every variable into Customer inputs / Pricing / Paragraphs. Values the lead is never asked for — the proposal date, the valid-until date, validity days, payment terms, a fixed contract length — land in **Customer inputs**, so the screen tells the user the lead will be asked for them. The pipeline already handles them correctly; only the label misleads. Add a 4th box, **Fixed & auto-filled**, so Customer inputs means only "values the lead tells us". The reviewer can move chips into and out of it like any other box.

This is a **UX change, not a pipeline change.** Inside the system a `fixed` variable is handled exactly like `customer_input` is today. Stage 2 only creates and sorts variables; their values are still defined in Stage 4.

**Blocked by:** None (can start immediately)

**Status:** in progress — code, checks, live flow and docs done (2026-10-01); waiting on `npm run test:live` (human) and the commit

**Decisions (2026-10-01, grill session, with the user):**
- **Name:** "Fixed & auto-filled" on screen, stored key `fixed`. Screen order: Customer inputs → Fixed & auto-filled → Pricing → Paragraphs.
- **Box rule — who supplies the value:** the lead tells us → Customer inputs; the seller sets it or the system computes it (dates, validity days, payment terms, a fixed contract length) → Fixed & auto-filled; money, rates, percentages, the selected tier → Pricing; prose rewritten per client → Paragraphs (unchanged). Whether the maths uses a value does not decide its box — Stage 4 reads every box.
- **Not a Paragraphs merge:** a `paragraph` variable has its whole block replaced and is handed to the narrative drafter, so the model would "write" dates.
- **Label only.** Everywhere the code checks `customer_input`, it also accepts `fixed`. No change to the Stage 4 compiler prompt wording, the pricing maths, the lead-form logic or the narrative drafter. The only behaviour change is one new category rule in the Stage 2 extraction prompt (Gemini + DeepSeek share it) plus the schema enums.
- **Stage 4 has the final say, as today.** A `fixed` value Stage 4 leaves undefined is still asked in the lead form (mark this with a `ponytail:` comment naming the gap); if the pricing notes say the client chooses, the notes win — this is also how a seller value is switched to "ask the client".
- **Dates keep `data_type: "date"`** inside the new box, so the calendar fill keeps working for them.
- **Old companies:** stored rows keep dates under `customer_input` and keep working; reset or re-extract to re-sort them. No data conversion. Old log runs are history and need no action.
- **Bug fixed on the way:** the variables route's data-type allow-list omits `"date"`, so a date chip can't be created through the API.
- **Out of scope:** the valid-until date following the Stage 4 validity days — ticket 11.

## Where it lives
DB `CHECK` constraint + the existing table-rebuild migration in `db/database.ts` (switch its trigger to look for `'fixed'`) · `CATEGORIES` / `DATA_TYPES` in `routes/variables.ts` · extraction schema enums + category rules in `gemini.service.ts` and `deepseek.service.ts` · `isDateVariable` and the payload loop in `proposal-generator.service.ts` · the fallback field loop in `lead-extractor.service.ts` · the inputs list in `pricing-compiler.service.ts` · frontend `types/variable.ts`, `VariableReviewDeck.tsx` (boxes + move menu), `AddCustomChipModal.tsx`. Run `graft grep "customer_input"` before editing for the exhaustive list.

## Steps
- [x] Before any change: generate a proposal for co1, co2 and co3 and keep the payload + lead-form fields as the baseline.
- [x] DB + API accept `fixed`; API accepts `date` (tests: creating a `fixed` + `date` chip succeeds; an old-style database migrates and accepts a `fixed` row).
- [x] Every internal `customer_input` check also accepts `fixed` (test: a `fixed` date is still calendar-filled and never appears in the lead form).
- [x] Stage 2 prompt: one category rule line for `fixed`; dates move there from `customer_input`.
- [x] Screen: 4th box in that order, in the move menu and in the add-chip modal.
- [x] `npm test` green, golden test included.
- [x] After: regenerate co1/co2/co3 (done deterministically: stored state copied, AI + PDF stubbed, run as-is and with every date relabelled `fixed` — lead-form fields, Stage 4 compile prompt, payload, review flags and narrative prompt identical to the baseline). Numbers, dates and lead-form fields match the baseline; only the box a chip sits in may differ (AI prose may vary by wording, so it is compared by eye, not exactly).
- [ ] Human runs `npm run test:live` (the Stage 2 prompt changed).
- [x] Doc drift (show diff, wait for OK, after tests pass): "3 boxes" → 4 and dates under the new box in `docs/plan.md`, `docs/design.md`, `docs/plans/06-lead-simulator.md`, `spec.md`, and `AGENTS.md` §4 if needed. State explicitly that Fixed & auto-filled is its own box on screen but is processed exactly like Customer inputs, so nobody later "fixes" the two being grouped together.

## Comments

**2026-10-01, live flow after reset (deepseek-flash, Stage 1→5, seed pricing notes + seed leads):**
- Every date landed in Fixed & auto-filled on all three companies and printed as October 1 / October 15, 2026 (14 days). Seller values also landed there: validity days, minimum engagement months, the 10-seat minimum, the 100-product cap, the delivery window, the 2-add-on bundle minimum. Each one printed its value and none was asked.
- Benchmarks hit to the cent: co1 $35,073.00, co2 $2,734.80/mo + $3,150.00 onboarding, co3 $10,445.00. No template misses, compile errors, sample-check failures or review flags. All three PDFs were built.
- One "Stage 4 has the final say" case seen, as agreed: co1 `contract_months` (12) was put in Fixed, but the compiler made it a lead input ("12 months for an annual prepay"), so the lead form asks for it. The lead extractor read 12 from "pay once a year", so the total is right. This is today's behaviour, not a regression, but it is the one place where the label and the lead form disagree.
