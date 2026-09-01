
//Lines 1–11: import googleapis client and various repositories/services used to save messages, call AI, calculate price, and manage watch history.

const { google } = require("googleapis");
const googleConfig = require("../../../config/google.config");

const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/conversation-message.repository");
const logger = require("../../../utils/logger");
const aiService = require("./ai-response.service");
const leadRequirementRepository = require("../repositories/lead-requirement.repository");
const finalPriceCalculationRepository = require("../repositories/final-price-calculation.repository");
const userIdentityRepository = require("../repositories/user-identity.repository");
const gmailWatchService = require("./gmail-watch.service");
const proposalDraftRepository = require("../repositories/proposal-draft.repository");
const gmailWatchRepository = require("../repositories/gmail-watch.repository");
// Inside another service (e.g., MarketingService.js)
const leadService = require("./lead.service");
const { parseContactInfo } = require("../../../utils/common-utils");
const leadRequirementValueRepo = require("../repositories/lead_requirement_values.repository");
const tenatDetailsRepo = require("../repositories/tenant.repository");
const leadRepository = require("../repositories/lead.repository");
const conversationParticipantsRepository = require("../repositories/conversation-participants.repository");
const gmailSendService = require("./gmail-send-email.service");
const PlaceHolderBuilder = require('../../../utils/placeHolderBuilder');
const tenantProfileRepository = require("../repositories/tenant-profile.repository");
const conversationService = require("./conversation.service");
const lead_requirement_configRepository = require("../repositories/lead_requirement_config.repository");
const proposalDraftItemsRepository = require("../repositories/proposal-draft-items.repository");

/* 1️⃣ Start Gmail Watch */
async function startWatch(email, tenantId) {
  const oAuth2Client = await googleConfig.getGoogleClientForUser(email);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  // the gmail.users.watch() API is used to start Gmail Push Notifications so that Gmail automatically notifies your system when something changes in the mailbox.

  // Instead of your server polling Gmail repeatedly, Gmail pushes events to Google Pub/Sub, and your webhook receives them.
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: process.env.GOOGLE_PUBSUB_TOPIC || "projects/lad-develop/topics/gmail-read-send",
      labelIds: ["INBOX"],
    },
  });
  logger.info("Watch subscription initialized", { email, tenantId, historyId: response.data.historyId });

  // After setting up the watch, we should save the historyId and expiration time in our database so that we can use it later to fetch new emails and also to know when to renew the watch. Here we are using a hardcoded user identity for demonstration, but in a real application, you would associate this with the actual user who authenticated their Gmail account.
  const userIdentityId = await userIdentityRepository.findByProvider(
    "gmail",
    email
  );

  // Save the watch details in the database (create or update)
  await gmailWatchService.initializeWatch({
    tenant_id: tenantId,
    user_identities_id: userIdentityId,
    history_id: response.data.historyId,
    expiration: response.data.expiration
  });
  return response.data;
}

