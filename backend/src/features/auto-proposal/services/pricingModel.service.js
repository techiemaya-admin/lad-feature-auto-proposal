const repo = require('../repositories/pricingModel.repository');

exports.create = (data) => repo.create(data);
exports.getById = (id, tenant_id) => repo.findById(id, tenant_id);
exports.update = (id, data) => repo.update(id, data);
exports.remove = (id, tenant_id) => repo.delete(id, tenant_id);

exports.getAll = async (tenantId) => {
  const types = await repo.findAll(tenantId);

  // Fallback: If no custom models are defined for the tenant, return defaults [cite: 53, 153]
  if (types.length === 0) {
    return [
      { value: 'per_person', label: 'Per Person (Event)' },
      { value: 'per_day', label: 'Per Day (Hall)' },
      { value: 'fixed', label: 'Fixed Price (Package)' }
    ];
  }

  return types;
}