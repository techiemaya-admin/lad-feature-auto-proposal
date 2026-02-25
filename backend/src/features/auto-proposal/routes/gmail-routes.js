const express = require("express");
//This gives you the ability to create routes and APIs.
const router = express.Router();
const gmailController = require("../controllers/gmail.controller");
const gmailReadController = require("../controllers/gmail-read-email.controller");

router.get("/send-email", gmailController.sendEmail);
router.get("/read-emails", gmailController.readEmails);
router.post("/webhook", gmailReadController.webhook);
router.get("/test-prompt", gmailReadController.testprompt);
router.post("/watch", gmailReadController.startWatch);


module.exports = router;