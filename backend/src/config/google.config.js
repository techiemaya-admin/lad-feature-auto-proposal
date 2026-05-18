const { google } = require("googleapis");
const userIdentityRepository = require("../features/auto-proposal/repositories/user-identity.repository");

/**
 * Creates a configured Google OAuth2 Client for a specific user.
 * @param {string} userId - The unique identifier of the user/tenant
 * @returns {Promise<google.auth.OAuth2>} Configured OAuth2 client instance
 */
async function getGoogleClientForUser(email, userId) {
  // 1. Initialize a fresh client structure with your app's core credentials
  console.log("Fetching Google OAuth2 client for user: " + userId + " and email: " + email);
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // 2. Fetch the specific user's tokens from the user_identities table
  let identity;
  if (email != "undefined" && email != undefined && email != null && email != "") {
    console.log("Fetching identity using email: " + email);
    identity = await userIdentityRepository.findByProviderAndProviderUserId("gmail", email);
  } else {
    console.log("Fetching identity using userId: " + userId);
    identity = await userIdentityRepository.findByProviderAndProviderUserIdAndTenantId(userId, "gmail");
  }
  console.log("Fetched identity: ", identity);
  if (!identity || !identity.refresh_token) {
    throw new Error(`No Gmail integration credentials found for user: ${userId}`);
  }

  // 3. Inject the database tokens dynamically into this client instance
  oAuth2Client.setCredentials({
    access_token: identity.access_token,
    refresh_token: identity.refresh_token,
    expiry_date: identity.token_expires_at ? new Date(identity.token_expires_at).getTime() : null,
  });

  // 4. Optional: Set up an automated listener to save refreshed tokens
  // If the access token expires, google-auth-library automatically fetches a new one
  // using the refresh token, and fires this 'tokens' event.
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      console.log(`Automatically refreshing access token for user: ${userId} and email: ${email}`);
      if (email != "undefined" && email != undefined && email != null && email != "") {
        await userIdentityRepository.updateAccessTokenByProviderUserId(email, "gmail", {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000)
        });
      } else {
        await userIdentityRepository.updateAccessTokenByUserId(userId, "gmail", {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000)
        });
      }
    }
  });

  return oAuth2Client;
}

module.exports = { getGoogleClientForUser };