# Automated Testing Strategy, High-Value Quality Standards, and Anti-Pattern Prohibitions

We structure the automated test suite into high-confidence tiers focused on critical revenue logic, multi-tenant boundaries, and input validation while forbidding low-value mock-echoing tests:

1. **Testing Tiers & Priority**:
   - **Tier 1 (High-Value / Critical Paths)**: Calculation engines (`final-price-calculation.repository.js`), multi-tenant data isolation (`tenant_id` queries), authentication/JWT guards, and input schema validation middleware (`validateBody`). These must maintain exhaustive branch and boundary coverage.
   - **Tier 2 (Domain Services & Repositories)**: Business logic services (e.g. `concept.service.js`, `gmail-read-email.service.js`) and database query layers. Must test domain validation (400, 404, 409), fallback routing, and parameter binding.
   - **Tier 3 (Controllers & Transports)**: HTTP route handlers with non-trivial transformations, batch handling, and error middleware forwarding (`next(err)`).

2. **Prohibition of Mock-Echoing Tests**:
   - Pure pass-through controller endpoints that contain no branching, no transformation, and merely echo a mocked repository return into `res.json` are prohibited. Tests must assert actual business rules, error handling, or validation logic rather than testing Jest's mock mechanism.

3. **Co-located Domain Test Organization**:
   - Generic grab-bag regression files (such as `remediation-fixes.test.js`) are forbidden. All unit tests must be co-located within domain-specific `__tests__/` subdirectories adjacent to their target units (e.g., `repositories/__tests__/`, `controllers/__tests__/`, `services/__tests__/`, `middleware/__tests__/`, `utils/__tests__/`).
