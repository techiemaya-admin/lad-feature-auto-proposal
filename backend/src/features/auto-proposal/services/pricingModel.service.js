const repo = require('../repositories/pricingModel.repository');

exports.create = (data) => repo.create(data);
exports.getById = (id, tenant_id) => repo.findById(id, tenant_id);
exports.update = (id, data) => repo.update(id, data);
exports.remove = (id, tenant_id) => repo.delete(id, tenant_id);

exports.getAll = async (tenantId) => {
  const types = await repo.findAll(tenantId);
  return types;
}