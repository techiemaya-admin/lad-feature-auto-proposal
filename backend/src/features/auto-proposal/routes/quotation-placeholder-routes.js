const express = require('express');
const router = express.Router();
const quotationPlaceholderController = require('../controllers/quotation-placeholder.controller');

// GET / -> list placeholders for tenant. Tenant id via query `tenant_id` or header `x-tenant-id`.
router.get('/:tenantId', (req, res) => quotationPlaceholderController.getPlaceholders(req, res));

module.exports = router;
