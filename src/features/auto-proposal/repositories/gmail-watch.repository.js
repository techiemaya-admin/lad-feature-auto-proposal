const AppDataSource = require("../../../config/data-source");
const logger = require("../../../utils/logger");

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


  async findByUserIdentity(userIdentityId, tenantId) {
    let sql = `
      SELECT *
      FROM gmail_watch
      WHERE user_identities_id = $1
    `;
    const values = [userIdentityId];

    if (tenantId) {
      sql += ` AND tenant_id = $2`;
      values.push(tenantId);
    }
    sql += ` LIMIT 1;`;

    const result = await AppDataSource.query(sql, values);
    logger.debug("Gmail Watch lookup for userIdentityId", { userIdentityId, tenantId, found: !!result[0] });
    return result[0] || null;
  }


  async updateHistory(data) {
    let sql = `
      UPDATE gmail_watch
      SET
        history_id = $2,
        expiration = COALESCE($3, expiration),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_identities_id = $1
    `;

    const values = [
      data.user_identities_id,
      data.history_id,
      data.expiration || null
    ];

    if (data.tenant_id) {
      sql += ` AND tenant_id = $4`;
      values.push(data.tenant_id);
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, values);
    return result[0] || null;
  }


  async deleteByUserIdentity(userIdentityId, tenantId) {
    let sql = `
      DELETE FROM gmail_watch
      WHERE user_identities_id = $1
    `;
    const values = [userIdentityId];

    if (tenantId) {
      sql += ` AND tenant_id = $2`;
      values.push(tenantId);
    }
    sql += ` RETURNING *;`;

    const result = await AppDataSource.query(sql, values);
    return result[0] || null;
  }

}

module.exports = new GmailWatchRepository();