const AppDataSource = require("../../../config/data-source");

class GmailWatchRepository {

  async create(data) {
    const sql = `
      INSERT INTO gmail_watch
      (
        tenant_id,
        user_identities_id,
        history_id,
        expiration
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;

    const values = [
      data.tenant_id,
      data.user_identities_id,
      data.history_id || null,
      data.expiration || null
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0];
  }


  async findByUserIdentity(userIdentityId) {
    const sql = `
      SELECT *
      FROM gmail_watch
      WHERE user_identities_id = $1
      LIMIT 1;
    `;

    const result = await AppDataSource.query(sql, [userIdentityId]);
    console.log("Gmail Watch found for userIdentityId", userIdentityId, ":", result[0]);
    return result[0] || null;
  }


  async updateHistory(data) {
    const sql = `
      UPDATE gmail_watch
      SET
        history_id = $2,
        expiration = COALESCE($3, expiration),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_identities_id = $1
      RETURNING *;
    `;

    const values = [
      data.user_identities_id,
      data.history_id,
      data.expiration || null
    ];

    const result = await AppDataSource.query(sql, values);
    return result[0] || null;
  }


  async deleteByUserIdentity(userIdentityId) {
    const sql = `
      DELETE FROM gmail_watch
      WHERE user_identities_id = $1
      RETURNING *;
    `;

    const result = await AppDataSource.query(sql, [userIdentityId]);
    return result[0] || null;
  }

}

module.exports = new GmailWatchRepository();