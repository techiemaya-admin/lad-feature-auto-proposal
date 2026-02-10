const tenantRepository = require('../repositories/tenant.repository');

async function createTenant(tenantData) {
  if (!tenantData.name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  if (tenantData.slug) {
    const existing = await tenantRepository.findBySlug(tenantData.slug);
    if (existing) {
      const err = new Error('slug already in use');
      err.statusCode = 409;
      throw err;
    }
  }
  return tenantRepository.create(tenantData);
}

async function getTenantById(id) {
  const tenant = await tenantRepository.findById(id);
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.statusCode = 404;
    throw err;
  }
  return tenant;
}

async function listTenants(limit, offset) {
  return tenantRepository.findAll(limit, offset);
}

module.exports = {
  createTenant,
  getTenantById,
  listTenants,
};
