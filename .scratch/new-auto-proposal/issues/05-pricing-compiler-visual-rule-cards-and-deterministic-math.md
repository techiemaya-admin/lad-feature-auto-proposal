# 05: Pricing Compiler, Visual Rule Cards, and Deterministic Math

**What to build:** A natural-language pricing rule compiler, interactive rule cards UI (`PricingEngineDeck.tsx`), and deterministic calculation engine. Advancing from the template checkpoint triggers Gemini to translate the company's natural `pricing_engine_spec` together with confirmed variables and sample quotation values into a structured JSON rule schema (`PricingRuleSchema`). The frontend displays these rules as interactive visual cards (Packages/Tiers, Volume Breakpoints, Add-ons, and Taxes/Discounts) with inline controls to change prices, adjust multipliers, or add/remove conditional blocks. A pure JavaScript calculation module on the backend evaluates these rules against incoming parameters with 100% mathematical precision (zero LLM arithmetic), verified against the exact ground-truth totals in `verification_guide.md`. Direct schema inspection and manual tweaking are accessible in the Bottom Dev Dock. A primary `[Proceed to Lead Simulation ➔]` button advances to simulation.

**Blocked by:** 04: docXMLater Word Template Mutation and Minimal Checkpoint Preview

**Status:** ready-for-agent

- [ ] Implement backend endpoint `POST /api/companies/:id/rules/compile` prompting Gemini to compile `pricing_engine_spec`, confirmed variables, and sample quotation values into structured `PricingRuleSchema` JSON.
- [ ] Create SQLite schema to store and persist compiled pricing rules per company, with endpoints `GET /api/companies/:id/rules` and `PUT /api/companies/:id/rules`.
- [ ] Build pure JavaScript pricing calculation engine module in `backend/src/services/pricing-calculator.ts` supporting tiered packages, per-unit volume adjustments, stackable add-on discounts, one-time setup fees, and conditional state tax rates.
- [ ] Write automated unit tests for the pricing engine asserting exact calculations against `verification_guide.md`:
  - Northstar (`co1_seo`): 2 locations, Texas, annual prepay = **$35,073.00**
  - Fortress IT (`co2_msp`): 42 seats, Standard tier, 5 extra devices, Ohio = **$2,734.80/mo recurring + $3,150.00 setup**
  - Fieldstone (`co3_dev`): E-commerce build + Copywriting + SEO setup, 10% bundle discount = **$10,445.00**
- [ ] Build Visual Rule Cards UI (`PricingEngineDeck.tsx`):
  - Packages/Tiers card (rates, caps, SLA descriptions).
  - Volume Breakpoints card (seat counts, rate adjustments).
  - Add-ons & Modifiers card (stackable items, bundle rules).
  - Tax & Payment Terms card (state tax rates, milestone splits).
- [ ] Enforce `font-mono` / `tabular-nums` formatting on all currency and multiplier inputs to eliminate numeric jitter during live recalculations.
- [ ] Implement tactile card physics with subtle hover lift (`hover:-translate-y-0.5 transition-transform duration-100`) and active control states.
- [ ] Hook raw `PricingRuleSchema` JSON editor with syntax validation into the Bottom Dev Dock tab.
- [ ] Implement primary `[Proceed to Lead Simulation ➔]` advance button.
