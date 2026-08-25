const repo = require("../repositories/lead_requirement_config.repository");

exports.create = async (req, res) => {
  const payload = {
    ...req.body,
    tenant_id: req.tenantId || req.body.tenant_id,
  };
  const data = await repo.create(payload);
  res.json(data);
};

exports.get = async (req, res) => {
  const tenantId = req.tenantId || req.params.tenant_id;
  const data = await repo.findByTenant(tenantId);
  res.json(data);
};

exports.update = async (req, res) => {
  const payload = {
    ...req.body,
    tenant_id: req.tenantId || req.body.tenant_id,
  };
  const data = await repo.update(req.params.id, payload);
  res.json(data);
};

exports.delete = async (req, res) => {
  await repo.delete(req.params.id);
  res.json({ message: "Field disabled" });
};