const conceptRepository = require('../repositories/concept.repository');
const conceptLocationRepository = require('../repositories/concept-location.repository');
const conceptPricingMatrixRepository = require('../repositories/concept-pricing-matrix.repository');
const locationRepository = require('../repositories/location.repository');

async function createConcept(tenantId, data) {
  if (!data.name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  return conceptRepository.create(tenantId, data);
}

async function getConceptById(tenantId, id) {
  const concept = await conceptRepository.findById(tenantId, id);
  if (!concept) {
    const err = new Error('Concept not found');
    err.statusCode = 404;
    throw err;
  }
  return concept;
}

async function listConcepts(tenantId) {
  return conceptRepository.findAll(tenantId);
}

/** List concepts available at a given location (for lead flow). */
async function listConceptsByLocation(tenantId, locationId) {
  await locationRepository.findById(tenantId, locationId);
  const conceptIds = await conceptLocationRepository.findConceptIdsByLocation(tenantId, locationId);
  if (conceptIds.length === 0) return [];
  return conceptRepository.findByIds(tenantId, conceptIds);
}

async function linkConceptToLocation(tenantId, conceptId, locationId, options = {}) {
  await conceptRepository.findById(tenantId, conceptId);
  await locationRepository.findById(tenantId, locationId);
  const existing = await conceptLocationRepository.findByConceptAndLocation(tenantId, conceptId, locationId);
  if (existing) {
    const err = new Error('Concept already linked to this location');
    err.statusCode = 409;
    throw err;
  }
  return conceptLocationRepository.create(tenantId, conceptId, locationId, options);
}

async function addPricing(tenantId, conceptId, data) {
  if (data.base_price == null) {
    const err = new Error('base_price is required');
    err.statusCode = 400;
    throw err;
  }
  await conceptRepository.findById(tenantId, conceptId);
  return conceptPricingMatrixRepository.create(tenantId, conceptId, data);
}

// concept.service.js - Add these methods
async function updateConcept(tenantId, id, data) {
  console.log(`Updating concept ${id} for tenant ${tenantId} with data:`, data);
  const concept = await getConceptById(tenantId, id); // Reuse your existing check
  return conceptRepository.update(tenantId, id, data);
}

async function deleteConcept(id) {
  return conceptRepository.softDelete(id);
}

module.exports = {
  createConcept,
  getConceptById,
  listConcepts,
  listConceptsByLocation,
  linkConceptToLocation,
  addPricing,
  updateConcept,
  deleteConcept,
};
