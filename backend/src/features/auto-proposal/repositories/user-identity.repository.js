const AppDataSource = require("../../../config/data-source");

class UserIdentityRepository {

  async findByProviderUserId(providerUserId) {
    const sql = `
      SELECT *
      FROM user_identities
      WHERE provider_user_id = $1
      LIMIT 1;
    `;

    const values = [providerUserId];

    const result = await AppDataSource.query(sql, values);
    return result[0] || null;
  }


  async findByProvider(provider, providerUserId) {
    const sql = `
      SELECT *
      FROM user_identities
      WHERE provider = $1
        AND provider_user_id = $2
      LIMIT 1;
    `;

    const values = [provider, providerUserId];

    const result = await AppDataSource.query(sql, values);
    return result[0]?.id || null;
  }

}

module.exports = new UserIdentityRepository();