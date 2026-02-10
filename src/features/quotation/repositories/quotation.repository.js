const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('Quotation');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    lead_requirement_id: data.lead_requirement_id,
    price_calculation_id: data.price_calculation_id,
    quotation_template_metadata_id: data.quotation_template_metadata_id || null,
    status: data.status || 'draft',
    quotation_number: data.quotation_number,
    body: data.body || {},
  });
  return repo.save(entity);
}

async function findById(tenantId, id) {
  const repo = getRepository();
  return repo.findOne({ where: { id, tenant_id: tenantId, is_deleted: false } });
}

async function findByLeadRequirement(tenantId, leadRequirementId) {
  const repo = getRepository();
  return repo.find({ where: { tenant_id: tenantId, lead_requirement_id: leadRequirementId, is_deleted: false }, order: { created_at: 'DESC' } });
}

module.exports = {
  create,
  findById,
  findByLeadRequirement,
};
