const matrixRepo = require('../repositories/concept-pricing-matrix.repository');

async function addPricingEntry(tenantId, data) {
    if (data.min_pax > data.max_pax) {
        throw new Error("Minimum pax cannot be greater than maximum pax");
    }
    return await matrixRepo.create(tenantId, data);
}

async function getPricingByConcept(tenantId, conceptId) {
    return await matrixRepo.findByConcept(tenantId, conceptId);
}

async function updatePricingEntry(tenantId, id, data) {
    return await matrixRepo.update(tenantId, id, data);
}

async function removePricingEntry(tenantId, id) {
    return await matrixRepo.softDelete(tenantId, id);
}

async function getAllPricingEntries(tenantId) {
    return await matrixRepo.getAllByTenant(tenantId);
}
module.exports = { addPricingEntry, getPricingByConcept, updatePricingEntry, removePricingEntry, getAllPricingEntries };