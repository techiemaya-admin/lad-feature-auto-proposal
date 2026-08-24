jest.mock('../../../../utils/gcsUploader', () => ({
  uploadToGCSFromBase64: jest.fn(),
  uploadToGCS: jest.fn(),
  uploadBufferToGCS: jest.fn(),
}));
jest.mock('../../services/conversation.service', () => ({
  handleBulkEmailSend: jest.fn(),
  getContacts: jest.fn(),
  getContactMessages: jest.fn(),
  findLastMessagesByContactId: jest.fn(),
}));
jest.mock('../../services/ai-response.service', () => ({
  generateFollowUpEmailContent: jest.fn(),
  generateEmailMessagesCrux: jest.fn(),
}));
jest.mock('../../services/tenant.service', () => ({
  getTenantById: jest.fn(),
}));
jest.mock('../../services/lead.service', () => ({
  getLeadById: jest.fn(),
}));

const conversationController = require('../conversation.controller');
const conversationService = require('../../services/conversation.service');
const aiResponseService = require('../../services/ai-response.service');
const tenantService = require('../../services/tenant.service');
const leadService = require('../../services/lead.service');
const { uploadToGCSFromBase64 } = require('../../../../utils/gcsUploader');

describe('ConversationController', () => {
  let req;
  let res;
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    req = {
      tenantId: 'tenant-abc-123',
      userId: 'user-xyz-789',
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendBulkEmails', () => {
    it('does not log raw request body with sensitive email bodies or attachments', async () => {
      req.body = {
        body_html: '<p>Secret confidential email text</p>',
        subject: 'Confidential subject',
        recipients: [{ email: 'secret@example.com' }],
        attachments: [{ data: 'base64-secret-content' }],
        provider: 'smtp',
      };
      conversationService.handleBulkEmailSend.mockResolvedValue({ processed: 1 });

      await conversationController.sendBulkEmails(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const loggedMessages = logSpy.mock.calls.map(call => call.join(' '));
      const fullLog = loggedMessages.join('\n');
      expect(fullLog).not.toContain('Secret confidential email text');
      expect(fullLog).not.toContain('base64-secret-content');
      expect(fullLog).toContain('tenant-abc-123');
      expect(fullLog).toContain('user-xyz-789');
    });
  });

  describe('uploadAttachment', () => {
    it('does not log raw file buffer or full file object', async () => {
      req.file = {
        originalname: 'contract.pdf',
        buffer: Buffer.from('sensitive binary content'),
        mimetype: 'application/pdf',
      };
      uploadToGCSFromBase64.mockResolvedValue({ fileUrl: 'https://gcs.example.com/contract.pdf' });

      await conversationController.uploadAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const fullLog = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(fullLog).not.toContain('sensitive binary content');
      expect(fullLog).not.toContain('File Object:');
      expect(fullLog).toContain('contract.pdf');
    });
  });

  describe('generateFollowUp', () => {
    it('does not log full conversation message objects or raw client body text', async () => {
      req.params = { contactId: 'contact-001' };
      const lastMessage = [{
        id: 'msg-1',
        body_text: 'Confidential client inquiry message content',
        body_html: '<p>Confidential client inquiry message content</p>',
      }];
      conversationService.findLastMessagesByContactId.mockResolvedValue(lastMessage);
      tenantService.getTenantById.mockResolvedValue({ id: 'tenant-abc-123' });
      leadService.getLeadById.mockResolvedValue({ id: 'contact-001' });
      aiResponseService.generateFollowUpEmailContent.mockResolvedValue({
        subject: 'Follow-up',
        body: 'Follow-up body',
      });

      await conversationController.generateFollowUp(req, res);

      expect(res.json).toHaveBeenCalled();
      const fullLog = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(fullLog).not.toContain('Confidential client inquiry message content');
      expect(fullLog).toContain('contact-001');
      expect(fullLog).toContain('tenant-abc-123');
    });
  });

  describe('generateFollowUpCrux', () => {
    it('does not log complete conversation history or generated crux content', async () => {
      req.params = { contactId: 'contact-001' };
      const messages = [
        { id: 'm-1', text: 'Sensitive message 1' },
        { id: 'm-2', text: 'Sensitive message 2' },
      ];
      conversationService.getContactMessages.mockResolvedValue(messages);
      tenantService.getTenantById.mockResolvedValue({ id: 'tenant-abc-123' });
      leadService.getLeadById.mockResolvedValue({ id: 'contact-001' });
      aiResponseService.generateEmailMessagesCrux.mockResolvedValue('Sensitive generated crux summary');

      await conversationController.generateFollowUpCrux(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const fullLog = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(fullLog).not.toContain('Sensitive message 1');
      expect(fullLog).not.toContain('Sensitive generated crux summary');
      expect(fullLog).toContain('contact-001');
    });
  });
});
