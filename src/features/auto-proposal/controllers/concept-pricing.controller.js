const matrixService = require('../services/concept-pricing.service');

async function create(req, res, next) {
  try {
    const tenantId = req.tenantId || req.body.tenant_id;
    const entry = await matrixService.addPricingEntry(tenantId, req.body);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

async function listByConcept(req, res, next) {
  try {
    const entries = await matrixService.getPricingByConcept(req.tenantId, req.params.conceptId);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await matrixService.updatePricingEntry(req.tenantId, req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteEntry(req, res, next) {
  try {
    await matrixService.removePricingEntry(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const tenantId = req.tenantId || req.params.tenant_id;
    console.log('Fetching all pricing entries for tenant:', tenantId);
    const entries = await matrixService.getAllPricingEntries(tenantId);
    console.log('All pricing entries:', entries);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listByConcept, update, deleteEntry, listAll };