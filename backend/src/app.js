const express = require('express');
const tenantRoute = require('./features/auto-proposal/routes/tenant-route');
const locationRoute =  require('./features/auto-proposal/routes/location-routes');
const conceptRoute =  require('./features/auto-proposal/routes/concept-routes');
const leadRoute = require('./features/auto-proposal/routes/lead-routes');
const pricingRoute = require('./features/auto-proposal/routes/pricing-routes');
const quotationRoute = require('./features/auto-proposal/routes/quotation-routes');
const quotationTemplateRoute = require('./features/auto-proposal/routes/quotation-template-routes');
const gmailRoutes = require("../src/features/auto-proposal/routes/gmail-routes");
const proposalDraftRoute = require("../src/features/auto-proposal/routes/proposal-draft.routes");
const leadRequirementConfigRoute = require("../src/features/auto-proposal/routes/lead_requirement_config-routes");
const conceptPricingRoute = require("./features/auto-proposal/routes/concept-pricing.routes");

const app = express();
const cors = require('cors'); // 1. Import cors
// 2. Enable CORS
app.use(cors({
  origin: 'http://localhost:3000', // Allow only your frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed actions
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


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

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
