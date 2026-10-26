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

jest.mock('../ai-response.service', () => ({
  generateProposalFromTemplate: jest.fn(),
  callGeminiWithRetry: jest.fn(),
}));

const mockHistoryList = jest.fn();
const mockGetProfile = jest.fn();
const mockMessagesGet = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        history: {
          list: mockHistoryList,
        },
        getProfile: mockGetProfile,
        messages: {
          get: mockMessagesGet,
        },
      },
    })),
  },
}));

const finalPriceCalculationRepository = require('../../repositories/final-price-calculation.repository');
const leadRequirementValueRepo = require('../../repositories/lead_requirement_values.repository');
const tenatDetailsRepo = require('../../repositories/tenant.repository');
const tenantProfileRepository = require('../../repositories/tenant-profile.repository');
const aiService = require('../ai-response.service');
const gmailSendService = require('../gmail-send-email.service');
const proposalDraftRepository = require('../../repositories/proposal-draft.repository');
const messageRepository = require('../../repositories/conversation-message.repository');
const userIdentityRepository = require('../../repositories/user-identity.repository');
const leadService = require('../lead.service');
const gmailWatchService = require('../gmail-watch.service');
const gmailWatchRepository = require('../../repositories/gmail-watch.repository');
const googleConfig = require('../../../../config/google.config');

jest.mock('../../repositories/final-price-calculation.repository');
jest.mock('../../repositories/lead_requirement_values.repository');
jest.mock('../../repositories/tenant.repository');
jest.mock('../../repositories/tenant-profile.repository');
jest.mock('../gmail-send-email.service');
jest.mock('../../repositories/proposal-draft.repository');
jest.mock('../../repositories/conversation-message.repository');
jest.mock('../gmail-watch.service');
jest.mock('../../repositories/gmail-watch.repository');
jest.mock('../../repositories/user-identity.repository');
jest.mock('../../repositories/conversation.repository');
jest.mock('../../repositories/lead.repository');
jest.mock('../../repositories/conversation-participants.repository');
jest.mock('../../repositories/lead_requirement_config.repository');
jest.mock('../../repositories/proposal-draft-items.repository');
jest.mock('../lead.service');
jest.mock('../../../../config/google.config');

// Require service under test after mocks
const gmailReadEmailService = require('../gmail-read-email.service');

describe('GmailReadEmailService - createProposalDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses PlaceHolderBuilder and tenantProfileRepository without throwing ReferenceError', async () => {
    const leadRequirementDetails = {
      id: 'req-123',
      tenant_id: 'tenant-456',
      event_category: 'Wedding',
      event_type: 'wedding',
    };

    const leadData = {
      id: 'lead-789',
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
    };

    finalPriceCalculationRepository.generateFinalPrice.mockResolvedValue({
      total_base_price: 1000,
      total_concept_discount: 100,
      total_concept_surcharge: 0,
      total_discount_percentage: 10,
      total_surcharge_percentage: 0,
      final_price: 900,
      breakdown: [
        { label: 'Photography', count: 1, base_unit_price: 1000, price: 900 },
      ],
      applied_package_rules: ['rule-1'],
    });

    leadRequirementValueRepo.findByRequirementId.mockResolvedValue([
      { label: 'Photography' },
    ]);

    tenatDetailsRepo.findById.mockResolvedValue({
      name: 'Studio Pro',
      phone: '+1-555-1234',
      website: 'studiopro.example.com',
    });

    tenantProfileRepository.findByTenantId.mockResolvedValue({
      official_email: 'hello@studiopro.example.com',
      company_logo_url: 'https://cdn.example.com/logo.png',
      tagline: 'Moments Captured',
      instagram_url: 'https://instagram.com/studiopro',
      linkedin_url: 'https://linkedin.com/studiopro',
      whatsapp_url: 'https://wa.me/15551234',
    });

    aiService.generateProposalFromTemplate.mockResolvedValue({
      gcsUrl: 'https://storage.googleapis.com/b/proposal.pdf',
      fileName: 'Proposal_123.pdf',
    });

    gmailSendService.processAndSendDefaultEmailFromDragDrop.mockResolvedValue({
      messageData: {
        id: 'msg-rec-1',
        conversation_id: 'conv-1',
      },
    });

    proposalDraftRepository.create.mockResolvedValue({
      id: 'draft-999',
      final_price: 900,
      status: 'DRAFTED',
    });

    messageRepository.createMessage.mockResolvedValue({ id: 'saved-msg-1' });

    const result = await gmailReadEmailService.createProposalDraft(
      leadRequirementDetails,
      leadData,
      'Email body with prompt requirements'
    );

    expect(tenantProfileRepository.findByTenantId).toHaveBeenCalledWith('tenant-456');
    expect(aiService.generateProposalFromTemplate).toHaveBeenCalledTimes(1);
    expect(proposalDraftRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-456',
        lead_requirement_id: 'req-123',
        final_price: 900,
        status: 'DRAFTED',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'draft-999',
        final_price: 900,
      })
    );
  });
});

