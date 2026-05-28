const finalPriceCalculationRepository = require('../repositories/final-price-calculation.repository');

async function calculateFinalPrice(tenantId,
  id, email_content,
  event_type) {
  console.log("Calculating price with details in service :", { tenantId, id, email_content, event_type });
  return finalPriceCalculationRepository.generateFinalPrice(tenantId, id, email_content, event_type);
}

module.exports = {
  calculateFinalPrice
};