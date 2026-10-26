const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

process.env.JWT_SECRET = SECRET;
process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

jest.mock('../features/auto-proposal/repositories/tenant.repository', () => ({
  findById: jest.fn(async (id) => ({ id, name: 'Tenant' })),
  findAll: jest.fn(async () => []),
  findBySlug: jest.fn(async () => null),
  create: jest.fn(),
}));
jest.mock('../features/auto-proposal/repositories/tenant-profile.repository', () => ({
  findByTenantId: jest.fn(async (tenantId) => ({ tenant_id: tenantId })),
  updateField: jest.fn(async () => ({})),
}));
jest.mock('../features/auto-proposal/services/google-auth.service', () => ({
  getAuthUrl: jest.fn(),
  verifyState: jest.fn(() => { throw new Error('invalid state'); }),
  handleGoogleCallback: jest.fn(),
  revokeGoogleToken: jest.fn(),
}));
jest.mock('../features/auto-proposal/services/gmail-read-email.service', () => ({
  fetchNewEmails: jest.fn(async () => {}),
}));

const tenantProfileRepository = require('../features/auto-proposal/repositories/tenant-profile.repository');
const googleAuthService = require('../features/auto-proposal/services/google-auth.service');
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

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      port, method, path,
      headers: { ...(payload ? { 'content-type': 'application/json' } : {}), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function bearer(claims) {
  return { authorization: `Bearer ${jwt.sign({ userId: 'user-1', ...claims }, SECRET)}` };
}

describe('API authentication and tenant isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps /health public', async () => {
    expect((await request('GET', '/health')).status).toBe(200);
  });

  // Previously these were reachable anonymously, with tenant taken from header or URL.
  const anonymousCases = [
    ['GET', '/api/tenants'],
    ['POST', '/api/tenants'],
    ['GET', `/api/tenants/${TENANT_A}`],
    ['GET', '/api/leads'],
    ['GET', `/api/tenant-profile/${TENANT_A}`],
    ['PATCH', `/api/tenant-profile/${TENANT_A}/update-field`],
    ['GET', `/api/quotation-email-template/${TENANT_A}`],
    ['GET', `/api/quotation-templates/${TENANT_A}`],
    ['DELETE', '/api/quotation-templates/some-id'],
    ['GET', '/api/quotation-templates/some-id/preview'],
    ['GET', `/api/template-placeholder/${TENANT_A}`],
    ['GET', `/api/ai-response/suggest-concepts/${TENANT_A}`],
    ['POST', `/api/email-templates/upload/${TENANT_A}`],
    ['PATCH', '/api/proposal-draft/approve/some-id'],
    ['POST', '/api/gmail/test-prompt'],
    ['POST', '/api/social-integration/email/google/disconnect'],
    ['GET', '/api/email-conversations/contacts'],
  ];

  it.each(anonymousCases)('rejects anonymous %s %s with 401', async (method, path) => {
    const res = await request(method, path, { 'x-tenant-id': TENANT_A, 'x-user-id': 'user-1' });
    expect(res.status).toBe(401);
  });

  it('rejects an X-Tenant-Id header that differs from the token tenant', async () => {
    const res = await request('GET', '/api/leads', { ...bearer({ tenantId: TENANT_A }), 'x-tenant-id': TENANT_B });
    expect(res.status).toBe(403);
  });

  it('rejects a tenant in the URL that differs from the token tenant', async () => {
    const res = await request('GET', `/api/tenant-profile/${TENANT_B}`, bearer({ tenantId: TENANT_A }));
    expect(res.status).toBe(403);
    expect(tenantProfileRepository.findByTenantId).not.toHaveBeenCalled();
  });

  it('serves the token tenant\'s own data', async () => {
    const res = await request('GET', `/api/tenant-profile/${TENANT_A}`, bearer({ tenantId: TENANT_A }));
    expect(res.status).toBe(200);
    expect(tenantProfileRepository.findByTenantId).toHaveBeenCalledWith(TENANT_A);
  });

  it('restricts tenant listing and creation to platform admins', async () => {
    expect((await request('GET', '/api/tenants', bearer({ tenantId: TENANT_A }))).status).toBe(403);
    expect((await request('GET', '/api/tenants', bearer({ tenantId: TENANT_A, roles: ['platform_admin'] }))).status).toBe(200);
  });

  it('lets a user read only their own tenant record', async () => {
    expect((await request('GET', `/api/tenants/${TENANT_A}`, bearer({ tenantId: TENANT_A }))).status).toBe(200);
    expect((await request('GET', `/api/tenants/${TENANT_B}`, bearer({ tenantId: TENANT_A }))).status).toBe(403);
  });

  it('keeps the Google Pub/Sub webhook reachable without a JWT', async () => {
    const data = Buffer.from(JSON.stringify({ emailAddress: 'x@example.com', historyId: '1' })).toString('base64');
    const res = await request('POST', '/api/gmail/webhook', {}, { message: { data } });
    expect(res.status).toBe(200);
  });

  it('keeps the Google OAuth callback reachable but rejects unsigned state', async () => {
    const forged = Buffer.from(JSON.stringify({ tenantId: TENANT_A, userId: 'victim' })).toString('base64');
    const res = await request('GET', `/api/social-integration/email/google/callback?code=abc&state=${encodeURIComponent(forged)}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('GOOGLE_AUTH_ERROR');
    expect(googleAuthService.handleGoogleCallback).not.toHaveBeenCalled();
  });

  it('does not let a query string make a protected route public', async () => {
    const res = await request('GET', '/api/social-integration/email/google/status?x=/api/gmail/webhook');
    expect(res.status).toBe(401);
  });
});
