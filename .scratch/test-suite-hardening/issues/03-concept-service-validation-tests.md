# Status: ready-for-agent

# Concept Service Complete Business Validation Tests

## Description
Expand `src/features/auto-proposal/services/__tests__/concept.service.test.js` from 1 method to cover all 8 methods and boundary error handling:

1. `createConcept`: Throws 400 when `name` is missing; delegates to repository when valid.
2. `getConceptById`: Throws 404 when concept is not found; returns entity when found.
3. `listConcepts`: Delegates to `conceptRepository.findAllWithRequirements`.
4. `listConceptsByLocation`: Returns empty array if no concept IDs mapped to location; delegates to `conceptRepository.findByIds`.
5. `linkConceptToLocation`: Validates concept & location existence; throws 409 Conflict if link already exists; creates link when valid.
6. `addPricing`: Throws 400 when `base_price` is missing; calls repository when valid.
7. `updateConcept`: Validates concept existence with 404 check before updating.
8. `deleteConcept`: Calls repository `softDelete`.
