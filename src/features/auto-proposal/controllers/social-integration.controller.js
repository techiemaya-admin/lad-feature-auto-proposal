const userIdentityRepository = require("../repositories/user-identity.repository");
const authService = require("../services/google-auth.service");
const logger = require("../../../utils/logger");

async function getGoogleEmailStatus(req, res) {
    try {
        logger.info("Checking Google email status", { tenantId: req.tenantId });
        const userIdentity = await userIdentityRepository.findByProviderDetails(
            "gmail"
        );

        logger.debug("Found user identity for Gmail", { connected: !!userIdentity, email: userIdentity?.provider_user_id });
        if (userIdentity) {
            return res.json({
                success: true,
                connected: true,
                email: userIdentity.provider_user_id
            });
        } else {
            return res.json({
                success: true,
                connected: false
            });
        }
    } catch (error) {
        logger.error("Error checking Google email connection status", { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function getGoogleEmailStatusWithOtherDetails(req, res) {
    try {
        logger.info("Checking Google email status with details", { tenantId: req.tenantId });
        const userIdentity = await userIdentityRepository.findByProviderDetails(
            "gmail"
        );

        logger.debug("Found user identity for Gmail details", { connected: !!userIdentity, email: userIdentity?.provider_user_id });
        if (userIdentity) {
            return res.json({
                success: true,
                gmail: {
                    connected: true,
                    email: userIdentity.provider_user_id
                }
            });
        } else {
            return res.json({
                success: true,
                gmail: {
                    connected: false
                }
            });
        }
    } catch (error) {
        logger.error("Error checking Google email connection status", { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function initiateGoogle(req, res) {
    try {
        logger.info("Initiating Google OAuth flow", { tenantId: req.tenantId });
        let url = authService.getAuthUrl(req.tenantId);

        // Return it as JSON so window.location.href = result.url can trigger in the browser.
        return res.json({ url });
    } catch (error) {
        logger.error("Error generating Google auth URL", { error: error.message });
        return res.status(500).json({ error: "Failed to initialize auth flow" });
    }
}

async function googleCallback(req, res) {
    try {
        const { code, state } = req.query;
        const tenantId = state;
        // Grab user context if available, fallback for testing
        const userId = req.userId || 'b8c1ffa5-3000-4e85-bf56-237ba478aea2';

        await authService.handleGoogleCallback(code, userId, tenantId);

        // After successfully connecting, redirect the actual window back to frontend settings tab
        res.redirect('http://localhost:3000/settings?google=connected');
    } catch (error) {
        logger.error("Error handling Google callback", { error: error.message });
        res.redirect('http://localhost:3000/settings?error=google_auth_failed');
    }
}

async function disconnectGoogle(req, res) {
    try {
        const userId = req.userId || 'b8c1ffa5-3000-4e85-bf56-237ba478aea2';

        // 1. Fetch token data from repository to revoke it gracefully at Google's servers
        const identity = await userIdentityRepository.findByUserIdAndProvider(userId, "gmail");

        if (identity) {
            // Revoke tokens on Google's end so they are invalidated completely
            await authService.revokeGoogleToken(identity.access_token || identity.refresh_token);

            // 2. Clear credentials mapping out of your database
            await userIdentityRepository.deleteIdentity(identity.id);
        }

        // Return direct success verification response
        return res.status(200).json({
            success: true,
            message: "Google account disconnected successfully."
        });
    } catch (error) {
        logger.error("Error disconnecting Google account", { error: error.message });
        return res.status(500).json({
            success: false,
            message: "Failed to cleanly disconnect Google account.",
            error: error.message
        });
    }
}


module.exports = {
    getGoogleEmailStatus,
    initiateGoogle,
    googleCallback,
    disconnectGoogle,
    getGoogleEmailStatusWithOtherDetails
};
