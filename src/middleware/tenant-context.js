const tenantRepository = require('../features/tenant/repositories/tenant.repository');
const { isUuid } = require('./validate');

/**
 * Resolves tenant from the authenticated token (req.auth.tenantId) and sets req.tenantId.
 * Must run after authenticate. The client-supplied X-Tenant-Id header is never trusted:
 * if present, it must match the token's tenant or the request is rejected.
 * Responds 403 if the token carries no tenant or the header mismatches, 404 if tenant not found.
 */
async function tenantContext(req, res, next) {
  const tenantId = req.auth && req.auth.tenantId;
  if (!tenantId || !isUuid(tenantId)) {
    return res.status(403).json({ error: 'Token is not scoped to a tenant' });
  }
  const headerTenantId = req.headers['x-tenant-id'];
  if (headerTenantId && headerTenantId !== tenantId) {
    return res.status(403).json({ error: 'X-Tenant-Id does not match authenticated tenant' });
  }
  try {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    req.tenantId = tenantId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantContext };
