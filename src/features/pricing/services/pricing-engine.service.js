const conceptRepository = require('../../concept/repositories/concept.repository');
const conceptLocationRepository = require('../../concept/repositories/concept-location.repository');
const conceptPricingMatrixRepository = require('../../concept/repositories/concept-pricing-matrix.repository');
const pricingRulesRepository = require('../repositories/pricing-rules.repository');
const priceCalculationRepository = require('../repositories/price-calculation.repository');
const locationRepository = require('../../location/repositories/location.repository');

async function calculatePrice(tenantId, options) {
  const { conceptId, locationId, quantity = 1, leadRequirementId = null } = options;

  await conceptRepository.findById(tenantId, conceptId);
  const location = locationId ? await locationRepository.findById(tenantId, locationId) : null;
  if (locationId && !location) {
    const err = new Error('Location not found');
    err.statusCode = 404;
    throw err;
  }

  const availableAtLocation = locationId
    ? await conceptLocationRepository.findConceptIdsByLocation(tenantId, locationId)
    : [];
  if (locationId && !availableAtLocation.includes(conceptId)) {
    const err = new Error('Concept is not available at this location');
    err.statusCode = 400;
    throw err;
  }

  const pricingRow = await conceptPricingMatrixRepository.findOneByConcept(tenantId, conceptId);
  if (!pricingRow) {
    const err = new Error('No pricing defined for this concept');
    err.statusCode = 400;
    throw err;
  }

  const basePrice = Number(pricingRow.base_price);
  const minQuantity = Number(pricingRow.min_quantity) || 1;
  const locationMultiplier = pricingRow.location_multiplier != null ? Number(pricingRow.location_multiplier) : 1;
  const effectiveQuantity = Math.max(quantity, minQuantity);
  let runningPrice = basePrice * effectiveQuantity * locationMultiplier;

  const rules = await pricingRulesRepository.findActiveByTenant(tenantId);
  const rulesApplied = [];

  for (const rule of rules) {
    const params = rule.parameters || {};
    const before = runningPrice;
    switch (rule.rule_type) {
      case 'multiplier':
        runningPrice *= Number(params.factor ?? 1);
        break;
      case 'minimum':
        runningPrice = Math.max(runningPrice, Number(params.min_amount ?? 0));
        break;
      case 'surcharge':
        runningPrice += Number(params.amount ?? 0);
        break;
      case 'percentage_discount':
        runningPrice *= 1 - Number(params.percent ?? 0) / 100;
        break;
      default:
        break;
    }
    if (before !== runningPrice) {
      rulesApplied.push({ rule_id: rule.id, rule_name: rule.name, before, after: runningPrice });
    }
  }

  const finalPrice = Math.round(runningPrice * 100) / 100;
  const calculationInput = {
    concept_id: conceptId,
    location_id: locationId,
    quantity: effectiveQuantity,
    base_price: basePrice,
    min_quantity: minQuantity,
    location_multiplier: locationMultiplier,
  };

  const persisted = await priceCalculationRepository.create(tenantId, {
    lead_requirement_id: leadRequirementId,
    concept_id: conceptId,
    location_id: locationId,
    base_price: basePrice,
    final_price: finalPrice,
    currency: 'USD',
    calculation_input: calculationInput,
    rules_applied: rulesApplied,
  });

  return {
    price_calculation_id: persisted.id,
    base_price: basePrice,
    final_price: finalPrice,
    currency: 'USD',
    calculation_input: calculationInput,
    rules_applied: rulesApplied,
  };
}

module.exports = {
  calculatePrice,
};
