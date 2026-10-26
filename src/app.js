const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const authenticateJWT = require('./middleware/auth.middleware');
const { createApiLimiter, createAiLimiter, AI_ROUTE_PREFIXES } = require('./middleware/rate-limit.middleware');
const app = express();

// Set TRUST_PROXY (e.g. "1" or "loopback") when running behind a load balancer so req.ip
// is the client address used for IP-based rate limiting.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}
app.disable('x-powered-by');
app.use(helmet({
  // The Google OAuth popup page must keep its link to the frontend window that opened it
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  // The frontend runs on another origin and loads API responses (e.g. template previews)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/**
 * Allowed browser origins: CORS_ORIGINS (comma-separated), else FRONTEND_URL's origin,
 * else the local development frontend.
 */
function allowedCorsOrigins() {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.FRONTEND_URL) {
    try {
      return [new URL(process.env.FRONTEND_URL).origin];
    } catch (_) {
      logger.warn('FRONTEND_URL is not a valid URL; falling back to the local development CORS origin');
    }
  }
  return ['http://localhost:3000'];
}

const corsOptions = {
  origin: allowedCorsOrigins(),
  credentials: true,               // Allows cookies/sessions when requested
  optionsSuccessStatus: 200        // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

const tenantRoute = require('./features/auto-proposal/routes/tenant-route');
const locationRoute = require('./features/auto-proposal/routes/location-routes');
const conceptRoute = require('./features/auto-proposal/routes/concept-routes');
const leadRoute = require('./features/auto-proposal/routes/lead-routes');
const quotationRoute = require('./features/auto-proposal/routes/quotation-routes');
const quotationTemplateRoute = require('./features/auto-proposal/routes/quotation-template-routes');
const gmailRoutes = require("../src/features/auto-proposal/routes/gmail-routes");
const proposalDraftRoute = require("./features/auto-proposal/routes/proposal-draft.routes");
const leadRequirementConfigRoute = require("./features/auto-proposal/routes/lead_requirement_config-routes");
const leadRequirementValuesRoute = require("./features/auto-proposal/routes/lead_requirement_values-routes");
const conceptPricingRoute = require("./features/auto-proposal/routes/concept-pricing.routes");
const pricingModelRoute = require("./features/auto-proposal/routes/pricingModel.routes");
const pricingRuleRoute = require("./features/auto-proposal/routes/pricingRule.routes");
const conversationRoutes = require('./features/auto-proposal/routes/conversation.route');
const socialIntegrationRoutes = require('./features/auto-proposal/routes/social-integration.route');

// In your main server.js
app.use((req, res, next) => {
  if (req.originalUrl === '/api/email-conversations/upload') {
    logger.debug("Skipping JSON parsing for upload route");
    next(); // Skip JSON parsing for the upload route
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Endpoints called by Google rather than by our users; they cannot carry our JWT.
const PUBLIC_API_ROUTES = new Set([
  'POST /api/gmail/webhook',
  'GET /api/social-integration/email/google/callback',
]);

// Every other /api route requires a verified JWT; tenant scope comes from the token.
app.use('/api', (req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  if (PUBLIC_API_ROUTES.has(`${req.method} ${path}`)) return next();
  return authenticateJWT(req, res, next);
});

// Rate limits run after authentication so they can key on the user rather than the IP.
app.use('/api', createApiLimiter());
app.use(AI_ROUTE_PREFIXES, createAiLimiter());

app.use("/api/gmail", gmailRoutes);


app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/tenants', tenantRoute);
app.use('/api/locations', locationRoute);
app.use('/api/concepts', conceptRoute);
app.use('/api/concept-pricing-matrix', conceptPricingRoute);
app.use('/api/leads', leadRoute);
app.use('/api/quotations', quotationRoute);
app.use('/api/quotation-templates', quotationTemplateRoute);
app.use('/api/proposal-draft', proposalDraftRoute);
app.use('/api/lead-requirement-config', leadRequirementConfigRoute);
app.use('/api/lead-requirement-values', leadRequirementValuesRoute);
app.use('/api/pricing-models', pricingModelRoute);
app.use('/api/pricing-rules', pricingRuleRoute);
app.use('/api/tenant-profile', require('./features/auto-proposal/routes/tenant-profile.routes')); // Add this line to include tenant profile routes
app.use('/api/email-templates', require('./features/auto-proposal/routes/email-template.routes')); // Add this line to include email template routes
app.use('/api/template-placeholder', require('./features/auto-proposal/routes/quotation-placeholder-routes'))
app.use('/api/quotation-email-template', require('./features/auto-proposal/routes/quotation-email-template.routes'))
app.use('/api/ai-response', require('./features/auto-proposal/routes/ai.response.routes'))

// Use the exact prefix your frontend Axios client expects
app.use('/api/email-conversations', conversationRoutes);
app.use('/api/social-integration', socialIntegrationRoutes);

app.use((err, req, res, next) => {
  // Upload limit/type violations (multer) are client errors
  const status = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) {
    logger.error('Unhandled request error', { method: req.method, path: req.originalUrl.split('?')[0], error: err.message, stack: err.stack });
  }
  // Only client (4xx) errors carry their own message; server errors never leak internals
  const message = status < 500 && err.message ? err.message : 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
