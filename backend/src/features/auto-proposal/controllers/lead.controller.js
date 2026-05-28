const leadService = require('../services/lead.service');
const { createLeadDto, toLeadResponse } = require('../dtos/lead.dto');

async function create(req, res, next) {
  try {
    const dto = createLeadDto(req.body);
    const lead = await leadService.createLead(req.tenantId, dto);
    res.status(201).json(toLeadResponse(lead));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.tenantId, req.params.id);
    res.json(toLeadResponse(lead));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const leads = await leadService.listLeads(req.tenantId, limit, offset);
    res.json(leads.map(toLeadResponse));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  list,
};
