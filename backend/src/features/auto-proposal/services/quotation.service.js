const leadRepository = require('../repositories/lead.repository');
const quotationRepository = require('../repositories/quotation.repository');
const quotationTemplateMetadataRepository = require('../repositories/quotation-template-metadata.repository');
const pricingEngineService = require('../services/pricing-engine.service');

async function generateQuotation(tenantId, options) {
  const { lead_requirement_id, concept_id, quantity = 1, quotation_template_metadata_id: templateId } = options;

  const lead = await leadRepository.findById(tenantId, lead_requirement_id);
  if (!lead) {
    const err = new Error('Lead requirement not found');
    err.statusCode = 404;
    throw err;
  }

  const priceResult = await pricingEngineService.calculatePrice(tenantId, {
    conceptId: concept_id,
    locationId: lead.location_id,
    quantity,
    leadRequirementId: lead_requirement_id,
  });

  let quotationTemplateMetadataId = templateId;
  if (!quotationTemplateMetadataId) {
    const defaultTemplate = await quotationTemplateMetadataRepository.findDefault(tenantId);
    quotationTemplateMetadataId = defaultTemplate ? defaultTemplate.id : null;
  } else {
    const template = await quotationTemplateMetadataRepository.findById(tenantId, templateId);
    if (!template) {
      const err = new Error('Quotation template not found');
      err.statusCode = 404;
      throw err;
    }
  }

  const quotationNumber = `QT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const body = {
    price: priceResult,
    template_applied: !!quotationTemplateMetadataId,
  };

  const quotation = await quotationRepository.create(tenantId, {
    lead_requirement_id,
    price_calculation_id: priceResult.price_calculation_id,
    quotation_template_metadata_id: quotationTemplateMetadataId,
    status: 'draft',
    quotation_number: quotationNumber,
    body,
  });

  return quotation;
}

async function getQuotationById(tenantId, id) {
  const quotation = await quotationRepository.findById(tenantId, id);
  if (!quotation) {
    const err = new Error('Quotation not found');
    err.statusCode = 404;
    throw err;
  }
  return quotation;
}

async function listQuotationsByLead(tenantId, leadRequirementId) {
  await leadRepository.findById(tenantId, leadRequirementId);
  return quotationRepository.findByLeadRequirement(tenantId, leadRequirementId);
}

module.exports = {
  generateQuotation,
  getQuotationById,
  listQuotationsByLead,
};
