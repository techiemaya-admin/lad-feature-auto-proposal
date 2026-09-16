const express = require("express");
const router = express.Router();
const controller = require("../controllers/proposal-draft.controller");
const { tenantContext } = require("../../../middleware/tenant-context");

router.use(tenantContext);
router.patch("/approve/:id", controller.approveProposalDraft);

module.exports = router;