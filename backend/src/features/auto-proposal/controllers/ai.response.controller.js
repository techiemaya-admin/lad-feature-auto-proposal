const service = require('../services/ai-response.service');

class AiResponseController {

    async suggestConcepts(req, res) {
        try {
            const concepts = await service.suggestConcepts(req.params.tenantId);
            res.status(200).json(concepts);
        } catch (error) {
            console.error("Error fetching suggestconcepts:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async suggestPricingRules(req, res) {
        try {
            const pricingRules = await service.suggestPricingRules(req.params.tenantId);
            res.status(200).json(pricingRules);
        } catch (error) {
            console.error("Error fetching suggestPricingRules:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async suggestEmailTemplates(req, res) {
        try {
            const emailTemplates = await service.suggestEmailTemplete(req.params.tenantId);
            res.status(200).json(emailTemplates);
        } catch (error) {
            console.error("Error fetching suggestEmailTemplates :", error);
            res.status(500).json({ error: error.message });
        }
    }

}

module.exports = new AiResponseController();