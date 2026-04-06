const service = require('../services/pricingModel.service');

exports.create = async (req, res) => {
  const data = await service.create(req.body);
  res.json(data);
};

exports.getAll = async (req, res) => {
  const data = await service.getAll(req.query.tenant_id);
  res.json(data);
};

exports.getById = async (req, res) => {
  const data = await service.getById(req.params.id, req.query.tenant_id);
  res.json(data);
};

exports.update = async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  await service.remove(req.params.id, req.query.tenant_id);
  res.json({ message: 'Deleted successfully' });
};