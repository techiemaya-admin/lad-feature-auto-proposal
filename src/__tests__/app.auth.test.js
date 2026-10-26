const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';

process.env.JWT_SECRET = SECRET;
process.env.DB_PASSWORD = 'unused-in-tests';

jest.mock('../features/tenant/repositories/tenant.repository', () => ({
  findById: jest.fn(async (id) => ({ id, name: 'Tenant' })),
  findAll: jest.fn(async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Tenant' }]),
  findBySlug: jest.fn(async () => null),
  create: jest.fn(),
}));
jest.mock('../features/lead/repositories/lead.repository', () => ({
  findAll: jest.fn(async () => []),
  findById: jest.fn(async () => null),
  create: jest.fn(),
}));

const leadRepository = require('../features/lead/repositories/lead.repository');
const app = require('../app');

let server;
let port;

beforeAll((done) => {
  server = app.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

function bearer(claims) {
  return { authorization: `Bearer ${jwt.sign({ sub: 'user-1', ...claims }, SECRET)}` };
}

describe('API authentication', () => {
  beforeEach(() => {
    leadRepository.findAll.mockClear();
  });

  it('keeps /health public', async () => {
    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
  });

  it('rejects tenant-scoped requests that only send X-Tenant-Id', async () => {
    const res = await request('GET', '/api/leads', { 'x-tenant-id': TENANT_ID });
    expect(res.status).toBe(401);
    expect(leadRepository.findAll).not.toHaveBeenCalled();
  });

  it('scopes tenant data to the token tenant', async () => {
    const res = await request('GET', '/api/leads', bearer({ tenant_id: TENANT_ID }));
    expect(res.status).toBe(200);
    expect(leadRepository.findAll).toHaveBeenCalledWith(TENANT_ID, 100, 0);
  });

  it('rejects an X-Tenant-Id that differs from the token tenant', async () => {
    const res = await request('GET', '/api/leads', { ...bearer({ tenant_id: TENANT_ID }), 'x-tenant-id': OTHER_TENANT_ID });
    expect(res.status).toBe(403);
    expect(leadRepository.findAll).not.toHaveBeenCalled();
  });

  it('rejects anonymous tenant listing', async () => {
    const res = await request('GET', '/api/tenants');
    expect(res.status).toBe(401);
  });

  it('rejects tenant listing for non-admin users', async () => {
    const res = await request('GET', '/api/tenants', bearer({ tenant_id: TENANT_ID, roles: ['member'] }));
    expect(res.status).toBe(403);
  });

  it('allows tenant listing for platform admins', async () => {
    const res = await request('GET', '/api/tenants', bearer({ roles: ['platform_admin'] }));
    expect(res.status).toBe(200);
  });

  it('lets a user read only their own tenant record', async () => {
    const own = await request('GET', `/api/tenants/${TENANT_ID}`, bearer({ tenant_id: TENANT_ID }));
    const other = await request('GET', `/api/tenants/${OTHER_TENANT_ID}`, bearer({ tenant_id: TENANT_ID }));
    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
  });
});
