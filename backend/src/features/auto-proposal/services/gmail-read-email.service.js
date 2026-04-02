
//Lines 1–11: import googleapis client and various repositories/services used to save messages, call AI, calculate price, and manage watch history.

const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");

const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/conversationMessage.repository");
const { logger } = require("../../../utils/logger");
const aiService = require("./ai-response.service");
const leadRequirementRepository = require("../repositories/lead-requirement.repository");
const finalPriceCalculationService = require("./final-price-calculaton.service");
const userIdentityRepository = require("../repositories/user-identity.repository");
const gmailWatchService = require("./gmail-watch.service");
const proposalDraftRepository = require("../repositories/proposal-draft.repository");
const gmailWatchRepository = require("../repositories/gmail-watch.repository");
// Inside another service (e.g., MarketingService.js)
const leadService = require("./lead.service");
const CommonUtil = require("../../../utils/common-utils");
const leadRequirementValueRepo = require("../repositories/lead_requirement_values.repository");

//
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
  console.log(" snipper : " + emailData.snippet)
  console.log("raw payload : " + emailData)
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
  // the gmail.users.watch() API is used to start Gmail Push Notifications so that Gmail automatically notifies your system when something changes in the mailbox.

  // Instead of your server polling Gmail repeatedly, Gmail pushes events to Google Pub/Sub, and your webhook receives them.
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/phonic-agility-487809-e9/topics/gmail-read-send",
      labelIds: ["INBOX"],
    },
  });
  console.log("Watch response:", response.data);

  // After setting up the watch, we should save the historyId and expiration time in our database so that we can use it later to fetch new emails and also to know when to renew the watch. Here we are using a hardcoded user identity for demonstration, but in a real application, you would associate this with the actual user who authenticated their Gmail account.
  const userIdentityId = await userIdentityRepository.findByProvider(
    "gmail",
    "shweta.goel1711@gmail.com"
  );
  let tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
  // Save the watch details in the database (create or update)
  await gmailWatchService.initializeWatch({
    tenant_id: tenantId,
    user_identities_id: userIdentityId,
    history_id: response.data.historyId,
    expiration: response.data.expiration
  });
  return response.data;
}


