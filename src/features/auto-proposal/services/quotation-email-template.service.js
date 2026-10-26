// services/quotationEmail.service.js
const repository = require('../repositories/quotation-email-template.repository');

class QuotationEmailService {
  async createTemplate(tenantId, payload) {
    // Logic: Ensure subject line exists
    if (!payload.subject) throw new Error("Subject line is required");
    return await repository.create({ ...payload, tenant_id: tenantId });
  }

  async getAllTemplates(tenantId) {
    return await repository.findAll(tenantId);
  }

  async getTemplate(id, tenantId) {
    const template = await repository.findById(id, tenantId);
    if (!template) throw new Error("Template not found");
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