# Status: ready-for-agent

# Test Suite Hardening, High-Value Engine Coverage & Waste Removal Specification

## Problem Statement

The Rush Away Auto-Proposal backend currently has significant imbalances and critical blind spots across its automated test suite:
1. **Critical Revenue & Calculation Logic Untested**: The primary revenue and quotation calculation pipeline (`final-price-calculation.repository.js`) is a 350-line engine managing concept vs add-on buckets, condition operators, percentage/fixed discounts, surcharges, minimum cost commitments, and AI fallback re-evaluations. It currently has **zero dedicated unit tests**.
2. **Untested Input Validation & Utilities**: The core request body validation middleware (`validate.js`), quotation placeholder builder (`placeHolderBuilder.js`), and contact parsing utilities (`common-utils.js`) have **0% or near-0% test coverage**.
3. **Superficial "Coverage-Only" Tests**: Several test suites create a false sense of security by testing only a fraction of a module. For example, `concept.service.test.js` tests only 1 method (`deleteConcept`) out of 8 methods, leaving validation checks for required names, duplicate location mappings, and pricing rules unverified.
4. **Wasteful Mock-Echoing Tests**: Pure pass-through controllers with no branch logic or payload transformations (e.g. `lead_requirement_values.controller.test.js` get/update/delete) merely assert that mocked return values are echoed into `res.json`, testing Jest's mock mechanism rather than application behavior.
5. **Fragmented Regression Organization**: Regression tests are bundled into a generic `remediation-fixes.test.js` file across 5 unrelated domains instead of being co-located in their proper domain suites.

## Solution

Harden the test suite into a high-confidence, production-grade verification asset by:
1. **Adding Comprehensive Dynamic Pricing Tests**: Create a dedicated test suite for `final-price-calculation.repository.js` asserting all rule operators (`>`, `<`, `>=`, `<=`, `=`), discount and surcharge modes (percentage vs fixed), concept vs add-on subtotal splitting, minimum commitment floor adjustments, event type matching, and zero-total AI consultant fallbacks.
2. **Adding Boundary & Schema Validation Tests**: Create unit test suites for `validate.js`, `placeHolderBuilder.js`, and `common-utils.js`.
3. **Fleshing Out Incomplete Business Service Suites**: Expand `concept.service.test.js` to cover all 8 methods, including 400 Bad Request, 404 Not Found, and 409 Conflict boundary conditions.
4. **Eliminating Mock-Echoing Waste & Re-homing Regressions**: Remove trivial mock-echoing controller tests, re-home all regression tests from `remediation-fixes.test.js` into their canonical domain test suites, and delete `remediation-fixes.test.js`.
5. **Formalizing Quality Standards (ADR-0005)**: Record `0005-testing-strategy-and-quality-standards.md` to establish lasting quality standards, testing tiers, and waste-test prohibitions.

## User Stories

1. As a platform engineer, I want the Dynamic Pricing Engine (`calculateFinalPrice`) to be verified against all condition operators (`>`, `<`, `>=`, `<=`, `=`), so that complex tenant pricing rules always calculate mathematically accurate quotation subtotals.
2. As a platform engineer, I want package-level rules to apply strictly to services inside a Concept bucket and service-level rules to apply to Add-on services, so that bundle discounts and item add-ons do not corrupt each other's calculations.
3. As a sales administrator, I want minimum package commitments (`concept.minimum_cost`) to automatically trigger a `min_cost_adjustment` line item when subtotals fall below the floor, so that profit margins and minimum contract values are protected.
4. As an automated lead handler, I want zero-total calculations to trigger the AI Consultant fallback to discover requirements from raw inquiry emails, so that incomplete customer inquiries still yield valid quotation drafts.
5. As an API client developer, I want `validateBody` middleware to reject missing required fields, non-UUID strings, out-of-bounds numbers, and malformed types with structured 400 errors, so that invalid data never reaches the database or service layers.
6. As a catalog manager, I want `concept.service.js` to enforce name requirements (400), non-existent concept checks (404), base price requirements (400), and duplicate location mapping checks (409), so that catalog data integrity is maintained.
7. As a quotation template author, I want `placeHolderBuilder.js` to sanitize unknown keys, preserve required proposal metadata, and format item arrays with numerical defaults, so that proposal docx generation never crashes on missing attributes.
8. As an inbound message processor, I want `common-utils.js` (`parseContactInfo`) to accurately parse multi-word names and email addresses from angle-bracketed strings while safely returning null on malformed inputs.
9. As a software maintainer, I want all tests to be organized in co-located `__tests__/` domain directories rather than generic grab-bag regression files, so that tests are discoverable and maintainable.
10. As a software maintainer, I want trivial mock-echoing tests to be eliminated from the test suite, so that test execution time and maintenance overhead are focused exclusively on high-value business logic.
11. As a future contributor, I want testing standards and anti-patterns to be documented in ADR-0005, so that team conventions are transparent and consistently followed.

