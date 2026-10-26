# Header-Based Multi-Tenancy Enforcement

All tenant-scoped API requests must supply tenant context via the `X-Tenant-Id` HTTP header. Every repository query must explicitly enforce tenant isolation with `WHERE tenant_id = $1` to guarantee complete data isolation between tenants at the application and query layers.
