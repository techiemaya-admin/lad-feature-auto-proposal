# 04: Non-Crashing AI Service Boot & Gemini Suggestions

**What to build:**
Resilient AI service initialization and structured Gemini suggestion capabilities for concepts, pricing rules, and email templates. The Express backend starts cleanly without fatal exceptions even when AI API keys are omitted. When invoked with a valid configuration, endpoints `/api/ai-response/suggest-*` produce structured JSON outputs tailored to the tenant's business profile and catalog rules.

**Blocked by:** 01: Authentication Signature Verification & Tenant Context Enforcement

**Status:** ready-for-agent

- [ ] `AIService` constructor soft-initializes: if `GEMINI_API_KEY` is not present, it logs a warning and marks the service unconfigured without throwing an exception or terminating the Node process.
- [ ] If AI suggestion endpoints are called when unconfigured, the system returns `503 Service Unavailable` with `{ "error": "AI service is not configured with valid API keys" }`.
- [ ] `suggestConcepts(tenantId)` generates structured JSON concept tiers `[{ name, description, estimated_base_price, suggested_deliverables }]` using the tenant's profile context.
- [ ] `suggestPricingRules(tenantId)` generates schema-compatible dynamic pricing rules `[{ name, condition_field, condition_operator, condition_value, action_type, action_mode, action_value, description }]` using active concepts and requirement configs.
- [ ] `suggestEmailTemplates(tenantId)` (and `suggestEmailTemplete`) generates HTML quotation email templates populated with token tags (`[lead_name]`, `[company_name]`, `[final_price]`).
- [ ] `ai.response.controller.js` maps all 3 suggestion methods correctly without throwing `TypeError`.
