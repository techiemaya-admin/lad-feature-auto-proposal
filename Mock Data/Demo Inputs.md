# Demo Inputs — the three mock companies

Copy-paste sheet for a live demo. Every prompt and email below is **verbatim** from `Mock Data/test_seeds.json`, which is what the prototype seeds itself with — so nothing has to be typed by hand.

**The order for each company:** pick the company tab → **Stage 1** paste the pricing prompt and upload the `.docx` → work through the stages → **Stage 5** paste the email.

The `.docx` files live in `Mock Data/docx/`. The same email also prefills the mock inbox in the template library, if you want to demo email → template routing.

The full worked arithmetic behind every total is in [`Verification Guide.md`](Verification%20Guide.md).

| Company | Final amount | Upload this `.docx` | Prompt | Email |
| --- | --- | --- | --- | --- |
| 1. Northstar Digital | **$35,073.00** | `Co1_Proposal_Northstar_BloomAndCo.docx` | [→](#1-northstar-digital) | [→](#1-northstar-digital) |
| 2. Fortress IT Group | **$2,734.80/mo** + **$3,150.00** setup | `Co2_Proposal_FortressIT_WhitfieldAssociates.docx` | [→](#2-fortress-it-group) | [→](#2-fortress-it-group) |
| 3. Fieldstone Studio | **$10,445.00** | `Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx` | [→](#3-fieldstone-studio) | [→](#3-fieldstone-studio) |

---

## 1. Northstar Digital

`co1_seo`

**Upload — Stage 1 → Proposal Document Source:**

```text
Mock Data/docx/Co1_Proposal_Northstar_BloomAndCo.docx
```

**Pricing briefing prompt — paste into the Stage 1 prompt box:**

```text
We have 3 packages. Local is $1000/mo, for one location - GBP cleanup, on page stuff, one blog post a month. Growth is $3000/mo, up to 3 locations, more content (4 posts/mo), citations. Authority is $8000/mo, unlimited locations, dedicated strategist, weekly content - mostly our franchise clients end up here. For Austin/Texas clients we add sales tax, around 8.25%, bookkeeper has the exact number. Also do 10% off if someone pays annually upfront instead of monthly, always forget to put that down but we do offer it.
```

**Sample email — paste into Stage 5 (Lead & Proposal):**

*Client: Bloom & Co Dental Group · inbound WhatsApp reply · Sept 4, 2026*

```text
Hi, saw your message about local SEO. We're Bloom & Co, a dental group — we actually have two clinic locations now in the Austin area and neither shows up on Google when people search near either one. What would it cost to fix that? Also, would rather just pay once a year if that gets us a better rate than monthly.
```

**Final amount: $35,073.00** — see [`Verification Guide.md`](Verification%20Guide.md), section 1.

**How it's built:** Growth tier · $36,000.00 base −$3,600.00 annual-prepay discount → $32,400.00 subtotal → $2,673.00 Texas tax → $35,073.00 total.

---

## 2. Fortress IT Group

`co2_msp`

**Upload — Stage 1 → Proposal Document Source:**

```text
Mock Data/docx/Co2_Proposal_FortressIT_WhitfieldAssociates.docx
```

**Pricing briefing prompt — paste into the Stage 1 prompt box:**

```text
Pricing is per seat per month based on support tier. Essential $45/seat/mo - basic helpdesk, patching, monitoring, business hours only. Standard $65/seat/mo - faster SLA, backup management, after hours emergency line. Premium $85/seat/mo - vCIO quarterly review, 24/7 support, priority response under 1hr. Once a client crosses 25 total seats it's $5/seat off whatever tier rate, and past 50 seats it's $10/seat off instead (not stacked, just whichever band they're in). Devices beyond a 1:1 ratio with seats - servers, shared workstations, kiosks - billed separately at $12/device/mo regardless of tier. One time onboarding fee of $75 per seat. 10 seat minimum commit (billed for 10 even if fewer, though we don't really take on anyone smaller than that anyway). Tax is flat 6% Ohio rate for home state clients, applied to the recurring monthly total, not the setup fee.
```

**Sample email — paste into Stage 5 (Lead & Proposal):**

*Client: Whitfield & Associates · inbound email reply · Sept 5, 2026*

```text
We're Whitfield & Associates, a law firm — 42 employees total, split across two office locations. No real IT support right now beyond one guy who helps when something breaks. We'd want the tier with faster response and backups, not the bare minimum, but we don't need the round-the-clock stuff. We also run 5 servers in-house beyond everyone's regular laptop. We're based in Ohio if that matters for pricing.
```

**Final amount: $2,734.80/mo** recurring + **$3,150.00** one-time setup — see [`Verification Guide.md`](Verification%20Guide.md), section 2.

**How it's built:** Standard tier · $65.00 −$5.00 volume adjustment → $60.00/seat; 42 seats → $2,520.00 + $60.00 devices → $2,580.00 recurring → $154.80 Ohio tax → $2,734.80/mo; plus $3,150.00 onboarding (untaxed).

---

## 3. Fieldstone Studio

`co3_dev`

**Upload — Stage 1 → Proposal Document Source:**

```text
Mock Data/docx/Co3_Proposal_Fieldstone_RosewoodHomeGoods.docx
```

**Pricing briefing prompt — paste into the Stage 1 prompt box:**

```text
Fixed templates. Landing Page $2,500, single page, one revision round, ~2 weeks - phases Design then Build/Launch. Business Website $6,000, up to 8 pages, phases Discovery/Design/Build/Launch. E-commerce $9,500, up to 100 products, Shopify or custom cart, phases Discovery/Design/Build/QA/Launch. Custom Web App starts at $22,000 - always needs a scoping call so that's a starting price only, not final. Payment split is usually 50% deposit / 50% at delivery, sometimes thirds for Business Website and E-commerce if the client wants that. Add-ons: CMS integration +$800, copywriting +$600, basic SEO setup +$450, extra revision round +$300, rush delivery (~30% faster) +20% of base price. 2+ add-ons bundled = 10% off the add-on subtotal, started that last year. Tax - honestly not sure, ask accounting, don't think we charge sales tax on services in our state but not 100% on that.
```

**Sample email — paste into Stage 5 (Lead & Proposal):**

*Client: Rosewood Home Goods · inbound email reply · Sept 3, 2026*

```text
Hi! We're Rosewood Home Goods, we sell home decor and want to finally start selling online — probably around 60 products to start. We don't have anyone who can write product descriptions well, so it'd be great if you could handle that too, and if you could also just make sure the basic SEO stuff is set up since we have zero idea how to do that ourselves. No rush on timeline, just want it done properly.
```

**Final amount: $10,445.00** — see [`Verification Guide.md`](Verification%20Guide.md), section 3.

**How it's built:** E-commerce Build · $9,500.00 base + $1,050.00 add-ons (copywriting + SEO) −$105.00 bundle discount → $10,445.00 total; 50/50 split of $5,222.50.
