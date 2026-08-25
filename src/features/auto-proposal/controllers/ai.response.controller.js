const service = require('../services/ai-response.service');

class AiResponseController {

    async suggestConcepts(req, res) {
        try {
            if (!service.isConfigured) {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            const concepts = await service.suggestConcepts(req.params.tenantId);
            res.status(200).json(concepts);
        } catch (error) {
            console.error("Error fetching suggestconcepts:", error);
            if (error.statusCode === 503 || error.message === "AI service is not configured with valid API keys") {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            res.status(500).json({ error: error.message });
        }
    }

    async suggestPricingRules(req, res) {
        try {
            if (!service.isConfigured) {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            const pricingRules = await service.suggestPricingRules(req.params.tenantId);
            res.status(200).json(pricingRules);
        } catch (error) {
            console.error("Error fetching suggestPricingRules:", error);
            if (error.statusCode === 503 || error.message === "AI service is not configured with valid API keys") {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            res.status(500).json({ error: error.message });
        }
    }

    async suggestEmailTemplates(req, res) {
        try {
            if (!service.isConfigured) {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            const suggestFn = service.suggestEmailTemplates || service.suggestEmailTemplete;
            const emailTemplates = await suggestFn.call(service, req.params.tenantId);
            res.status(200).json(emailTemplates);
        } catch (error) {
            console.error("Error fetching suggestEmailTemplates :", error);
            if (error.statusCode === 503 || error.message === "AI service is not configured with valid API keys") {
                return res.status(503).json({ error: "AI service is not configured with valid API keys" });
            }
            res.status(500).json({ error: error.message });
        }
    }

}

module.exports = new AiResponseController();