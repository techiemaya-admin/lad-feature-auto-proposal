const gmailController = require('../gmail.controller');

describe('GmailController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-123',
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('sendEmail (deprecated)', () => {
    it('returns 410 Gone status with deprecation explanation', async () => {
      await gmailController.sendEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Gone: /api/gmail/send-email has been deprecated'),
        })
      );
    });
  });

  describe('readEmails (deprecated)', () => {
    it('returns 410 Gone status with deprecation explanation', async () => {
      await gmailController.readEmails(req, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Gone: /api/gmail/read-emails has been deprecated'),
        })
      );
    });
  });

  describe('webhook', () => {
    it('returns 200 OK status', () => {
      gmailController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
    });
  });
});
