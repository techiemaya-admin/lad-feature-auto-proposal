process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue([Buffer.from('template content')]),
      }),
    }),
  })),
}));

jest.mock('../../services/ai-response.service', () => ({
  generateProposalFromTemplate: jest.fn(),
  callGeminiWithRetry: jest.fn(),
}));

const gmailReadEmailController = require('../gmail-read-email.controller');
const gmailService = require('../../services/gmail-read-email.service');

jest.mock('../../services/gmail-read-email.service');

describe('GmailReadEmailController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant-test-123',
      body: { prompt: 'Need photography and videography for wedding' },
      headers: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('testprompt', () => {
    it('sends a 200 OK JSON response with generated draft and requirements', async () => {
      const mockLeadReq = { id: 'req-1', tenant_id: 'tenant-test-123' };
      const mockValues = [{ label: 'Photography', price: 500 }];
      const mockDraft = { id: 'draft-1', final_price: 500 };

      gmailService.createLeadRequirementViaPrompt.mockResolvedValue({
        leadRequirementDetails: mockLeadReq,
        values: mockValues,
      });
      gmailService.createProposalDraft.mockResolvedValue(mockDraft);

      await gmailReadEmailController.testprompt(req, res);

      expect(gmailService.createLeadRequirementViaPrompt).toHaveBeenCalledWith(
        'Need photography and videography for wedding',
        '7cb0954d-ba2c-4224-969c-a3fa353a68fd',
        'tenant-test-123'
      );
      expect(gmailService.createProposalDraft).toHaveBeenCalledWith(
        mockLeadReq,
        expect.objectContaining({
          id: '7cb0954d-ba2c-4224-969c-a3fa353a68fd',
          email: 'test.lead@example.com',
        }),
        'Need photography and videography for wedding'
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          leadRequirementDetails: mockLeadReq,
          values: mockValues,
          draft: mockDraft,
        },
      });
    });

    it('returns a 400 Bad Request when X-Tenant-Id is missing', async () => {
      req.tenantId = undefined;
      req.headers = {};

      await gmailReadEmailController.testprompt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'X-Tenant-Id header is required' });
      expect(gmailService.createLeadRequirementViaPrompt).not.toHaveBeenCalled();
    });

    it('returns a 400 Bad Request when prompt is missing from body and query', async () => {
      req.body = {};
      req.query = {};

      await gmailReadEmailController.testprompt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prompt is required in request body or query',
      });
      expect(gmailService.createLeadRequirementViaPrompt).not.toHaveBeenCalled();
    });

    it('returns a 500 JSON error when prompt processing fails', async () => {
      gmailService.createLeadRequirementViaPrompt.mockRejectedValue(new Error('AI Service Unavailable'));

      await gmailReadEmailController.testprompt(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI Service Unavailable' });
    });
  });

  describe('startWatch', () => {
    it('returns 400 when tenantId is missing', async () => {
      req.tenantId = undefined;
      req.headers = {};
      req.body = { email: 'user@example.com' };

      await gmailReadEmailController.startWatch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Both X-Tenant-Id header and email parameter are required to start a watch',
      });
      expect(gmailService.startWatch).not.toHaveBeenCalled();
    });

    it('returns 400 when email is missing', async () => {
      req.body = {};
      req.query = {};

      await gmailReadEmailController.startWatch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Both X-Tenant-Id header and email parameter are required to start a watch',
      });
      expect(gmailService.startWatch).not.toHaveBeenCalled();
    });

    it('initiates watch subscription and returns result when valid parameters are provided', async () => {
      req.body = { email: 'photographer@studio.com' };
      const mockResult = { historyId: '123456', expiration: '1700000000' };
      gmailService.startWatch.mockResolvedValue({ data: mockResult });

      await gmailReadEmailController.startWatch(req, res);

      expect(gmailService.startWatch).toHaveBeenCalledWith('photographer@studio.com', 'tenant-test-123');
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('returns 500 when service throws an error', async () => {
      req.body = { email: 'photographer@studio.com' };
      gmailService.startWatch.mockRejectedValue(new Error('Google PubSub error'));

      await gmailReadEmailController.startWatch(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Google PubSub error' });
    });
  });
});
