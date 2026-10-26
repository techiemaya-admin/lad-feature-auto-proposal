const express = require('express');
const tenantController = require('../controllers/tenant.controller');
const { validateBody } = require('../../../middleware/validate');
const { requirePlatformAdmin, isPlatformAdmin } = require('../../../middleware/auth');

const router = express.Router();

/** Platform admins may read any tenant; other callers only their own token's tenant. */
function requireAdminOrOwnTenant(req, res, next) {
  if (isPlatformAdmin(req) || (req.auth.tenantId && req.auth.tenantId === req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

const createTenantSchema = { name: { required: true, type: 'string', min: 1, max: 255 }, slug: { type: 'string', max: 100 } };
router.post('/', requirePlatformAdmin, validateBody(createTenantSchema), tenantController.create);
router.get('/', requirePlatformAdmin, tenantController.list);
router.get('/:id', requireAdminOrOwnTenant, tenantController.getById);

module.exports = router;
