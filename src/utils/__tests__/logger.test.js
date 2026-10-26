const logger = require('../logger');

describe('logger redaction', () => {
  let errorSpy;
  let debugSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEBUG;
  });

  it('masks token, secret and authorization values at any nesting level', () => {
    logger.error('Gmail call failed', {
      accessToken: 'ya29.secret-access',
      refresh_token: '1//secret-refresh',
      config: { headers: { Authorization: 'Bearer ya29.secret-access', 'x-api-key': 'AIzaSecret' } },
      client_secret: 'GOCSPX-secret',
      token_expires_at: '2026-10-26',
      tenantId: 't-1',
    });
    const out = errorSpy.mock.calls[0].join(' ');
    expect(out).not.toMatch(/ya29|1\/\/secret|GOCSPX|AIzaSecret/);
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('t-1');
    expect(out).toContain('2026-10-26');
  });

  it('logs errors as name/message/code/stack only, dropping attached request config', () => {
    const err = new Error('invalid_grant');
    err.code = 400;
    err.config = { headers: { Authorization: 'Bearer ya29.leaked' }, data: 'refresh_token=1//leaked' };
    err.response = { status: 400, data: { error: 'invalid_grant' } };

    logger.error('Token refresh failed:', err);

    const out = errorSpy.mock.calls[0].join(' ');
    expect(out).toContain('invalid_grant');
    expect(out).not.toContain('ya29.leaked');
    expect(out).not.toContain('1//leaked');
  });

  it('summarises buffers instead of dumping file contents', () => {
    process.env.DEBUG = 'true';
    logger.debug('upload', { buffer: Buffer.from('confidential file bytes') });
    const out = debugSpy.mock.calls[0].join(' ');
    expect(out).not.toContain('confidential');
    expect(out).toContain('[Buffer 23 bytes]');
  });

  it('only prints debug output when DEBUG is set', () => {
    logger.debug('hidden');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
