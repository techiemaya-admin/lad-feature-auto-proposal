//  Import service that talks to Gmail and processes messages
const gmailService = require("../services/gmail-read-email.service");

const logger = require('../../../utils/logger');
const finalPriceCalculationService = require("../services/final-price-calculaton.service");
const aiResponseService = require("../services/ai-response.service");
const proposalDraftRepository = require("../repositories/proposal-draft.repository");
const { file } = require("pdfkit");

async function startWatch(req, res) {
  logger.info("Testing start watch>>")
  const result = await gmailService.startWatch();
  console.log(result)
  res.json(result.data);
}

// This is the webhook endpoint that will be called by Google when there is a new email in the user's inbox. We will receive the email details in the request body and we can process it accordingly.
async function webhook(req, res) {
  // Log the incoming webhook request for debugging
  console.log('Received webhook:');
  // Start try to protect from exceptions. Any error should not cause the webhook to fail because Google expects a 200 response to consider the webhook successful. We can log the error and return a 200 response with an error message in the body.
  try {
    // Extract Pub/Sub message object sent by Google (request body shape: { message: { data: "base64-encoded-string", ...}}
    const message = req.body.message;

    // Decode base64 message.data into a JSON object (this is the payload Google encodes). The payload contains details about the email event, including the email address and historyId which we can use to fetch the new email details from Gmail API. Example :  data :{"emailAddress":"","historyId":"1234567890"}
    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString()
    );
      // print the decoded data for debugging
    console.log("Webhook data:", data);

    // Extract historyId from payload. The historyId is a unique identifier for the email event and can be used to fetch the new email details from Gmail API. 
    const historyId = data.historyId;

    // Log the historyId for debugging
    console.log("History ID:", historyId);

    // Call the service function to fetch new email details from Gmail API using the email address and historyId. The service function will use the Gmail API to fetch the new email details based on the historyId and process it accordingly (e.g. save to DB, trigger AI processing, lead requirement cretaed, calculated price, create quatotion, send to gcs,then create proposal draft .)
    await gmailService.fetchNewEmails(data.emailAddress, historyId);

    // Return a 200 response to acknowledge successful processing of the webhook. Google expects a 200 response to consider the webhook successful. We can also include a message in the response body for debugging purposes.
    res.status(200).send("Processed");

    // If there is any error during processing, catch it and log the error for debugging. We can return a 200 response with an error message in the body to acknowledge the webhook but indicate that there was an error during processing. This way, Google will not retry the webhook since we are returning a 200 status, but we can still log and monitor the errors in our system.
  } catch (err) {
    // Log the error for debugging
    console.error(err);

    // Return a 200 response with an error message in the body to acknowledge the webhook but indicate that there was an error during processing. This way, Google will  not retry the webhook since we are returning a 200 status, but we can still log and monitor the errors in our system.
    res.status(200).send("Error");
  }
}



async function testprompt(req, res) {


  console.log("Testing AI prompt in controller : " + req.body.prompt);
  const leadDetails = await gmailService.createLeadRequirementViaPrompt(req.body.prompt);
  console.log("Lead details received in controller:", leadDetails);

  const calculatedPriceDetails = await finalPriceCalculationService.calculateFinalPrice(leadDetails.tenant_id, leadDetails.location, leadDetails.main_event_guests, leadDetails.catering_guests, leadDetails.function_hall_guests);
  console.log("Final price calculated:", calculatedPriceDetails);
  const formattedData = await gmailService.formatConceptPricingResponse(calculatedPriceDetails, leadDetails.location, leadDetails.main_event_guests, leadDetails.catering_guests, leadDetails.function_hall_guests, leadDetails.event_category);
  console.log("formatted>>>>>")
  console.log(formattedData);

  const matrixIds = calculatedPriceDetails.map(
    item => item.concept_pricing_matrix_id
  );
  const final_price = (formattedData.totalImpactPrice || 0) + (formattedData.totalLitePrice || 0);
  console.log(matrixIds);
  const prosalPathDetails = await aiResponseService.generateQuotationProposal(formattedData);
  const dataToSave = {
    tenant_id: leadDetails.tenant_id,
    lead_requirement_id: leadDetails.id,
    final_price: final_price,
    gcsUrl: prosalPathDetails.gcsUrl,
    file_name: prosalPathDetails.fileName,
    status: "DRAFTED",
    metadata: { formattedData },
    concept_pricing_matrix_ids: matrixIds
  }
  proposalDraftRepository.create(dataToSave)
  return res.json({ leadDetails, calculatedPriceDetails });
}

module.exports = { startWatch, webhook, testprompt };