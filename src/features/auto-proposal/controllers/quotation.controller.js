const quotationService = require('../services/quotation.service');
const { toQuotationResponse } = require('../dtos/quotation.dto');

async function generate(req, res, next) {
  try {
    const { lead_requirement_id, concept_id, quantity, quotation_template_metadata_id } = req.body;
    if (!lead_requirement_id || !concept_id) {
      return res.status(400).json({ error: 'lead_requirement_id and concept_id are required' });
    }
    const quotation = await quotationService.generateQuotation(req.tenantId, {
      lead_requirement_id,
      concept_id,
      quantity,
      quotation_template_metadata_id,
    });
    res.status(201).json(toQuotationResponse(quotation));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const quotation = await quotationService.getQuotationById(req.tenantId, req.params.id);
    res.json(toQuotationResponse(quotation));
  } catch (err) {
    next(err);
  }
}

async function listByLead(req, res, next) {
  try {
    const quotations = await quotationService.listQuotationsByLead(req.tenantId, req.params.leadId);
    res.json(quotations.map(toQuotationResponse));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generate,
  getById,
  listByLead,
};
