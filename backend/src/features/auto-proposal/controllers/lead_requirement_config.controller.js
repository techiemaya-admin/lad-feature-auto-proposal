const service = require("../services/config.service");

exports.create = async (req, res) => {
  const data = await service.createField(req.body);
  res.json(data);
};

exports.get = async (req, res) => {
  const data = await service.getFields(req.params.tenant_id);
  res.json(data);
};

exports.update = async (req, res) => {
  const data = await service.updateField(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  await service.deleteField(req.params.id);
  res.json({ message: "Field disabled" });
};