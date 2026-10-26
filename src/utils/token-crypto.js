const crypto = require('crypto');
const logger = require('./logger');

/**
 * Application-level encryption for OAuth tokens stored in the database (AES-256-GCM).
 * Key: TOKEN_ENCRYPTION_KEY, 32 random bytes encoded as base64.
 * Stored format: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext).
 * Values without the prefix are treated as legacy plaintext so existing rows keep working
 * until they are re-encrypted (scripts/encrypt-existing-tokens.js) or refreshed.
 */
const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;
let warnedMissingKey = false;

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

/** Throws unless a valid key is configured. Called at startup in production. */
function assertTokenEncryptionConfig() {
  if (!getKey()) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set (32 random bytes, base64)');
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptToken(value) {
  if (value === null || value === undefined || value === '' || isEncrypted(value)) return value;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is required to store OAuth tokens');
    }
    if (!warnedMissingKey) {
      logger.warn('TOKEN_ENCRYPTION_KEY not set; storing OAuth tokens unencrypted (non-production only)');
      warnedMissingKey = true;
    }
    return value;
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

function decryptToken(value) {
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required to read encrypted OAuth tokens');
  }
  const data = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = data.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptToken, decryptToken, isEncrypted, assertTokenEncryptionConfig };
