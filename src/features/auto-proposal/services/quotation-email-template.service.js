// services/quotationEmail.service.js
const repository = require('../repositories/quotation-email-template.repository');
const { clientError } = require('../../../utils/http-errors');

class QuotationEmailService {
  async createTemplate(tenantId, payload) {
    // Logic: Ensure subject line exists
    if (!payload.subject) throw clientError("Subject line is required", 400);
    return await repository.create({ ...payload, tenant_id: tenantId });
  }

  async getAllTemplates(tenantId) {
    return await repository.findAll(tenantId);
  }

  async getTemplate(id, tenantId) {
    const template = await repository.findById(id, tenantId);
    if (!template) throw clientError("Template not found", 404);
    return template;
  }

  async updateTemplate(id, tenantId, payload) {
    return await repository.update(id, tenantId, payload);
  }

  async deleteTemplate(id, tenantId) {
    return await repository.softDelete(id, tenantId);
  }

  async setDefault(tenantId, templateId) {
    return await repository.setAsDefault(tenantId, templateId);
  }

}

module.exports = new QuotationEmailService();