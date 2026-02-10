const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('PriceCalculation');
}

async function create(tenantId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    lead_requirement_id: data.lead_requirement_id || null,
    concept_id: data.concept_id,
    location_id: data.location_id || null,
    base_price: data.base_price,
    final_price: data.final_price,
    currency: data.currency || 'USD',
    calculation_input: data.calculation_input || {},
    rules_applied: data.rules_applied || [],
  });
  return repo.save(entity);
}

module.exports = {
  create,
};
