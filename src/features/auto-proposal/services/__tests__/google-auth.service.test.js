process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue([Buffer.from('template content')]),
      }),
    }),
  })),
}));

const { google } = require('googleapis');
const userIdentityRepository = require('../../repositories/user-identity.repository');
const gmailService = require('../gmail-read-email.service');
const googleAuthService = require('../google-auth.service');

jest.mock('../../repositories/user-identity.repository');
jest.mock('../gmail-read-email.service');

describe('GoogleAuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createOAuth2Client', () => {
        it('returns a new OAuth2 client instance on each invocation to prevent concurrency race conditions', () => {
            const client1 = googleAuthService.createOAuth2Client();
            const client2 = googleAuthService.createOAuth2Client();

            expect(client1).toBeDefined();
            expect(client2).toBeDefined();
            expect(client1).not.toBe(client2);
        });
    });

    describe('getAuthUrl and OAuth state', () => {
        const originalSecret = process.env.JWT_SECRET;
        const originalStateSecret = process.env.OAUTH_STATE_SECRET;
        const jwt = require('jsonwebtoken');

        beforeEach(() => {
            process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
            delete process.env.OAUTH_STATE_SECRET;
        });

        afterAll(() => {
            process.env.JWT_SECRET = originalSecret;
            if (originalStateSecret === undefined) delete process.env.OAUTH_STATE_SECRET;
            else process.env.OAUTH_STATE_SECRET = originalStateSecret;
        });

        function stateFromUrl(url) {
            return new URL(url).searchParams.get('state');
        }

        it('generates an offline consent URL with a signed state', () => {
            const url = googleAuthService.getAuthUrl('tenant-abc-123', 'user-xyz-456');

            expect(typeof url).toBe('string');
            expect(url).toContain('access_type=offline');
            expect(url).toContain('prompt=consent');
            expect(url).toContain('gmail.readonly');
            expect(url).toContain('gmail.send');
            expect(googleAuthService.verifyState(stateFromUrl(url))).toEqual({
                tenantId: 'tenant-abc-123',
                userId: 'user-xyz-456',
            });
        });

        it('refuses to start OAuth without both tenantId and userId', () => {
            expect(() => googleAuthService.getAuthUrl('tenant-abc-123')).toThrow();
            expect(() => googleAuthService.getAuthUrl(null, 'user-xyz-456')).toThrow();
        });

        it('rejects unsigned base64 JSON state', () => {
            const forged = Buffer.from(JSON.stringify({ tenantId: 't', userId: 'u' })).toString('base64');
            expect(() => googleAuthService.verifyState(forged)).toThrow();
        });

        it('rejects state signed with a different key', () => {
            const forged = jwt.sign({ purpose: 'google_oauth_state', tenantId: 't', userId: 'u' }, 'attacker-key');
            expect(() => googleAuthService.verifyState(forged)).toThrow();
        });

        it('rejects expired state', () => {
            const url = googleAuthService.getAuthUrl('tenant-abc-123', 'user-xyz-456');
            const state = stateFromUrl(url);
            const realNow = Date.now;
            try {
                Date.now = () => realNow() + 11 * 60 * 1000;
                expect(() => googleAuthService.verifyState(state)).toThrow();
            } finally {
                Date.now = realNow;
            }
        });

        it('cannot be verified as an API bearer token with JWT_SECRET', () => {
            const state = stateFromUrl(googleAuthService.getAuthUrl('tenant-abc-123', 'user-xyz-456'));
            expect(() => jwt.verify(state, process.env.JWT_SECRET)).toThrow();
        });
    });

    describe('handleGoogleCallback', () => {
        it('exchanges code for tokens, fetches profile, saves identity, and triggers startWatch', async () => {
            const mockGetToken = jest.fn().mockResolvedValue({
                tokens: {
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    expiry_date: Date.now() + 3600 * 1000
                }
            });
            const mockSetCredentials = jest.fn();
            const mockUserinfoGet = jest.fn().mockResolvedValue({
                data: {
                    email: 'user@example.com',
                    id: 'google-user-123',
                    name: 'Test User'
                }
            });

            jest.spyOn(googleAuthService, 'createOAuth2Client').mockReturnValue({
                getToken: mockGetToken,
                setCredentials: mockSetCredentials
            });

            jest.spyOn(google, 'oauth2').mockReturnValue({
                userinfo: {
                    get: mockUserinfoGet
                }
            });

            userIdentityRepository.upsertIdentity.mockResolvedValue({ id: 'identity-1' });
            gmailService.startWatch.mockResolvedValue({ historyId: '1001' });

            await googleAuthService.handleGoogleCallback('auth-code-xyz', 'user-456', 'tenant-789');

            expect(mockGetToken).toHaveBeenCalledWith('auth-code-xyz');
            expect(mockSetCredentials).toHaveBeenCalledWith(expect.objectContaining({
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token'
            }));
            expect(mockUserinfoGet).toHaveBeenCalled();
            expect(userIdentityRepository.upsertIdentity).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-456',
                    email: 'user@example.com',
                    accessToken: 'mock-access-token',
                    refreshToken: 'mock-refresh-token'
                })
            );
            expect(gmailService.startWatch).toHaveBeenCalledWith('user@example.com', 'tenant-789');

            googleAuthService.createOAuth2Client.mockRestore();
            google.oauth2.mockRestore();
        });

        it('still completes successfully if startWatch fails (Pub/Sub unconfigured in dev/demo)', async () => {
            const mockGetToken = jest.fn().mockResolvedValue({
                tokens: {
                    access_token: 'mock-access-token',
                    refresh_token: 'mock-refresh-token',
                    expiry_date: Date.now() + 3600 * 1000
                }
            });
            const mockSetCredentials = jest.fn();
            const mockUserinfoGet = jest.fn().mockResolvedValue({
                data: {
                    email: 'user@example.com',
                    id: 'google-user-123',
                    name: 'Test User'
                }
            });

            jest.spyOn(googleAuthService, 'createOAuth2Client').mockReturnValue({
                getToken: mockGetToken,
                setCredentials: mockSetCredentials
            });

            jest.spyOn(google, 'oauth2').mockReturnValue({
                userinfo: {
                    get: mockUserinfoGet
                }
            });

            userIdentityRepository.upsertIdentity.mockResolvedValue({ id: 'identity-1' });
            gmailService.startWatch.mockRejectedValue(new Error('User not authorized on topic'));

            await expect(googleAuthService.handleGoogleCallback('code', 'user-1', 'tenant-1')).resolves.not.toThrow();

            expect(userIdentityRepository.upsertIdentity).toHaveBeenCalled();
            googleAuthService.createOAuth2Client.mockRestore();
            google.oauth2.mockRestore();
        });
    });

    describe('revokeGoogleToken', () => {
        it('revokes token using an isolated client', async () => {
            const mockRevokeToken = jest.fn().mockResolvedValue({});
            jest.spyOn(googleAuthService, 'createOAuth2Client').mockReturnValue({
                revokeToken: mockRevokeToken
            });

            await googleAuthService.revokeGoogleToken('token-to-revoke');

            expect(mockRevokeToken).toHaveBeenCalledWith('token-to-revoke');
            googleAuthService.createOAuth2Client.mockRestore();
        });

        it('handles token revocation errors gracefully without crashing', async () => {
            const mockRevokeToken = jest.fn().mockRejectedValue(new Error('Google API network error'));
            jest.spyOn(googleAuthService, 'createOAuth2Client').mockReturnValue({
                revokeToken: mockRevokeToken
            });

            await expect(googleAuthService.revokeGoogleToken('bad-token')).resolves.not.toThrow();

            googleAuthService.createOAuth2Client.mockRestore();
        });

        it('returns early when token is null or undefined', async () => {
            const spyCreate = jest.spyOn(googleAuthService, 'createOAuth2Client');
            await googleAuthService.revokeGoogleToken(null);
            expect(spyCreate).not.toHaveBeenCalled();
            spyCreate.mockRestore();
        });
    });
});
