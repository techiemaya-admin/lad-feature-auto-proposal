const express = require("express");
const router = express.Router();
const controller = require("../controllers/proposal-draft.controller");

router.patch("/approve/:id", controller.approveProposalDraft);

module.exports = router;