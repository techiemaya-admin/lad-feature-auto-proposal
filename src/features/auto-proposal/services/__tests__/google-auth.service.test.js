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

    describe('getAuthUrl', () => {
        it('generates an offline consent URL containing the provided tenant state', () => {
            const tenantId = 'tenant-abc-123';
            const url = googleAuthService.getAuthUrl(tenantId);

            expect(typeof url).toBe('string');
            expect(url).toContain('access_type=offline');
            expect(url).toContain('prompt=consent');
            expect(url).toContain(`state=${tenantId}`);
            expect(url).toContain('gmail.readonly');
            expect(url).toContain('gmail.send');
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
