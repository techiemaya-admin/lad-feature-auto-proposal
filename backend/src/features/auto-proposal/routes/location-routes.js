const express = require('express');
const { tenantContext } = require('../../../../../src/middleware/tenant-context');
const { validateBody } = require('../../../middleware/validate');
const locationController = require('../controllers/location.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

const createLocationSchema = { name: { required: true, type: 'string', min: 1, max: 255 } };
router.post('/', validateBody(createLocationSchema), locationController.create);
router.get('/', locationController.list);
router.get('/:id', locationController.getById);

module.exports = router;
