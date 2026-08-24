const { list } = require('pdfkit');
const matrixService = require('../services/concept-pricing.service');

async function create(req, res, next) {
    try {
        const entry = await matrixService.addPricingEntry(req.body.tenant_id, req.body);
        res.status(201).json(entry);
    } catch (err) { next(err); }
}

async function listByConcept(req, res, next) {
    try {
        const entries = await matrixService.getPricingByConcept(req.tenantId, req.params.conceptId);
        res.json(entries);
    } catch (err) { next(err); }
}

async function update(req, res, next) {
    try {
        const updated = await matrixService.updatePricingEntry(req.tenantId, req.params.id, req.body);
        res.json(updated);
    } catch (err) { next(err); }
}

async function deleteEntry(req, res, next) {
    try {
        await matrixService.removePricingEntry(req.tenantId, req.params.id);
        res.status(204).send();
    } catch (err) { next(err); }
}

async function listAll(req, res, next) {
    try {
        console.log('Fetching all pricing entries for tenant:', req.params.tenant_id);
        const entries = await matrixService.getAllPricingEntries(req.params.tenant_id);
        console.log('All pricing entries:', entries);
        res.json(entries);
    } catch (err) { next(err); }
}
module.exports = { create, listByConcept, update, deleteEntry, listAll };