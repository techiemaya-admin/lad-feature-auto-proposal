const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const { validateBody } = require('../../../middleware/validate');
const quotationTemplateController = require('../controllers/quotation-template.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

const createTemplateSchema = {
  name: { required: true, type: 'string', min: 1, max: 255 },
  template_key: { type: 'string', max: 255 },
  structure: { type: 'object' },
  is_default: { type: 'boolean' },
};

router.post('/', validateBody(createTemplateSchema), quotationTemplateController.create);
router.get('/', quotationTemplateController.list);
router.get('/:id', quotationTemplateController.getById);
router.post('/:id/default', quotationTemplateController.setDefault);

module.exports = router;
