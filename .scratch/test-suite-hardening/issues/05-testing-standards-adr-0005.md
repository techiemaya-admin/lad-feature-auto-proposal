# Status: ready-for-agent

# Document Testing Strategy & Standards (ADR-0005)

## Description
Document the testing strategy and architectural boundaries in `docs/adr/0005-testing-strategy-and-quality-standards.md`:

- Define Tier 1 testing requirements for business calculation engines (dynamic pricing), security/tenant middleware, and domain models.
- Document anti-patterns: prohibition of mock-echoing pass-through controller tests that only verify Jest mocks.
- Establish co-located `__tests__/` directory organization standard across features, services, repositories, and middleware.
