const service = require('../services/quotation-template.service');

class QuotationTemplateController {
    async uploadTemplate(req, res) {
        try {
            const { tenantId } = req.params;
            const result = await service.uploadAndSaveTemplate(tenantId, req.file, req.body);
            res.status(201).json(result);
        } catch (error) {
            console.error("Upload failed:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getPreview(req, res) {
        service.getVisualPreview(req, res);
    }

    // API 3: Set Default
    async makeDefault(req, res) {
        try {
            const result = await service.setDefault(req.body.tenant_id, req.params.id);
            res.status(200).json({ message: "Default template updated", data: result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // API 4: Delete Template
    async remove(req, res) {
        try {
            await service.deleteTemplate(req.query.tenant_id, req.params.id);
            res.status(200).json({ message: "Template deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getTemplates(req, res) {
        try {
            const templates = await service.getTemplatesByTenant(req.params.tenantId);
            res.status(200).json(templates);
        } catch (error) {
            console.error("Error fetching templates:", error);
            res.status(500).json({ error: error.message });
        }
    }


}

module.exports = new QuotationTemplateController();