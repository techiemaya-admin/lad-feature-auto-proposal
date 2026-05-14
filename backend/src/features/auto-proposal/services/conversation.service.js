// src/features/conversations/conversation.service.js
const ConversationRepository = require('../repositories/conversation.repository');
const MessageRepository = require('../repositories/conversation-message.repository');
const gmailSendEmailService = require('../services/gmail-send-email.service');
const { uploadToGCSFromBase64 } = require('../../../utils/gcsUploader');

class ConversationService {
  async listConversations(tenantId, filters) {
    console.log("list conversations for tenant:", tenantId, "with filters:", filters);
    // Fetch from your DB
    return await ConversationRepository.listAllConversationByTenantId(tenantId, filters);
  }

  async listMessages(conversationId) {
    const messages = await MessageRepository.findByConversationId(conversationId);
    return messages.map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      content: m.content,
      role: m.sender_type === 'lead' ? 'user' : 'assistant',
      created_at: m.created_at,
      message_status: 'sent'
    }));
  }

  async getContacts(tenantId, search) {
    // Business logic: filter or transform contacts if needed
    return await ConversationRepository.findAllContacts(tenantId, search);
  }

  async getContactMessages(tenantId, contactId) {
    // Business logic: e.g. marking messages as read or processing HTML
    return await ConversationRepository.findMessagesByContactId(tenantId, contactId);
  }

  
  async findLastMessagesByContactId(tenantId, contactId) {
    // Business logic: e.g. marking messages as read or processing HTML
    return await ConversationRepository.findLastMessagesByContactId(tenantId, contactId);
  }

  async handleBulkEmailSend(tenantId, payload) {
    const { body_html, subject, recipients, provider, attachments } = payload;
    console.log("Handling bulk email send for tenant:", tenantId, " with payload:", payload);
    const results = [];
    const processedAttachments = attachments;

    for (const recipient of recipients) {
      try {


        // 2. Prepare Data for Placeholder Replacement
        // We merge recipient details so placeholders like {{name}} work
        const placeholderData = {
          ...recipient,
          company_name: recipient.company, // mapping 'company' to 'company_name' if needed
        };

        // 3. Perform Replacement
        const personalizedSubject = await this.replacePlaceholders(subject, placeholderData);
        const personalizedHtml = await this.replacePlaceholders(body_html, placeholderData);

        // 4. Send via Gmail (Reusing your existing RFC 2822 logic)
        const gmailResponse = await gmailSendEmailService.sendGmailWithAttachments({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedHtml,
          attachments: attachments || [] // Optional: handle if passed
        });
        console.log(`Email sent to ${recipient.email} with Gmail response:`, gmailResponse.data);
        await this.createConversationAndConversationMessages(tenantId, recipient.email, personalizedSubject, personalizedHtml, processedAttachments, gmailResponse.id, gmailResponse.globalMessageId);
        results.push({ email: recipient.email, status: 'sent' });
      } catch (err) {
        console.error(`Failed to send bulk email to ${recipient.email}:`, err);
        results.push({ email: recipient.email, status: 'failed', error: err.message });
      }
    }

    return results;
  }


  async replacePlaceholders(template, data) {
    if (!template) return "";
    // Regex matches {{name}} or [name]
    return template.replace(/{{(.*?)}}|\[(.*?)\]/g, (match, p1, p2) => {
      const key = (p1 || p2).trim();
      // Use _.get or direct access. Example: data['name']
      return data[key] !== undefined ? data[key] : match;
    });
  }

  async createConversationAndConversationMessages(tenantId, email, personalizedSubject, personalizedHtml, processedAttachments, message_id = null, global_message_id = null) {
    console.log("Creating conversation and message for email:", email, " tenantId:", tenantId, " message_id:", message_id, " global_message_id:", global_message_id," personalizedSubject:", personalizedSubject);
    const result = await ConversationRepository.getLeadAndThreadByEmail(tenantId, email);
    const conversation = await ConversationRepository.upsertByThread({
      tenant_id: tenantId,
      lead_id: result?.lead_id || null,
      external_thread_id: result?.external_thread_id,
      channel: 'email',
      metadata: { subject: personalizedSubject }
    });
    // 5. Save to conversation_messages using your createMessage method
    await MessageRepository.createMessage({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      sender_type: 'agent',
      channel: 'email',
      content: personalizedHtml,
      message_id: message_id,
      raw_payload: {
        to: email,
        subject: personalizedSubject,
        attachments: processedAttachments
      },
      global_message_id: global_message_id
    });
  }
}

module.exports = new ConversationService();