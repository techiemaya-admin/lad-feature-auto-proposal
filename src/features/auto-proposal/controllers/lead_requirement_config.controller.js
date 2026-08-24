const repo = require("../repositories/lead_requirement_config.repository");

exports.create = async (req, res) => {
  const data = await repo.create(req.body);
  res.json(data);
};

exports.get = async (req, res) => {
  const data = await repo.findByTenant(req.params.tenant_id);
  res.json(data);
};

exports.update = async (req, res) => {
  const data = await repo.update(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  await repo.delete(req.params.id);
  res.json({ message: "Field disabled" });
};