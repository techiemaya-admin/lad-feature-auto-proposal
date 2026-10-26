const jwt = require('jsonwebtoken');
const { authenticate, requirePlatformAdmin } = require('../auth');

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() };
}

describe('authenticate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: SECRET };
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sets req.auth from a valid token', () => {
    const token = jwt.sign({ sub: 'user-1', tenant_id: TENANT_ID, roles: ['member'] }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toEqual({ userId: 'user-1', tenantId: TENANT_ID, roles: ['member'] });
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'user-1', tenant_id: TENANT_ID }, 'some-other-secret-of-sufficient-length!!');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ sub: 'user-1', tenant_id: TENANT_ID, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects unsigned (alg: none) tokens', () => {
    const token = jwt.sign({ sub: 'user-1', tenant_id: TENANT_ID }, null, { algorithm: 'none' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when the token has no subject', () => {
    const token = jwt.sign({ tenant_id: TENANT_ID }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('enforces issuer when JWT_ISSUER is set', () => {
    process.env.JWT_ISSUER = 'https://auth.example.com';
    const token = jwt.sign({ sub: 'user-1', tenant_id: TENANT_ID }, SECRET, { issuer: 'https://evil.example.com' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('passes a config error to next when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    const req = { headers: { authorization: 'Bearer abc.def.ghi' } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requirePlatformAdmin', () => {
  it('calls next for platform_admin', () => {
    const next = jest.fn();
    requirePlatformAdmin({ auth: { roles: ['platform_admin'] } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for other roles', () => {
    const res = mockRes();
    const next = jest.fn();
    requirePlatformAdmin({ auth: { roles: ['member'] } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
