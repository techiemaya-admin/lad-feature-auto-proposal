const AppDataSource = require("../../../config/data-source");
const { v4: uuidv4 } = require('uuid');

class ConversationMessageRepository {

  async createMessage(data) {
    const id = uuidv4();
    const {
      tenant_id, conversation_id, sender_type, sender_id,
      channel, message_type, content, raw_payload, message_id, global_message_id, proposal_draft_id
    } = data;

    const sql = `
      INSERT INTO conversation_messages (
        id, tenant_id, conversation_id, sender_type, sender_id, 
        channel, message_type, content, raw_payload, message_id, global_message_id, proposal_draft_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [
      id, tenant_id, conversation_id, sender_type, sender_id,
      channel, message_type || 'email', content, JSON.stringify(raw_payload || {}), (data.message_id || null), (data.global_message_id || null), (data.proposal_draft_id || null)
    ]);
    return result[0];
  }


  // =====================================================
  // FIND BY CONVERSATION ID
  // =====================================================
  async findByConversationId(conversationId, limit = 50) {
    const sql = `
      SELECT * FROM conversation_messages 
      WHERE conversation_id = $1 
      ORDER BY created_at ASC 
      LIMIT $2;
    `;

    return await AppDataSource.query(sql, [conversationId, limit]);
  }

  // =====================================================
  // DELETE MESSAGE (Soft delete if column exists)
  // =====================================================
  async deleteMessage(id) {
    const sql = `
      DELETE FROM conversation_messages 
      WHERE id = $1 
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [id]);
    return result[0];
  }

  // =====================================================
  // FIND BY MESSAGE ID (Gmail message ID)
  // =====================================================
  async findByMessageId(messageId) {
    const sql = `
      SELECT * FROM conversation_messages 
      WHERE message_id = $1 
      LIMIT 1;
    `;
    const result = await AppDataSource.query(sql, [messageId]);
    return result[0];
  }
  
  async findTop10EmailByTenantIdAndConversationId(tenant_id, conversation_id, global_message_id) {
    const sql = `
    SELECT 
      sender_type, 
      content, 
      message_id,
      created_at ,
      proposal_draft_id
    FROM conversation_messages 
    WHERE tenant_id = $1 
      AND conversation_id = $2 
      AND channel = 'email'
      and global_message_id = $3
    ORDER BY created_at DESC 
    LIMIT 10;
  `;
    const result = await AppDataSource.query(sql, [tenant_id, conversation_id, global_message_id]);
    return result; // We reverse this in the AI service logic
  }
}

module.exports = new ConversationMessageRepository();