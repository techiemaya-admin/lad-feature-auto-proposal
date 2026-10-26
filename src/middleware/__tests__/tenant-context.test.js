const { tenantContext, matchTenantParam } = require('../tenant-context');
const tenantRepository = require('../../features/auto-proposal/repositories/tenant.repository');

jest.mock('../../features/auto-proposal/repositories/tenant.repository');

describe('Tenant Context Middleware (tenantContext)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns 401 when the request is not authenticated', async () => {
    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(tenantRepository.findById).not.toHaveBeenCalled();
  });

  it('ignores X-Tenant-Id on unauthenticated requests', async () => {
    req.headers['x-tenant-id'] = 'tenant-valid-123';

    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(tenantRepository.findById).not.toHaveBeenCalled();
  });

  it('returns 403 when X-Tenant-Id differs from the token tenant', async () => {
    req.isAuthenticated = true;
    req.tenantId = 'tenant-from-jwt-456';
    req.headers['x-tenant-id'] = 'other-tenant-789';

    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(tenantRepository.findById).not.toHaveBeenCalled();
  });

  it('accepts a matching X-Tenant-Id header', async () => {
    req.isAuthenticated = true;
    req.tenantId = 'tenant-from-jwt-456';
    req.headers['x-tenant-id'] = 'tenant-from-jwt-456';
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-from-jwt-456' });

    await tenantContext(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when tenant is not found in repository', async () => {
    req.isAuthenticated = true;
    req.tenantId = 'non-existent-tenant-999';
    tenantRepository.findById.mockResolvedValue(null);

    await tenantContext(req, res, next);

    expect(tenantRepository.findById).toHaveBeenCalledWith('non-existent-tenant-999');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves tenant from the verified token and calls next()', async () => {
    req.isAuthenticated = true;
    req.tenantId = 'tenant-from-jwt-456';
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-from-jwt-456', name: 'Acme Corp' });

    await tenantContext(req, res, next);

    expect(tenantRepository.findById).toHaveBeenCalledWith('tenant-from-jwt-456');
    expect(req.tenantId).toBe('tenant-from-jwt-456');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes repository errors to next()', async () => {
    req.isAuthenticated = true;
    req.tenantId = 'tenant-valid-123';
    const dbError = new Error('Database connection failure');
    tenantRepository.findById.mockRejectedValue(dbError);

    await tenantContext(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('matchTenantParam', () => {
  let res;
  let next;

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  it('calls next() when the path tenant matches the token tenant', () => {
    matchTenantParam({ isAuthenticated: true, tenantId: 't-1' }, res, next, 't-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when the path tenant differs from the token tenant', () => {
    matchTenantParam({ isAuthenticated: true, tenantId: 't-1' }, res, next, 't-2');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', () => {
    matchTenantParam({}, res, next, 't-1');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
