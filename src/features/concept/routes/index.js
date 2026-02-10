const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const { validateBody } = require('../../../middleware/validate');
const conceptController = require('../controllers/concept.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

const createConceptSchema = { name: { required: true, type: 'string', min: 1, max: 255 }, code: { type: 'string', max: 50 }, description: { type: 'string' } };
const addPricingSchema = { base_price: { required: true, type: 'number', min: 0 }, min_quantity: { type: 'number', min: 1 }, unit: { type: 'string', max: 50 }, location_multiplier: { type: 'number', min: 0 } };
router.post('/', validateBody(createConceptSchema), conceptController.create);
router.get('/', conceptController.list);
router.get('/:id', conceptController.getById);
router.post('/:conceptId/locations/:locationId', conceptController.linkLocation);
router.post('/:id/pricing', validateBody(addPricingSchema), conceptController.addPricing);

module.exports = router;
