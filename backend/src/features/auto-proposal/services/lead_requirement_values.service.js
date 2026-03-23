const repo = require("../repositories/values.repository");

exports.createValues = async (lead_requirement_id, values) => {
  await repo.bulkInsert(lead_requirement_id, values);
};

exports.getValues = async (id) => repo.findByLeadRequirement(id);
exports.updateValue = async (id, data) => repo.update(id, data);
exports.deleteValue = async (id) => repo.delete(id);