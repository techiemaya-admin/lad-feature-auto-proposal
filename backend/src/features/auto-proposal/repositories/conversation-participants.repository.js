const AppDataSource = require("../../../config/data-source");

class ConversationParticipantRepository {
  async addParticipant(conversationId, type, participantId = null) {
    const sql = `
      INSERT INTO conversation_participants (conversation_id, participant_type, participant_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await AppDataSource.query(sql, [conversationId, type, participantId]);
    return result[0];
  }
}

module.exports = new ConversationParticipantRepository();