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
            const tenantId = req.params.tenantId
            const id = req.params.id
            console.log("make quotations default : " + tenantId + " id : " + id)
            const result = await service.setDefault(tenantId, id);
            res.status(200).json({ message: "Default template updated", data: result });
        } catch (error) {
            console.error("Error in setting default quotation : ", error)
            res.status(500).json({ error: error.message });
        }
    }

    // API 4: Delete Template
    async remove(req, res) {
        try {
            await service.deleteTemplate(req.params.id);
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


    async getTemplatesViaAuth(req, res) {
        try {
            console.log("Fetching templates for tenant via auth : " + req.tenantId)
            const templates = await service.getTemplatesByTenant(req.tenantId);
            const contactId = req.params.contactId;
            const templatesMap = templates.map(t => ({
                id: t.id,
                name: t.name,
                subject: t.subject,
                body: t.body || '',
                body_html: t.body_html,
                category: t.category || 'General',
                is_active: t.is_active,
                created_at: t.created_at.toISOString(),
                attachments: t.attachments || []
            }));
            console.log("Templates fetched: ", templatesMap);
            res.status(200).json({ data: templatesMap });
        } catch (error) {
            console.error("Error fetching templates:", error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new QuotationTemplateController();