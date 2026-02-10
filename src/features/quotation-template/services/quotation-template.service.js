const quotationTemplateMetadataRepository = require('../../../repositories/quotation-template-metadata.repository');

async function createTemplate(tenantId, data) {
  if (!data.name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  return quotationTemplateMetadataRepository.create(tenantId, data);
}

async function getTemplateById(tenantId, id) {
  const template = await quotationTemplateMetadataRepository.findById(tenantId, id);
  if (!template) {
    const err = new Error('Quotation template not found');
    err.statusCode = 404;
    throw err;
  }
  return template;
}

async function listTemplates(tenantId, limit, offset) {
  return quotationTemplateMetadataRepository.findAll(tenantId, limit, offset);
}

async function setDefault(tenantId, id) {
  await getTemplateById(tenantId, id);
  return quotationTemplateMetadataRepository.setDefault(tenantId, id);
}

module.exports = {
  createTemplate,
  getTemplateById,
  listTemplates,
  setDefault,
};
