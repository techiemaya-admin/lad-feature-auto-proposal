const repo = require('../repositories/pricingRule.repository');

exports.create = async (req, res) => {
  console.log('Received request to create pricing rule with body:', req.body);
  const payload = {
    ...req.body,
    tenant_id: req.tenantId || req.body.tenant_id,
  };
  const data = await repo.create(payload);
  res.json(data);
};

exports.getAll = async (req, res) => {
  const tenantId = req.tenantId || req.params.tenant_id;
  const data = await repo.findAll(tenantId);
  res.json(data);
};

exports.getById = async (req, res) => {
  const tenantId = req.tenantId || req.query.tenant_id;
  const data = await repo.findById(req.params.id, tenantId);
  res.json(data);
};

exports.update = async (req, res) => {
  console.log('Received request to update pricing rule with ID:', req.params.id, 'and body:', req.body);
  const tenantId = req.tenantId || req.body.tenant_id;
  const data = await repo.update(req.params.id, req.body, tenantId);
  res.json(data);
};

exports.delete = async (req, res) => {
  console.log('Deleting pricing rule with ID:', req.params.id);
  const tenantId = req.tenantId || req.query?.tenant_id;
  await repo.delete(req.params.id, tenantId);
  res.json({ message: 'Deleted successfully' });
};