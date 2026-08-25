const { tenantContext } = require('../tenant-context');
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

  it('returns 400 when X-Tenant-Id header is missing', async () => {
    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'X-Tenant-Id header is required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when tenant is not found in repository', async () => {
    req.headers['x-tenant-id'] = 'non-existent-tenant-999';
    tenantRepository.findById.mockResolvedValue(null);

    await tenantContext(req, res, next);

    expect(tenantRepository.findById).toHaveBeenCalledWith('non-existent-tenant-999');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.tenantId and calls next() when tenant exists', async () => {
    req.headers['x-tenant-id'] = 'tenant-valid-123';
    const mockTenant = { id: 'tenant-valid-123', name: 'Acme Corp' };
    tenantRepository.findById.mockResolvedValue(mockTenant);

    await tenantContext(req, res, next);

    expect(tenantRepository.findById).toHaveBeenCalledWith('tenant-valid-123');
    expect(req.tenantId).toBe('tenant-valid-123');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes repository errors to next()', async () => {
    req.headers['x-tenant-id'] = 'tenant-valid-123';
    const dbError = new Error('Database connection failure');
    tenantRepository.findById.mockRejectedValue(dbError);

    await tenantContext(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
