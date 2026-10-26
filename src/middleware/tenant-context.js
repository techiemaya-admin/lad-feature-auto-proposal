const tenantRepository = require('../features/auto-proposal/repositories/tenant.repository');

/**
 * Resolves tenant from the verified JWT (req.tenantId, set by authenticateJWT) and confirms it exists.
 * Must run after authenticateJWT. The X-Tenant-Id header is never trusted on its own:
 * if a client still sends it, it must match the token's tenant.
 * Responds 401 if unauthenticated, 403 on header mismatch, 404 if tenant not found.
 */
async function tenantContext(req, res, next) {
  const tenantId = req.isAuthenticated ? req.tenantId : null;
  if (!tenantId) {
    return res.status(401).json({ error: 'Authentication required' });
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

/**
 * router.param handler for :tenantId / :tenant_id path segments.
 * Rejects requests whose path tenant differs from the authenticated tenant.
 */
function matchTenantParam(req, res, next, value) {
  if (!req.isAuthenticated || !req.tenantId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (value !== req.tenantId) {
    return res.status(403).json({ error: 'Tenant in path does not match authenticated tenant' });
  }
  next();
}

/** Registers matchTenantParam for both tenant path param spellings on a router. */
function enforceTenantParams(router) {
  router.param('tenantId', matchTenantParam);
  router.param('tenant_id', matchTenantParam);
  return router;
}

module.exports = { tenantContext, matchTenantParam, enforceTenantParams };
