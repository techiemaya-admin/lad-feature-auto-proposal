const { google } = require("googleapis");
const { oAuth2Client } = require("../../../config/google.config");

const conversationRepository = require("../repositories/conversation.repository");
const messageRepository = require("../repositories/conversationMessage.repository");
const { logger } = require("../../../utils/logger");
const aiService = require("./ai-response.service");
const leadRequirementRepository = require("../repositories/lead-requirement.repository");  

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
async function fetchNewEmails(historyId) {
  console.log("Fetching new emails with historyId:", historyId);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const history = await gmail.users.history.list({
    userId: "me",
    startHistoryId: historyId,
  });
// console.log("History response:", history.data);
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
        const body = fullMessage.data.snippet;
console.log("body : "+body)

// console.log(" Saving enmail to conversation tables ")

try {
    const response = await aiService.generateAIResponse(
      body
    );
console.log("Generated AI response:", response);
  } catch (err) {
  }
        // saveEmailToDB(fullMessage.data,"test-tenant-id");
      }
    }
  }
}

async function createLeadRequirementViaPrompt(body) {

try {
  console.log("Testing AI prompt :", body);
    const response = await aiService.generateAIResponse(
      body
    );
console.log("Generated AI response:", response);
leadRequirementRepository.create(response);
return response;
  } catch (err) {
    console.error("Error in createLeadRequirementViaPrompt:", err.message);
  }
}

module.exports = { startWatch, fetchNewEmails , createLeadRequirementViaPrompt};