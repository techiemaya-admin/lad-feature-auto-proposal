const service = require('../services/tenant-profile.service');
const { uploadBufferToGCS } = require('../../../utils/gcsUploader');

class TenantProfileController {
    async getProfile(req, res) {
        try {
            const { tenantId } = req.params;
            const profile = await service.getProfile(tenantId);
            res.status(200).json(profile);
        } catch (error) {
            // THIS IS THE IMPORTANT PART:
            console.error("DETAILED ERROR:", error); // This WILL show in your console
            res.status(500).json({
                success: false,
                message: error.message,
                stack: error.stack // Include this temporarily to see exactly where it fails
            });
        }
    }

    async updateField(req, res) {
        try {
            console.log("Received update request with body:", req.body); // Log the incoming request body
            const { tenantId } = req.params;
            const { field, value } = req.body; // e.g., { "field": "whatsapp_url", "value": "https://wa.me/..." }

            if (!field) return res.status(400).json({ error: "Field name is required" });

            const updatedProfile = await service.updateProfileField(tenantId, field, value);
            res.status(200).json({
                message: `${field} updated successfully`,
                data: updatedProfile
            });
        } catch (error) {
            console.error("DETAILED ERROR in update field :", error); // This WILL show in your console
            res.status(400).json({ error: error.message });
        }
    }

    async getLogoPreview(req, res) {
        try {
            const { tenantId } = req.params;
            const profile = await service.getProfile(tenantId);

            if (!profile || !profile.company_logo_url) {
                return res.status(404).json({ error: "No logo found for this tenant" });
            }

            res.status(200).json({
                tenantId: tenantId,
                logoUrl: profile.company_logo_url
            });
        } catch (error) {
            console.error("DETAILED ERROR in getLogoPreview:", error); // This WILL show in your console
            res.status(500).json({ error: error.message });
        }
    }

    async uploadLogo(req, res) {
        try {
            const { tenantId } = req.params;
            const file = req.file;
            console.log("Received file for upload:", tenantId); // Log the incoming file details
            if (!file) return res.status(400).json({ error: "No image file provided" });
            console.log("File details:", file); // Log the incoming file details
            // 1. Generate unique path in GCS
            const destination = `logos/${tenantId}/${Date.now()}_${file.originalname}`;

            // 2. Upload to GCS
            const publicUrl = await uploadBufferToGCS(file.buffer, destination, file.mimetype);

            // 3. Save the path/URL to the database
            // We use the same updateField logic from before
            const updatedProfile = await service.updateProfileField(tenantId, 'company_logo_url', publicUrl);

            res.status(200).json({
                message: "Logo uploaded successfully",
                logoUrl: publicUrl,
                data: updatedProfile
            });
        } catch (error) {
            console.error("Logo Upload Error:", error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TenantProfileController();