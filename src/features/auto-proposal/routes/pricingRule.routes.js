const express = require('express');
const router = express.Router();
const controller = require('../controllers/pricing-rule.controller');

router.post('/', controller.create);
router.get('/:tenant_id', controller.getAll);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;