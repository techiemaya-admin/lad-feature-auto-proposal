const express = require("express");
const router = express.Router();
const socialIntegrationController = require("../controllers/social-integration.controller");
const { tenantContext } = require("../../../middleware/tenant-context");

// Unauthenticated public callback target for Google OAuth redirection
router.get('/email/google/callback', socialIntegrationController.googleCallback);

// Apply tenant context resolution to protected routes
router.use(tenantContext);
router.get("/email/google/status", socialIntegrationController.getGoogleEmailStatus);
router.post("/email/google/status", socialIntegrationController.getGoogleEmailStatus);
router.post("/email/google/start", socialIntegrationController.initiateGoogle);
router.post("/email/google/disconnect", socialIntegrationController.disconnectGoogle);

module.exports = router;
