const service = require("../services/values.service");

exports.create = async (req, res) => {
  await service.createValues(req.body.lead_requirement_id, req.body.values);
  res.json({ message: "Saved" });
};

exports.get = async (req, res) => {
  const data = await service.getValues(req.params.id);
  res.json(data);
};

exports.update = async (req, res) => {
  const data = await service.updateValue(req.params.id, req.body);
  res.json(data);
};

exports.delete = async (req, res) => {
  await service.deleteValue(req.params.id);
  res.json({ message: "Deleted" });
};