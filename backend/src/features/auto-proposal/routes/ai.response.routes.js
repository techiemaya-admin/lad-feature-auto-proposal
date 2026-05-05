const express = require('express');
const router = express.Router({ mergeParams: true });
const aiResponseController = require('../controllers/ai.response.controller');

router.get('/suggest-concepts/:tenantId', aiResponseController.suggestConcepts);
router.get('/suggest-pricing-rule/:tenantId', aiResponseController.suggestPricingRules);
module.exports = router;