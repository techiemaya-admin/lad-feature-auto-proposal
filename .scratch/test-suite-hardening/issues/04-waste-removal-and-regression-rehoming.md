# Status: ready-for-agent

# Waste Test Removal & Regression Suite Re-homing

## Description
Clean up low-value mock-echoing controller tests, relocate regression tests into domain-specific suites, and delete the generic grab-bag regression file:

1. `src/features/auto-proposal/controllers/__tests__/lead_requirement_values.controller.test.js`:
   - Remove trivial mock-echoing tests (`get`, `update`, `delete` pass-throughs).
   - Retain `create` batch dynamic requirements test and error forwarding.
2. Create `src/features/auto-proposal/repositories/__tests__/lead_requirement_config.repository.test.js` (re-homed from remediation-fixes: `findIdByFieldKey` and tenant-scoped `delete`).
3. Create `src/features/auto-proposal/controllers/__tests__/lead_requirement_config.controller.test.js` (re-homed: delete passing tenantId).
4. Create `src/features/auto-proposal/controllers/__tests__/tenant-profile.controller.test.js` (re-homed: both `fieldName`/`fieldValue` and `field`/`value` payload formats).
5. Update `src/features/auto-proposal/repositories/__tests__/concept.repository.test.js` (re-homed: `findByIds` with `$2 = ANY` check).
6. Delete `src/features/auto-proposal/__tests__/remediation-fixes.test.js`.
