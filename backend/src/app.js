const express = require('express');
const tenantRoute = require('./features/auto-proposal/routes/tenant-route');
const locationRoute =  require('./features/auto-proposal/routes/location-routes');
const conceptRoute =  require('./features/auto-proposal/routes/concept-routes');
const leadRoute = require('./features/auto-proposal/routes/lead-routes');
const pricingRoute = require('./features/auto-proposal/routes/pricing-routes');
const quotationRoute = require('./features/auto-proposal/routes/quotation-routes');
const quotationTemplateRoute = require('./features/auto-proposal/routes/quotation-template-routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/tenants', tenantRoute);
app.use('/api/locations', locationRoute);
app.use('/api/concepts', conceptRoute);
app.use('/api/leads', leadRoute);
app.use('/api/pricing', pricingRoute);
app.use('/api/quotations', quotationRoute);
app.use('/api/quotation-templates', quotationTemplateRoute);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
