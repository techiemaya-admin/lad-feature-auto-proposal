# Verification Guide — Auto-Proposal Test Suite

This guide validates that the pricing math in each generated `.docx` proposal is correct against the `pricing_engine_parsed` rules in `companies_dataset.json`. Each section explains **how the pricing mechanism is set up**, then walks through **one full worked example** tied directly to the delivered document — no extra hypothetical cases mixed in, per scope.

Test date used throughout: **September 7, 2026**.

---

## 1. Northstar Digital — Tiered Package Pricing

### 1.1 How the mechanism is set up

Northstar sells three fixed monthly tiers (`Local`, `Growth`, `Authority`), each with a hard `location_cap`. The rule engine's job is:

1. Read the lead's stated number of locations.
2. Select the **lowest tier whose `location_cap` is ≥ that number** (tier_selection_rule in the dataset).
3. Apply the `discount_rule` only if the lead has indicated annual prepayment.
4. Apply the `tax_rule` only if the client's state is Texas, calculated on the **post-discount** subtotal (this basis was an assumption resolution — the raw owner input only said "around 8.25%" without specifying pre/post-discount basis).

This is a **discrete selection problem**, not a formula — the engine matches an input against tier boundaries rather than computing a continuous function.

### 1.2 Mock lead input

> *Inbound WhatsApp reply, Sept 4, 2026:*
> "Hi, saw your message about local SEO. We're Bloom & Co, a dental group — we actually have two clinic locations now in the Austin area and neither shows up on Google when people search near either one. What would it cost to fix that? Also, would rather just pay once a year if that gets us a better rate than monthly."

**Extracted fields:** `locations = 2`, `state = TX`, `payment_preference = annual`.

### 1.3 Ground-truth math

| Step | Rule applied | Calculation | Result |
|---|---|---|---|
| 1. Tier selection | `location_cap(Local)=1 < 2` → fails. `location_cap(Growth)=3 ≥ 2` → passes. | Lowest passing tier = Growth | **Growth, $3,000/mo** |
| 2. Annualize | 12 × monthly_price | 12 × $3,000 | $36,000.00 |
| 3. Annual prepay discount | 10% off annual total | $36,000 × 0.10 | −$3,600.00 |
| 4. Subtotal | Step 2 − Step 3 | $36,000 − $3,600 | $32,400.00 |
| 5. TX sales tax | 8.25% on post-discount subtotal | $32,400 × 0.0825 | $2,673.00 |
| 6. **Total** | Step 4 + Step 5 | $32,400 + $2,673 | **$35,073.00** |

**Cross-check against `Proposal_Northstar_BloomAndCo.docx`:** Growth tier selected ✓; $36,000.00 → −$3,600.00 → $32,400.00 subtotal → $2,673.00 tax → **$35,073.00** total, all match.

---

## 2. Fortress IT Group — Per-Seat Formula Pricing

### 2.1 How the mechanism is set up

Fortress prices per seat, where the **rate itself is a function of two inputs**, not a single lookup:

