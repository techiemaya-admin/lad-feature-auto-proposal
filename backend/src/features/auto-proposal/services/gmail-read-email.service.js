
//Lines 1–11: import googleapis client and various repositories/services used to save messages, call AI, calculate price, and manage watch history.

const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");

const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/conversation-message.repository");
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
const tenatDetailsRepo = require("../repositories/tenant.repository");
const leadRepository = require("../repositories/lead.repository");
const conversationParticipantsRepository = require("../repositories/conversation-participants.repository");
const gmailSendService = require("./gmail-send-email.service");
const placeHolderBuilder = require('../../../utils/placeHolderBuilder');
const PlaceHolderBuilder = require("../../../utils/placeHolderBuilder");
const tenantProfileService = require("./tenant-profile.service");
const conversationService = require("./conversation.service");

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

async function createProposalDraft(leadRequirementDetails, leadData, email_content, conversation_id, global_message_id, threadId, subject) {
  console.log("Calculating final price for conversationid :", conversation_id, " lead requirement details :", leadRequirementDetails, " lead data : ", leadData, " email content : ", email_content);
  const calculatedPriceDetails = await finalPriceCalculationService.calculateFinalPrice(leadRequirementDetails.tenant_id, leadRequirementDetails.id, email_content, leadRequirementDetails.event_type);
  calculatedPriceDetails.breakdown.sort((a, b) => {
    const aPrice = a.price || 0;
    const bPrice = b.price || 0;

    // Standard "Zero to Bottom" Logic:
    // If a is 0 and b is > 0, a moves down (returns 1)
    // If a is > 0 and b is 0, a moves up (returns -1)
    if (aPrice === 0 && bPrice > 0) return 1;
    if (aPrice > 0 && bPrice === 0) return -1;
    return 0; // Keep original order for items with same price status
  });
  console.log("Final price calculated:", calculatedPriceDetails);

  if (calculatedPriceDetails.final_price != 0) {

    const tenantDetails = await tenatDetailsRepo.findById(leadRequirementDetails.tenant_id);
    const tenantProfileDetails = await tenantProfileService.getProfile(leadRequirementDetails.tenant_id);
    console.log("tenantDetails : " + JSON.stringify(tenantDetails));
    console.log("lead data : " + JSON.stringify(leadData))
    console.log("tenant profile details : " + JSON.stringify(tenantProfileDetails))
    const items = calculatedPriceDetails.breakdown.map(item => ({
      qty: item.count,
      description: item.label,
      unit_price: item.base_unit_price,
      line_total: item.price
    }));
    const placeholderBuilderForEmail = new PlaceHolderBuilder()
      .setBulk({
        lead_name: leadData.first_name + " " + leadData.last_name,
        lead_email: leadData.email || '',
        company_name: tenantDetails.name || '',
        company_email: tenantProfileDetails.official_email || '',
        company_phone: tenantDetails.phone,
        company_website: tenantDetails.website || '',
        company_logo: tenantProfileDetails.company_logo_url || '',
        company_tagline: tenantProfileDetails.tagline || '',
        instagram_url: tenantProfileDetails.instagram_url || '',
        linkedin_url: tenantProfileDetails.linkedin_url || '',
        whatsapp_url: tenantProfileDetails.whatsapp_url || '',
        total_base_price: calculatedPriceDetails.total_base_price,
        total_discount: calculatedPriceDetails.total_concept_discount,
        total_surcharge: calculatedPriceDetails.total_concept_surcharge,
        final_price: calculatedPriceDetails.final_price,
        items: items,
        date: Date.now()
      })
      .build();
    const prosalPathDetails = await aiService.generateProposalFromTemplate(placeholderBuilderForEmail, leadRequirementDetails.tenant_id);

    await gmailSendService.processAndSendDefaultEmailFromDragDrop(leadRequirementDetails.tenant_id, placeholderBuilderForEmail, prosalPathDetails.gcsUrl, calculatedPriceDetails.final_price, conversation_id, global_message_id, threadId, subject);

    const dataToSave = {
      tenant_id: leadRequirementDetails.tenant_id,
      lead_requirement_id: leadRequirementDetails.id,
      final_price: calculatedPriceDetails.final_price,
      gcsUrl: prosalPathDetails.gcsUrl,
      file_name: prosalPathDetails.fileName,
      status: "DRAFTED",
      metadata: calculatedPriceDetails,
      calculation_snapshot: calculatedPriceDetails,
      pricing_rule_ids: calculatedPriceDetails.applied_package_rules
    }
    proposalDraftRepository.create(dataToSave)
  } else { console.log("quotation should not be made due to price valued is ZERO") }

}

