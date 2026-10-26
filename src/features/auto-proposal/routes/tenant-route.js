const express = require('express');
const tenantController = require('../controllers/tenant.controller');
const { validateBody } = require('../../../middleware/validate');

const router = express.Router();

const createTenantSchema = { name: { required: true, type: 'string', min: 1, max: 255 }, slug: { type: 'string', max: 100 } };
router.post('/', validateBody(createTenantSchema), tenantController.create);
router.get('/', tenantController.list);
router.get('/:id', tenantController.getById);

module.exports = router;
