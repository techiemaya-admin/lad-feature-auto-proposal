const repo = require('../repositories/pricingModel.repository');

exports.create = (data) => repo.create(data);
exports.getAll = (tenant_id) => repo.findAll(tenant_id);
exports.getById = (id, tenant_id) => repo.findById(id, tenant_id);
exports.update = (id, data) => repo.update(id, data);
exports.remove = (id, tenant_id) => repo.delete(id, tenant_id);