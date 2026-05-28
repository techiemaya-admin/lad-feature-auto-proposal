const express = require('express');
const { validateBody } = require('../../../middleware/validate');
const conceptController = require('../controllers/concept.controller');

const router = express.Router({ mergeParams: true });

const createConceptSchema = { name: { required: true, type: 'string', min: 1, max: 255 }, code: { type: 'string', max: 50 }, description: { type: 'string' } };
router.post('/', validateBody(createConceptSchema), conceptController.create);
router.get('/:tenant_id', conceptController.list);
router.put('/:id', validateBody(createConceptSchema), conceptController.update);
router.delete('/:id', conceptController.remove);

module.exports = router;
