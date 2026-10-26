const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmail.controller");
const gmailReadController = require("../controllers/gmail-read-email.controller");
const { tenantContext } = require("../../../middleware/tenant-context");
const { verifyPubSubPush } = require("../../../middleware/pubsub-auth.middleware");

// Google Pub/Sub push webhook: no user JWT, but every push must carry Google's signed OIDC token
router.post("/webhook", verifyPubSubPush, gmailReadController.webhook);

// Enforce tenant isolation on all remaining Gmail endpoints
router.use(tenantContext);

// Deprecated legacy endpoints (return 410 Gone)
router.get("/send-email", gmailController.sendEmail);
router.get("/read-emails", gmailController.readEmails);

// AI prompt test endpoints (support both GET query and POST JSON payload)
router.get("/test-prompt", gmailReadController.testprompt);
router.post("/test-prompt", gmailReadController.testprompt);

// Watch initiation endpoint
router.post("/watch", gmailReadController.startWatch);

module.exports = router;