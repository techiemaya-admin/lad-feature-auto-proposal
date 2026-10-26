const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const router = express.Router();
const controller = require('../controllers/lead_requirement_config.controller');

router.use(tenantContext);

router.post('/', controller.create);
router.get('/', controller.get);
router.get('/:tenant_id', controller.get);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;