const express = require('express');
const cors = require('cors');
const app = express();
const corsOptions = {
  origin: 'http://localhost:3000', // Matches your frontend exactly
  credentials: true,               // Allows cookies/sessions when requested
  optionsSuccessStatus: 200        // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

const tenantRoute = require('./features/auto-proposal/routes/tenant-route');
const locationRoute = require('./features/auto-proposal/routes/location-routes');
const conceptRoute = require('./features/auto-proposal/routes/concept-routes');
const leadRoute = require('./features/auto-proposal/routes/lead-routes');
const pricingRoute = require('./features/auto-proposal/routes/pricing-routes');
const quotationRoute = require('./features/auto-proposal/routes/quotation-routes');
const quotationTemplateRoute = require('./features/auto-proposal/routes/quotation-template-routes');
const gmailRoutes = require("../src/features/auto-proposal/routes/gmail-routes");
const proposalDraftRoute = require("../src/features/auto-proposal/routes/proposal-draft.routes");
const leadRequirementConfigRoute = require("../src/features/auto-proposal/routes/lead_requirement_config-routes");
const conceptPricingRoute = require("./features/auto-proposal/routes/concept-pricing.routes");
const pricingModelRoute = require("./features/auto-proposal/routes/pricingModel.routes");
const pricingRuleRoute = require("./features/auto-proposal/routes/pricingRule.routes");
const conversationRoutes = require('./features/auto-proposal/routes/conversation.route');
const socialIntegrationRoutes = require('./features/auto-proposal/routes/social-integration.route');

// In your main server.js
app.use((req, res, next) => {
  if (req.originalUrl === '/api/email-conversations/upload') {
    console.log("Skipping JSON parsing for upload route");
    next(); // Skip JSON parsing for the upload route
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use("/api/gmail", gmailRoutes);


app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/tenants', tenantRoute);
app.use('/api/locations', locationRoute);
app.use('/api/concepts', conceptRoute);
app.use('/api/concept-pricing-matrix', conceptPricingRoute);
app.use('/api/leads', leadRoute);
app.use('/api/pricing', pricingRoute);
app.use('/api/quotations', quotationRoute);
app.use('/api/quotation-templates', quotationTemplateRoute);
app.use('/api/proposal-draft', proposalDraftRoute);
app.use('/api/lead-requirement-config', leadRequirementConfigRoute);
app.use('/api/pricing-models', pricingModelRoute);
app.use('/api/pricing-rules', pricingRuleRoute);
app.use('/api/test', require('./features/auto-proposal/routes/test.route')); // Add this line to include the test route
app.use('/api/tenant-profile', require('./features/auto-proposal/routes/tenant-profile.routes')); // Add this line to include tenant profile routes
app.use('/api/email-templates', require('./features/auto-proposal/routes/email-template.routes')); // Add this line to include email template routes
app.use('/api/template-placeholder', require('./features/auto-proposal/routes/quotation-placeholder-routes'))
app.use('/api/quotation-email-template', require('./features/auto-proposal/routes/quotation-email-template.routes'))
app.use('/api/ai-response', require('./features/auto-proposal/routes/ai.response.routes'))

// Use the exact prefix your frontend Axios client expects
app.use('/api/email-conversations', conversationRoutes);
app.use('/api/social-integration', socialIntegrationRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
