const userIdentityRepository = require("../repositories/user-identity.repository");
const authService = require("../services/google-auth.service");

async function getGoogleEmailStatus(req, res) {
    try {
        console.log("status check>> tenant id : " + req.tenantId)
        const userIdentity = await userIdentityRepository.findByProviderDetails(
            "gmail"
        );

        console.log("Found user identity for Gmail:", userIdentity);
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
        console.error("Error checking Google email connection status:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function getGoogleEmailStatusWithOtherDetails(req, res) {
    try {
        console.log("status check>> tenant id : " + req.tenantId)
        const userIdentity = await userIdentityRepository.findByProviderDetails(
            "gmail"
        );

        console.log("Found user identity for Gmail:", userIdentity);
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
        console.error("Error checking Google email connection status:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function initiateGoogle(req, res) {
    try {
        console.log("Initiating Google OAuth flow for tenant:", req.tenantId);
        let url = authService.getAuthUrl(req.tenantId);

        // DO NOT res.redirect(url) here! 
        console.log("Generated Google Auth URL:", url);
        // Return it as JSON so window.location.href = result.url can trigger in the browser.
        return res.json({ url });
    } catch (error) {
        console.error("Error generating Google auth URL:", error);
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

        // After successfully connecting, redirect the actual window back to your frontend settings tab
        res.redirect('http://localhost:3000/settings?google=connected');
    } catch (error) {
        console.error("Error handling Google callback:", error);
        res.redirect('http://localhost:3000/settings?error=google_auth_failed');
    }
}

async function disconnectGoogle(req, res) {
    try {
        const userId = req.userId || 'b8c1ffa5-3000-4e85-bf56-237ba478aea2';

        // 1. Fetch token data from repository to revoke it gracefully at Google's servers
        const identity = await userIdentityRepository.findByProviderAndProviderUserIdAndTenantId(userId, "gmail");

        if (identity) {
            // Revoke tokens on Google's end so they are invalidated completely
            await authService.revokeGoogleToken(identity.access_token || identity.refresh_token);

            // 2. Clear credentials mapping out of your database
            await userIdentityRepository.deleteIdentity(identity.id);
        }

        // Your TanStack query options hook expects a direct success verification response
        return res.status(200).json({
            success: true,
            message: "Google account disconnected successfully."
        });
    } catch (error) {
        console.error("Error disconnecting Google account:", error);
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