function isSystemGenerated(headers) {
  const headerMap = {};
  headers.forEach(h => { headerMap[h.name.toLowerCase()] = h.value.toLowerCase(); });

  // A. List-Unsubscribe: Real leads don't have "Unsubscribe" buttons in their headers.
  if (headerMap['list-unsubscribe']) return true;

  // B. List-ID: Real people don't have List-IDs (YouTube, LinkedIn, Newsletters do).
  if (headerMap['list-id']) return true;

  // C. Auto-Submitted: Catch-all for "auto-generated" notifications.
  if (headerMap['auto-submitted'] && headerMap['auto-submitted'] !== 'no') return true;

  // D. Precedence: Values like 'bulk', 'list', or 'junk'.
  if (headerMap['precedence'] && ['bulk', 'list', 'junk'].includes(headerMap['precedence'])) return true;

  // E. No-Reply From Address:
  const from = headerMap['from'] || "";
  if (/no-reply|noreply|notification|donotreply/i.test(from)) return true;

  return false;
}
function extractGmailData(fullMessage) {
  const headers = fullMessage.data.payload.headers;
  const payload = fullMessage.data.payload;
  const globalMsgId = headers.find(h => h.name.toLowerCase() === 'message-id')?.value;
  console.log("Global Message ID from headers:", globalMsgId);

  // 1. Extract "From"
  const fromHeader = headers.find(h => h.name === 'From')?.value || "";
  const emailMatch = fromHeader.match(/<(.+)>|(\S+@\S+)/);
  const senderEmail = emailMatch ? (emailMatch[1] || emailMatch[2]) : null;

  // 2. Extract Subject
  const subject = headers.find(h => h.name === 'Subject')?.value || "No Subject";

  // 3. Extract Full Body Content
  let body = "";

  const getBody = (part) => {
    if (part.body && part.body.data) {
      // Decode Base64URL to UTF-8 string
      const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
      body += decoded;
    }
    if (part.parts) {
      part.parts.forEach(getBody);
    }
  };

  // Gmail emails can be complex (multipart/alternative, etc.)
  // We prioritize HTML if available, otherwise Plain Text
  if (payload.parts) {
    // Look for the HTML part specifically first
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');

    if (htmlPart) getBody(htmlPart);
    else if (textPart) getBody(textPart);
    else payload.parts.forEach(getBody);
  } else {
    getBody(payload);
  }

  return {
    threadId: fullMessage.data.threadId,
    messageId: fullMessage.data.id,
    globalMessageId: globalMsgId,
    senderEmail: senderEmail,
    subject: subject,
    // This is the full decoded content for your 'content' column
    content: body || fullMessage.data.snippet,
    raw: fullMessage.data
  };
}

async function processIncomingEmail(tenantId, fullMessage, lead_id, messageId) {
  const headers = fullMessage.data.payload.headers;
  if (isSystemGenerated(headers)) {
    console.log("Dropping system notification/marketing email.");
    return;
  }
  const emailData = extractGmailData(fullMessage);

  console.log("Processing incoming email for tenant: {} , and emailData: {}", tenantId, emailData);

  // 2. Upsert the Conversation
  // This uses threadId to group messages into a single chat history
  const conversation = await conversationRepository.upsertByThread({
    tenant_id: tenantId,
    lead_id: lead_id,
    external_thread_id: emailData.threadId,
    channel: 'email',
    metadata: { subject: emailData.subject }
  });

  console.log("Conversation upserted with ID:", conversation);

  // 3. Ensure the Lead is a Participant
  // You can check if they exist first, or write the repo to handle conflicts
  await conversationParticipantsRepository.addParticipant(
    conversation.id,
    'lead',
    lead_id
  );

  // 4. Save the Message
  // We set sender_type to 'lead' so your UI knows who sent it
  const message = await messageRepository.createMessage({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    sender_type: 'lead',
    sender_id: lead_id,
    channel: 'email',
    message_type: 'text',
    content: emailData.content, // Or your parsed full body
    raw_payload: emailData.raw,
    message_id: messageId, // Save the Gmail message ID for reference
    global_message_id: emailData.globalMessageId // Save the Gmail global message ID for reference
  });
  console.log("Message saved with conversation ID:", conversation.id);
  const result = {
    conversation_id: conversation.id,
    threadId: emailData.threadId,
    messageId: emailData.messageId,
    global_message_id: emailData.globalMessageId
  }
  return result;
}

