const jwt = require('jsonwebtoken');

const PLATFORM_ADMIN_ROLE = 'platform_admin';
const ALLOWED_ALGORITHMS = ['HS256', 'HS384', 'HS512'];
const MIN_SECRET_LENGTH = 32;

function getVerifyConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
  const options = { algorithms: ALLOWED_ALGORITHMS };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return { secret, options };
}

function unauthorized(res, message) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ error: message });
}

/**
 * Verifies the `Authorization: Bearer <JWT>` header and sets req.auth.
 * Expected claims: sub (user id), tenant_id (UUID), roles (string[], optional).
 * Responds 401 if the token is missing, invalid or expired.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return unauthorized(res, 'Authentication required');
  }

  let claims;
  try {
    const { secret, options } = getVerifyConfig();
    claims = jwt.verify(token, secret, options);
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return unauthorized(res, 'Invalid or expired token');
    }
    return next(err);
  }

  if (!claims.sub) {
    return unauthorized(res, 'Invalid or expired token');
  }

  req.auth = {
    userId: claims.sub,
    tenantId: claims.tenant_id || null,
    roles: Array.isArray(claims.roles) ? claims.roles : [],
  };
  next();
}

function isPlatformAdmin(req) {
  return !!req.auth && req.auth.roles.includes(PLATFORM_ADMIN_ROLE);
}

/** Responds 403 unless the authenticated caller has the platform_admin role. */
function requirePlatformAdmin(req, res, next) {
  if (!isPlatformAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = {
  authenticate,
  requirePlatformAdmin,
  isPlatformAdmin,
  getVerifyConfig,
  PLATFORM_ADMIN_ROLE,
};
