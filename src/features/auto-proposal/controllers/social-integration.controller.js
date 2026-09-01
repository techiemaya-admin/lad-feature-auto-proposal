const userIdentityRepository = require("../repositories/user-identity.repository");
const authService = require("../services/google-auth.service");
const logger = require("../../../utils/logger");

const DEFAULT_DEV_USER_ID = 'b8c1ffa5-3000-4e85-bf56-237ba478aea2';

/**
 * Resolves active user ID from request context, headers, query, or body.
 * In production, only trusted auth context (req.userId) or upstream gateway header (X-User-Id) is accepted.
 * Body/query overrides and the seeded default admin ID are restricted to non-production environments.
 */
function resolveUserId(req) {
    if (req.userId) return req.userId;
    if (req.headers && req.headers['x-user-id']) return req.headers['x-user-id'];
    if (process.env.NODE_ENV !== 'production') {
        if (req.query && req.query.userId) return req.query.userId;
        if (req.body && req.body.userId) return req.body.userId;
        return DEFAULT_DEV_USER_ID;
    }
    return null;
}

/**
 * Basic HTML entity escaping for XSS prevention.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Renders a lightweight self-closing HTML payload that posts a completion
 * message to the parent window opener and closes the popup.
 */
function renderPopupHtml({ success, error }) {
    const payload = success
        ? { type: 'GOOGLE_AUTH_SUCCESS' }
        : { type: 'GOOGLE_AUTH_ERROR', error: error || 'Authentication failed' };

    const title = success ? 'Connected Successfully' : 'Authentication Failed';
    const heading = success ? 'Connected Successfully!' : 'Authentication Failed';
    const subtext = success
        ? 'Your Gmail account has been linked. This window will close automatically.'
        : escapeHtml(error || 'An error occurred during authentication.');
    const color = success ? '#10b981' : '#ef4444';

    let targetOrigin = '*';
    if (process.env.FRONTEND_URL) {
        try {
            targetOrigin = new URL(process.env.FRONTEND_URL).origin;
        } catch (_) {
            targetOrigin = process.env.FRONTEND_URL;
        }
    }
    const safePayload = JSON.stringify(payload)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background-color: #f9fafb;
      color: #111827;
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      max-width: 400px;
      width: 100%;
    }
    .icon {
      font-size: 40px;
      margin-bottom: 16px;
      color: ${color};
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
    }
    p {
      margin: 0 0 20px 0;
      font-size: 14px;
      color: #6b7280;
      word-break: break-word;
    }
    button {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    button:hover {
      background-color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '&#10003;' : '&#9888;'}</div>
    <h2>${heading}</h2>
    <p>${subtext}</p>
    <button onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      try {
        if (window.opener) {
          window.opener.postMessage(${safePayload}, ${JSON.stringify(targetOrigin)});
        }
      } catch (e) {
        console.error('Failed to dispatch postMessage to opener:', e);
      }
      setTimeout(function() {
        try {
          window.close();
        } catch (e) {}
      }, 500);
    })();
  </script>
</body>
</html>`;
}

async function getGoogleEmailStatus(req, res) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User identification (X-User-Id header or auth context) is required."
            });
        }

        logger.info("Checking Google email status", { tenantId: req.tenantId, userId });
        const userIdentity = await userIdentityRepository.findByUserIdAndProvider(userId, "gmail");

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
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function getGoogleEmailStatusWithOtherDetails(req, res) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User identification (X-User-Id header or auth context) is required."
            });
        }

        logger.info("Checking Google email status with details", { tenantId: req.tenantId, userId });
        const userIdentity = await userIdentityRepository.findByUserIdAndProvider(userId, "gmail");

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
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

async function initiateGoogle(req, res) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return res.status(400).json({
                error: "User identification (X-User-Id header or auth context) is required."
            });
        }

        logger.info("Initiating Google OAuth flow", { tenantId: req.tenantId, userId });
        const url = authService.getAuthUrl(req.tenantId, userId);

        return res.json({ url });
    } catch (error) {
        logger.error("Error generating Google auth URL", { error: error.message });
        return res.status(500).json({ error: "Failed to initialize auth flow" });
    }
}

async function googleCallback(req, res) {
    try {
        const { code, state, error: oauthError, error_description: oauthErrorDesc } = req.query;

        // 1. Handle user cancellation or OAuth error from Google consent screen
        if (oauthError) {
            const errorMsg = oauthErrorDesc ? `${oauthError} (${oauthErrorDesc})` : oauthError;
            logger.warn("Google OAuth callback received error parameter", { error: oauthError, description: oauthErrorDesc });
            return res.status(200).send(renderPopupHtml({
                success: false,
                error: `Google authorization denied: ${errorMsg}`
            }));
        }

        // 2. Ensure code is provided
        if (!code) {
            logger.warn("Google OAuth callback missing authorization code", { query: req.query });
            return res.status(200).send(renderPopupHtml({
                success: false,
                error: "Authorization code missing from Google response."
            }));
        }

        let tenantId = state;
        let userId = null;

        if (state) {
            try {
                const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
                if (decodedState.tenantId) tenantId = decodedState.tenantId;
                if (decodedState.userId) userId = decodedState.userId;
            } catch (err) {
                logger.debug("State is plain string, not base64 JSON", { state });
            }
        }

        userId = userId || resolveUserId(req);
        if (!userId) {
            logger.error("Google OAuth callback missing user ID context");
            return res.status(200).send(renderPopupHtml({
                success: false,
                error: "User identification missing from OAuth state."
            }));
        }

        await authService.handleGoogleCallback(code, userId, tenantId);

        logger.info("Successfully completed Google OAuth callback", { tenantId, userId });
        return res.status(200).send(renderPopupHtml({ success: true }));
    } catch (error) {
        logger.error("Error handling Google callback", { error: error.message });
        return res.status(200).send(renderPopupHtml({
            success: false,
            error: error.message || "Failed to complete Google authentication."
        }));
    }
}

async function disconnectGoogle(req, res) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User identification (X-User-Id header or auth context) is required."
            });
        }

        logger.info("Disconnecting Google account", { tenantId: req.tenantId, userId });

        // 1. Fetch token data from repository to revoke it gracefully at Google's servers
        const identity = await userIdentityRepository.findByUserIdAndProvider(userId, "gmail");

        if (identity) {
            // Revoke tokens on Google's end so they are invalidated completely
            await authService.revokeGoogleToken(identity.access_token || identity.refresh_token);

            // 2. Clear credentials mapping out of database
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
    getGoogleEmailStatusWithOtherDetails,
    resolveUserId,
    renderPopupHtml
};
