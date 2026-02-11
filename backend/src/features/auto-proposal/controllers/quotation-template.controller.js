const quotationTemplateService = require('../../../../../src/features/quotation-template/services/quotation-template.service');
const { createQuotationTemplateDto, toQuotationTemplateResponse } = require('../dtos/quotation-template.dto');

async function create(req, res, next) {
  try {
    const dto = createQuotationTemplateDto(req.body);
    const template = await quotationTemplateService.createTemplate(req.tenantId, dto);
    res.status(201).json(toQuotationTemplateResponse(template));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const template = await quotationTemplateService.getTemplateById(req.tenantId, req.params.id);
    res.json(toQuotationTemplateResponse(template));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const templates = await quotationTemplateService.listTemplates(req.tenantId, limit, offset);
    res.json(templates.map(toQuotationTemplateResponse));
  } catch (err) {
    next(err);
  }
}

async function setDefault(req, res, next) {
  try {
    const template = await quotationTemplateService.setDefault(req.tenantId, req.params.id);
    res.json(toQuotationTemplateResponse(template));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  list,
  setDefault,
};
