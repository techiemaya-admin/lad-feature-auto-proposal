const jwt = require('jsonwebtoken');

const PLATFORM_ADMIN_ROLE = 'platform_admin';
const ALLOWED_ALGORITHMS = ['HS256', 'HS384', 'HS512'];
const MIN_SECRET_LENGTH = 32;

/**
 * Throws if JWT_SECRET is missing or too short. Called at startup so a
 * misconfigured deployment fails fast instead of serving 500s.
 */
function assertJwtConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
}

function getVerifyOptions() {
  const options = { algorithms: ALLOWED_ALGORITHMS };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return options;
}

function extractRoles(decoded) {
  if (Array.isArray(decoded.roles)) return decoded.roles;
  if (typeof decoded.role === 'string') return [decoded.role];
  return [];
}

/**
 * Verifies `Authorization: Bearer <JWT>` and sets req.tenantId, req.userId and req.roles
 * from the token. Expected claims: tenantId (required), userId or id, roles[] or role.
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET is not configured' });
    }
    const decoded = jwt.verify(token, secret, getVerifyOptions());

    if (!decoded || !decoded.tenantId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId || decoded.id || null;
    req.roles = extractRoles(decoded);
    req.isAuthenticated = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

function isPlatformAdmin(req) {
  return Array.isArray(req.roles) && req.roles.includes(PLATFORM_ADMIN_ROLE);
}

/** Responds 403 unless the authenticated caller has the platform_admin role. */
function requirePlatformAdmin(req, res, next) {
  if (!isPlatformAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = authenticateJWT;
module.exports.authenticateJWT = authenticateJWT;
module.exports.assertJwtConfig = assertJwtConfig;
module.exports.isPlatformAdmin = isPlatformAdmin;
module.exports.requirePlatformAdmin = requirePlatformAdmin;
module.exports.PLATFORM_ADMIN_ROLE = PLATFORM_ADMIN_ROLE;
