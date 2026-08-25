# Proposal Draft Pipeline Consolidation and Legacy Engine Deprecation

We standardize all dynamic pricing calculation, itemization, and document generation on the `Proposal Draft` pipeline (`proposal-draft.service.js`, `final-price-calculation.repository.js`, `pricing_rules`). Legacy files (`quotation.service.js`, `pricing-engine.service.js`) are retained with explicit deprecation annotations for reference but are bypassed by all active HTTP routes and AI workflows.
