const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('ConceptPricingMatrix');
}

async function create(tenantId, conceptId, data) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    concept_id: conceptId,
    base_price: data.base_price,
    min_quantity: data.min_quantity ?? null,
    unit: data.unit || null,
    location_multiplier: data.location_multiplier ?? null,
  });
  return repo.save(entity);
}

async function findOneByConcept(tenantId, conceptId) {
  const repo = getRepository();
  return repo.findOne({ where: { tenant_id: tenantId, concept_id: conceptId, is_deleted: false } });
}

module.exports = {
  create,
  findOneByConcept,
};
