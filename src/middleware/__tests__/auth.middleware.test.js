const jwt = require('jsonwebtoken');
const authenticateJWT = require('../auth.middleware');

describe('Auth Middleware (authenticateJWT)', () => {
  let req;
  let res;
  let next;
  const originalSecret = process.env.JWT_SECRET;
  const testSecret = 'test-jwt-secret-key-12345';

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret;
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('rejects requests without Authorization header with 401', () => {
    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with malformed Authorization header with 401', () => {
    req.headers.authorization = 'NotBearer format';

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects forged/unverified tokens with 401', () => {
    const forgedToken = jwt.sign({ tenantId: 'tenant-123', userId: 'user-1' }, 'wrong-secret');
    req.headers.authorization = `Bearer ${forgedToken}`;

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects expired tokens with 401', () => {
    const expiredToken = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      testSecret,
      { expiresIn: '-1s' }
    );
    req.headers.authorization = `Bearer ${expiredToken}`;

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects tokens missing tenantId with 401', () => {
    const tokenWithoutTenant = jwt.sign({ userId: 'user-1' }, testSecret);
    req.headers.authorization = `Bearer ${tokenWithoutTenant}`;

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates valid tokens and sets req.tenantId and req.userId', () => {
    const validToken = jwt.sign(
      { tenantId: 'tenant-abc-123', userId: 'user-def-456' },
      testSecret
    );
    req.headers.authorization = `Bearer ${validToken}`;

    authenticateJWT(req, res, next);

    expect(req.tenantId).toBe('tenant-abc-123');
    expect(req.userId).toBe('user-def-456');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 in production when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    req.headers.authorization = 'Bearer some-token';

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'JWT_SECRET is not configured' });
    expect(next).not.toHaveBeenCalled();

    process.env.NODE_ENV = 'test';
  });
});
