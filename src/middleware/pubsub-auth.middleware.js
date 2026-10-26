const { OAuth2Client } = require('google-auth-library');
const logger = require('../utils/logger');

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

let client = null;
function getClient() {
  if (!client) client = new OAuth2Client();
  return client;
}

/**
 * Verifies the OIDC token Google Pub/Sub attaches to authenticated push requests.
 * Configure the push subscription with a service account and set:
 *   PUBSUB_PUSH_AUDIENCE         - the audience configured on the subscription (usually the webhook URL)
 *   PUBSUB_PUSH_SERVICE_ACCOUNT  - the service account email the subscription signs as
 * Rejects with 401 when the token is missing or invalid. Fails closed when unconfigured,
 * unless PUBSUB_SKIP_VERIFY=true outside production (local development only).
 */
async function verifyPubSubPush(req, res, next) {
  const audience = process.env.PUBSUB_PUSH_AUDIENCE;
  const serviceAccount = process.env.PUBSUB_PUSH_SERVICE_ACCOUNT;

  if (!audience || !serviceAccount) {
    if (process.env.PUBSUB_SKIP_VERIFY === 'true' && process.env.NODE_ENV !== 'production') {
      logger.warn('Pub/Sub push verification skipped (PUBSUB_SKIP_VERIFY=true, non-production)');
      return next();
    }
    logger.error('Pub/Sub push verification is not configured (PUBSUB_PUSH_AUDIENCE / PUBSUB_PUSH_SERVICE_ACCOUNT)');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const ticket = await getClient().verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload() || {};
    if (!GOOGLE_ISSUERS.includes(payload.iss)) {
      throw new Error('Unexpected token issuer');
    }
    if (payload.email !== serviceAccount || payload.email_verified !== true) {
      throw new Error('Unexpected push service account');
    }
    return next();
  } catch (err) {
    logger.warn('Rejected Pub/Sub push with invalid token', { error: err.message });
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { verifyPubSubPush, _setClientForTests: (c) => { client = c; } };
