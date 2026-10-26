const { verifyPubSubPush, _setClientForTests } = require('../pubsub-auth.middleware');

describe('verifyPubSubPush', () => {
  const originalEnv = process.env;
  let res;
  let next;
  let verifyIdToken;

  function payload(overrides = {}) {
    return {
      iss: 'https://accounts.google.com',
      email: 'pubsub-push@project.iam.gserviceaccount.com',
      email_verified: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PUBSUB_PUSH_AUDIENCE: 'https://api.example.com/api/gmail/webhook',
      PUBSUB_PUSH_SERVICE_ACCOUNT: 'pubsub-push@project.iam.gserviceaccount.com',
    };
    delete process.env.PUBSUB_SKIP_VERIFY;
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    verifyIdToken = jest.fn();
    _setClientForTests({ verifyIdToken });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a valid token from the configured service account', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload() });

    await verifyPubSubPush({ headers: { authorization: 'Bearer good-token' } }, res, next);

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'good-token',
      audience: 'https://api.example.com/api/gmail/webhook',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects requests without a bearer token', async () => {
    await verifyPubSubPush({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects tokens that fail signature or audience verification', async () => {
    verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));
    await verifyPubSubPush({ headers: { authorization: 'Bearer bad' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects tokens from a different service account', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email: 'attacker@evil.iam.gserviceaccount.com' }) });
    await verifyPubSubPush({ headers: { authorization: 'Bearer t' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects tokens with an unverified email or foreign issuer', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email_verified: false }) });
    await verifyPubSubPush({ headers: { authorization: 'Bearer t' } }, res, next);
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ iss: 'https://evil.example.com' }) });
    await verifyPubSubPush({ headers: { authorization: 'Bearer t' } }, res, next);
    expect(res.status).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed when verification is not configured', async () => {
    delete process.env.PUBSUB_PUSH_AUDIENCE;
    await verifyPubSubPush({ headers: { authorization: 'Bearer t' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows the explicit local-dev bypass outside production only', async () => {
    delete process.env.PUBSUB_PUSH_AUDIENCE;
    process.env.PUBSUB_SKIP_VERIFY = 'true';
    await verifyPubSubPush({ headers: {} }, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    next.mockClear();
    process.env.NODE_ENV = 'production';
    await verifyPubSubPush({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
