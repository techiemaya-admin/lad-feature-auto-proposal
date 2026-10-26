jest.mock('../../repositories/user-identity.repository', () => ({
  findByUserIdAndProvider: jest.fn(),
  findByProviderDetails: jest.fn(),
  deleteIdentity: jest.fn(),
}));

jest.mock('../../services/google-auth.service', () => ({
  getAuthUrl: jest.fn(),
  verifyState: jest.fn(),
  handleGoogleCallback: jest.fn(),
  revokeGoogleToken: jest.fn(),
}));

const socialIntegrationController = require('../social-integration.controller');
const userIdentityRepository = require('../../repositories/user-identity.repository');
const authService = require('../../services/google-auth.service');

describe('SocialIntegrationController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5',
      userId: 'user-test-123',
      headers: {},
      query: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('resolveUserId', () => {
    it('prioritizes req.userId when present', () => {
      req.userId = 'user-explicit-1';
      req.headers['x-user-id'] = 'user-header-2';
      expect(socialIntegrationController.resolveUserId(req)).toBe('user-explicit-1');
    });

    it('ignores x-user-id header, query and body userId when req.userId is absent', () => {
      delete req.userId;
      req.headers['x-user-id'] = 'attacker-header-user';
      req.query.userId = 'attacker-query-user';
      req.body.userId = 'attacker-body-user';
      expect(socialIntegrationController.resolveUserId(req)).toBeNull();
    });

    it('never falls back to a default user ID in non-production environments', () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        delete req.userId;
        expect(socialIntegrationController.resolveUserId(req)).toBeNull();
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });

  describe('User identity required', () => {
    const oldEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete req.userId;
      req.headers = { 'x-user-id': 'attacker-header-user' };
      req.query = {};
      req.body = {};
    });

    afterEach(() => {
      process.env.NODE_ENV = oldEnv;
    });

    it('getGoogleEmailStatus returns 400 when no authenticated user ID is present', async () => {
      await socialIntegrationController.getGoogleEmailStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Authenticated user context'),
      }));
    });

    it('initiateGoogle returns 400 when no authenticated user ID is present', async () => {
      await socialIntegrationController.initiateGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Authenticated user context'),
      }));
    });

    it('disconnectGoogle returns 400 when no authenticated user ID is present', async () => {
      await socialIntegrationController.disconnectGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Authenticated user context'),
      }));
    });
  });

  describe('getGoogleEmailStatus', () => {
    it('returns connected true and user email when user identity exists', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue({
        id: 'identity-1',
        provider: 'gmail',
        provider_user_id: 'connected.user@example.com',
      });

      await socialIntegrationController.getGoogleEmailStatus(req, res);

      expect(userIdentityRepository.findByUserIdAndProvider).toHaveBeenCalledWith(
        'user-test-123',
        'gmail'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        connected: true,
        email: 'connected.user@example.com',
      });
    });

    it('returns connected false when no user identity is found', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue(null);

      await socialIntegrationController.getGoogleEmailStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        connected: false,
      });
    });

    it('returns 500 when repository throws an error', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockRejectedValue(new Error('Database error'));

      await socialIntegrationController.getGoogleEmailStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
      });
    });
  });

  describe('getGoogleEmailStatusWithOtherDetails', () => {
    it('returns gmail connected object when identity exists', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue({
        id: 'identity-1',
        provider: 'gmail',
        provider_user_id: 'details.user@example.com',
      });

      await socialIntegrationController.getGoogleEmailStatusWithOtherDetails(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        gmail: {
          connected: true,
          email: 'details.user@example.com',
        },
      });
    });

    it('returns gmail disconnected object when identity does not exist', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue(null);

      await socialIntegrationController.getGoogleEmailStatusWithOtherDetails(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        gmail: {
          connected: false,
        },
      });
    });

    it('returns 500 when repository throws an error', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockRejectedValue(new Error('DB failure'));

      await socialIntegrationController.getGoogleEmailStatusWithOtherDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'DB failure',
      });
    });
  });

  describe('initiateGoogle', () => {
    it('generates auth URL and returns { url }', async () => {
      authService.getAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?client_id=123');

      await socialIntegrationController.initiateGoogle(req, res);

      expect(authService.getAuthUrl).toHaveBeenCalledWith(
        'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5',
        'user-test-123'
      );
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://accounts.google.com/o/oauth2/auth?client_id=123',
      });
    });

    it('returns 500 if authService.getAuthUrl throws', async () => {
      authService.getAuthUrl.mockImplementation(() => {
        throw new Error('Config missing');
      });

      await socialIntegrationController.initiateGoogle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to initialize auth flow',
      });
    });
  });

  describe('googleCallback', () => {
    it('handles Google consent denial error query cleanly with self-closing HTML', async () => {
      req.query = {
        error: 'access_denied',
        error_description: 'The user denied request to access data',
      };

      await socialIntegrationController.googleCallback(req, res);

      expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_ERROR');
      expect(html).toContain('access_denied');
      expect(html).toContain('window.close()');
    });

    it('handles missing authorization code with error HTML', async () => {
      req.query = { state: 'some-state' };

      await socialIntegrationController.googleCallback(req, res);

      expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_ERROR');
      expect(html).toContain('Authorization code missing');
    });

    it('verifies signed state, calls handleGoogleCallback with its identity, and responds with success HTML', async () => {
      req.query = {
        code: 'google-auth-code-123',
        state: 'signed-state-token',
      };
      authService.verifyState.mockReturnValue({ tenantId: 'tenant-from-state', userId: 'user-from-state' });
      authService.handleGoogleCallback.mockResolvedValue();

      await socialIntegrationController.googleCallback(req, res);

      expect(authService.verifyState).toHaveBeenCalledWith('signed-state-token');
      expect(authService.handleGoogleCallback).toHaveBeenCalledWith(
        'google-auth-code-123',
        'user-from-state',
        'tenant-from-state'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_SUCCESS');
      expect(html).toContain('Connected Successfully!');
      expect(html).toContain('window.close()');
    });

    it('rejects forged or unsigned state without linking any account', async () => {
      const forgedState = Buffer.from(
        JSON.stringify({ tenantId: 'victim-tenant', userId: 'victim-user' })
      ).toString('base64');
      req.query = { code: 'attacker-code', state: forgedState };
      authService.verifyState.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await socialIntegrationController.googleCallback(req, res);

      expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_ERROR');
      expect(html).toContain('invalid or has expired');
    });

    it('handles callback service failure with error HTML and postMessage', async () => {
      req.query = {
        code: 'bad-code',
        state: 'signed-state-token',
      };
      authService.verifyState.mockReturnValue({ tenantId: 'tenant-1', userId: 'user-1' });
      authService.handleGoogleCallback.mockRejectedValue(new Error('Invalid token exchange'));

      await socialIntegrationController.googleCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_ERROR');
      expect(html).toContain('Invalid token exchange');
    });
  });

  describe('disconnectGoogle', () => {
    it('revokes Google token and deletes identity record when identity exists', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue({
        id: 'identity-to-delete',
        access_token: 'active-access-token',
        refresh_token: 'active-refresh-token',
      });
      authService.revokeGoogleToken.mockResolvedValue();
      userIdentityRepository.deleteIdentity.mockResolvedValue();

      await socialIntegrationController.disconnectGoogle(req, res);

      expect(userIdentityRepository.findByUserIdAndProvider).toHaveBeenCalledWith(
        'user-test-123',
        'gmail'
      );
      expect(authService.revokeGoogleToken).toHaveBeenCalledWith('active-access-token');
      expect(userIdentityRepository.deleteIdentity).toHaveBeenCalledWith('identity-to-delete');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Google account disconnected successfully.',
      });
    });

    it('returns success even if identity is not found (idempotent disconnect)', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockResolvedValue(null);

      await socialIntegrationController.disconnectGoogle(req, res);

      expect(authService.revokeGoogleToken).not.toHaveBeenCalled();
      expect(userIdentityRepository.deleteIdentity).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Google account disconnected successfully.',
      });
    });

    it('returns 500 when disconnect throws an unhandled error', async () => {
      userIdentityRepository.findByUserIdAndProvider.mockRejectedValue(new Error('DB disconnect error'));

      await socialIntegrationController.disconnectGoogle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to cleanly disconnect Google account.',
        error: 'DB disconnect error',
      });
    });
  });

  describe('renderPopupHtml', () => {
    const oldFrontendUrl = process.env.FRONTEND_URL;

    afterEach(() => {
      process.env.FRONTEND_URL = oldFrontendUrl;
    });

    it('renders success popup with auto-closing script and success postMessage', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const html = socialIntegrationController.renderPopupHtml({ success: true });

      expect(html).toContain('Connected Successfully');
      expect(html).toContain('GOOGLE_AUTH_SUCCESS');
      expect(html).toContain("window.opener.postMessage({\"type\":\"GOOGLE_AUTH_SUCCESS\"}, \"http://localhost:3000\")");
      expect(html).toContain('window.close()');
    });

    it('neutralizes script tag breakout in error messages preventing XSS', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const maliciousError = '</script><script>alert("XSS")</script>';
      const html = socialIntegrationController.renderPopupHtml({
        success: false,
        error: maliciousError,
      });

      expect(html).not.toContain('</script><script>');
      expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003e');
      expect(html).toContain('&lt;/script&gt;&lt;script&gt;');
    });

    it('falls back to wildcard targetOrigin if FRONTEND_URL is unset', () => {
      delete process.env.FRONTEND_URL;
      const html = socialIntegrationController.renderPopupHtml({ success: true });

      expect(html).toContain('window.opener.postMessage({"type":"GOOGLE_AUTH_SUCCESS"}, "*")');
    });
  });
});