async function fetchNewEmails(email, historyIdFromWebhook) {
  console.log("Fetching new emails for email:", email);
  const tenantId = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5";
  const tenatDetails = await tenatDetailsRepo.findById(tenantId);
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

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId || historyIdFromWebhook,
      historyTypes: ["messageAdded"],
    });
    console.log("History response:", history.data);
    const messages = history.data.history || [];

    for (const record of messages) {
      if (record.messages) {
        for (const msg of record.messages) {
          const messageId = msg.id;
          const existingMessage = await messageRepository.findByMessageId(messageId);
          if (existingMessage) {
            console.log("Message with ID", messageId, "already exists in the database. Skipping.");
            continue;
          }

          const fullMessage = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
          });

          const headers = fullMessage.data.payload.headers;
          const subject = headers.find(h => h.name === "Subject")?.value || "";
          const from = headers.find(h => h.name === "From")?.value || "";
          const contact = CommonUtil.parseContactInfo(from);
          const body = getEmailBody(fullMessage.data.payload);
          console.log("subject: " + subject + " from : " + from + " contact: " + JSON.stringify(contact) + " body : " + body);
console.log("Checking if email is system generated...");
          if (contact && contact.email != email) {
            const leadData = await triggerNewLeadAutomation(contact.firstName, contact.lastName, contact.email);
            console.log("Lead created from email:", leadData.id);

            const result = await processIncomingEmail(tenantId, fullMessage, leadData.id, messageId);
            const conversation_id = result.conversation_id;
            const threadId = result.threadId;
            const global_message_id = result.global_message_id;
            console.log("Email saved to conversation with ID:", conversation_id);
            if (tenatDetails.email != from && conversation_id != null && conversation_id != undefined) {
              const resultToReturn = await createLeadRequirementViaPrompt(body, leadData.id, tenantId, conversation_id);
              const type = resultToReturn.type;
              const leadRequirementDetails = resultToReturn.leadRequirementDetails;
              const values = resultToReturn.values;
              const content = resultToReturn.content;
              if (type === "DISCOVERY_EMAIL") {
                console.log("The email was classified as a DISCOVERY_EMAIL. No lead requirement was created. AI's suggested email reply content:", content);
                const reSendSubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
                const gmailResponse = gmailSendService.sendGmailRaw({
                  to: contact.email,
                  subject: reSendSubject,
                  html: content,
                  messageId: global_message_id,
                  threadId: threadId
                });
                await conversationService.createConversationAndConversationMessages(tenantId, contact.email, reSendSubject, content, [], gmailResponse.id);
              }
              else {
                console.log("Lead requirement details:", leadRequirementDetails);
                console.log("Saved requirement values:", values);

                await createProposalDraft(leadRequirementDetails, leadData, body, conversation_id,global_message_id, threadId,subject);
                // // process emails...
              }
            } else {
              console.log("Email is from tenant's own email address, skipping lead creation and proposal drafting.");
            }
          }
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

async function createLeadRequirementViaPrompt(body, lead_id, tenant_id, conversation_id) {
  console.log(lead_id)
  try {

    console.log("Testing AI prompt :", body);
    const response =
      await aiService.generateAIResponse(body, tenant_id, conversation_id);

    // {
    //   "dynamic_requirements": {
    //     "main event guest count": 100,
    //     "catering": null,
    //     "function_hall": null,
    //     "Videography": 1,
    //     "AV Equipment" : 1
    //   },
    //   "location": null,
    //   "event_category": "wedding",
    //   "event_type": "Technical",
    //   "support_level": "full_event_management",
    //   "inquiry_type": "pricing",
    //   "duration": null,
    //   "client_type": "B2C",
    //   "services_requested": [
    //     "venue coordination",
    //     "décor",
    //     "wedding photography and videography",
    //     "overall event execution",
    //     "catering services",
    //     "function hall arrangement"
    //   ]
    // }



    console.log("Generated AI response:", response);
    if (response.type === "DISCOVERY_EMAIL") {
      console.log("Received a general inquiry. No lead requirement will be created. AI's suggested email reply:", response.content);
      return response;
    }
    const data = response.data;
    data.lead_id = lead_id;
    data.tenant_id = tenant_id;
    const leadRequirementDetails = await leadRequirementRepository.create(data);
    console.log("Lead requirement created with :", leadRequirementDetails);

    const results = await leadRequirementValueRepo.saveRequirementValues(tenant_id, leadRequirementDetails.id, data.dynamic_requirements);
    const resultToReturn = { type: "PROPOSAL_DATA", leadRequirementDetails: leadRequirementDetails, values: results }
    return resultToReturn;
  } catch (err) {
    console.error("Error in createLeadRequirementViaPrompt:", err);
  }
}

module.exports = { startWatch, fetchNewEmails, createLeadRequirementViaPrompt, formatConceptPricingResponse, createProposalDraft };