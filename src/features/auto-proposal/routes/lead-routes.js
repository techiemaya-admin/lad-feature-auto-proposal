const express = require('express');
const { tenantContext } = require('../../../middleware/tenant-context');
const { validateBody } = require('../../../middleware/validate');
const leadController = require('../controllers/lead.controller');

const router = express.Router({ mergeParams: true });

router.use(tenantContext);

const createLeadSchema = {
  location_id: { type: 'string' },
  first_name: { type: 'string' },
  last_name: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  company_name: { type: 'string' },
  company_domain: { type: 'string' },
  title: { type: 'string' },
  linkedin_url: { type: 'string' },
  status: { type: 'string' },
  stage: { type: 'string' },
  notes: { type: 'string' },
  metadata: { type: 'object' },
  custom_fields: { type: 'object' },
  raw_data: { type: 'object' },
};

router.post('/', validateBody(createLeadSchema), leadController.create);
router.get('/', leadController.list);
router.get('/:id', leadController.getById);

module.exports = router;
