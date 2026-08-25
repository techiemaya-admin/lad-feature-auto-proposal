# Status: ready-for-agent

# Dynamic Pricing Calculation Engine Unit Tests

## Description
Create a dedicated, thorough test suite in `src/features/auto-proposal/repositories/__tests__/final-price-calculation.repository.test.js` for the primary dynamic pricing engine:

- Test `calculateFinalPrice`:
  - Condition operators: `>`, `<`, `>=`, `<=`, `=`.
  - Discount vs surcharge actions, percentage vs fixed calculation modes.
  - Concept bucket vs Add-on bucket separation (package rules applied to concept items, service rules applied to add-on items).
  - Fixed pricing model vs quantity count model (`pricing_model === 'Fixed'` vs `base_price * count`).
  - Minimum commitment floor: verifies price is raised to `concept.minimum_cost` and `min_cost_adjustment` is injected into the breakdown array.
  - Fallback custom service quote when no concept matches.
  - Multi-concept tie-breaking by case-insensitive `event_type` match.
- Test `generateFinalPrice`:
  - Zero-total fallback: triggers `aiService.callConsultantAI`, updates requirement values, recalculates, and merges breakdowns deduplicating non-zero priced items.