## Implementation Decisions

### 1. Dynamic Pricing Calculation Engine Coverage
- Implement unit tests for `calculateFinalPrice` and `generateFinalPrice` in `final-price-calculation.repository.test.js`.
- Mock database query results and AI service responses deterministically to exercise all execution branches:
  - Branch 1: Concept matched + Package rules applied to Concept bucket + Service rules applied to Add-on bucket.
  - Branch 2: Fixed pricing model (`item.pricing_model === 'Fixed'`) vs variable count pricing model (`base_price * count`).
  - Branch 3: Minimum cost commitment floor applied (`final_price < concept.minimum_cost`), raising price and appending `min_cost_adjustment` to breakdown.
  - Branch 4: Fallback custom quote when no concept matches lead requirements.
  - Branch 5: Multi-concept tie-breaking by case-insensitive `event_type` match.
  - Branch 6: `generateFinalPrice` zero-total re-evaluation triggering `aiService.callConsultantAI` and merging deduplicated breakdowns.

### 2. Validation Middleware & Utility Testing
- Implement `validate.test.js` to test `validateBody`:
  - Required field presence and missing error formatting.
  - Type checking (`string`, `number`, `uuid`, `object`).
  - Constraint limits (`min` and `max` for strings and numbers).
  - Calling `next()` on successful validation.
- Implement `placeHolderBuilder.test.js` to test:
  - Default initialization and schema attributes.
  - Disallowed/unknown key filtering in `set` and `setBulk`.
  - Normalization of line items in `setItems` and `addItem`.
  - Final JSON structure from `build()`.
- Implement `common-utils.test.js` to test `parseContactInfo`:
  - Standard `"First Last <email@example.com>"`.
  - Multi-word first and last names.
  - Malformed inputs, missing angle brackets, empty inputs, non-string inputs.

### 3. Concept Service Comprehensive Validation
- Expand `concept.service.test.js` to test all 8 service methods:
  - `createConcept`: Throws 400 when `name` is missing.
  - `getConceptById`: Throws 404 when concept is not found.
  - `listConcepts`: Delegates to `conceptRepository.findAllWithRequirements`.
  - `listConceptsByLocation`: Returns empty array if no concepts at location, otherwise queries repository.
  - `linkConceptToLocation`: Validates concept & location exist, throws 409 Conflict if already linked, creates link when valid.
  - `addPricing`: Throws 400 when `base_price` is missing.
  - `updateConcept`: Validates concept existence with 404 check before updating.
  - `deleteConcept`: Soft-deletes concept for tenant.

### 4. Waste Removal & Regression Re-homing
- Remove pass-through `get`, `update`, `delete` mock-echoing tests from `lead_requirement_values.controller.test.js` while retaining dynamic requirement batching and error forwarding.
- Re-home tests from `remediation-fixes.test.js`:
  - Section 1 -> `lead_requirement_config.repository.test.js` and `lead_requirement_config.controller.test.js`.
  - Section 2 -> `quotation-email-template.controller.test.js`.
  - Section 3 -> `concept.repository.test.js` (`findByIds` with `$2 = ANY` SQL check).
  - Section 4 -> `pricing-rule.controller.test.js`.
  - Section 5 -> `tenant-profile.controller.test.js`.
- Delete `src/features/auto-proposal/__tests__/remediation-fixes.test.js`.

### 5. Architectural Standards (ADR-0005)
- Author `docs/adr/0005-testing-strategy-and-quality-standards.md` codifying:
  - Tier 1 testing requirements for business calculation engines and security boundaries.
  - Anti-pattern: Mock-echoing pass-through controller tests.
  - Co-located `__tests__/` directory organization.

## Testing Decisions

### Seams & Scope
- **Seam 1 (Domain Services & Calculation Engines)**: Test domain service and repository calculations directly via deterministic mock injection of SQL queries and external AI clients.
- **Seam 2 (HTTP Middleware & Utilities)**: Test pure functions and Express middleware directly with mock `(req, res, next)` contexts and input fixtures.

### Prior Art
- Unit tests in `src/features/auto-proposal/services/__tests__/lead.service.test.js` and `src/middleware/__tests__/auth.middleware.test.js`.

## Out of Scope

- Writing unit tests for deprecated legacy files (`pricing-engine.service.js`, `quotation.service.js`) marked per ADR-0004.
- Running live PostgreSQL or external GCS integration tests (pure in-memory unit tests only).
- Modifying production endpoint routes or database schemas.

## Further Notes

- Cross-references:
  - Domain Glossary: `CONTEXT.md`
  - ADRs: `docs/adr/0001-commonjs-typeorm-entity-schema.md`, `docs/adr/0002-header-based-multitenancy.md`, `docs/adr/0003-unified-feature-module-packaging.md`, `docs/adr/0004-proposal-draft-engine-consolidation.md`.
