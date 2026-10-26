const crypto = require('crypto');

process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

jest.mock('../../../../config/data-source', () => ({ query: jest.fn() }));

const db = require('../../../../config/data-source');
const repo = require('../user-identity.repository');
const { encryptToken } = require('../../../../utils/token-crypto');

describe('UserIdentityRepository token encryption', () => {
  beforeEach(() => jest.clearAllMocks());

  it('encrypts access and refresh tokens when upserting an identity', async () => {
    db.query.mockResolvedValue([]);

    await repo.upsertIdentity({
      userId: 'u-1', email: 'a@b.com', accessToken: 'ya29.access', refreshToken: '1//refresh',
      expiryDate: new Date(), providerData: {},
    });

    const params = db.query.mock.calls[0][1];
    expect(params[3]).toMatch(/^enc:v1:/);
    expect(params[4]).toMatch(/^enc:v1:/);
    expect(JSON.stringify(params)).not.toContain('ya29.access');
    expect(JSON.stringify(params)).not.toContain('1//refresh');
  });

  it('encrypts refreshed tokens', async () => {
    db.query.mockResolvedValue([]);
    await repo.updateAccessTokenByUserId('u-1', 'gmail', { accessToken: 'ya29.new', expiryDate: new Date(), refreshToken: '1//rot' });
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toMatch(/^enc:v1:/);
    expect(params[2]).toMatch(/^enc:v1:/);
  });

  it('keeps the stored refresh token when none is rotated', async () => {
    db.query.mockResolvedValue([]);
    await repo.updateAccessTokenByProviderUserId('a@b.com', 'gmail', { accessToken: 'ya29.new', expiryDate: new Date() });
    expect(db.query.mock.calls[0][1][2]).toBeNull();
  });

  it('returns decrypted tokens to callers and still reads legacy plaintext rows', async () => {
    db.query.mockResolvedValueOnce([{ id: 'i-1', access_token: encryptToken('ya29.access'), refresh_token: encryptToken('1//refresh') }]);
    const identity = await repo.findByUserIdAndProvider('u-1', 'gmail');
    expect(identity.access_token).toBe('ya29.access');
    expect(identity.refresh_token).toBe('1//refresh');

    db.query.mockResolvedValueOnce([{ id: 'i-2', access_token: 'legacy-access', refresh_token: 'legacy-refresh' }]);
    const legacy = await repo.findByProviderAndProviderUserId('gmail', 'a@b.com');
    expect(legacy.refresh_token).toBe('legacy-refresh');
  });
});
