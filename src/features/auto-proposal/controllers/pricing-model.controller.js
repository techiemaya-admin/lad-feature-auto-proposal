const repo = require('../repositories/pricingModel.repository');
const logger = require('../../../utils/logger');

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

exports.getAll = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.params.tenant_id;
    logger.debug('Fetching pricing models for tenant:', tenantId);
    const data = await repo.findAll(tenantId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.query.tenant_id;
    const data = await repo.findById(req.params.id, tenantId);
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
    const tenantId = req.tenantId || req.query.tenant_id;
    await repo.delete(req.params.id, tenantId);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
};