const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('../controllers/email-template.controller');
const upload = multer({ storage: multer.memoryStorage() });

// 1. Upload .docx
router.post('/upload/:tenantId', upload.single('file'), controller.upload);

// 2. Preview
router.get('/:id/preview', controller.getPreview);

// 3. Set Default
router.patch('/:tenantId/set-default/:id', controller.makeDefault);

// 4. Delete
router.delete('/:id', controller.remove);

// Route to get all templates for a tenant
router.get('/:tenantId', controller.getTemplates);

module.exports = router;