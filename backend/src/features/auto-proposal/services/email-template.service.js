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
        if (body.is_default === 'true') {
            await repository.clearDefaults(tenantId);
        }
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

    async setDefault(tenantId, templateId) {
        return await repository.setAsDefault(tenantId, templateId);
    }

    async deleteTemplate(templateId) {
        return await repository.softDelete(templateId);
    }

    async getPreviewUrl(templateId) {
        const template = await repository.findById(templateId);
        if (!template) throw new Error("Template not found");
        return template.relative_path;
    }

    async defaultEmailTemplateIfNoTemplateUpload() {
        return `<!DOCTYPE html>
            <html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
  .email-container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eeeeee; }
  .logo { max-width: 150px; margin-bottom: 20px; }
  .summary-box { background-color: #f9f9f9; border-left: 4px solid #8B5E3C; padding: 15px; margin: 20px 0; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 13px; color: #666; }
  .social-links a { margin-right: 10px; text-decoration: none; color: #8B5E3C; font-weight: bold; }
  .price { font-size: 18px; font-weight: bold; color: #000; }
</style>
</head>
<body>
  <div class="email-container">
    [company_logo]    
    <p>Dear <strong>[lead_name]</strong>,</p>
    
    <p>I hope you are doing well.</p>
    
    <p>Thank you for sharing your requirements with us. Based on your requirements, we are pleased to provide you with the quotation for the services you asked.</p>
    
    <div class="summary-box">
      <h3 style="margin-top: 0;">📌 Quotation Summary:</h3>
      <p><strong>Total Cost:</strong> <span class="price">₹[final_price]</span></p>
    </div>
    
    <p>Please find the detailed quotation attached with this email for your review.</p>
    
    <h3>✅ What’s Next?</h3>
    <p>If everything looks good, you can simply reply to this email with your approval, and we will proceed with the next steps.</p>
    
    <p>In case you have any questions or need modifications, feel free to reach out—we’d be happy to assist you.</p>
    
    <p>Looking forward to your response.</p>
    
    <div class="footer">
      <p>Warm regards,<br>
      <strong>[company_name]</strong></p>
      
      <p class="social-links">
        <strong>Follow us:</strong> 
        [linkedin_url]
        [instagram_url]
        [whatsapp_url]
      </p>
      
      <p>
        <strong>Contact us:</strong> [company_phone]<br>
        <strong>Email:</strong> [company_email]<br>
        <strong>Website:</strong> [company_website]
      </p>
    </div>
  </div>
</body>
</html>`;
    }
}

module.exports = new EmailTemplateService();