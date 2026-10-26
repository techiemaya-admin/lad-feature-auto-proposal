const express = require('express');
const { tenantContext, enforceTenantParams } = require('../../../middleware/tenant-context');
const router = express.Router({ mergeParams: true });
const matrixController = require('../controllers/concept-pricing.controller');

router.use(tenantContext);
enforceTenantParams(router);

router.post('/', matrixController.create);
router.get('/', matrixController.listAll);
router.get('/:tenant_id', matrixController.listAll);
router.get('/concept/:conceptId', matrixController.listByConcept);
router.put('/:id', matrixController.update);
router.delete('/:id', matrixController.deleteEntry);

module.exports = router;