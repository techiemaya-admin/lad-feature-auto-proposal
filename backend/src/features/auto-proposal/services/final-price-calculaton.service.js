const finalPriceCalculationRepository = require('../repositories/final-price-calculation.repository');

async function calculateFinalPrice(tenantId,
  locationName,
  id) {
  console.log("Calculating price with details in service :", { tenantId, locationName, id });
  return finalPriceCalculationRepository.calculateFinalPrice(tenantId, locationName, id);
}

module.exports = {
  calculateFinalPrice
};