// src/features/conversations/conversation.controller.js
const conversationService = require('../services/conversation.service');
const { uploadToGCSFromBase64 } = require('../../../utils/gcsUploader');
const tenantService = require('../services/tenant.service');
const aiResponseService = require('../services/ai-response.service');
const leadService = require('../services/lead.service');

class ConversationController {
  async getConversations(req, res) {
    console.log("Received request to get conversations with query:", req.tenantId);
    try {
      const { search } = req.query;
      const contacts = await conversationService.getContacts(req.tenantId, search);

      res.status(200).json({
        success: true,
        data: contacts
      });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMessages(req, res) {
    try {
      const contactId = req.query.contact_id;
      console.log("Received request to get messages for contact:", contactId, "tenant:", req.tenantId);
      const messages = await conversationService.getContactMessages(req.tenantId, contactId);

      res.status(200).json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async sendBulkEmails(req, res) {
    try {
      const { body_html, subject, recipients, attachments, provider } = req.body;
      const tenantId = req.tenantId; // Taken from auth middleware

      // Basic Validation
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients list is required." });
      }

      // Call the service to handle the heavy lifting
      const summary = await conversationService.handleBulkEmailSend(tenantId, {
        body_html,
        subject,
        recipients,
        provider,
        attachments: attachments || []
      });

      res.status(200).json({
        message: "Bulk processing complete",
        success: true
      });
    } catch (error) {
      console.error("Bulk Send Controller Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  async uploadAttachment(req, res) {
    try {
      console.log('File Object:', req.file); // Check your terminal!
      console.log('Body Object:', req.body);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Call service to upload to GCS
      const result = await uploadToGCSFromBase64(
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );

      // Return the URL and metadata to the frontend
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('GCS Upload Error:', error);
      return res.status(500).json({ error: 'Failed to upload to storage' });
    }
  };


  async generateFollowUp(req, res) {
    try {
      const { contactId } = req.params;
      console.log("Generating follow-up for contact_id:", contactId, "tenant:", req.tenantId);
      // 1. Fetch the last message from this contact (Inbound)
      const lastMessage = await conversationService.findLastMessagesByContactId(req.tenantId, contactId);
      console.log("Last message fetched for follow-up generation: ", lastMessage);
      const clientText = lastMessage[0]?.body_text || lastMessage[0]?.body_html || "No previous message found.";
      console.log("Last client message fetched for follow-up generation: ", clientText);
      const tenantDetails=await tenantService.getTenantById(req.tenantId);
      const leadDetails = await leadService.getLeadById(contactId, req.tenantId);
     const result = await aiResponseService.generateFollowUpEmailContent(clientText, tenantDetails,leadDetails);
      res.json({
        success: true,
        subject: result.subject,
        body_html: result.body
      });

    } catch (error) {
      console.error("Error generating AI follow-up:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

module.exports = new ConversationController();