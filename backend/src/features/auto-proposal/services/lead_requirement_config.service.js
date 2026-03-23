const repo = require("../repositories/config.repository");

exports.createField = async (data) => repo.create(data);
exports.getFields = async (tenant_id) => repo.findByTenant(tenant_id);
exports.updateField = async (id, data) => repo.update(id, data);
exports.deleteField = async (id) => repo.deactivate(id);