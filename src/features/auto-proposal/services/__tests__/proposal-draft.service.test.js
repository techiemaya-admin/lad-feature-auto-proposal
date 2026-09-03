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

const proposalRepo = require('../../repositories/proposal-draft.repository');
const leadRepo = require('../../repositories/lead.repository');
const attachmentRepo = require('../../repositories/lead-attachment.repository');
const tenantRepo = require('../../repositories/tenant.repository');
const gmailService = require('../gmail-send-email.service');
const googleConfig = require('../../../../config/google.config');
const userIdentityRepository = require('../../repositories/user-identity.repository');

jest.mock('../../repositories/proposal-draft.repository');
jest.mock('../../repositories/lead.repository');
jest.mock('../../repositories/lead-attachment.repository');
jest.mock('../../repositories/tenant.repository');
jest.mock('../../repositories/user-identity.repository');
jest.mock('../gmail-send-email.service');
jest.mock('../../../../config/google.config');

const proposalDraftService = require('../proposal-draft.service');

describe('ProposalDraftService - approveProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves draft and sends email using provided oAuth2Client', async () => {
    const mockDraft = {
      id: 'draft-1',
      tenant_id: 'tenant-1',
      lead_requirement_id: 'req-1',
      quotation_template_metadata_id: 'tmpl-1',
      gcs_storage_path: 'https://storage.googleapis.com/b/file.pdf',
      file_name: 'file.pdf',
      final_price: 1500,
    };

    const mockLead = {
      id: 'lead-1',
      email: 'lead@example.com',
    };

    const mockAttachment = {
      id: 'att-1',
    };

    const mockClient = { auth: true };

    proposalRepo.findDraftById.mockResolvedValue(mockDraft);
    leadRepo.findByLeadRequirementId.mockResolvedValue(mockLead);
    proposalRepo.approveProposalDraft.mockResolvedValue(true);
    attachmentRepo.create.mockResolvedValue(mockAttachment);
    gmailService.sendQuotationEmail.mockResolvedValue({ id: 'gmail-msg-1' });

    const result = await proposalDraftService.approveProposal('draft-1', mockClient);

    expect(proposalRepo.approveProposalDraft).toHaveBeenCalledWith('draft-1');
    expect(attachmentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        lead_id: 'lead-1',
        file_url: 'https://storage.googleapis.com/b/file.pdf',
      })
    );
    expect(gmailService.sendQuotationEmail).toHaveBeenCalledWith(
      'lead@example.com',
      'https://storage.googleapis.com/b/file.pdf',
      1500,
      mockClient
    );
    expect(result).toEqual({
      proposal_id: 'draft-1',
      attachment_id: 'att-1',
    });
  });

  it('dynamically resolves OAuth client from tenant when oAuth2Client is not provided', async () => {
    const mockDraft = {
      id: 'draft-2',
      tenant_id: 'tenant-2',
      lead_requirement_id: 'req-2',
      quotation_template_metadata_id: 'tmpl-2',
      gcs_storage_path: 'https://storage.googleapis.com/b/file2.pdf',
      file_name: 'file2.pdf',
      final_price: 2000,
    };

    const mockLead = {
      id: 'lead-2',
      email: 'lead2@example.com',
    };

    const mockTenant = {
      id: 'tenant-2',
      email: 'owner@tenant2.com',
    };

    const mockResolvedClient = { token: 'resolved-token' };

    proposalRepo.findDraftById.mockResolvedValue(mockDraft);
    leadRepo.findByLeadRequirementId.mockResolvedValue(mockLead);
    proposalRepo.approveProposalDraft.mockResolvedValue(true);
    attachmentRepo.create.mockResolvedValue({ id: 'att-2' });
    tenantRepo.findById.mockResolvedValue(mockTenant);
    googleConfig.getGoogleClientForUser.mockResolvedValue(mockResolvedClient);
    gmailService.sendQuotationEmail.mockResolvedValue({ id: 'gmail-msg-2' });

    const result = await proposalDraftService.approveProposal('draft-2');

    expect(tenantRepo.findById).toHaveBeenCalledWith('tenant-2');
    expect(googleConfig.getGoogleClientForUser).toHaveBeenCalledWith('owner@tenant2.com');
    expect(gmailService.sendQuotationEmail).toHaveBeenCalledWith(
      'lead2@example.com',
      'https://storage.googleapis.com/b/file2.pdf',
      2000,
      mockResolvedClient
    );
    expect(result).toEqual({
      proposal_id: 'draft-2',
      attachment_id: 'att-2',
    });
  });

  it('throws an error if draft does not exist', async () => {
    proposalRepo.findDraftById.mockResolvedValue(null);

    await expect(proposalDraftService.approveProposal('invalid-id')).rejects.toThrow(
      'Proposal not found or already approved'
    );
  });

  it('scopes draft lookup and approval by tenantId when tenantId is provided', async () => {
    const mockDraft = {
      id: 'draft-scoped',
      tenant_id: 'tenant-999',
      lead_requirement_id: 'req-999',
      gcs_storage_path: 'https://storage/doc.pdf',
      file_name: 'doc.pdf',
      final_price: 3500,
    };
    const mockLead = { id: 'lead-999', email: 'lead@scoped.com' };
    const mockClient = { auth: true };

    proposalRepo.findDraftById.mockResolvedValue(mockDraft);
    leadRepo.findByLeadRequirementId.mockResolvedValue(mockLead);
    proposalRepo.approveProposalDraft.mockResolvedValue(true);
    attachmentRepo.create.mockResolvedValue({ id: 'att-scoped' });
    gmailService.sendQuotationEmail.mockResolvedValue({ id: 'msg-scoped' });

    const result = await proposalDraftService.approveProposal('draft-scoped', mockClient, 'tenant-999');

    expect(proposalRepo.findDraftById).toHaveBeenCalledWith('draft-scoped', 'tenant-999');
    expect(leadRepo.findByLeadRequirementId).toHaveBeenCalledWith('req-999', 'tenant-999');
    expect(proposalRepo.approveProposalDraft).toHaveBeenCalledWith('draft-scoped', 'tenant-999');
    expect(result).toEqual({
      proposal_id: 'draft-scoped',
      attachment_id: 'att-scoped',
    });
  });

  it('falls back to userIdentityRepository.findByTenantId when tenant email is missing', async () => {
    const mockDraft = {
      id: 'draft-fallback-1',
      tenant_id: 'tenant-fb-1',
      lead_requirement_id: 'req-fb-1',
      quotation_template_metadata_id: 'tmpl-fb-1',
      gcs_storage_path: 'https://storage/fb1.pdf',
      file_name: 'fb1.pdf',
      final_price: 1800,
    };
    const mockLead = { id: 'lead-fb-1', email: 'client@example.com' };
    const mockIdentity = { provider_user_id: 'tenant-admin@gmail.com' };
    const mockResolvedClient = { auth: 'via-identity' };

    proposalRepo.findDraftById.mockResolvedValue(mockDraft);
    leadRepo.findByLeadRequirementId.mockResolvedValue(mockLead);
    proposalRepo.approveProposalDraft.mockResolvedValue(true);
    attachmentRepo.create.mockResolvedValue({ id: 'att-fb-1' });
    tenantRepo.findById.mockResolvedValue({ id: 'tenant-fb-1', email: null });
    userIdentityRepository.findByTenantId.mockResolvedValue(mockIdentity);
    googleConfig.getGoogleClientForUser.mockResolvedValue(mockResolvedClient);
    gmailService.sendQuotationEmail.mockResolvedValue({ id: 'msg-fb-1' });

    const result = await proposalDraftService.approveProposal('draft-fallback-1');

    expect(userIdentityRepository.findByTenantId).toHaveBeenCalledWith('tenant-fb-1', 'gmail');
    expect(googleConfig.getGoogleClientForUser).toHaveBeenCalledWith('tenant-admin@gmail.com');
    expect(gmailService.sendQuotationEmail).toHaveBeenCalledWith(
      'client@example.com',
      'https://storage/fb1.pdf',
      1800,
      mockResolvedClient
    );
    expect(result).toEqual({
      proposal_id: 'draft-fallback-1',
      attachment_id: 'att-fb-1',
    });
  });

  it('falls back to userIdentityRepository.findByTenantId when tenant email lookup fails', async () => {
    const mockDraft = {
      id: 'draft-fallback-2',
      tenant_id: 'tenant-fb-2',
      lead_requirement_id: 'req-fb-2',
      quotation_template_metadata_id: 'tmpl-fb-2',
      gcs_storage_path: 'https://storage/fb2.pdf',
      file_name: 'fb2.pdf',
      final_price: 2500,
    };
    const mockLead = { id: 'lead-fb-2', email: 'client2@example.com' };
    const mockIdentity = { provider_user_id: 'backup@gmail.com' };
    const mockResolvedClient = { auth: 'via-backup' };

    proposalRepo.findDraftById.mockResolvedValue(mockDraft);
    leadRepo.findByLeadRequirementId.mockResolvedValue(mockLead);
    proposalRepo.approveProposalDraft.mockResolvedValue(true);
    attachmentRepo.create.mockResolvedValue({ id: 'att-fb-2' });
    tenantRepo.findById.mockResolvedValue({ id: 'tenant-fb-2', email: 'broken@tenant.com' });
    googleConfig.getGoogleClientForUser
      .mockRejectedValueOnce(new Error('No token for broken@tenant.com'))
      .mockResolvedValueOnce(mockResolvedClient);
    userIdentityRepository.findByTenantId.mockResolvedValue(mockIdentity);
    gmailService.sendQuotationEmail.mockResolvedValue({ id: 'msg-fb-2' });

    const result = await proposalDraftService.approveProposal('draft-fallback-2');

    expect(userIdentityRepository.findByTenantId).toHaveBeenCalledWith('tenant-fb-2', 'gmail');
    expect(googleConfig.getGoogleClientForUser).toHaveBeenLastCalledWith('backup@gmail.com');
    expect(gmailService.sendQuotationEmail).toHaveBeenCalledWith(
      'client2@example.com',
      'https://storage/fb2.pdf',
      2500,
      mockResolvedClient
    );
    expect(result).toEqual({
      proposal_id: 'draft-fallback-2',
      attachment_id: 'att-fb-2',
    });
  });
});

