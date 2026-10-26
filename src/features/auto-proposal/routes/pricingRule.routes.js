const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const router = express.Router();
const controller = require('../controllers/pricing-rule.controller');

router.use(tenantContext);

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:tenant_id', controller.getAll);
router.get('/detail/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;