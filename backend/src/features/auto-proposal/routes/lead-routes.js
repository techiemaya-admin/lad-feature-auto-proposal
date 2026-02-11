const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const { validateBody } = require('../../../middleware/validate');
const leadController = require('../controllers/lead.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

const createLeadSchema = { location_id: { type: 'string' } };
router.post('/', validateBody(createLeadSchema), leadController.create);
router.get('/', leadController.list);
router.get('/:id', leadController.getById);

module.exports = router;
