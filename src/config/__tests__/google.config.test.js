const { getGoogleClientForUser } = require('../google.config');
const userIdentityRepository = require('../../features/auto-proposal/repositories/user-identity.repository');

jest.mock('../../features/auto-proposal/repositories/user-identity.repository');

describe('google.config - getGoogleClientForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3004/callback';
  });

  it('fetches credentials by email when valid email is provided', async () => {
    userIdentityRepository.findByProviderAndProviderUserId.mockResolvedValue({
      id: 'id-1',
      access_token: 'token-123',
      refresh_token: 'refresh-456',
      token_expires_at: new Date(Date.now() + 3600000)
    });

    const client = await getGoogleClientForUser('user@example.com');
    expect(client).toBeDefined();
    expect(userIdentityRepository.findByProviderAndProviderUserId).toHaveBeenCalledWith('gmail', 'user@example.com');
    expect(client.credentials.access_token).toBe('token-123');
    expect(client.credentials.refresh_token).toBe('refresh-456');
  });

  it('fetches credentials by userId when email is missing or empty', async () => {
    userIdentityRepository.findByUserIdAndProvider.mockResolvedValue({
      id: 'id-2',
      access_token: 'token-abc',
      refresh_token: 'refresh-xyz',
      token_expires_at: new Date(Date.now() + 3600000)
    });

    const client = await getGoogleClientForUser('', 'user-uuid-999');
    expect(client).toBeDefined();
    expect(userIdentityRepository.findByUserIdAndProvider).toHaveBeenCalledWith('user-uuid-999', 'gmail');
    expect(client.credentials.access_token).toBe('token-abc');
  });

  it('handles "undefined" string cleanly without throwing undefined user error', async () => {
    userIdentityRepository.findByProviderAndProviderUserId.mockResolvedValue(null);
    userIdentityRepository.findByUserIdAndProvider.mockResolvedValue(null);

    await expect(getGoogleClientForUser('undefined', 'undefined')).rejects.toThrow(
      'No Gmail integration credentials found for identifier: unknown'
    );
  });

  it('throws an error with the email identifier when identity is not found', async () => {
    userIdentityRepository.findByProviderAndProviderUserId.mockResolvedValue(null);

    await expect(getGoogleClientForUser('missing@example.com')).rejects.toThrow(
      'No Gmail integration credentials found for identifier: missing@example.com'
    );
  });

  it('persists rotated refresh token when tokens event fires', async () => {
    userIdentityRepository.findByProviderAndProviderUserId.mockResolvedValue({
      id: 'id-1',
      access_token: 'initial-access',
      refresh_token: 'initial-refresh',
      token_expires_at: new Date()
    });

    const client = await getGoogleClientForUser('test@domain.com');

    // Emit tokens event with rotated refresh token
    client.emit('tokens', {
      access_token: 'new-access-token',
      refresh_token: 'rotated-refresh-token',
      expiry_date: Date.now() + 3600000
    });

    // Wait microtask tick for async listener
    await new Promise((resolve) => setImmediate(resolve));

    expect(userIdentityRepository.updateAccessTokenByProviderUserId).toHaveBeenCalledWith(
      'test@domain.com',
      'gmail',
      expect.objectContaining({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token'
      })
    );
  });
});
