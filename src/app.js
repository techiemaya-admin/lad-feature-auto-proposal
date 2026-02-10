const express = require('express');
const tenantModule = require('./features/tenant/modules/tenant.module');
const locationModule = require('./features/location//modules/location.module');
const conceptModule = require('./features/concept/modules/concept.module');
const leadModule = require('./features/lead/modules/lead.module');
const pricingModule = require('./features/pricing/modules/pricing.module');
const quotationModule = require('./features/quotation/modules/quotation.module');
const quotationTemplateModule = require('./features/quotation-template/modules/quotation-template.module');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/tenants', tenantModule);
app.use('/api/locations', locationModule);
app.use('/api/concepts', conceptModule);
app.use('/api/leads', leadModule);
app.use('/api/pricing', pricingModule);
app.use('/api/quotations', quotationModule);
app.use('/api/quotation-templates', quotationTemplateModule);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
