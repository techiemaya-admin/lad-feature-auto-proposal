const db = require('../../../../config/data-source');
const userIdentityRepository = require('../user-identity.repository');

jest.mock('../../../../config/data-source', () => ({
  query: jest.fn(),
}));

describe('UserIdentityRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserIdAndProvider', () => {
    it('queries user_identities by user_id and provider', async () => {
      db.query.mockResolvedValue([{ id: 'ident-1', user_id: 'user-123', provider: 'gmail' }]);

      const result = await userIdentityRepository.findByUserIdAndProvider('user-123', 'gmail');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE user_id = $1');
      expect(sql).toContain('AND provider  = $2');
      expect(values).toEqual(['user-123', 'gmail']);
      expect(result).toEqual({ id: 'ident-1', user_id: 'user-123', provider: 'gmail' });
    });
  });

  describe('findByProviderAndProviderUserIdAndTenantId (legacy alias)', () => {
    it('delegates to findByUserIdAndProvider', async () => {
      const spy = jest.spyOn(userIdentityRepository, 'findByUserIdAndProvider').mockResolvedValue({ id: 'ident-1' });

      const result = await userIdentityRepository.findByProviderAndProviderUserIdAndTenantId('user-123', 'gmail');

      expect(spy).toHaveBeenCalledWith('user-123', 'gmail');
      expect(result).toEqual({ id: 'ident-1' });
      spy.mockRestore();
    });
  });

  describe('updateAccessTokenByUserId', () => {
    it('updates access token and supports refresh token rotation via COALESCE', async () => {
      db.query.mockResolvedValue([]);

      const tokenDetails = {
        accessToken: 'new-acc',
        expiryDate: new Date('2026-09-01T15:00:00Z'),
        refreshToken: 'new-ref'
      };

      await userIdentityRepository.updateAccessTokenByUserId('user-123', 'gmail', tokenDetails);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('refresh_token = COALESCE($3, refresh_token)');
      expect(values).toEqual([
        'new-acc',
        tokenDetails.expiryDate,
        'new-ref',
        'user-123',
        'gmail'
      ]);
    });

    it('passes null for refreshToken when omitted so COALESCE retains existing value', async () => {
      db.query.mockResolvedValue([]);

      const tokenDetails = {
        accessToken: 'new-acc',
        expiryDate: new Date('2026-09-01T15:00:00Z')
      };

      await userIdentityRepository.updateAccessTokenByUserId('user-123', 'gmail', tokenDetails);

      const [, values] = db.query.mock.calls[0];
      expect(values[2]).toBeNull();
    });
  });

  describe('updateAccessTokenByProviderUserId', () => {
    it('updates access token and supports refresh token rotation via COALESCE', async () => {
      db.query.mockResolvedValue([]);

      const tokenDetails = {
        accessToken: 'new-acc',
        expiryDate: new Date('2026-09-01T15:00:00Z'),
        refreshToken: 'new-ref'
      };

      await userIdentityRepository.updateAccessTokenByProviderUserId('email@domain.com', 'gmail', tokenDetails);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('refresh_token = COALESCE($3, refresh_token)');
      expect(values).toEqual([
        'new-acc',
        tokenDetails.expiryDate,
        'new-ref',
        'email@domain.com',
        'gmail'
      ]);
    });
  });

  describe('findTenantContextByProviderUserId', () => {
    it('returns userIdentityId, userId, and tenantId when matching identity exists', async () => {
      db.query.mockResolvedValue([
        {
          user_identities_id: 'ident-uuid-1',
          user_id: 'user-uuid-2',
          tenant_id: 'tenant-uuid-3'
        }
      ]);

      const result = await userIdentityRepository.findTenantContextByProviderUserId('gmail', 'lead@example.com');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, values] = db.query.mock.calls[0];
      expect(sql).toContain('COALESCE(gw.tenant_id, u.primary_tenant_id) AS tenant_id');
      expect(sql).toContain('WHERE ui.provider = $1 AND LOWER(ui.provider_user_id) = LOWER($2)');
      expect(values).toEqual(['gmail', 'lead@example.com']);
      expect(result).toEqual({
        userIdentityId: 'ident-uuid-1',
        userId: 'user-uuid-2',
        tenantId: 'tenant-uuid-3'
      });
    });

    it('returns null when no matching identity is found', async () => {
      db.query.mockResolvedValue([]);

      const result = await userIdentityRepository.findTenantContextByProviderUserId('gmail', 'unknown@example.com');

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });
});

