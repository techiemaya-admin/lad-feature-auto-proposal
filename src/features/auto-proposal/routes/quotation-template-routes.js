const express = require('express');
const { tenantContext, enforceTenantParams } = require('../../../middleware/tenant-context');
const router = express.Router();

router.use(tenantContext);
enforceTenantParams(router);
const controller = require('../controllers/quotation-template.controller');
const { documentUpload } = require('../../../utils/upload');

// 1. Upload .docx
router.post('/upload/:tenantId', documentUpload.single('file'), controller.uploadTemplate);

// 2. Preview
router.get('/:id/preview', controller.getPreview);

// 3. Set Default
router.patch('/:tenantId/set-default/:id', controller.makeDefault);

// 4. Delete
router.delete('/:id', controller.remove);

// Route to get all templates for a tenant
router.get('/:tenantId', controller.getTemplates);

module.exports = router;