async function createProposalDraft(leadRequirementDetails, leadData, email_content, conversation_id, global_message_id, threadId, subject, oAuth2Client, content) {
  logger.debug("Calculating final price for conversationid :", conversation_id, " lead requirement details :", leadRequirementDetails, " lead data : ", leadData, " email content : ", email_content);
  const calculatedPriceDetails = await finalPriceCalculationRepository.generateFinalPrice(leadRequirementDetails.tenant_id, leadRequirementDetails.id, email_content, leadRequirementDetails.event_type);
  const leadRequirementValues = await leadRequirementValueRepo.findByRequirementId(leadRequirementDetails.id);
  const services_given = leadRequirementValues.map(v => v.label).join(', ');
  logger.debug("Services given to tenant: ", services_given);
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
  logger.debug("Final price calculated:", calculatedPriceDetails);

  if (calculatedPriceDetails.final_price != 0) {

    const tenantDetails = (await tenatDetailsRepo.findById(leadRequirementDetails.tenant_id)) || {};
    const tenantProfileDetails = (await tenantProfileRepository.findByTenantId(leadRequirementDetails.tenant_id)) || {};
    logger.debug("tenantDetails : " + JSON.stringify(tenantDetails));
    logger.debug("lead data : " + JSON.stringify(leadData));
    logger.debug("tenant profile details : " + JSON.stringify(tenantProfileDetails));
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
        date: Date.now(),
        event_category: leadRequirementDetails.event_category,
        services_given: services_given,
        discount_percentage: ' (' + calculatedPriceDetails.total_discount_percentage + '%)',
        surcharge_percentage: ' (' + calculatedPriceDetails.total_surcharge_percentage + '%)',
      })
      .build();
    const prosalPathDetails = await aiService.generateProposalFromTemplate(placeholderBuilderForEmail, leadRequirementDetails.tenant_id);

    const emailResult = await gmailSendService.processAndSendDefaultEmailFromDragDrop(leadRequirementDetails.tenant_id, placeholderBuilderForEmail, prosalPathDetails.gcsUrl, calculatedPriceDetails.final_price, conversation_id, global_message_id, threadId, subject, oAuth2Client, content);

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
    const proposalDraft = await proposalDraftRepository.create(dataToSave);
    logger.info("Proposal draft created with ID:", proposalDraft.id);
    try {

      let messageData = emailResult?.messageData;
      if (messageData) {
        messageData.proposal_draft_id = proposalDraft.id;

        // Call your specific method
        const savedMsg = await messageRepository.createMessage(messageData);
        logger.info("Message archived in DB:", savedMsg.id);
      }

    } catch (dbError) {
      // Log the error but don't stop the process since the email was already sent
      logger.error("Archive Error: Failed to save sent email to DB.", dbError);
    }
    return proposalDraft;
  } else {
    logger.info("quotation should not be made due to price valued is ZERO");
    return null;
  }

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
  if (/no-reply|instagram.com|youtube.com|noreply|notification|donotreply/i.test(from)) return true;

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
  logger.info("Fetching new emails", { email });

  const identityContext = await userIdentityRepository.findTenantContextByProviderUserId("gmail", email);
  if (!identityContext || !identityContext.tenantId) {
    logger.warn("Received Gmail webhook for unmapped email address or missing tenant context", { email });
    return;
  }

  const { tenantId, userId, userIdentityId } = identityContext;
  const tenatDetails = await tenatDetailsRepo.findById(tenantId);

  if (userIdentityId != null) {
    const historyId = await gmailWatchService.getLastHistoryId(userIdentityId, tenantId);
    logger.debug("Last history ID lookup", { userIdentityId, historyId });
    if (!historyId) {
      logger.debug("No history ID found for userIdentityId; initializing watch record");
      await gmailWatchRepository.create({
        tenant_id: tenantId,
        user_identities_id: userIdentityId,
        history_id: historyIdFromWebhook
      });
    }
    const oAuth2Client = await googleConfig.getGoogleClientForUser(email);
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
          const contact = parseContactInfo(from);
          const body = getEmailBody(fullMessage.data.payload);
          console.log("subject: " + subject + " from : " + from + " contact: " + JSON.stringify(contact) + " body : " + body);
          console.log("Checking if email is system generated...");
          if (contact && contact.email != email) {
            const leadData = await triggerNewLeadAutomation(tenantId, userId, contact.firstName, contact.lastName, contact.email);
            if (!leadData?.id) {
              logger.warn("Skipping email processing: lead could not be created or resolved", { email: contact.email, messageId });
              continue;
            }
            logger.info("Lead created from email", { leadId: leadData.id });

            const result = await processIncomingEmail(tenantId, fullMessage, leadData.id, messageId);
            if (!result) {
              console.error("Failed to process incoming email for message ID:", messageId);
              continue;
            }
            const conversation_id = result.conversation_id;
            const threadId = result.threadId;
            const global_message_id = result.global_message_id;
            console.log("Email saved to conversation with ID:", conversation_id);
            if (tenatDetails?.email !== from && conversation_id != null) {
              const resultToReturn = await createLeadRequirementViaPrompt(body, leadData, tenantId, conversation_id, global_message_id);
              console.log("Result from createLeadRequirementViaPrompt:", resultToReturn);
              const type = resultToReturn.type;
              const leadRequirementDetails = resultToReturn.leadRequirementDetails;
              const values = resultToReturn.values;
              const content = resultToReturn.content;
              if (type === "EXISTING_PROPOSAL_MATCH") {
                const reSendSubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
                const gmailResponse = await gmailSendService.sendGmailRaw({
                  to: contact.email,
                  subject: reSendSubject,
                  html: content,
                  messageId: global_message_id,
                  threadId: threadId,
                  oAuth2Client: oAuth2Client,
                  attachments: [{ filename: "Proposal.pdf", url: resultToReturn.proposalDetails.gcs_storage_path, type: "application/pdf" }], // Optional: handle if passed
                });
                console.log(`Sent AI-generated existing proposal email response to ${contact.email} with Gmail response:`, gmailResponse);
                const id = gmailResponse.data.id;
                await conversationService.createConversationAndConversationMessages(tenantId, contact.email, reSendSubject, content, [], id, global_message_id);
              } else if (type === "DISCOVERY_EMAIL") {
                console.log("The email was classified as a DISCOVERY_EMAIL. No lead requirement was created. AI's suggested email reply content:", content);
                const reSendSubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
                const gmailResponse = await gmailSendService.sendGmailRaw({
                  to: contact.email,
                  subject: reSendSubject,
                  html: content,
                  messageId: global_message_id,
                  threadId: threadId,
                  oAuth2Client: oAuth2Client
                });
                const id = gmailResponse.data.id;
                console.log(`Sent AI-generated discovery email response to ${contact.email} with Gmail response:`, gmailResponse);
                await conversationService.createConversationAndConversationMessages(tenantId, contact.email, reSendSubject, content, [], id, global_message_id);
              } else if (type === "BUDGET_REQUEST" || type === "RETURNING_CLIENT_QUOTE") {
                console.log("Lead requirement details:", leadRequirementDetails);
                console.log("Saved requirement values:", values);

                await createProposalDraft(leadRequirementDetails, leadData, body, conversation_id, global_message_id, threadId, subject, oAuth2Client, content);
              } else {
                console.log("Lead requirement details:", leadRequirementDetails);
                console.log("Saved requirement values:", values);

                await createProposalDraft(leadRequirementDetails, leadData, body, conversation_id, global_message_id, threadId, subject, oAuth2Client);
                // // process emails...
              }
            } else {
              console.log("Email is from tenant's own email address, skipping lead creation and proposal drafting.");
            }
          }
        }
      }
    }
    if (history.data.historyId) {
      await gmailWatchService.updateHistoryId(
        userIdentityId,
        history.data.historyId,
        tenantId
      );
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

async function triggerNewLeadAutomation(tenantId, userId, first_name, last_name, email) {
  logger.info("Triggering new lead automation", { tenantId, userId, first_name, last_name, email });

  const leadData = {
    // Identity & Contact
    first_name: first_name,
    last_name: last_name,
    email: email
  };

  try {
    const createdLead = await leadService.createLead(
      tenantId,
      leadData,
      userId
    );

    logger.info("Service call successful! New Lead ID:", { leadId: createdLead?.id });
    return createdLead;
  } catch (error) {
    logger.error("Failed to create lead via service:", { error: error.message });
  }
}

async function createLeadRequirementViaPrompt(body, leadData, tenant_id, conversation_id, global_message_id) {
  console.log(leadData.id)
  try {

    console.log("Testing AI prompt :", body);
    // Extract newly requested service config keys from the active custom configurations
    const activeConfigs = await lead_requirement_configRepository.findByTenantAndActive(tenant_id);

    const response = await aiService.generateAIResponse(body, tenant_id, conversation_id, leadData, global_message_id, activeConfigs);

    console.log("Generated AI response:", response);
    if (response.type === "DISCOVERY_EMAIL") {
      console.log("Received a general inquiry. No lead requirement will be created. AI's suggested email reply:", response.content);
      return response;
    }

    const lastMessageWithDraft = response.lastMessageWithDraft;
    if (lastMessageWithDraft && lastMessageWithDraft.proposal_draft_id != null) {
      console.log("Found existing proposal draft link:", lastMessageWithDraft.proposal_draft_id);

      // Fetch the service config IDs tied to that prior draft configuration
      const oldItems = await proposalDraftItemsRepository.findItemsByMessageId(lastMessageWithDraft.proposal_draft_id);
      const oldConfigIds = oldItems.map(item => item.requirement_config_id);

      // Filter out keys that the AI evaluated as active numbers (non-null and greater than 0)
      const newlyRequestedConfigIds = activeConfigs
        .filter(config => response.data?.dynamic_requirements?.[config.field_key] != null && Number(response.data.dynamic_requirements[config.field_key]) > 0)
        .map(config => config.id);
      // Sort both arrays to perform an exact element match evaluation
      const oldSorted = [...oldConfigIds].sort();
      const newSorted = [...newlyRequestedConfigIds].sort();

      const isSameServicesPattern = oldSorted.length === newSorted.length &&
        oldSorted.every((val, index) => val === newSorted[index]);

      if (isSameServicesPattern) {
        console.log("Services match exactly! Bypassing generation and returning original asset tracking URLs.");

        // Fetch the full original draft metadata records (which contain your existing GCS URL and historical message configurations)
        const activeDraftDetails = await proposalDraftRepository.findById(lastMessageWithDraft.proposal_draft_id);

        return {
          type: "EXISTING_PROPOSAL_MATCH",
          message: "The customer requested a quotation for identical services. Reusing existing quote record assets.",
          proposalDetails: activeDraftDetails,
          content: lastMessageWithDraft.content
        };
      }

      console.log("New services detected in the quote request. Proceeding with new proposal configuration generation.");
    }
    const data = response.data;
    data.lead_id = leadData.id;
    data.tenant_id = tenant_id;
    const leadRequirementDetails = await leadRequirementRepository.create(data);
    console.log("Lead requirement created with :", leadRequirementDetails);

    const results = await leadRequirementValueRepo.saveRequirementValues(tenant_id, leadRequirementDetails.id, data.dynamic_requirements);
    const resultToReturn = { type: response.type, leadRequirementDetails: leadRequirementDetails, values: results, content: response.data.text_reply }
    return resultToReturn;
  } catch (err) {
    console.error("Error in createLeadRequirementViaPrompt:", err);
    throw err;
  }
}

module.exports = { startWatch, fetchNewEmails, triggerNewLeadAutomation, createLeadRequirementViaPrompt, formatConceptPricingResponse, createProposalDraft };