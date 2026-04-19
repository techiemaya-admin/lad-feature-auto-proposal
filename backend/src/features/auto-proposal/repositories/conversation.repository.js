const AppDataSource = require("../../../config/data-source");

class ConversationRepository {
  async upsertByThread(data) {
    const { tenant_id, lead_id, external_thread_id, channel, metadata } = data;

    // 1. Try to find existing conversation
    const findSql = `SELECT * FROM conversations WHERE external_thread_id = $1 LIMIT 1`;
    const existing = await AppDataSource.query(findSql, [external_thread_id]);

    if (existing.length > 0) {
      // 2. Update existing
      const updateSql = `
      UPDATE conversations 
      SET last_message_at = NOW(), updated_at = NOW() 
      WHERE external_thread_id = $1 
      RETURNING *;
    `;
      const result = await AppDataSource.query(updateSql, [external_thread_id]);
      const updatedConversationArray = result[0];
      if(updatedConversationArray) {
        const updatedConversation = updatedConversationArray[0];
        console.log("Updated existing conversation for thread:", external_thread_id+" result : ", updatedConversation);
        return updatedConversation;
      } else {
        console.log("No conversation found to update for thread:", external_thread_id);
        return null;
      }
    } else {
      // 3. Insert new
      const insertSql = `
      INSERT INTO conversations (tenant_id, lead_id, external_thread_id, channel, metadata, last_message_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *;
    `;
      const result = await AppDataSource.query(insertSql, [
        tenant_id, lead_id, external_thread_id, channel, JSON.stringify(metadata || {})
      ]);
      return result[0];
    }
  }

  async findByThreadId(threadId) {
    const sql = `SELECT * FROM conversations WHERE external_thread_id = $1`;
    const res = await AppDataSource.query(sql, [threadId]);
    return res[0];
  }

  async findAllByTenant(tenantId) {
    // We join with leads table to get the name/email for the UI sidebar
    const sql = `
      SELECT 
        c.*, 
        l.email as lead_email,
        (SELECT content FROM conversation_messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC LIMIT 1) as last_message_content
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.tenant_id = $1
      ORDER BY c.last_message_at DESC;
    `;
    return await AppDataSource.query(sql, [tenantId]);
  }
}

module.exports = new ConversationRepository();