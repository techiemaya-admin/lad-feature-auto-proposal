const leadRequirementValuesRepo = require("../repositories/lead_requirement_values.repository");

exports.create = async (req, res, next) => {
  try {
    const { lead_requirement_id, dynamic_requirements, field_id, value_text, value_number, value_json } = req.body;
    if (dynamic_requirements) {
      const results = await leadRequirementValuesRepo.saveRequirementValues(req.tenantId, lead_requirement_id, dynamic_requirements);
      return res.status(200).json({ message: "Saved", data: results });
    }
    const data = await leadRequirementValuesRepo.create({
      lead_requirement_id,
      field_id,
      value_text,
      value_number,
      value_json
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const data = await leadRequirementValuesRepo.findByRequirementId(req.params.id);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = await leadRequirementValuesRepo.update(req.params.id, req.body);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const data = await leadRequirementValuesRepo.delete(req.params.id);
    res.status(200).json({ message: "Deleted", data });
  } catch (err) {
    next(err);
  }
};