const conceptService = require('../services/concept.service');
const { createConceptDto, toConceptResponse } = require('../dtos/concept.dto');

async function create(req, res, next) {
  try {
    console.log('Creating concept with data:', req.body);
    const dto = createConceptDto(req.body);
    console.log('DTO after validation:', dto);
    const concept = await conceptService.createConcept(req.body.tenant_id, dto);
    res.status(201).json(toConceptResponse(concept));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const concept = await conceptService.getConceptById(req.tenantId, req.params.id);
    res.json(toConceptResponse(concept));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  console.log('Listing concepts for tenant:', req.params.tenant_id);
  const data = await conceptService.listConcepts(req.params.tenant_id);
  res.json(data);
}

async function linkLocation(req, res, next) {
  try {
    const { conceptId, locationId } = req.params;
    const link = await conceptService.linkConceptToLocation(req.tenantId, conceptId, locationId, req.body);
    res.status(201).json({
      id: link.id,
      concept_id: link.concept_id,
      location_id: link.location_id,
      is_available: link.is_available,
    });
  } catch (err) {
    next(err);
  }
}

async function addPricing(req, res, next) {
  try {
    const { id: conceptId } = req.params;
    const pricing = await conceptService.addPricing(req.tenantId, conceptId, req.body);
    res.status(201).json({
      id: pricing.id,
      concept_id: pricing.concept_id,
      base_price: pricing.base_price,
      min_quantity: pricing.min_quantity,
      unit: pricing.unit,
      location_multiplier: pricing.location_multiplier,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const concept = await conceptService.updateConcept(req.tenantId, req.params.id, req.body);
    res.json(toConceptResponse(concept));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    console.log('Deleting concept with ID:', req.params.id);
    await conceptService.deleteConcept(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  create,
  getById,
  list,
  update,
  remove,
  linkLocation,
  addPricing,
};
