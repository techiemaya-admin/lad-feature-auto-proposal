const AppDataSource = require("../../../config/data-source");

class ConversationRepository {

  async getLeadAndThreadByEmail(tenantId, email) {
    const sql = `
    SELECT 
      l.id AS lead_id,
      c.id AS conversation_id,
      c.external_thread_id 
    FROM leads l
    LEFT JOIN conversations c ON l.id = c.lead_id 
      AND c.channel = 'email'
      AND c.tenant_id = $2
    WHERE l.email = $1 
      AND l.tenant_id = $2 
      AND l.is_deleted = false
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT 1;
  `;

    const result = await AppDataSource.query(sql, [email, tenantId]);

    if (result.length > 0) {
      return {
        lead_id: result[0].lead_id,
        conversation_id: result[0].conversation_id,
        external_thread_id: result[0].external_thread_id
      };
    }

    return null;
  }
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
      if (updatedConversationArray) {
        const updatedConversation = updatedConversationArray[0];
        console.log("Updated existing conversation for thread:", external_thread_id + " result : ", updatedConversation);
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

  async listAllConversationByTenantId(tenantId, filters) {
    // We join with leads table to get the name/email for the UI sidebar
    const query = `
    SELECT 
      c.*,
      -- Subquery for Participants
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', cp.id,
          'participant_type', cp.participant_type,
          'participant_id', cp.participant_id,
          'created_at', cp.created_at
        ))
        FROM conversation_participants cp
        WHERE cp.conversation_id = c.id), 
      '[]') AS participants,

      -- Subquery for Messages (Ordered by oldest to newest)
      COALESCE(
        (SELECT json_agg(msg) FROM (
          SELECT 
            cm.id, 
            cm.message_id, 
            cm.sender_type, 
            cm.sender_id, 
            cm.content, 
            cm.ai_generated, 
            cm.created_at
          FROM conversation_messages cm
          WHERE cm.conversation_id = c.id
          ORDER BY cm.created_at ASC
        ) msg), 
      '[]') AS messages

    FROM conversations c
    WHERE c.tenant_id = $1
    ORDER BY c.last_message_at DESC;
  `;
    return await AppDataSource.query(query, [tenantId]);
  }

  async findAllContacts(tenantId, search = '') {
    let sql = `
            SELECT 
                id,
                (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS contact_name,
                email,
                company_name AS company,
                'email' AS channel,
                created_at
            FROM leads
            WHERE tenant_id = $1 AND is_deleted = false
        `;

    const params = [tenantId];

    if (search) {
      sql += ` AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY created_at DESC`;
    return await AppDataSource.query(sql, params);
  }

  async findMessagesByContactId(tenantId, contactId) {
    const sql = `
    SELECT 
        cm.id,
        c.lead_id AS contact_id,
        CASE 
            WHEN cm.sender_type = 'agent' THEN 'outbound' 
            ELSE 'inbound' 
        END AS direction,
        cm.channel AS provider,
        COALESCE(cm.raw_payload->>'subject', 'No Subject') AS subject,
        cm.content AS body_html,
        LEFT(cm.content, 100) AS preview_text,
        c.status,
        cm.created_at AS sent_at,
        -- THIS IS THE CHANGE:
        -- Extract the 'attachments' array from raw_payload
        cm.raw_payload->'attachments' AS attachments
    FROM conversation_messages cm
    JOIN conversations c ON cm.conversation_id = c.id
    WHERE c.tenant_id = $1 AND c.lead_id = $2
    ORDER BY cm.created_at DESC;
  `;

    return await AppDataSource.query(sql, [tenantId, contactId]);
  }
}

module.exports = new ConversationRepository();