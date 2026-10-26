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

const proposalDraftController = require('../proposal-draft.controller');
const proposalDraftService = require('../../services/proposal-draft.service');

jest.mock('../../services/proposal-draft.service');

describe('ProposalDraftController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: 'draft-101' },
      tenantId: 'tenant-abc-123',
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('approveProposalDraft', () => {
    it('approves proposal draft using tenantId and returns 200 with result', async () => {
      const mockResult = {
        proposal_id: 'draft-101',
        attachment_id: 'att-555',
      };
      proposalDraftService.approveProposal.mockResolvedValue(mockResult);

      await proposalDraftController.approveProposalDraft(req, res);

      expect(proposalDraftService.approveProposal).toHaveBeenCalledWith(
        'draft-101',
        null,
        'tenant-abc-123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Proposal approved successfully',
        data: mockResult,
      });
    });

    it('falls back to x-tenant-id header when req.tenantId is not preset', async () => {
      req.tenantId = undefined;
      req.headers['x-tenant-id'] = 'header-tenant-456';
      proposalDraftService.approveProposal.mockResolvedValue({ proposal_id: 'draft-101' });

      await proposalDraftController.approveProposalDraft(req, res);

      expect(proposalDraftService.approveProposal).toHaveBeenCalledWith(
        'draft-101',
        null,
        'header-tenant-456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns the client error status and message for expected failures', async () => {
      const notFound = new Error('Proposal not found or already approved');
      notFound.statusCode = 404;
      proposalDraftService.approveProposal.mockRejectedValue(notFound);

      await proposalDraftController.approveProposalDraft(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Proposal not found or already approved',
      });
    });

    it('hides internal error details behind a generic 500', async () => {
      proposalDraftService.approveProposal.mockRejectedValue(new Error('relation "proposal_draft" does not exist'));

      await proposalDraftController.approveProposalDraft(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal Server Error',
      });
    });
  });
});
