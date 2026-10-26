const express = require('express');
const http = require('http');

function request(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: server.address().port, path, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('rate limiting', () => {
  const originalEnv = process.env;
  let server;

  beforeAll((done) => {
    process.env = { ...originalEnv, AI_RATE_LIMIT_PER_MINUTE: '2', RATE_LIMIT_PER_MINUTE: '4' };
    const { createApiLimiter, createAiLimiter, AI_ROUTE_PREFIXES } = require('../rate-limit.middleware');
    const app = express();
    // stand-in for authenticateJWT: the user comes from a header in this test only
    app.use((req, res, next) => {
      if (req.headers['x-test-user']) {
        req.isAuthenticated = true;
        req.tenantId = 'tenant-1';
        req.userId = req.headers['x-test-user'];
      }
      next();
    });
    app.use('/api', createApiLimiter());
    app.use(AI_ROUTE_PREFIXES, createAiLimiter());
    app.get('/api/ai-response/suggest-concepts/x', (req, res) => res.json({ ok: true }));
    app.get('/api/leads', (req, res) => res.json({ ok: true }));
    app.post('/api/gmail/webhook', (req, res) => res.send('ok'));
    server = app.listen(0, done);
  });

  afterAll((done) => {
    process.env = originalEnv;
    server.close(done);
  });

  it('limits AI endpoints per user and returns 429', async () => {
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push(await request(server, '/api/ai-response/suggest-concepts/x', { 'x-test-user': 'alice' }));
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('keeps limits separate per user', async () => {
    expect(await request(server, '/api/ai-response/suggest-concepts/x', { 'x-test-user': 'bob' })).toBe(200);
  });

  it('applies the general API limit', async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push(await request(server, '/api/leads', { 'x-test-user': 'carol' }));
    expect(statuses.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(statuses[4]).toBe(429);
  });
});