describe('GmailReadEmailService - fetchNewEmails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gracefully drops execution without calling downstream services when email is unmapped', async () => {
    userIdentityRepository.findTenantContextByProviderUserId.mockResolvedValue(null);

    await gmailReadEmailService.fetchNewEmails('unmapped@example.com', 'hist-123');

    expect(userIdentityRepository.findTenantContextByProviderUserId).toHaveBeenCalledWith(
      'gmail',
      'unmapped@example.com'
    );
    expect(tenatDetailsRepo.findById).not.toHaveBeenCalled();
  });

  it('gracefully drops execution when identity exists but tenantId is null', async () => {
    userIdentityRepository.findTenantContextByProviderUserId.mockResolvedValue({
      userIdentityId: 'ident-1',
      userId: 'user-1',
      tenantId: null
    });

    await gmailReadEmailService.fetchNewEmails('notenant@example.com', 'hist-123');

    expect(userIdentityRepository.findTenantContextByProviderUserId).toHaveBeenCalledWith(
      'gmail',
      'notenant@example.com'
    );
    expect(tenatDetailsRepo.findById).not.toHaveBeenCalled();
  });

  it('updates watch record via initializeWatch when DB historyId is null but webhook historyId is present', async () => {
    userIdentityRepository.findTenantContextByProviderUserId.mockResolvedValue({
      userIdentityId: 'ident-1',
      userId: 'user-1',
      tenantId: 'tenant-123'
    });
    tenatDetailsRepo.findById.mockResolvedValue({ id: 'tenant-123' });
    gmailWatchService.getLastHistoryId.mockResolvedValue(null);
    googleConfig.getGoogleClientForUser.mockResolvedValue({});
    mockHistoryList.mockResolvedValue({ data: { history: [] } });

    await gmailReadEmailService.fetchNewEmails('user@example.com', 'hist-from-webhook');

    expect(gmailWatchService.initializeWatch).toHaveBeenCalledWith({
      tenant_id: 'tenant-123',
      user_identities_id: 'ident-1',
      history_id: 'hist-from-webhook'
    });
    expect(gmailWatchRepository.create).not.toHaveBeenCalled();
    expect(mockHistoryList).toHaveBeenCalledWith(expect.objectContaining({
      startHistoryId: 'hist-from-webhook'
    }));
  });

  it('syncs baseline historyId from profile when neither DB nor webhook provides a historyId', async () => {
    userIdentityRepository.findTenantContextByProviderUserId.mockResolvedValue({
      userIdentityId: 'ident-1',
      userId: 'user-1',
      tenantId: 'tenant-123'
    });
    tenatDetailsRepo.findById.mockResolvedValue({ id: 'tenant-123' });
    gmailWatchService.getLastHistoryId.mockResolvedValue(null);
    googleConfig.getGoogleClientForUser.mockResolvedValue({});
    mockGetProfile.mockResolvedValue({ data: { historyId: 'profile-hist-999' } });
    mockHistoryList.mockResolvedValue({ data: { history: [] } });

    await gmailReadEmailService.fetchNewEmails('user@example.com', null);

    expect(mockGetProfile).toHaveBeenCalledWith({ userId: 'me' });
    expect(gmailWatchService.initializeWatch).toHaveBeenCalledWith({
      tenant_id: 'tenant-123',
      user_identities_id: 'ident-1',
      history_id: 'profile-hist-999'
    });
    expect(gmailWatchRepository.create).not.toHaveBeenCalled();
  });

  it('re-syncs baseline historyId and exits cleanly when history.list throws an error', async () => {
    userIdentityRepository.findTenantContextByProviderUserId.mockResolvedValue({
      userIdentityId: 'ident-1',
      userId: 'user-1',
      tenantId: 'tenant-123'
    });
    tenatDetailsRepo.findById.mockResolvedValue({ id: 'tenant-123' });
    gmailWatchService.getLastHistoryId.mockResolvedValue('stale-hist-111');
    googleConfig.getGoogleClientForUser.mockResolvedValue({});
    mockHistoryList.mockRejectedValue(new Error('History id out of date'));
    mockGetProfile.mockResolvedValue({ data: { historyId: 'fresh-hist-222' } });

    await expect(
      gmailReadEmailService.fetchNewEmails('user@example.com', null)
    ).resolves.not.toThrow();

    expect(mockGetProfile).toHaveBeenCalledWith({ userId: 'me' });
    expect(gmailWatchService.updateHistoryId).toHaveBeenCalledWith(
      'ident-1',
      'fresh-hist-222',
      'tenant-123'
    );
  });
});

describe('GmailReadEmailService - triggerNewLeadAutomation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes dynamic tenantId and userId to leadService.createLead', async () => {
    leadService.createLead.mockResolvedValue({ id: 'lead-dynamic-001' });

    const result = await gmailReadEmailService.triggerNewLeadAutomation(
      'tenant-dyn-123',
      'user-dyn-456',
      'Jane',
      'Doe',
      'jane.doe@example.com'
    );

    expect(leadService.createLead).toHaveBeenCalledWith(
      'tenant-dyn-123',
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com'
      },
      'user-dyn-456'
    );
    expect(result).toEqual({ id: 'lead-dynamic-001' });
  });

  it('handles leadService errors gracefully and logs error', async () => {
    leadService.createLead.mockRejectedValue(new Error('Database write error'));

    const result = await gmailReadEmailService.triggerNewLeadAutomation(
      'tenant-dyn-123',
      'user-dyn-456',
      'Jane',
      'Doe',
      'jane.doe@example.com'
    );

    expect(result).toBeUndefined();
  });
});

