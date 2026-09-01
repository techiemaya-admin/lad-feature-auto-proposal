jest.mock('../../repositories/user-identity.repository', () => ({
  findByUserIdAndProvider: jest.fn(),
  findByProviderDetails: jest.fn(),
  deleteIdentity: jest.fn(),
}));

jest.mock('../../services/google-auth.service', () => ({
  getAuthUrl: jest.fn(),
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

    it('uses x-user-id header when req.userId is absent', () => {
      delete req.userId;
      req.headers['x-user-id'] = 'user-header-2';
      expect(socialIntegrationController.resolveUserId(req)).toBe('user-header-2');
    });

    it('uses query parameter userId when req.userId and header are absent', () => {
      delete req.userId;
      req.query.userId = 'user-query-3';
      expect(socialIntegrationController.resolveUserId(req)).toBe('user-query-3');
    });

    it('uses body userId when other sources are absent', () => {
      delete req.userId;
      req.body.userId = 'user-body-4';
      expect(socialIntegrationController.resolveUserId(req)).toBe('user-body-4');
    });

    it('falls back to default seeded admin user ID when nothing is supplied in non-production environment', () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        delete req.userId;
        req.headers = {};
        req.query = {};
        req.body = {};
        expect(socialIntegrationController.resolveUserId(req)).toBe('b8c1ffa5-3000-4e85-bf56-237ba478aea2');
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('returns null when nothing is supplied in production environment', () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete req.userId;
        req.headers = {};
        req.query = {};
        req.body = {};
        expect(socialIntegrationController.resolveUserId(req)).toBeNull();
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('ignores query parameter and body userId in production environment', () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete req.userId;
        req.headers = {};
        req.query = { userId: 'untrusted-query-user' };
        req.body = { userId: 'untrusted-body-user' };
        expect(socialIntegrationController.resolveUserId(req)).toBeNull();
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('still honors x-user-id header from trusted proxy/gateway in production environment', () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete req.userId;
        req.headers = { 'x-user-id': 'trusted-gateway-user' };
        req.query = { userId: 'untrusted-query-user' };
        req.body = { userId: 'untrusted-body-user' };
        expect(socialIntegrationController.resolveUserId(req)).toBe('trusted-gateway-user');
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });

  describe('Production Environment Guard (userId required)', () => {
    const oldEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete req.userId;
      req.headers = {};
      req.query = {};
      req.body = {};
    });

    afterEach(() => {
      process.env.NODE_ENV = oldEnv;
    });

    it('getGoogleEmailStatus returns 400 in production when user ID cannot be resolved', async () => {
      await socialIntegrationController.getGoogleEmailStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('User identification'),
      }));
    });

    it('initiateGoogle returns 400 in production when user ID cannot be resolved', async () => {
      await socialIntegrationController.initiateGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('User identification'),
      }));
    });

    it('disconnectGoogle returns 400 in production when user ID cannot be resolved', async () => {
      await socialIntegrationController.disconnectGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('User identification'),
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

    it('decodes base64 state, calls handleGoogleCallback, and responds with success HTML', async () => {
      const statePayload = Buffer.from(
        JSON.stringify({
          tenantId: 'tenant-from-state',
          userId: 'user-from-state',
        })
      ).toString('base64');

      req.query = {
        code: 'google-auth-code-123',
        state: statePayload,
      };

      authService.handleGoogleCallback.mockResolvedValue();

      await socialIntegrationController.googleCallback(req, res);

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

    it('handles plain string state fallback gracefully', async () => {
      req.query = {
        code: 'google-auth-code-456',
        state: 'plain-tenant-id',
      };
      req.userId = 'user-test-123';

      authService.handleGoogleCallback.mockResolvedValue();

      await socialIntegrationController.googleCallback(req, res);

      expect(authService.handleGoogleCallback).toHaveBeenCalledWith(
        'google-auth-code-456',
        'user-test-123',
        'plain-tenant-id'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('GOOGLE_AUTH_SUCCESS');
    });

    it('handles callback service failure with error HTML and postMessage', async () => {
      req.query = {
        code: 'bad-code',
        state: 'some-state',
      };

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
