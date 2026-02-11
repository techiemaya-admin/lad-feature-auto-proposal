const { v4: uuidv4 } = require('uuid');
const dataSource = require('../../../config/data-source');

function getRepository() {
  return dataSource.getRepository('ConceptLocation');
}

async function create(tenantId, conceptId, locationId, options = {}) {
  const repo = getRepository();
  const entity = repo.create({
    id: uuidv4(),
    tenant_id: tenantId,
    concept_id: conceptId,
    location_id: locationId,
    is_available: options.is_available !== false,
  });
  return repo.save(entity);
}

async function findByConceptAndLocation(tenantId, conceptId, locationId) {
  const repo = getRepository();
  return repo.findOne({
    where: {
      tenant_id: tenantId,
      concept_id: conceptId,
      location_id: locationId,
      is_deleted: false,
    },
  });
}

/** List concept IDs available at the given location. */
async function findConceptIdsByLocation(tenantId, locationId) {
  const repo = getRepository();
  const rows = await repo.find({
    where: { tenant_id: tenantId, location_id: locationId, is_available: true, is_deleted: false },
    select: ['concept_id'],
  });
  return rows.map((r) => r.concept_id);
}

/** List location IDs where the concept is available. */
async function findLocationIdsByConcept(tenantId, conceptId) {
  const repo = getRepository();
  const rows = await repo.find({
    where: { tenant_id: tenantId, concept_id: conceptId, is_available: true, is_deleted: false },
    select: ['location_id'],
  });
  return rows.map((r) => r.location_id);
}

module.exports = {
  create,
  findByConceptAndLocation,
  findConceptIdsByLocation,
  findLocationIdsByConcept,
};
