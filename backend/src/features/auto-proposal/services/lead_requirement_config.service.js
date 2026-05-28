const repo = require("../repositories/lead_requirement_config.repository");

exports.createField = async (data) => repo.create(data);
exports.getFields = async (tenant_id) => repo.findByTenant(tenant_id);
exports.getActiveFields = async (tenant_id) => repo.findByTenantAndActive(tenant_id);
exports.updateField = async (id, data) => repo.update(id, data);
exports.deleteField = async (id) => repo.delete(id);