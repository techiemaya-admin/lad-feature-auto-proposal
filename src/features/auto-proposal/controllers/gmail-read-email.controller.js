//  Import service that talks to Gmail and processes messages
const gmailService = require("../services/gmail-read-email.service");
const logger = require('../../../utils/logger');

async function startWatch(req, res) {
  try {
    const tenantId = req.tenantId || req.headers?.['x-tenant-id'];
    const email = req.body?.email || req.query?.email;
    if (!tenantId || !email) {
      return res.status(400).json({
        error: "Both X-Tenant-Id header and email parameter are required to start a watch",
      });
    }
    logger.info("Initiating Gmail watch subscription", { tenantId, email });
    const result = await gmailService.startWatch(email, tenantId);
    logger.debug("Gmail watch initialized", { result });
    return res.json(result?.data || result);
  } catch (err) {
    logger.error("Error starting Gmail watch:", err);
    return res.status(500).json({ error: err.message });
  }
}

// This is the webhook endpoint that will be called by Google when there is a new email in the user's inbox. We will receive the email details in the request body and we can process it accordingly.

async function webhook(req, res) {

  // Log the incoming webhook request for debugging
  logger.debug('Received webhook:');

  // Start try to protect from exceptions. Any error should not cause the webhook to fail because Google expects a 200 response to consider the webhook successful. We can log the error and return a 200 response with an error message in the body.
  try {
    // Extract Pub/Sub message object sent by Google (request body shape: { message: { data: "base64-encoded-string", ...}}
    const message = req.body.message;

    // Decode base64 message.data into a JSON object (this is the payload Google encodes). The payload contains details about the email event, including the email address and historyId which we can use to fetch the new email details from Gmail API. Example :  data :{"emailAddress":"","historyId":"1234567890"}
    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString()
    );
    // print the decoded data for debugging
    logger.debug("Webhook data:", data);

    // Extract historyId from payload. The historyId is a unique identifier for the email event and can be used to fetch the new email details from Gmail API. 
    const historyId = data.historyId;

    // Log the historyId for debugging
    logger.debug("History ID:", historyId);

    // Call the service function to fetch new email details from Gmail API using the email address and historyId. The service function will use the Gmail API to fetch the new email details based on the historyId and process it accordingly (e.g. save to DB, trigger AI processing, lead requirement cretaed, calculated price, create quatotion, send to gcs,then create proposal draft .)
    await gmailService.fetchNewEmails(data.emailAddress, historyId);

    // Return a 200 response to acknowledge successful processing of the webhook. Google expects a 200 response to consider the webhook successful. We can also include a message in the response body for debugging purposes.
    res.status(200).send("Processed");

    // If there is any error during processing, catch it and log the error for debugging. We can return a 200 response with an error message in the body to acknowledge the webhook but indicate that there was an error during processing. This way, Google will not retry the webhook since we are returning a 200 status, but we can still log and monitor the errors in our system.
  } catch (err) {
    // Log the error for debugging
    logger.error("Error in webhook:", err);

    // Return a 200 response with an error message in the body to acknowledge the webhook but indicate that there was an error during processing. This way, Google will  not retry the webhook since we are returning a 200 status, but we can still log and monitor the errors in our system.
    res.status(200).send("Error");
  }
}



async function testprompt(req, res) {
  try {
    const body = req.body?.prompt || req.query?.prompt;
    const tenantId = req.tenantId || req.headers?.['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: "X-Tenant-Id header is required" });
    }
    if (!body) {
      return res.status(400).json({ error: "Prompt is required in request body or query" });
    }

    const leadData = {
      id: req.leadId || req.body?.leadId || req.body?.leadData?.id || "7cb0954d-ba2c-4224-969c-a3fa353a68fd",
      first_name: req.body?.first_name || req.body?.leadData?.first_name || "Test",
      last_name: req.body?.last_name || req.body?.leadData?.last_name || "Lead",
      email: req.body?.email || req.body?.leadData?.email || "test.lead@example.com",
      phone: req.body?.phone || req.body?.leadData?.phone || "1234567890",
    };

    logger.debug("Testing AI prompt in controller:", { prompt: body, tenantId, leadId: leadData.id });
    const { leadRequirementDetails, values } = await gmailService.createLeadRequirementViaPrompt(body, leadData.id, tenantId);
    logger.debug("Lead requirement details:", leadRequirementDetails);
    logger.debug("Saved requirement values:", values);
    const draft = await gmailService.createProposalDraft(leadRequirementDetails, leadData, body);

    return res.status(200).json({
      success: true,
      data: {
        leadRequirementDetails,
        values,
        draft
      }
    });
  } catch (error) {
    logger.error("Error in testprompt:", error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { startWatch, webhook, testprompt };