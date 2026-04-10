const AppDataSource = require("../../../config/data-source");
const { v4: uuidv4 } = require('uuid');

class ConversationMessageRepository {
  
  async createMessage(data) {
    const id = uuidv4();
    const { 
      tenant_id, conversation_id, sender_type, sender_id, 
      channel, message_type, content, raw_payload 
    } = data;

    const sql = `
      INSERT INTO conversation_messages (
        id, tenant_id, conversation_id, sender_type, sender_id, 
        channel, message_type, content, raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [
      id, tenant_id, conversation_id, sender_type, sender_id,
      channel, message_type || 'email', content, JSON.stringify(raw_payload || {})
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
}

module.exports = new ConversationMessageRepository();