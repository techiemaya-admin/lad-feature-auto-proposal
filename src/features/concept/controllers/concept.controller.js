const conceptService = require('../services/concept.service');
const { createConceptDto, toConceptResponse } = require('../dtos/concept.dto');

async function create(req, res, next) {
  try {
    const dto = createConceptDto(req.body);
    const concept = await conceptService.createConcept(req.tenantId, dto);
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
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const locationId = req.query.location_id;
    let concepts;
    if (locationId) {
      concepts = await conceptService.listConceptsByLocation(req.tenantId, locationId);
    } else {
      concepts = await conceptService.listConcepts(req.tenantId, limit, offset);
    }
    res.json(concepts.map(toConceptResponse));
  } catch (err) {
    next(err);
  }
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

module.exports = {
  create,
  getById,
  list,
  linkLocation,
  addPricing,
};
