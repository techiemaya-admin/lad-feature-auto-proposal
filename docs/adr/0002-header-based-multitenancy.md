# Header-Based Multi-Tenancy Enforcement

All tenant-scoped API requests must supply tenant context via the `X-Tenant-Id` HTTP header. Every repository query must explicitly enforce tenant isolation with `WHERE tenant_id = $1` to guarantee complete data isolation between tenants at the application and query layers.

## Status: Superseded (security remediation)

Trusting a client-supplied `X-Tenant-Id` header let any caller act as any tenant. Tenant context now comes only from the verified JWT (`tenantId` claim, set by `authenticateJWT`). `X-Tenant-Id` is still accepted for compatibility but must equal the token's tenant; tenant IDs in URL paths are checked the same way (`enforceTenantParams`). Repository queries must continue to filter by `tenant_id`.
