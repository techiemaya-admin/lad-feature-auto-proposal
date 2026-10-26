const leadRequirementValuesRepo = require("../repositories/lead_requirement_values.repository");

exports.create = async (req, res, next) => {
  try {
    const { lead_requirement_id, dynamic_requirements, field_id, value_text, value_number, value_json } = req.body;
    // The lead requirement (and the field, when given) must belong to the caller's tenant
    const owned = await leadRequirementValuesRepo.belongsToTenant(
      lead_requirement_id,
      req.tenantId,
      dynamic_requirements ? null : field_id
    );
    if (!owned) {
      return res.status(404).json({ error: "Lead requirement not found" });
    }
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
    const data = await leadRequirementValuesRepo.findByRequirementId(req.params.id, req.tenantId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = await leadRequirementValuesRepo.update(req.params.id, req.body, req.tenantId);
    if (!data) return res.status(404).json({ error: "Value not found" });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const data = await leadRequirementValuesRepo.delete(req.params.id, req.tenantId);
    if (!data) return res.status(404).json({ error: "Value not found" });
    res.status(200).json({ message: "Deleted", data });
  } catch (err) {
    next(err);
  }
};
