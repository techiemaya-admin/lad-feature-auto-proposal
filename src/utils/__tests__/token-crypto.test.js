const crypto = require('crypto');
const { encryptToken, decryptToken, isEncrypted, assertTokenEncryptionConfig } = require('../token-crypto');

describe('token-crypto', () => {
  const originalEnv = process.env;
  const key = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: key, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('round-trips tokens and never stores the plaintext', () => {
    const enc = encryptToken('1//refresh-token-value');
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain('refresh-token-value');
    expect(decryptToken(enc)).toBe('1//refresh-token-value');
  });

  it('uses a fresh IV per encryption', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'));
  });

  it('passes through null/empty values and legacy plaintext', () => {
    expect(encryptToken(null)).toBeNull();
    expect(encryptToken('')).toBe('');
    expect(decryptToken('ya29.legacy-plaintext')).toBe('ya29.legacy-plaintext');
    expect(decryptToken(null)).toBeNull();
  });

  it('does not double-encrypt', () => {
    const enc = encryptToken('abc');
    expect(encryptToken(enc)).toBe(enc);
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptToken('abc');
    const raw = Buffer.from(enc.slice('enc:v1:'.length), 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(() => decryptToken('enc:v1:' + raw.toString('base64'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const enc = encryptToken('abc');
    process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    expect(() => decryptToken(enc)).toThrow();
  });

  it('refuses to store plaintext in production without a key', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => encryptToken('abc')).toThrow();
    expect(() => assertTokenEncryptionConfig()).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
    expect(() => encryptToken('abc')).toThrow('32 bytes');
  });
});
