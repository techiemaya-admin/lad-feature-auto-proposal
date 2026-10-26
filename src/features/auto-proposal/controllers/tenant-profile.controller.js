const repository = require('../repositories/tenant-profile.repository');
const { clientMessage } = require('../../../utils/http-errors');
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');
const logger = require('../../../utils/logger');
const { isAllowedImageUrl, isHttpUrl } = require('../../../utils/safe-url');
const { safeFileName } = require('../../../utils/upload');

const LINK_FIELDS = ['whatsapp_url', 'linkedin_url', 'instagram_url', 'website_url'];

/** Returns an error message if the value is not acceptable for the field, else null. */
function validateProfileField(field, value) {
    if (value === null || value === undefined || value === '') return null;
    if (field === 'company_logo_url' && !isAllowedImageUrl(value)) {
        return 'company_logo_url must be an https URL on an allowed image host';
    }
    if (LINK_FIELDS.includes(field) && !isHttpUrl(value)) {
        return `${field} must be an http(s) URL`;
    }
    return null;
}

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
                message: "Failed to retrieve tenant profile"
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
            const validationError = validateProfileField(field, value);
            if (validationError) return res.status(400).json({ error: validationError });

            const updatedProfile = await repository.updateField(tenantId, field, value);
            res.status(200).json({
                message: `${field} updated successfully`,
                data: updatedProfile
            });
        } catch (error) {
            logger.error("Error in updateField:", error);
            res.status(400).json({ error: clientMessage(error) });
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
            res.status(500).json({ error: clientMessage(error) });
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
            const destination = `logos/${tenantId}/${Date.now()}_${safeFileName(file.originalname)}`;

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
            res.status(500).json({ error: clientMessage(error) });
        }
    }
}

module.exports = new TenantProfileController();