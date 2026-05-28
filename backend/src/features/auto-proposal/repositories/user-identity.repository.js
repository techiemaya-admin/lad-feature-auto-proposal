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


  //  =====================================================    
  // Fetch the user identity record based on provider and provider_user_id, but only return the id of the user_identities record
  //  =====================================================
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

  async findByProviderAndProviderUserId(provider, providerUserId) {
    const sql = `
      SELECT *
      FROM user_identities
      WHERE provider = $1
        AND provider_user_id = $2
      LIMIT 1;
    `;

    const values = [provider, providerUserId];

    const result = await AppDataSource.query(sql, values);
    return result[0] || null;
  }

  async findByProviderDetails(provider) {
    const sql = `
      SELECT *
      FROM user_identities
      WHERE provider = $1
      LIMIT 1;
    `;


    const values = [provider];

    const result = await AppDataSource.query(sql, values);
    return result.length > 0 ? result[0] : null;
  }



  async findByProviderAndProviderUserIdAndTenantId(user_id, provider) {
    const sql = `
      SELECT *
      FROM user_identities
      WHERE user_id = $1
        AND provider  = $2
      LIMIT 1;
    `;


    const values = [user_id, provider];

    const result = await AppDataSource.query(sql, values);
    return result.length > 0 ? result[0] : null;
  }

  async upsertIdentity(data) {
    const query = `
            INSERT INTO user_identities (
                id, user_id, provider, provider_user_id, 
                access_token, refresh_token, token_expires_at, 
                provider_data, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
            )
            ON CONFLICT (user_id,provider) 
            DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, user_identities.refresh_token),
                token_expires_at = EXCLUDED.token_expires_at,
                provider_data = EXCLUDED.provider_data,
                updated_at = NOW();
        `;

    const values = [
      data.userId,
      'gmail',
      data.email,
      data.accessToken,
      data.refreshToken,
      data.expiryDate,
      JSON.stringify(data.providerData)
    ];

    return await AppDataSource.query(query, values);
  }

  async deleteIdentity(identityId) {
    const query = `
      DELETE FROM user_identities
      WHERE id = $1
    `;
    const values = [identityId];
    await AppDataSource.query(query, values);
  }


  async updateAccessTokenByUserId(userId, provider, tokenDetails) {
    const query = `
    UPDATE user_identities 
    SET access_token = $1, token_expires_at = $2, updated_at = NOW()
    WHERE user_id = $3 AND provider = $4;
  `;
    return await AppDataSource.query(query, [
      tokenDetails.accessToken,
      tokenDetails.expiryDate,
      userId,
      provider
    ]);
  }


  async updateAccessTokenByProviderUserId(providerUserId, provider, tokenDetails) {
    const query = `
    UPDATE user_identities 
    SET access_token = $1, token_expires_at = $2, updated_at = NOW()
    WHERE provider_user_id = $3 AND provider = $4;
  `;
    return await AppDataSource.query(query, [
      tokenDetails.accessToken,
      tokenDetails.expiryDate,
      providerUserId,
      provider
    ]);
  }
}



module.exports = new UserIdentityRepository();