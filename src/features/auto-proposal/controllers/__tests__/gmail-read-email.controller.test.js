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
      body: { prompt: 'Need photography and videography for wedding' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('testprompt', () => {
    it('sends a 200 OK JSON response with generated draft and requirements', async () => {
      const mockLeadReq = { id: 'req-1', tenant_id: 'tenant-1' };
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
        'e0a3e9ca-3f46-4bb0-ac10-a91b5c1d20b5'
      );
      expect(gmailService.createProposalDraft).toHaveBeenCalledWith(
        mockLeadReq,
        expect.objectContaining({ id: '7cb0954d-ba2c-4224-969c-a3fa353a68fd' }),
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

    it('returns a 500 JSON error when prompt processing fails', async () => {
      gmailService.createLeadRequirementViaPrompt.mockRejectedValue(new Error('AI Service Unavailable'));

      await gmailReadEmailController.testprompt(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI Service Unavailable' });
    });
  });
});
