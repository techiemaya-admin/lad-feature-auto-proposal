const repository = require('../repositories/tenant-profile.repository');
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const logger = require('../../../utils/logger');

class TenantProfileController {
    async getProfile(req, res) {
        try {
            const { tenantId } = req.params;
            const profile = await repository.findByTenantId(tenantId);
            res.status(200).json(profile);
        } catch (error) {
            logger.error("Error in getProfile:", error);
            res.status(500).json({
                success: false,
                message: error.message,
                stack: error.stack
            });
        }
    }

    async updateField(req, res) {
        try {
            logger.debug("Received update request with body:", req.body);
            const { tenantId } = req.params;
            const field = req.body.field || req.body.fieldName;
            const value = req.body.value !== undefined ? req.body.value : req.body.fieldValue;

            if (!field) return res.status(400).json({ error: "Field name is required" });

            const updatedProfile = await repository.updateField(tenantId, field, value);
            res.status(200).json({
                message: `${field} updated successfully`,
                data: updatedProfile
            });
        } catch (error) {
            logger.error("Error in updateField:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async getLogoPreview(req, res) {
        try {
            const { tenantId } = req.params;
            const profile = await repository.findByTenantId(tenantId);

            if (!profile || !profile.company_logo_url) {
                return res.status(404).json({ error: "No logo found for this tenant" });
            }

            res.status(200).json({
                tenantId: tenantId,
                logoUrl: profile.company_logo_url
            });
        } catch (error) {
            logger.error("Error in getLogoPreview:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async uploadLogo(req, res) {
        try {
            const { tenantId } = req.params;
            const file = req.file;
            logger.debug("Received file for upload:", tenantId);
            if (!file) return res.status(400).json({ error: "No image file provided" });
            logger.debug("File details:", file);
            // 1. Generate unique path in GCS
            const destination = `logos/${tenantId}/${Date.now()}_${file.originalname}`;

            // 2. Upload to GCS
            const publicUrl = await uploadBufferToGCS(file.buffer, destination, file.mimetype);

            // 3. Save the path/URL to the database
            const updatedProfile = await repository.updateField(tenantId, 'company_logo_url', publicUrl);

            res.status(200).json({
                message: "Logo uploaded successfully",
                logoUrl: publicUrl,
                data: updatedProfile
            });
        } catch (error) {
            logger.error("Logo Upload Error:", error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TenantProfileController();