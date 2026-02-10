const leadRepository = require('../../../repositories/lead.repository');
const locationRepository = require('../../../repositories/location.repository');

async function createLead(tenantId, data) {
  if (data.location_id) {
    const location = await locationRepository.findById(tenantId, data.location_id);
    if (!location) {
      const err = new Error('Location not found');
      err.statusCode = 404;
      throw err;
    }
  }
  return leadRepository.create(tenantId, data);
}

async function getLeadById(tenantId, id) {
  const lead = await leadRepository.findById(tenantId, id);
  if (!lead) {
    const err = new Error('Lead requirement not found');
    err.statusCode = 404;
    throw err;
  }
  return lead;
}

async function listLeads(tenantId, limit, offset) {
  return leadRepository.findAll(tenantId, limit, offset);
}

module.exports = {
  createLead,
  getLeadById,
  listLeads,
};
