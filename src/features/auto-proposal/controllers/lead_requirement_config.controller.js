const repo = require("../repositories/lead_requirement_config.repository");

exports.create = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      tenant_id: req.tenantId || req.body.tenant_id,
    };
    const data = await repo.create(payload);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.params.tenant_id;
    const data = await repo.findByTenant(tenantId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      tenant_id: req.tenantId || req.body.tenant_id,
    };
    const data = await repo.update(req.params.id, payload);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.params.tenantId || req.params.tenant_id || req.query.tenant_id || req.body?.tenant_id;
    await repo.delete(req.params.id, tenantId);
    res.json({ message: "Field disabled" });
  } catch (err) {
    next(err);
  }
};