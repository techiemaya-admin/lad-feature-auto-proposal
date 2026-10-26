/**
 * One-off migration: encrypts any plaintext OAuth tokens left in user_identities.
 * Run once after deploying token encryption, with TOKEN_ENCRYPTION_KEY set:
 *   node scripts/maintenance/encrypt-existing-tokens.js
 * Safe to re-run: already-encrypted values are skipped.
 */
require('dotenv').config();
const dataSource = require('../../src/config/data-source');
const { encryptToken, isEncrypted, assertTokenEncryptionConfig } = require('../../src/utils/token-crypto');

async function main() {
  assertTokenEncryptionConfig();
  await dataSource.initialize();
  try {
    const rows = await dataSource.query(
      `SELECT id, access_token, refresh_token FROM user_identities
       WHERE (access_token IS NOT NULL AND access_token NOT LIKE 'enc:v1:%')
          OR (refresh_token IS NOT NULL AND refresh_token NOT LIKE 'enc:v1:%')`
    );
    let updated = 0;
    for (const row of rows) {
      const access = row.access_token && !isEncrypted(row.access_token) ? encryptToken(row.access_token) : row.access_token;
      const refresh = row.refresh_token && !isEncrypted(row.refresh_token) ? encryptToken(row.refresh_token) : row.refresh_token;
      await dataSource.query(
        'UPDATE user_identities SET access_token = $1, refresh_token = $2 WHERE id = $3',
        [access, refresh, row.id]
      );
      updated += 1;
    }
    console.log(`Encrypted tokens for ${updated} user identit${updated === 1 ? 'y' : 'ies'}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Token encryption migration failed:', err.message);
  process.exit(1);
});
