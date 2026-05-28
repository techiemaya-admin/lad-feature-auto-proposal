const service = require('../services/pricingRule.service');

exports.create = async (req, res) => {
  console.log('Received request to create pricing rule with body:', req.body);
  const data = await service.create(req.body);
  res.json(data);
};

exports.getAll = async (req, res) => {
  const data = await service.getAll(req.params.tenant_id);
  res.json(data);
};

exports.getById = async (req, res) => {
  const data = await service.getById(req.params.id, req.query.tenant_id);
  res.json(data);
};

exports.update = async (req, res) => {
  console.log('Received request to update pricing rule with ID:', req.params.id, 'and body:', req.body);
  const data = await service.update(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  console.log('Deleting pricing rule with ID:', req.params.id);
  await service.remove(req.params.id);
  res.json({ message: 'Deleted successfully' });
};