const express = require('express');
const { tenantContext, enforceTenantParams } = require('../../../middleware/tenant-context');
const router = express.Router();

router.use(tenantContext);
enforceTenantParams(router);
const controller = require('../controllers/tenant-profile.controller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Get profile details
router.get('/:tenantId', controller.getProfile);

// Update an individual column
// PATCH is best here as we are doing a partial update
router.patch('/:tenantId/update-field', controller.updateField);

// API 1: Upload Logo
router.post('/:tenantId/logo', upload.single('logo'), controller.uploadLogo);

// API 2: Preview Logo
router.get('/:tenantId/logo/preview', controller.getLogoPreview);

module.exports = router;