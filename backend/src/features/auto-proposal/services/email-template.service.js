const repository = require('../repositories/email-template.repository');
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const mammoth = require("mammoth");
const { Storage } = require("@google-cloud/storage");

const libre = require('libreoffice-convert');
const path = require('path');
const storage = new Storage({
    keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

const bucket = storage.bucket(process.env.GCS_BUCKET);
const sofficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';


class EmailTemplateService {
    async saveTemplateMetadata(data) {
        // If this is set to default, we might want to unset other defaults first
        // (Optional: Implement repository.clearDefaults(tenant_id) here)

        return await repository.createTemplate(data);
    }

    async getTemplatesByTenant(tenantId) {
        // Fetch all templates for the list view in the UI
        return await repository.findAllByTenant(tenantId);
    }
    async uploadAndSave(tenantId, file, body) {
        const destination = `email-templates/${tenantId}/${Date.now()}_${file.originalname}`;

        // 1. Upload .docx to GCS
        const publicUrl = await uploadBufferToGCS(file.buffer, destination, file.mimetype);

        // 2. Save to DB
        return await repository.create({
            tenant_id: tenantId,
            template_name: body.template_name,
            subject_line: body.subject_line,
            storage_path: destination,
            relative_path: publicUrl, // Using the public URL for previewing
            is_default: body.is_default === 'true',
            metadata: body.metadata || {}
        });
    }


    async getVisualPreview(req, res) {
        try {
            const { id } = req.params;
            const template = await repository.findById(id);
            const [fileBuffer] = await bucket.file(template.storage_path).download();

            // Pass the path directly if the library supports it, 
            // or ensure the environment variable is set in the process
            process.env.SOFFICE_PATH = sofficePath;

            libre.convert(fileBuffer, '.pdf', undefined, (err, pdfBuffer) => {
                if (err) {
                    console.error(`Error converting: ${err}`);
                    return res.status(500).json({ error: "Conversion failed" });
                }
                res.contentType("application/pdf");
                res.send(pdfBuffer);
            });
        } catch (error) {
            console.error("Error in getVisualPreview:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getTemplatePreview(id) {
        try {
            // 1. Get metadata from DB
            const template = await repository.findById(id);
            if (!template) throw new Error("Template not found");

            // 2. Download raw .docx from GCS
            const bucket = storage.bucket(process.env.GCS_BUCKET);
            const [fileBuffer] = await bucket.file(template.storage_path).download();
            console.log("Downloaded file buffer for preview, size:", template.relative_path);
            // 3. Convert to HTML for previewing
            // Mammoth is great because it handles images and styles perfectly
            const { value: htmlContent } = await mammoth.convertToHtml({ buffer: fileBuffer });

            // 4. Send the HTML string to the frontend
            return { htmlContent: htmlContent, template: template };
        } catch (error) {
            console.error("Preview failed:", error);
            res.status(500).json({ error: "Could not generate preview" });
        }
    }

    async setDefault(tenantId, templateId) {
        return await repository.setAsDefault(tenantId, templateId);
    }

    async deleteTemplate(tenantId, templateId) {
        return await repository.softDelete(templateId, tenantId);
    }

    async getPreviewUrl(templateId) {
        const template = await repository.findById(templateId);
        if (!template) throw new Error("Template not found");
        return template.relative_path;
    }
}

module.exports = new EmailTemplateService();