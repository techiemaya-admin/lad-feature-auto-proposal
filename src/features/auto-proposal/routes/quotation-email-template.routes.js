// routes/quotationEmail.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/quotation-email-template.controller');
// const auth = require('../middleware/auth'); // Should provide req.user.tenant_id

router.post('/:tenantId', controller.create);
router.get('/:tenantId', controller.list);
router.get('/:tenantId/id/:id', controller.getById);
router.put('/:tenantId/id/:id', controller.update);
router.delete('/:tenantId/id/:id', controller.remove);
router.patch('/:tenantId/set-default/:id', controller.makeDefault);
module.exports = router;