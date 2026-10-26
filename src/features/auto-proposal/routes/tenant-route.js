const express = require('express');
const tenantController = require('../controllers/tenant.controller');
const { validateBody } = require('../../../middleware/validate');
const { requirePlatformAdmin, isPlatformAdmin } = require('../../../middleware/auth.middleware');

const router = express.Router();

/** Platform admins may read any tenant; other callers only the tenant in their token. */
function requireAdminOrOwnTenant(req, res, next) {
  if (isPlatformAdmin(req) || req.params.id === req.tenantId) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

const createTenantSchema = { name: { required: true, type: 'string', min: 1, max: 255 }, slug: { type: 'string', max: 100 } };
router.post('/', requirePlatformAdmin, validateBody(createTenantSchema), tenantController.create);
router.get('/', requirePlatformAdmin, tenantController.list);
router.get('/:id', requireAdminOrOwnTenant, tenantController.getById);

module.exports = router;
