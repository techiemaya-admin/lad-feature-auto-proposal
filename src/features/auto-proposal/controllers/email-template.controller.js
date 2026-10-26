const service = require('../services/email-template.service');

const { clientMessage } = require('../../../utils/http-errors');
const logger = require('../../../utils/logger');
class EmailTemplateController {
    // API 1: Upload .docx and Save
    async upload(req, res) {
        try {
            const { tenantId } = req.params;
            const result = await service.uploadAndSave(tenantId, req.file, req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error("Upload failed:", error);
            res.status(500).json({ error: clientMessage(error) });
        }
    }

    // API 2: Get Preview URL
    async preview(req, res) {
        try {
            const url = await service.getPreviewUrl(req.params.id, req.tenantId);
            res.status(200).json({ publicUrl: url });
        } catch (error) {
            logger.error("Preview failed:", error);
            res.status(500).json({ error: clientMessage(error) });
        }
    }

    // API 3: Set Default
    async makeDefault(req, res) {
        try {
            const result = await service.setDefault(req.params.tenantId, req.params.id);
            res.status(200).json({ message: "Default template updated", data: result });
        } catch (error) {
            res.status(500).json({ error: clientMessage(error) });
        }
    }

    // API 4: Delete Template
    async remove(req, res) {
        try {
            await service.deleteTemplate(req.params.id, req.tenantId);
            res.status(200).json({ message: "Template deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: clientMessage(error) });
        }
    }

    async getTemplates(req, res) {
        try {
            const templates = await service.getTemplatesByTenant(req.params.tenantId);
            res.status(200).json(templates);
        } catch (error) {
            logger.error("Error fetching templates:", error);
            res.status(500).json({ error: clientMessage(error) });
        }
    }


    async getPreview(req, res) {
        service.getVisualPreview(req, res);
    }
}

module.exports = new EmailTemplateController();