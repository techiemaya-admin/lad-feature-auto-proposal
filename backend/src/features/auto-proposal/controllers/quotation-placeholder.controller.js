const QuotationPlaceholderService = require('../services/quotation-placeholder.service');

class QuotationPlaceholderController {
    async getPlaceholders(req, res) {
        try {
            const tenantId = req.query.tenant_id || req.headers['x-tenant-id'];
            const data = await QuotationPlaceholderService.listByTenant(tenantId);
            res.json({ success: true, data: data, total: Array.isArray(data) ? data.length : 0 });
        } catch (error) {
            console.log("Error fetching placeholders for tenant:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new QuotationPlaceholderController();