1. Base rate comes from the **support tier** the client selects (Essential/Standard/Premium — a discrete choice, like Northstar's tiers).
2. That base rate is then adjusted by a **seat-count breakpoint band** (`volume_adjustment_rule`) — this is the formula's "moving part" and the one most likely to be miscalculated by a naive engine, because the discount applies to the **entire** seat count once a breakpoint is crossed, not marginally (i.e., it is *not* "first 24 seats at full rate, next 18 seats discounted" — all 42 seats get the 25–49 band rate).
3. Devices beyond a 1:1 seat:device ratio are billed as a flat separate add-on, unaffected by the seat breakpoint.
4. A one-time per-seat setup fee is charged once, and is explicitly **excluded** from the tax basis.
5. Tax applies only to the recurring monthly total, only for Ohio clients.
6. A seat-count floor (`minimum_commit`) exists but is not triggered by this lead — included here as a documented non-event, not a hypothetical.

### 2.2 Mock lead input

> *Inbound email reply, Sept 5, 2026:*
> "We're Whitfield & Associates, a law firm — 42 employees total, split across two office locations. No real IT support right now beyond one guy who helps when something breaks. We'd want the tier with faster response and backups, not the bare minimum, but we don't need the round-the-clock stuff. We also run 5 servers in-house beyond everyone's regular laptop. We're based in Ohio if that matters for pricing."

**Extracted fields:** `seats = 42`, `support_tier = Standard` (inferred from "faster response and backups, not the bare minimum... don't need round-the-clock" → matches Standard's SLA description, not Essential or Premium), `managed_devices_beyond_1to1 = 5`, `state = OH`.

### 2.3 Ground-truth math

| Step | Rule applied | Calculation | Result |
|---|---|---|---|
| 1. Base rate | Standard tier | lookup | $65.00/seat/mo |
| 2. Breakpoint band | 42 seats falls in the 25–49 band | rate_adjustment = −$5.00 | Adjusted rate = **$60.00/seat/mo** |
| 3. Seat subtotal | 42 seats × adjusted rate | 42 × $60.00 | $2,520.00 |
| 4. Device add-on | 5 devices × $12.00 | 5 × $12.00 | $60.00 |
| 5. Monthly recurring subtotal | Step 3 + Step 4 | $2,520 + $60 | $2,580.00 |
| 6. OH tax | 6% on recurring subtotal only | $2,580 × 0.06 | $154.80 |
| 7. **Total monthly recurring** | Step 5 + Step 6 | $2,580 + $154.80 | **$2,734.80** |
| 8. One-time setup fee (separate, untaxed) | 42 seats × $75.00 | 42 × $75.00 | **$3,150.00** |

**Minimum-commit check:** 42 ≥ 10 → floor not triggered → no adjustment. (This is a real test case, not a placeholder: an engine that doesn't check the floor at all would still get the right answer here, so it doesn't *prove* the floor logic works — see the edge-case checklist in Section 4 for the boundary test that does.)

**Cross-check against `Proposal_FortressIT_WhitfieldAssociates.docx`:** $65.00 base → −$5.00 adjustment → $60.00 adjusted rate → $2,520.00 seat subtotal → $60.00 device add-on → $2,580.00 recurring subtotal → $154.80 tax → **$2,734.80** total monthly recurring; **$3,150.00** one-time setup — all match.

---

## 3. Fieldstone Studio — Flat Fee per Project Template

### 3.1 How the mechanism is set up

Fieldstone prices off a fixed **project template** (a lookup, like Northstar's tiers) plus **stackable add-ons** (a summation, like Fortress's device add-on), with one conditional discount layered on top of the add-ons only:

1. Match the lead's request to the nearest `project_templates` entry by scope description (not a numeric threshold this time — a qualitative match: "e-commerce store" → E-Commerce Build template).
2. Sum any requested items from `addon_price_list`.
3. If 2 or more **stackable** add-ons are selected (Rush Delivery is excluded from this count, per the parsed rule — it's a percentage modifier, not a stackable flat add-on), apply the 10% `addon_bundle_discount_rule` to the **add-on subtotal only**, never the base fee.
4. Apply the `tax_rule` — resolved to 0% for this test suite, flagged as an assumption in the dataset because the source input was inconclusive.
5. Split into `payment_split_rule` — default 50/50 unless the client requested the optional 3-way split (not requested here, so default applies).

### 3.2 Mock lead input

> *Inbound email reply, Sept 3, 2026:*
> "Hi! We're Rosewood Home Goods, we sell home decor and want to finally start selling online — probably around 60 products to start. We don't have anyone who can write product descriptions well, so it'd be great if you could handle that too, and if you could also just make sure the basic SEO stuff is set up since we have zero idea how to do that ourselves. No rush on timeline, just want it done properly."

**Extracted fields:** `project_type = e-commerce`, `product_count ≈ 60` (within the 100-product cap, template confirmed), `addons_requested = [Copywriting, Basic SEO Setup]`, `rush = false`.

### 3.3 Ground-truth math

| Step | Rule applied | Calculation | Result |
|---|---|---|---|
| 1. Template match | "≈60 products, e-commerce" ≤ 100-product cap | lookup | E-Commerce Build, **$9,500.00** base |
| 2. Add-on subtotal | Copywriting + Basic SEO Setup | $600 + $450 | $1,050.00 |
| 3. Bundle discount check | 2 stackable add-ons selected (Rush not among them) → condition met | 10% × $1,050 | −$105.00 |
| 4. Add-on total (post-discount) | Step 2 − Step 3 | $1,050 − $105 | $945.00 |
| 5. Tax | 0% (resolved default) | $0.00 | $0.00 |
| 6. **Total project investment** | Step 1 + Step 4 + Step 5 | $9,500 + $945 + $0 | **$10,445.00** |
| 7. Deposit (50%) | Step 6 × 0.50 | $10,445 × 0.50 | $5,222.50 |
| 8. Final payment (50%) | Step 6 × 0.50 | $10,445 × 0.50 | $5,222.50 |

**Cross-check against `Proposal_Fieldstone_RosewoodHomeGoods.docx`:** $9,500.00 base + $600.00 + $450.00 → $1,050.00 add-on subtotal → −$105.00 bundle discount → **$10,445.00** total; deposit/final split **$5,222.50 / $5,222.50** — all match.

---

## 4. Rule Engine Validation Checklist

Use this to test the actual extraction + pricing engine beyond the three worked examples above (which each prove the *happy path* only).

### 4.1 Tier / template boundary conditions
- [ ] **Northstar, exactly at a cap:** a lead with exactly 3 locations should select **Growth**, not escalate to Authority (tests `>=` vs `>` boundary logic).
- [ ] **Northstar, above all caps:** a lead with, say, 15 locations should still resolve to **Authority** (unlimited), not error out or default incorrectly.
- [ ] **Fortress, exactly at a breakpoint:** a lead with exactly 25 seats should receive the **25–49 band** adjustment (−$5), not the 0–24 band — tests inclusive lower-bound handling.
- [ ] **Fortress, exactly at the next breakpoint:** a lead with exactly 50 seats should receive the **50+ band** (−$10), not 25–49 — same inclusive-boundary risk one band up.
- [ ] **Fortress, below the commit floor:** a lead with, say, 7 seats should be **billed for 10 seats**, not 7, per `minimum_commit` (the worked example above did not exercise this — it's a required separate test).
- [ ] **Fieldstone, exactly at scope cap:** a lead requesting exactly 100 products should still match **E-Commerce Build**, not fail the template match or silently upsell to Custom Web App.
- [ ] **Fieldstone, over scope cap:** a lead requesting, say, 140 products should NOT auto-match E-Commerce Build — correct behavior is flagging for human review, since Custom Web App requires a scoping call per `assumption_flag` (this is a case the engine should **decline to auto-quote**, not guess on).

### 4.2 Discount logic
- [ ] **Northstar, no annual mention:** a lead that doesn't mention prepayment should generate a monthly-only proposal with **no** discount line item at all (not a $0.00 line — the row should be absent).
- [ ] **Fortress:** confirm the volume adjustment is **non-stacking** — a 60-seat lead should get only the −$10/seat band applied, not −$5 and −$10 combined.
- [ ] **Fieldstone, exactly 1 add-on:** a lead selecting only Copywriting (no second add-on) should **not** receive the bundle discount — tests the "2 or more" threshold isn't off-by-one.
- [ ] **Fieldstone, Rush + 1 other add-on:** confirm Rush Delivery does **not** count toward the bundle-discount add-on count (per `addon_bundle_discount_rule` note), even though it's priced alongside the others.

### 4.3 Tax logic
- [ ] **Northstar, non-Texas lead:** a lead outside TX should generate **no tax line**, not a $0.00 tax line.
- [ ] **Fortress:** confirm the one-time setup fee is **excluded** from the taxable base even when the client is in Ohio — a common engine bug is applying the recurring tax rate to the full invoice total instead of the recurring portion only.
- [ ] **Fieldstone:** confirm the 0% tax resolution is applied consistently — and flag in QA that this field is a **resolved assumption**, not a confirmed accounting position, so it should be revisited before this company goes live on the real product (this is a dataset/process note, not a math bug).

### 4.4 Input-extraction edge cases (email → structured fields)
- [ ] Lead states location/seat/product counts as **words, not numerals** ("forty-two employees") — engine must still extract `42`.
- [ ] Lead gives a **range** instead of an exact number ("around 55-60 products") — engine should pick a defensible single value (e.g., the higher end, or flag for confirmation) rather than silently averaging or failing.
- [ ] Lead omits a required field entirely (e.g., MSP lead never states which state they're in) — engine should **not guess** a tax jurisdiction; it should omit tax and flag the gap, not assume the agency's home state.
- [ ] Lead's request maps ambiguously between two templates/tiers (e.g., "sort of a big website with maybe a store section") — engine should flag for human confirmation rather than forcing a single silent match.

### 4.5 Non-contract / plain-language disclaimer check

Each proposal must read as an **estimate**, not a binding legal instrument, per the product's design note that legal weight is carried by plain wording, not contract clauses. Confirm for all three documents:

- [ ] Contains one plain-language line stating this is a proposal/estimate, not a signed agreement (present in all three — see closing italic line on each document's final page).
- [ ] Contains a stated **validity window** (14 days) rather than an open-ended offer (present in the header table of all three).
- [ ] Contains **no** indemnification, liability, IP-assignment, arbitration, or governing-law clauses.
- [ ] Contains **no** signature/e-signature block (per explicit scope decision — acceptance happens by reply/call, not a formal signature capture in this artifact).
- [ ] Uses active, conversational voice throughout scope/pricing sections rather than passive legal phrasing ("we'll schedule your kickoff call" vs. "a kickoff call shall be scheduled").

---

## 5. File Cross-Reference

| Deliverable | Company | Pricing mechanism | Lead |
|---|---|---|---|
| `Proposal_Northstar_BloomAndCo.docx` | Northstar Digital | Tiered packages | Bloom & Co Dental Group (2 locations, TX, annual prepay) |
| `Proposal_FortressIT_WhitfieldAssociates.docx` | Fortress IT Group | Per-seat formula | Whitfield & Associates (42 seats, OH, 5 extra devices) |
| `Proposal_Fieldstone_RosewoodHomeGoods.docx` | Fieldstone Studio | Flat fee per project template | Rosewood Home Goods (E-commerce, 2 add-ons) |

All figures in this guide were computed independently from `companies_dataset.json` → `pricing_engine_parsed` and then checked against the rendered `.docx` output; no discrepancies were found at time of writing.
