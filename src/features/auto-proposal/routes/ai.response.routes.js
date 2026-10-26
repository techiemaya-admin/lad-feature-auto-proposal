const express = require('express');
const { tenantContext, enforceTenantParams } = require('../../../middleware/tenant-context');
const router = express.Router({ mergeParams: true });

router.use(tenantContext);
enforceTenantParams(router);
const aiResponseController = require('../controllers/ai.response.controller');

router.get('/suggest-concepts/:tenantId', aiResponseController.suggestConcepts);
router.get('/suggest-pricing-rule/:tenantId', aiResponseController.suggestPricingRules);
router.get('/suggest-pricing-rules/:tenantId', aiResponseController.suggestPricingRules);
router.get('/suggest-email-templates/:tenantId', aiResponseController.suggestEmailTemplates);
module.exports = router;