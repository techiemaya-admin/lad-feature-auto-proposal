const finalPriceCalculationRepository = require('../repositories/final-price-calculation.repository');

async function calculateFinalPrice(tenantId,
  id, email_content) {
  console.log("Calculating price with details in service :", { tenantId, id, email_content });
  return finalPriceCalculationRepository.generateFinalPrice(tenantId, id, email_content);
}

module.exports = {
  calculateFinalPrice
};