// src/features/conversations/conversation.service.js
const ConversationRepository = require('../repositories/conversation.repository');
const MessageRepository = require('../repositories/conversation-message.repository');

class ConversationService {
  async listConversations(tenantId, filters) {
    console.log("list conversations for tenant:", tenantId, "with filters:", filters);
    // Fetch from your DB
    const conversations = await ConversationRepository.findAllByTenant(tenantId, filters);
    
    // The UI expects specific names like lead_name and lead_channel
    return conversations.map(c => ({
      id: c.id,
      lead_id: c.lead_id,
      lead_name: c.lead_name, // Joined from leads table
      lead_email: c.lead_email,
      lead_channel: c.channel, // 'gmail'
      status: c.status,
      unread_count: 0,
      last_message_content: c.last_message_content,
      last_message_at: c.last_message_at,
      updated_at: c.updated_at
    }));
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
}

module.exports = new ConversationService();