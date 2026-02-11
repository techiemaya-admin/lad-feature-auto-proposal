const tenantRepository = require('../../backend/src/features/auto-proposal/repositories/tenant.repository');

/**
 * Resolves tenant from X-Tenant-Id header and sets req.tenantId.
 * Responds 400 if header missing, 404 if tenant not found.
 */
async function tenantContext(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-Id header is required' });
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
