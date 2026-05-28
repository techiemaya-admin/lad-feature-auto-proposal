const AppDataSource = require("../../../config/data-source");

class ConversationParticipantRepository {
  async addParticipant(conversationId, type, participantId = null) {
    const sql = `
    INSERT INTO conversation_participants (conversation_id, participant_type, participant_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (conversation_id, participant_id)
    DO NOTHING
    RETURNING *;
  `;

    const result = await AppDataSource.query(sql, [conversationId, type, participantId]);
    return result[0] || null; // null if already exists
  }
}

module.exports = new ConversationParticipantRepository();