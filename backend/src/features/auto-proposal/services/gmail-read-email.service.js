const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");

const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/conversationMessage.repository");
const { logger } = require("../../../utils/logger");
const aiService = require("./ai-response.service");
const leadRequirementRepository = require("../repositories/lead-requirement.repository");  
const finalPriceCalculationService = require("./final-price-calculaton.service");
const userIdentityRepository=require("../repositories/user-identity.repository");
const gmailWatchService = require("./gmail-watch.service");
const proposalDraftRepository = require("../repositories/proposal-draft.repository");
const gmailWatchRepository = require("../repositories/gmail-watch.repository");



async function saveEmailToDB(emailData, tenantId) {
  const threadId = emailData.threadId;
console.log("Saving email to DB, threadId:", threadId);
  let conversation = await conversationRepository.findByThreadId(threadId);

  if (!conversation) {
    conversation = await conversationRepository.createConversation({
      tenant_id: tenantId,
      channel: "gmail",
      external_thread_id: threadId,
      status: "open",
      last_message_at: new Date(),
      metadata: {},
    });
  }
console.log("Conversation found/created:", conversation.id);
console.log(" snipper : "+emailData.snippet)
console.log("raw payload : "+emailData)
  await messageRepository.createMessage({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    sender_type: "external",
    channel: "gmail",
    message_type: "text",
    content: emailData.snippet,
    raw_payload: emailData,
  });
}

/* 1️⃣ Start Gmail Watch */
async function startWatch() {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  var json= await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/phonic-agility-487809-e9/topics/gmail-read-send",
      labelIds: ["INBOX"],
    },
  });
  return json;
}

/* 2️⃣ Fetch Email Using History ID */
async function fetchNewEmails(email,historyIdFromWebhook) {
  console.log("Fetching new emails for email:", email);
  const userIdentityId=await userIdentityRepository.findByProvider(
  "gmail",
  email
);
  const historyId = await gmailWatchService.getLastHistoryId(userIdentityId);
  console.log("Last history ID for userIdentityId", userIdentityId, "is", historyId);
  if(!historyId){
    console.log("No history ID found for userIdentityId", userIdentityId, ". This might be the first time fetching emails for this user. Creating user identity record.");
    gmailWatchRepository.create({
      tenant_id: "550e8400-e29b-41d4-a716-446655440001",
      user_identities_id: userIdentityId,
      history_id: historyIdFromWebhook});
  }

  console.log("Fetching new emails with historyId:", historyId);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const history = await gmail.users.history.list({
    userId: "me",
    startHistoryId: historyId || historyIdFromWebhook,
    historyTypes: ["messageAdded"],
  });
console.log("History response:", history.data);
  const messages = history.data.history || [];
  // console.log("messages : "+messages)

  for (const record of messages) {
    if (record.messages) {
      for (const msg of record.messages) {
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
        });

        const threadId = fullMessage.data.threadId;
        const messageId = fullMessage.data.id;

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === "Subject")?.value || "";
        console.log("subject:  "+subject)
        const from = headers.find(h => h.name === "From")?.value || "";
console.log("from: "+from)
        const body = getEmailBody(fullMessage.data.payload);
console.log("body : "+body)


      const leadDetails= await createLeadRequirementViaPrompt(body);
        console.log("Generated AI response:", leadDetails);

        const calculatedPriceDetails = await finalPriceCalculationService.calculateFinalPrice(leadDetails.tenant_id, leadDetails.location, leadDetails.main_event_guests,leadDetails.catering_guests, leadDetails.function_hall_guests);
        console.log("Final price calculated:", calculatedPriceDetails);
        const formattedData = await formatConceptPricingResponse(calculatedPriceDetails, leadDetails.location, leadDetails.main_event_guests, leadDetails.catering_guests, leadDetails.function_hall_guests, leadDetails.event_category);
        console.log("formatted>>>>>")
        console.log(formattedData);

    const matrixIds = calculatedPriceDetails.map(
      item => item.concept_pricing_matrix_id
    );
    const final_price=(formattedData.totalImpactPrice || 0) + (formattedData.totalLitePrice || 0);
    console.log(matrixIds);
            const prosalPathDetails =await aiService.generateQuotationProposal(formattedData);
            const dataToSave = {
                tenant_id: leadDetails.tenant_id,
                lead_requirement_id: leadDetails.id,
                final_price: final_price,
              gcsUrl: prosalPathDetails.gcsUrl,
              file_name: prosalPathDetails.fileName,
                status: "DRAFTED",
                metadata: {formattedData},
                concept_pricing_matrix_ids: matrixIds
              }
            proposalDraftRepository.create(dataToSave)
            
// process emails...

      await gmailWatchService.updateHistoryId(
        userIdentityId,
        history.data.historyId
      );
      }
    }
  }
}


function getEmailBody(payload) {
  let body = "";

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        body = Buffer.from(part.body.data, "base64")
          .toString("utf-8");
        break;
      }

      if (part.mimeType === "text/html" && part.body.data) {
        body = Buffer.from(part.body.data, "base64")
          .toString("utf-8");
      }
    }
  } else if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, "base64")
      .toString("utf-8");
  }

  return body;
}



    async function formatConceptPricingResponse(
  results,
  locationName,
  mainEventGuestCount,
  cateringGuestCount,
  functionHallGuestCount,
  eventCategory) {
  const data = {
    location: locationName || null,
    mainEventGuestCount,
    cateringGuestCount,
    functionHallGuestCount,
    eventCategory,
  };

  for (const concept of results) {
    const conceptName = concept.concept_name.toUpperCase();

    if (conceptName === "LITE") {
      data.mainEventGuestLitePrice =
        concept.breakdown.main_event_price;

      data.cateringGuestLitePrice =
        concept.breakdown.catering_price;

      data.functionHallGuestLitePrice =
        concept.breakdown.functionhall_price;

      data.totalLitePrice = concept.final_price;
    }

    if (conceptName === "IMPACT") {
      data.mainEventGuestImpactPrice =
        concept.breakdown.main_event_price;

      data.cateringGuestImpactPrice =
        concept.breakdown.catering_price;

      data.functionHallGuestImpactPrice =
        concept.breakdown.functionhall_price;

      data.totalImpactPrice = concept.final_price;
    }
  }

  return data;
}

async function createLeadRequirementViaPrompt(body) {

try {
  console.log("Testing AI prompt :", body);
    const response = await aiService.generateAIResponse(
      body
    );
    console.log("Generated AI response:", response);
    const leadDetails=leadRequirementRepository.create(response);
    return leadDetails;
  } catch (err) {
    console.error("Error in createLeadRequirementViaPrompt:", err.message);
  }
}

module.exports = { startWatch, fetchNewEmails , createLeadRequirementViaPrompt, formatConceptPricingResponse};