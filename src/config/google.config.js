const { google } = require("googleapis");
const userIdentityRepository = require("../features/auto-proposal/repositories/user-identity.repository");
const logger = require("../utils/logger");

/**
 * Creates a configured Google OAuth2 Client for a specific user.
 * @param {string} [email] - The email address associated with the Gmail identity
 * @param {string} [userId] - The unique identifier of the user/tenant
 * @returns {Promise<google.auth.OAuth2>} Configured OAuth2 client instance
 */
async function getGoogleClientForUser(email, userId) {
  const isValidEmail = typeof email === 'string' && email.trim() !== '' && email !== 'undefined';
  const isValidUserId = typeof userId === 'string' && userId.trim() !== '' && userId !== 'undefined';

  logger.debug("Fetching Google OAuth2 client", {
    hasEmail: isValidEmail,
    hasUserId: isValidUserId
  });

  // 1. Initialize a fresh client structure with your app's core credentials
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // 2. Fetch the specific user's tokens from the user_identities table
  let identity = null;
  if (isValidEmail) {
    identity = await userIdentityRepository.findByProviderAndProviderUserId("gmail", email.trim());
  } else if (isValidUserId) {
    identity = await userIdentityRepository.findByUserIdAndProvider(userId.trim(), "gmail");
  }

  if (!identity || !identity.refresh_token) {
    const identifier = isValidEmail ? email : (isValidUserId ? userId : 'unknown');
    throw new Error(`No Gmail integration credentials found for identifier: ${identifier}`);
  }

  // 3. Inject the database tokens dynamically into this client instance
  oAuth2Client.setCredentials({
    access_token: identity.access_token,
    refresh_token: identity.refresh_token,
    expiry_date: identity.token_expires_at ? new Date(identity.token_expires_at).getTime() : null,
  });

  // 4. Set up an automated listener to save refreshed tokens
  // If the access token expires, google-auth-library automatically fetches a new one
  // using the refresh token, and fires this 'tokens' event.
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      logger.info("Automatically refreshing access token", {
        target: isValidEmail ? email : (isValidUserId ? userId : 'unknown'),
        hasRotatedRefreshToken: !!tokens.refresh_token
      });

      const tokenUpdates = {
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000)
      };

      if (tokens.refresh_token) {
        tokenUpdates.refreshToken = tokens.refresh_token;
      }

      if (isValidEmail) {
        await userIdentityRepository.updateAccessTokenByProviderUserId(email.trim(), "gmail", tokenUpdates);
      } else if (isValidUserId) {
        await userIdentityRepository.updateAccessTokenByUserId(userId.trim(), "gmail", tokenUpdates);
      }
    }
  });

  return oAuth2Client;
}

module.exports = { getGoogleClientForUser };