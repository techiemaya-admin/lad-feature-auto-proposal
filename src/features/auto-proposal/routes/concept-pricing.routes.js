const express = require('express');
const router = express.Router({ mergeParams: true });
const matrixController = require('../controllers/concept-pricing.controller');

router.post('/', matrixController.create);
router.get('/:tenant_id', matrixController.listAll);
router.get('/concept/:conceptId', matrixController.listByConcept);
router.put('/:id', matrixController.update);
router.delete('/:id', matrixController.deleteEntry);

module.exports = router;