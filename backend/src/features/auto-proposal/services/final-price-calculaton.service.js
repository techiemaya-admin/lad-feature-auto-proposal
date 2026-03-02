const finalPriceCalculationRepository = require('../repositories/final-price-calculation.repository');

async function calculateFinalPrice(tenantId,
  locationName,
  mainEventGuestCount=0,
  cateringGuestCount=0,
    functionHallGuestCount=0) {
  console.log("Calculating price with details in service :", { tenantId, locationName, mainEventGuestCount, cateringGuestCount, functionHallGuestCount});
  return finalPriceCalculationRepository.calculateFinalPrice(tenantId, locationName, mainEventGuestCount, cateringGuestCount, functionHallGuestCount);
}

module.exports = {
  calculateFinalPrice
};