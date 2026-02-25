const { google } = require("googleapis");

// “Hey Google, here is my App’s identity. Please create a secure connection for me.”
// The oAuth2Client is like a secure passport that allows the app to authenticate with Google’s services. It’s created using the client ID, client secret, and redirect URI that you get when you set up your app in the Google Developer Console.

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// “Google, I have a refresh token that proves I have permission to access the Gmail API. Please use it to get an access token for me.”
// The refresh token is like a long-term key that allows the app to get new access tokens without user involvement. It’s obtained during the initial OAuth flow when the user grants permission.
// By setting the credentials with the refresh token, the oAuth2Client can automatically handle token refreshing behind the scenes whenever it needs to make an authenticated request to the Gmail API.
// This way, the app can maintain continuous access to the Gmail API without requiring the user to log in again, as long as the refresh token remains valid.
// Note: Refresh tokens can expire or be revoked, so it’s important to handle errors that may occur when trying to use them to get access tokens.
oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

module.exports = { oAuth2Client };