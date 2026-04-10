// src/features/conversations/conversation.controller.js
const ConversationService = require('../services/conversation.service');

class ConversationController {
  async getConversations(req, res) {
    console.log("Received request to get conversations with query:", req);
    try {
      const tenant_id  = "e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5"; // Or however you get tenant context
      const filters = req.query;
      const data = await ConversationService.listConversations(tenant_id, filters);
      res.json({ success: true, data: data, total: data.length });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const data = await ConversationService.listMessages(conversationId);
      res.json({ 
        success: true, 
        data: data, 
        total: data.length, 
        has_more: false 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ConversationController();