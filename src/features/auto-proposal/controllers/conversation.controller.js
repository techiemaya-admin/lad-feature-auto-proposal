// src/features/conversations/conversation.controller.js
const conversationService = require('../services/conversation.service');
const { clientMessage } = require('../../../utils/http-errors');
const { uploadToGCSFromBase64 } = require('../../../utils/gcsUploader');
const tenantService = require('../services/tenant.service');
const aiResponseService = require('../services/ai-response.service');
const leadService = require('../services/lead.service');
const logger = require('../../../utils/logger');

class ConversationController {
  async getConversations(req, res) {
    logger.debug("Received request to get conversations with query:", req.tenantId);
    try {
      const { search } = req.query;
      const contacts = await conversationService.getContacts(req.tenantId, search);

      res.status(200).json({
        success: true,
        data: contacts
      });
    } catch (error) {
      logger.error("Error fetching conversations:", error);
      res.status(500).json({ success: false, message: clientMessage(error) });
    }
  }

  async getMessages(req, res) {
    try {
      const contactId = req.query.contact_id;
      logger.debug("Received request to get messages for contact:", contactId, "tenant:", req.tenantId);
      const messages = await conversationService.getContactMessages(req.tenantId, contactId);

      res.status(200).json(messages);
    } catch (error) {
      logger.error("Error fetching messages:", error);
      res.status(500).json({ success: false, message: clientMessage(error) });
    }
  }

  async sendBulkEmails(req, res) {
    try {
      const { body_html, subject, recipients, attachments, provider } = req.body;
      const tenantId = req.tenantId; // Taken from auth middleware
      const userId = req.userId; // Taken from auth middleware
      logger.debug("Received bulk email send request for tenant:", tenantId, "userId:", userId, "recipientsCount:", Array.isArray(recipients) ? recipients.length : 0);

      // Basic Validation
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients list is required." });
      }

      // Call the service to handle the heavy lifting
      const summary = await conversationService.handleBulkEmailSend(tenantId,userId, {
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
      logger.error("Bulk Send Controller Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  async uploadAttachment(req, res) {
    try {
      logger.debug("Uploading attachment for tenant:", req.tenantId, "filename:", req.file?.originalname);
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
      logger.error('GCS Upload Error:', error);
      return res.status(500).json({ error: 'Failed to upload to storage' });
    }
  };


  async generateFollowUp(req, res) {
    try {
      const { contactId } = req.params;
      logger.debug("Generating follow-up for contact_id:", contactId, "tenant:", req.tenantId);
      const lastMessage = await conversationService.findLastMessagesByContactId(req.tenantId, contactId);
      const clientText = lastMessage[0]?.body_text || lastMessage[0]?.body_html || "No previous message found.";
      const tenantDetails=await tenantService.getTenantById(req.tenantId);
      const leadDetails = await leadService.getLeadById(contactId, req.tenantId);
     const result = await aiResponseService.generateFollowUpEmailContent(clientText, tenantDetails,leadDetails);
      res.json({
        success: true,
        subject: result.subject,
        body_html: result.body
      });

    } catch (error) {
      logger.error("Error generating AI follow-up:", error);
      res.status(500).json({ success: false, error: clientMessage(error) });
    }
  };

  
  async generateFollowUpCrux(req, res) {
    try {
      const { contactId } = req.params;
      logger.debug("Generating follow-up crux for contact_id:", contactId, "tenant:", req.tenantId);
      // 1. Fetch the last message from this contact (Inbound)
      const messages = await conversationService.getContactMessages(req.tenantId, contactId);
      const tenantDetails=await tenantService.getTenantById(req.tenantId);
      const leadDetails = await leadService.getLeadById(contactId, req.tenantId);
      const crux = await aiResponseService.generateEmailMessagesCrux(messages, tenantDetails, leadDetails);
      res.status(200).json({ success: true, crux });

    } catch (error) {
      logger.error("Error generating AI follow-up:", error);
      res.status(500).json({ success: false, error: clientMessage(error) });
    }
  };
}

module.exports = new ConversationController();