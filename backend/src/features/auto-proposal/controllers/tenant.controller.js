const tenantService = require('../services/tenant.service');
const { createTenantDto, toTenantResponse } = require('../dtos/tenant.dto');
const logger = require('../../../utils/logger');

async function create(req, res, next) {
  try {
    const dto = createTenantDto(req.body);
    const tenant = await tenantService.createTenant(dto);
    res.status(201).json(toTenantResponse(tenant));
  } catch (err) {
    logger.error('Error creating tenant:', err);
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    res.json(toTenantResponse(tenant));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const tenants = await tenantService.listTenants(limit, offset);
    res.json(tenants.map(toTenantResponse));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  list,
};
