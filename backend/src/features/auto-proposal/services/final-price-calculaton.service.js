const finalPriceCalculationRepository = require('../repositories/final-price-calculation.repository');

async function calculateFinalPrice(tenantId,
  locationName,
  id,event_type) {
  console.log("Calculating price with details in service :", { tenantId, locationName, id, event_type });
  return finalPriceCalculationRepository.calculateFinalPrice(tenantId, locationName, id, event_type);
}

module.exports = {
  calculateFinalPrice
};