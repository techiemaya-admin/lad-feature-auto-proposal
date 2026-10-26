const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const userIdentityRepository = require('../repositories/user-identity.repository');
const gmailService = require('./gmail-read-email.service');
const logger = require('../../../utils/logger');

const STATE_PURPOSE = 'google_oauth_state';
const STATE_TTL = '10m';

/**
 * Key for signing OAuth state, derived from OAUTH_STATE_SECRET (or JWT_SECRET) so that a
 * state token can never be replayed as an API bearer token.
 */
function getStateKey() {
    const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('OAUTH_STATE_SECRET or JWT_SECRET must be configured');
    }
    return crypto.createHmac('sha256', secret).update(STATE_PURPOSE).digest();
}

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

    /** Signs the authenticated tenant/user into a short-lived OAuth state value. */
    createState(tenantId, userId) {
        if (!tenantId || !userId) {
            throw new Error('tenantId and userId are required to start Google OAuth');
        }
        return jwt.sign({ purpose: STATE_PURPOSE, tenantId, userId }, getStateKey(), {
            algorithm: 'HS256',
            expiresIn: STATE_TTL,
        });
    }

    /** Verifies an OAuth state value; throws if it is forged, expired or malformed. */
    verifyState(state) {
        if (!state || typeof state !== 'string') {
            throw new Error('Missing OAuth state');
        }
        const decoded = jwt.verify(state, getStateKey(), { algorithms: ['HS256'] });
        if (decoded.purpose !== STATE_PURPOSE || !decoded.tenantId || !decoded.userId) {
            throw new Error('Invalid OAuth state');
        }
        return { tenantId: decoded.tenantId, userId: decoded.userId };
    }

    getAuthUrl(tenantId, userId) {
        const client = this.createOAuth2Client();
        logger.info("Generating Google Auth URL", { tenantId, userId });
        const statePayload = this.createState(tenantId, userId);
        return client.generateAuthUrl({
            access_type: 'offline', // Critical for getting the refresh_token
            prompt: 'consent',
            scope: [// Profile & email details
                'https://www.googleapis.com/auth/userinfo.email',

                // Gmail Scopes
                'https://www.googleapis.com/auth/gmail.readonly', // Read messages, threads, labels, etc.
                'https://www.googleapis.com/auth/gmail.send'      // Send messages on user's behalf
            ],
            state: statePayload
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
        try {
            await gmailService.startWatch(userInfo.data.email, tenantId);
        } catch (watchError) {
            logger.warn("Failed to initialize Gmail watch subscription (Pub/Sub might not be configured):", {
                email: userInfo.data.email,
                tenantId,
                error: watchError.message
            });
        }
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