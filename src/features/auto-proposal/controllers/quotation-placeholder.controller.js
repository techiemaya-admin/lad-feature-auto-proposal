const quotationPlaceholderRepository = require('../repositories/quotation-placeholder.repository');

const { clientMessage } = require('../../../utils/http-errors');
const logger = require('../../../utils/logger');
class QuotationPlaceholderController {
    async getPlaceholders(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'tenantId is required' });
            const data = await quotationPlaceholderRepository.findByTenant(tenantId);
            res.json({ success: true, data: data, total: Array.isArray(data) ? data.length : 0 });
        } catch (error) {
            logger.debug("Error fetching placeholders for tenant:", error);
            res.status(500).json({ success: false, message: clientMessage(error) });
        }
    }
}

module.exports = new QuotationPlaceholderController();
