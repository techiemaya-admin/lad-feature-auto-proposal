const { google } = require('googleapis');
const userIdentityRepository = require('../repositories/user-identity.repository');
const gmailService = require('./gmail-read-email.service');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

class GoogleAuthService {
    getAuthUrl(tenantId) {
        console.log("Generating Google Auth URL with client ID:", process.env.GOOGLE_CLIENT_ID, "and redirect URI:", process.env.GOOGLE_REDIRECT_URI);
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', // Critical for getting the refresh_token
            prompt: 'consent',
            scope: [// Profile & email details
                'https://www.googleapis.com/auth/userinfo.email',

                // Gmail Scopes
                'https://www.googleapis.com/auth/gmail.readonly', // Read messages, threads, labels, etc.
                'https://www.googleapis.com/auth/gmail.send'      // Send messages on user's behalf
            ],
            state: tenantId
        });
    }

    async handleGoogleCallback(code, userId, tenantId) {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch user info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        console.log("User Info from Google:", userInfo.data);
        const identityData = {
            userId: userId, // Passed from your session/auth middleware
            email: userInfo.data.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token, // May be null if not first-time consent
            expiryDate: new Date(tokens.expiry_date),
            providerData: userInfo.data
        };

        const userIdentity = await userIdentityRepository.upsertIdentity(identityData);
        const result = await gmailService.startWatch(userInfo.data.email, tenantId);
    }

    async revokeGoogleToken(token) {
        try {
            if (!token) return;

            // Tells Google's OAuth infrastructure to explicitly invalidate this credentials string
            await oauth2Client.revokeToken(token);
        } catch (error) {
            // Log error but don't crash, we still want to clear our local DB row even if Google fails
            console.error("Warning: Failed to explicitly revoke token with Google API directly:", error.message);
        }
    }
}

module.exports = new GoogleAuthService();