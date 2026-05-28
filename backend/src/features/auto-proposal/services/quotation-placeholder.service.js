const quotationPlaceholderRepository = require('../repositories/quotation-placeholder.repository');

class QuotationPlaceholderService {
    async listByTenant(tenantId) {
        if (!tenantId) throw new Error('tenantId is required');
        const rows = await quotationPlaceholderRepository.findByTenant(tenantId);
        return rows;
    }
}

module.exports = new QuotationPlaceholderService();
