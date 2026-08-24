//This gives you the ability to create routes and APIs.
//Import Express framework to create routes.
const express = require("express");

// This is router object or instance which we will use to define our routes or API endpoints.
const router = express.Router();

// Load gmail controller. This controller will have the logic to send and read emails using Gmail API.
const gmailController = require("../controllers/gmail.controller");

//  Load the controller that handles watch/webhook. This controller will have the logic to start watch and process incoming webhooks from Gmail.
const gmailReadController = require("../controllers/gmail-read-email.controller");

//  GET endpoint to trigger sending an email (mapped handler)
// create a GET endpoint at /send-email which will call the sendEmail function in gmailController when accessed.
router.get("/send-email", gmailController.sendEmail);

// create a GET endpoint at /read-email which will call the readEmail function in gmailController when accessed.
router.get("/read-emails", gmailController.readEmails);


// this is the webhook api which will be called by google when there is a new email in the inbox of the user who has authenticated and given permission to our app. We will receive the email details in the request body and we can process it accordingly.
// The Pub/Sub topic is configured to forward messages to your application’s HTTP endpoint, which is the /api/gmail/webhook route in this case. When a new email arrives in the user’s inbox, Google will send a POST request to this endpoint with the email details in the request body. We can then process the email details and perform any necessary actions.
// ngrok is a tool that allows you to expose a local development server to the internet. It creates a secure tunnel from a public URL to your local machine, allowing you to test webhooks and other integrations that require an internet-accessible endpoint. In this case, you can use ngrok to create a public URL for your local development server, which will allow Google’s Pub/Sub service to send webhook requests to your /api/gmail/webhook endpoint during development and testing.


router.post("/webhook", gmailReadController.webhook);

// GET to test the AI prompt path. This is just for testing the AI prompt and response flow without having to wait for an actual email to arrive in the inbox. We can send a POST request to this endpoint with a sample prompt in the request body and it will return the generated lead details, calculated price, formatted response, and proposal path details based on that prompt.
router.get("/test-prompt", gmailReadController.testprompt);

// POST endpoint to start watch. This will be called to start the watch on the user's Gmail inbox. It will call the startWatch function in gmailReadController which will set up the watch and Pub/Sub topic to receive notifications for new emails.
router.post("/watch", gmailReadController.startWatch);

// Export router for app mounting (in app.js it is mounted at /api/gmail, so all routes defined here will be prefixed with /api/gmail)
module.exports = router;