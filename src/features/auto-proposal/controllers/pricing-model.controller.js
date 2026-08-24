const repo = require('../repositories/pricingModel.repository');

exports.create = async (req, res) => {
  const data = await repo.create(req.body);
  res.json(data);
};

exports.getAll = async (req, res) => {
  console.log('Fetching pricing models for tenant:', req.params.tenant_id);
  const data = await repo.findAll(req.params.tenant_id);
  res.json(data);
};

exports.getById = async (req, res) => {
  const data = await repo.findById(req.params.id, req.query.tenant_id);
  res.json(data);
};

exports.update = async (req, res) => {
  const data = await repo.update(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  await repo.delete(req.params.id, req.query.tenant_id);
  res.json({ message: 'Deleted successfully' });
};