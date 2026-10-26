jest.mock('../../features/tenant/repositories/tenant.repository', () => ({
  findById: jest.fn(),
}));

const tenantRepository = require('../../features/tenant/repositories/tenant.repository');
const { tenantContext } = require('../tenant-context');

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('tenantContext', () => {
  beforeEach(() => {
    tenantRepository.findById.mockReset();
  });

  it('sets req.tenantId from the authenticated token', async () => {
    tenantRepository.findById.mockResolvedValue({ id: TENANT_ID });
    const req = { auth: { tenantId: TENANT_ID }, headers: {} };
    const next = jest.fn();

    await tenantContext(req, mockRes(), next);

    expect(tenantRepository.findById).toHaveBeenCalledWith(TENANT_ID);
    expect(req.tenantId).toBe(TENANT_ID);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when the token has no tenant, even if X-Tenant-Id is sent', async () => {
    const req = { auth: { tenantId: null }, headers: { 'x-tenant-id': TENANT_ID } };
    const res = mockRes();
    const next = jest.fn();

    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(tenantRepository.findById).not.toHaveBeenCalled();
  });

  it('returns 403 when X-Tenant-Id does not match the token tenant', async () => {
    const req = { auth: { tenantId: TENANT_ID }, headers: { 'x-tenant-id': OTHER_TENANT_ID } };
    const res = mockRes();
    const next = jest.fn();

    await tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the token tenant is not a UUID', async () => {
    const req = { auth: { tenantId: 'not-a-uuid' }, headers: {} };
    const res = mockRes();

    await tenantContext(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(tenantRepository.findById).not.toHaveBeenCalled();
  });

  it('returns 404 when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);
    const req = { auth: { tenantId: TENANT_ID }, headers: {} };
    const res = mockRes();

    await tenantContext(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
