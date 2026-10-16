# Auto-Proposal Feature — Problem Discovery 

## 1. Problem Statement

Sales teams using our platform run AI-driven outbound/inbound campaigns (LinkedIn, WhatsApp, email, voice) that generate a high volume of inbound leads. When one of these leads replies asking for pricing, the campaign stops being automated: someone on the team has to leave the platform, manually interpret the request, build a proposal in Word or Excel, and email it back.

This manual step is slow (hours to days, not minutes), inconsistent in quality/format between reps, and — critically — doesn't scale with the volume the campaigns themselves generate. Because these are high-volume, comparatively low-value deals, the manual effort per proposal is disproportionate to the deal size, so either responses lag (losing leads to faster competitors) or proposal quality/consistency suffers under time pressure.

## 2. Root Cause

The bottleneck isn't lead generation (already automated) — it's that proposal creation requires a human to do four things no system currently does end-to-end:
1. **Interpret** the lead's request from an unstructured email
2. **Price it** against the agency's rate card / package structure / pricing formula
3. **Format** it into a client-ready document
4. **Send** it back

Even where pricing is "structured" in principle (packages, tiers, formulas), it typically lives in a person's head or a spreadsheet, not a system — so translating even semi-standardized pricing into a document is manual every single time. The AI campaign tool automates everything up to the point of a pricing question, then hands the ball back to a human, which is exactly where the funnel leaks for high-volume, low-value leads.

## 3. Target Clients (proposed scope)

**Primary target:** Small-to-mid-size B2B service agencies (marketing, IT/MSP, staffing, or web/software development) that:
- Already run lead-gen campaigns on our platform (existing user base, not new ICP)
- Sell at least one **standardized or productized** service/package — not purely bespoke, scoped-per-deal engagements
- Receive **high inbound volume relative to deal value**, making manual per-lead proposal writing a real bottleneck rather than an occasional task

**Explicitly out of scope (for now):** agencies where every deal requires a discovery call before any price can even be estimated (e.g., enterprise strategy consulting, custom software with unbounded scope). There's no fixed price to auto-quote there — auto-send would either be wrong or impossible without human scoping first.

**Decision:** kept as a single unified target type. Pricing across the example clients splits into different underlying *shapes* (menu-match vs formula-calculate vs hourly vs hybrid), but all are still "derive a number from structured inputs," and splitting into multiple target-client types isn't worth the added complexity at this stage given the goal of keeping this feature simple. Whether the different shapes need different handling is a build-time question for the spec phase, not a discovery-scope decision.

**Design note — legal weight of proposals:** no formal contract-like document mechanism is needed. The estimate/draft status is communicated simply through the wording of the email/WhatsApp message itself (e.g. "here's an estimate based on what you shared — happy to confirm details on a call"), not through contract-like clauses or a separate document type. The *content* (line items, pricing, scope) can still look proposal-like; the *legal weight* is just plain language, not formal terms.

## 4. Example Clients (for solution evaluation)

Chosen to span the target definition with different workflows *and*, following Section 5, at least one example per rule-based pricing mechanism.

| # | Client type | Pricing mechanism | Current manual workflow |
|---|---|---|---|
| 1 | Digital marketing agency (SEO/PPC) | Tiered packages (e.g. Local $1,000/mo, Growth $3,000/mo, Enterprise $8,000/mo) | Lead emails asking about "social media management" → account manager matches to closest tier, adjusts for business size, sends PDF next-day |
| 2 | IT Managed Service Provider (MSP) | Per-unit/per-seat formula (e.g. $35–$75/user/month × headcount, by support level) | Prospect emails "40 employees, need IT support" → ops person calculates seats × rate, builds SOW-style quote in Word |
| 3 | Staffing/recruitment agency (contract placement) | Markup formula (pay rate × 1.5–1.8x) or percentage-of-value (15–25% of first-year salary for perm roles) | Client emails a role brief (title, rate, duration) → recruiter calculates markup by hand in Excel, emails rate card back |
| 4 | Web/software development agency (new-build projects) | Flat/fixed fee per project template (Landing page $2.5k, E-commerce $8k, Custom app from $20k) | Lead emails "need a website for my restaurant" → rep matches nearest template, adjusts for requested features, sends proposal PDF |
| 5 | Performance/paid-ads agency | Percentage-of-spend (e.g. 10–15% of managed ad budget) | Lead emails current ad spend and goals → rep calculates fee off disclosed budget, drafts a proposal tying fee to spend tier |
| 6 | Web/software development agency (ad hoc support & change requests) | Hourly/time-based (e.g. $75–$150/hr × estimated hours) | Existing or prospective client emails "need a small fix / feature added" → dev estimates hours from the description, quotes hourly total |
| 7 | Growth marketing agency (retainer + performance bonus) | Hybrid (fixed base retainer + a pre-set rate per outcome, e.g. $2,000/mo base + $50 per qualified lead over target) | Lead emails asking about "lead gen service" → rep quotes the fixed base explicitly, plus the bonus rate as a conditional line item |

This set covers six distinct rule-based pricing mechanisms (Section 5) across the four target verticals, deliberately including two dev-agency examples (#4, #6) since new-build and ad hoc support pricing work fundamentally differently even within the same agency.

## 5. Pricing Mechanism Taxonomy (Rule-Based Only)

These are the pricing mechanisms the system should be able to accommodate, drawn from common patterns across B2B service/agency pricing. Only mechanisms where the price can be **fully computed from structured inputs the lead already provides** are listed — anything requiring case-by-case human judgment (e.g. fully custom/negotiated quoting) is excluded, since it falls outside the target client definition in Section 3.

| Mechanism | How it works | Example (from Section 4) |
|---|---|---|
| Flat/fixed fee | One set price for one defined deliverable. These include upfront amount, phases, recurring amount | Dev agency, new-build projects (#4) |
| Tiered packages | Lead's request is matched to the closest of a small menu of pre-set bundles | Marketing agency, SEO/PPC (#1) |
| Per-unit/per-seat formula | Rate × a countable quantity the lead provides (employees, devices, users) | IT MSP (#2) |
| Markup formula | A disclosed cost input × a fixed multiplier | Staffing agency (#3) |
| Percentage/commission-based | A fixed % applied to a value the lead discloses (spend, revenue, salary) | Performance/paid-ads agency (#5), Staffing agency (#3) |
| Hourly/time-based | Rate × estimated hours, where hours are inferable from the request | Dev agency, ad hoc support (#6) |
| Hybrid (base + fixed performance rate) | A fixed base amount plus a pre-set rate per outcome — the *rate* is rule-based even though the *total* depends on future performance | Growth marketing agency (#7) |

All seven are candidates for auto-generation since none require discretionary judgment to price — they only require the system to correctly extract the relevant input(s) from the inbound message and apply a rule the client has pre-defined. This is the boundary that should carry directly into the spec: **the MVP's job is input-extraction + rule-application, not pricing judgment.**