async function fetchNewEmails(email, historyIdFromWebhook) {
  console.log("Fetching new emails for email:", email);
  const tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
  const userIdentityId = await userIdentityRepository.findByProvider(
    "gmail",
    email
  );

  if (userIdentityId != null) {
    const historyId = await gmailWatchService.getLastHistoryId(userIdentityId);
    console.log("Last history ID for userIdentityId", userIdentityId, "is", historyId);
    if (!historyId) {
      console.log("No history ID found for userIdentityId", userIdentityId, ". This might be the first time fetching emails for this user. Creating user identity record.");
      gmailWatchRepository.create({
        tenant_id: tenantId,
        user_identities_id: userIdentityId,
        history_id: historyIdFromWebhook
      });
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

          const headers = fullMessage.data.payload.headers;
          const subject = headers.find(h => h.name === "Subject")?.value || "";
          console.log("subject:  " + subject)
          const from = headers.find(h => h.name === "From")?.value || "";
          console.log("from: " + from)
          const contact = CommonUtil.parseContactInfo(from);
          console.log("contact: " + JSON.stringify(contact));
          const leadData = await triggerNewLeadAutomation(contact.firstName, contact.lastName, contact.email);
          console.log("Lead created from email:", leadData.id);
          const body = getEmailBody(fullMessage.data.payload);
          console.log("body : " + body)

          const { leadRequirementDetails, values } = await createLeadRequirementViaPrompt(body, leadData.id, tenantId);
          console.log("Lead requirement details:", leadRequirementDetails);
          console.log("Saved requirement values:", values);

          const calculatedPriceDetails = await finalPriceCalculationService.calculateFinalPrice(leadRequirementDetails.tenant_id, leadRequirementDetails.location, leadRequirementDetails.id);
          console.log("Final price calculated:", calculatedPriceDetails);
          calculatedPriceDetails.forEach(item => {
            console.log(`Concept: ${item.concept_name}, Final Price: ${item.final_price}, Breakdown: ${JSON.stringify(item.breakdown)}`);
          });
          // const formattedData = await formatConceptPricingResponse(calculatedPriceDetails, leadRequirementDetails);
          // console.log("formatted>>>>>")
          // console.log(formattedData);

          const matrixIds = calculatedPriceDetails.map(
            item => item.concept_pricing_matrix_id
          );
          console.log("Matrix ids : " + matrixIds);
          // const final_price = (formattedData.totalImpactPrice || 0) + (formattedData.totalLitePrice || 0);
          // console.log("Final price : " + final_price);
          const pricingDetails=calculatedPriceDetails.filter(item => item.concept_name.toLowerCase() === leadRequirementDetails.event_type.toLowerCase()).map(item => ({
            markup: item.markup,
            discount: item.discount}
          ))[0];

          const final_price = calculatedPriceDetails.reduce((sum, item) => sum + item.final_price, 0);
          console.log("Total detailed price (sum of all concepts): " + final_price);
          console.log("pricingDetails : " + JSON.stringify(pricingDetails));
          const prosalPathDetails = await aiService.generateQuotationProposal(calculatedPriceDetails,leadData, pricingDetails);
          const dataToSave = {
            tenant_id: leadRequirementDetails.tenant_id,
            lead_requirement_id: leadRequirementDetails.id,
            final_price: final_price,
            gcsUrl: prosalPathDetails.gcsUrl,
            file_name: prosalPathDetails.fileName,
            status: "DRAFTED",
            metadata:  calculatedPriceDetails,
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

/**
 * Dynamically formats the pricing response regardless of how many 
 * guest types or concepts (Lite, Impact, Premium, etc.) exist.
 */
async function formatConceptPricingResponse(results, leadRequirementDetails) {
  // 1. Initialize with basic lead info
  const data = {
    location: leadRequirementDetails.location || null,
    eventCategory: leadRequirementDetails.event_category,
    // We can spread the raw counts here if needed
    guestCounts: {}
  };

  for (const concept of results) {
    // Normalize concept name (e.g., "Lite" -> "lite", "IMPACT" -> "impact")
    const conceptSlug = concept.concept_name.toLowerCase();

    // 2. Map the dynamic breakdown prices
    // If breakdown has { main_event_price: 500, catering_price: 400 }
    // It will create data.main_event_lite_price = 500, etc.
    if (concept.breakdown) {
      for (const [fieldKey, price] of Object.entries(concept.breakdown)) {
        // Construct a dynamic key: e.g., "main_event_lite_price"
        const responseKey = `${fieldKey.replace('_price', '')}_${conceptSlug}_price`;

        // Convert snake_case to camelCase (optional, but follows your style)
        // main_event_lite_price -> mainEventLitePrice
        const camelKey = responseKey.replace(/([-_][a-z])/g, group =>
          group.toUpperCase().replace('-', '').replace('_', '')
        );

        data[camelKey] = price;
      }
    }

    // 3. Add the total for this concept
    // e.g., totalLitePrice, totalImpactPrice
    const totalKey = `total${conceptSlug.charAt(0).toUpperCase() + conceptSlug.slice(1)}Price`;
    data[totalKey] = concept.final_price;

    // Check if minimum cost was applied for transparency
    data[`is${conceptSlug.charAt(0).toUpperCase() + conceptSlug.slice(1)}MinApplied`] = concept.is_minimum_cost_applied;
  }

  return data;
}

async function triggerNewLeadAutomation(first_name, last_name, email) {
  console.log("Triggering new lead automation for:", first_name, last_name, email);
  const dummyTenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
  const dummyUserId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"; // Optional

  const dummyLeadData = {
    // Identity & Contact
    first_name: first_name,
    last_name: last_name,
    email: email,
    phone: "+15550102030",

    // Company Info
    company_name: "Wonderland Adventures",
    company_domain: "wonderland.com",
    title: "Chief Explorer",

    // Lead Metadata
    source: "Website Form",
    source_id: "form_12345",
    status: "active",
    stage: "discovery",
    priority: 2, // Medium-High

    // JSON / Complex Fields
    tags: ["High Value", "Q2-Target", "Inbound"],
    custom_fields: {
      discovery_call_booked: false,
      product_line: "Enterprise Software",
      estimated_users: 150
    },

    // Optional / Extra Data
    notes: null,
    estimated_value: null,
    currency: null,
    country_code: null
  };

  try {
    const createdLead = await leadService.createLead(
      dummyTenantId,
      dummyLeadData,
      dummyUserId
    );

    console.log("Service call successful! New Lead ID:", createdLead.id);
    return createdLead;
  } catch (error) {
    console.error("Failed to create lead via service:", error.message);
  }
}

async function createLeadRequirementViaPrompt(body, lead_id, tenant_id) {

  try {

    console.log("Testing AI prompt :", body);
    const response = await aiService.generateAIResponse(
      body, tenant_id
    );
    console.log("Generated AI response:", response);
    response.lead_id = lead_id;
    response.tenant_id = tenant_id;
    const leadRequirementDetails = await leadRequirementRepository.create(response);
    const results = await leadRequirementValueRepo.saveRequirementValues(tenant_id, leadRequirementDetails.id, response.guest_counts);
    return { leadRequirementDetails: leadRequirementDetails, values: results };
  } catch (err) {
    console.error("Error in createLeadRequirementViaPrompt:", err.message);
  }
}

module.exports = { startWatch, fetchNewEmails, createLeadRequirementViaPrompt, formatConceptPricingResponse };