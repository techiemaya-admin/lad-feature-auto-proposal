const express = require("express");
const router = express.Router();
const socialIntegrationController = require("../controllers/social-integration.controller");
const authenticateJWT = require("../../../middleware/auth.middleware");

router.get('/email/google/callback', socialIntegrationController.googleCallback);

router.use(authenticateJWT);
router.post("/email/google/status", socialIntegrationController.getGoogleEmailStatus);
router.post("/email/google/start", socialIntegrationController.initiateGoogle);
router.post("/email/google/disconnect", socialIntegrationController.disconnectGoogle);

module.exports = router;
