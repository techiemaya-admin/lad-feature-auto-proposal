const repo = require('../repositories/pricingModel.repository');

exports.create = async (req, res) => {
  const payload = {
    ...req.body,
    tenant_id: req.tenantId || req.body.tenant_id,
  };
  const data = await repo.create(payload);
  res.json(data);
};

exports.getAll = async (req, res) => {
  const tenantId = req.tenantId || req.params.tenant_id;
  console.log('Fetching pricing models for tenant:', tenantId);
  const data = await repo.findAll(tenantId);
  res.json(data);
};

exports.getById = async (req, res) => {
  const tenantId = req.tenantId || req.query.tenant_id;
  const data = await repo.findById(req.params.id, tenantId);
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
  const tenantId = req.tenantId || req.query.tenant_id;
  await repo.delete(req.params.id, tenantId);
  res.json({ message: 'Deleted successfully' });
};