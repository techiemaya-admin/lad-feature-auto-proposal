const { google } = require('googleapis');
const userIdentityRepository = require('../repositories/user-identity.repository');
const gmailService = require('./gmail-read-email.service');
const logger = require('../../../utils/logger');

class GoogleAuthService {
    /**
     * Creates an isolated, ephemeral OAuth2 client instance per request.
     */
    createOAuth2Client() {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    getAuthUrl(tenantId) {
        const client = this.createOAuth2Client();
        logger.info("Generating Google Auth URL", { tenantId });
        return client.generateAuthUrl({
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
        const client = this.createOAuth2Client();

        // 1. Exchange code for tokens using isolated client
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // 2. Fetch authenticated profile details using this request's scoped client
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const userInfo = await oauth2.userinfo.get();
        logger.info("Retrieved Google profile for user", { email: userInfo.data.email, userId });

        // 3. Persist tokens into PostgreSQL
        const identityData = {
            userId: userId, // Passed from session/auth middleware
            email: userInfo.data.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token, // May be null if not first-time consent
            expiryDate: new Date(tokens.expiry_date),
            providerData: userInfo.data
        };

        await userIdentityRepository.upsertIdentity(identityData);

        // 4. Initialize Gmail Pub/Sub push notification subscription
        await gmailService.startWatch(userInfo.data.email, tenantId);
    }

    async revokeGoogleToken(token) {
        try {
            if (!token) return;
            const client = this.createOAuth2Client();
            await client.revokeToken(token);
            logger.info("Successfully revoked Google OAuth token");
        } catch (error) {
            // Log warning but do not crash so local database cleanup can still proceed
            logger.warn("Failed to explicitly revoke token with Google API:", { error: error.message });
        }
    }
}

module.exports = new GoogleAuthService();