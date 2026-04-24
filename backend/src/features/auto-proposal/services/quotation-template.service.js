const repository = require('../repositories/quotation-template-metadata.repository');
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


class QuotationTemplateService {

  async getTemplatesByTenant(tenantId) {
    // Fetch all templates for the list view in the UI
    return await repository.findAllByTenant(tenantId);
  }


  async setDefault(tenantId, templateId) {
    return await repository.setAsDefault(tenantId, templateId);
  }

  async deleteTemplate(tenantId, templateId) {
    return await repository.softDelete(templateId, tenantId);
  }

  async uploadAndSaveTemplate(tenantId, file, body) {
    const fileExt = path.extname(file.originalname);
    const destination = `quotation-templates/${tenantId}/${Date.now()}_${file.originalname}`;

    // 1. Upload .docx to GCS
    const publicUrl = await uploadBufferToGCS(file.buffer, destination, file.mimetype);

    // 3. Reset defaults and save metadata to DB
    await repository.resetDefaultsByTenant(tenantId);
    // 2. Save to DB
    return await repository.create({
      tenant_id: tenantId,
      name: body.template_name,
      type: fileExt.toUpperCase().replace(".", ""),
      storage_path: destination,
      relative_path: publicUrl, // Using the public URL for previewing
      is_default: body.is_default === 'true',
      metadata: body.metadata || {}
    });
  }

  async getVisualPreview(req, res) {
    try {
      const { id } = req.params;
      console.log("Fetch by id : " + id)

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

}

module.exports = new QuotationTemplateService();