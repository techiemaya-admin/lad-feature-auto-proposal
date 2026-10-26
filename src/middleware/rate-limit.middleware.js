const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function intFromEnv(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Per authenticated user (tenant + user) when known, otherwise per client IP. */
function keyFor(req) {
  if (req.isAuthenticated && req.userId) return `user:${req.tenantId}:${req.userId}`;
  if (req.isAuthenticated && req.tenantId) return `tenant:${req.tenantId}`;
  return `ip:${ipKeyGenerator(req.ip || '')}`;
}

function jsonHandler(req, res) {
  res.status(429).json({ error: 'Too many requests, please try again later.' });
}

/**
 * Limiters use the in-memory store, so limits apply per process. Behind a load balancer
 * with several instances, use a shared store (e.g. rate-limit-redis) for exact limits.
 */
function createApiLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: intFromEnv('RATE_LIMIT_PER_MINUTE', 300),
    // Pub/Sub pushes arrive from shared Google IPs and are authenticated by their OIDC token
    skip: (req) => req.originalUrl.split('?')[0] === '/api/gmail/webhook',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyFor,
    handler: jsonHandler,
  });
}

/** Tighter limit for endpoints that call Gemini/OpenAI and cost money per request. */
function createAiLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: intFromEnv('AI_RATE_LIMIT_PER_MINUTE', 20),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyFor,
    handler: jsonHandler,
  });
}

const AI_ROUTE_PREFIXES = [
  '/api/ai-response',
  '/api/gmail/test-prompt',
  '/api/email-conversations/email-ai-followup',
  '/api/email-conversations/email-ai-crux',
];

module.exports = { createApiLimiter, createAiLimiter, AI_ROUTE_PREFIXES, _keyFor: keyFor };
