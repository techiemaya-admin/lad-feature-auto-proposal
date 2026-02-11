const express = require('express');
const { tenantContext } = require('../../../../../src/middleware/tenant-context');
const quotationController = require('../controllers/quotation.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

router.post('/', quotationController.generate);
router.get('/:id', quotationController.getById);
router.get('/lead/:leadId', quotationController.listByLead);

module.exports = router;
