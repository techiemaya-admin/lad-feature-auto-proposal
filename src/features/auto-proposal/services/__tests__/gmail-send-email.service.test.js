process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

const { sendGmailRaw } = require('../gmail-send-email.service');
const { google } = require('googleapis');

const mockSend = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          send: mockSend,
        },
      },
    })),
  },
}));

// Mock @google-cloud/storage to avoid credentials issues in test environment
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue([Buffer.from('template content')]),
      }),
    }),
  })),
}));

describe('GmailSendEmailService - sendGmailRaw', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'sent-msg-999' } });
  });

  it('compiles valid RFC 2822 message without attachments', async () => {
    const result = await sendGmailRaw({
      to: 'client@example.com',
      subject: 'Quote Details',
      html: 'Hello world',
      global_message_id: 'msg-123@mail.gmail.com',
      threadId: 'thread-456',
      oAuth2Client: {},
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sendPayload = mockSend.mock.calls[0][0];
    expect(sendPayload.requestBody.threadId).toBe('thread-456');

    // Decode base64url message
    const base64Str = sendPayload.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/');
    const decodedMessage = Buffer.from(base64Str, 'base64').toString('utf-8');

    expect(decodedMessage).toContain('To: client@example.com');
    expect(decodedMessage).toContain('Subject: Re: Quote Details');
    expect(decodedMessage).toContain('In-Reply-To: <msg-123@mail.gmail.com>');
    expect(decodedMessage).toContain('References: <msg-123@mail.gmail.com>');
    expect(decodedMessage).toContain('Content-Type: multipart/mixed; boundary=');
    expect(decodedMessage).toContain('Content-Type: text/html; charset=utf-8');
    expect(decodedMessage).toContain('<p style="margin: 0 0 14px 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">Hello world</p>');
    expect(decodedMessage).toContain('--__boundary_string_generated_123__--');
    expect(result.data.id).toBe('sent-msg-999');
  });

  it('compiles valid RFC 2822 message with a single attachmentBase64', async () => {
    const sampleBase64 = Buffer.from('PDF CONTENT DUMMY').toString('base64');

    await sendGmailRaw({
      to: 'client@example.com',
      subject: 'Proposal Attached',
      html: 'Please find attached.',
      global_message_id: '<msg-123@mail.gmail.com>',
      threadId: 'thread-456',
      oAuth2Client: {},
      attachmentBase64: sampleBase64,
      filename: 'Proposal.pdf',
    });

    const sendPayload = mockSend.mock.calls[0][0];
    const base64Str = sendPayload.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/');
    const decodedMessage = Buffer.from(base64Str, 'base64').toString('utf-8');

    expect(decodedMessage).toContain('Content-Type: application/pdf; name="Proposal.pdf"');
    expect(decodedMessage).toContain('Content-Disposition: attachment; filename="Proposal.pdf"');
    expect(decodedMessage).toContain('Content-Transfer-Encoding: base64');
    expect(decodedMessage).toContain(sampleBase64);
  });

  it('compiles valid RFC 2822 message with multiple remote attachments without throwing TypeError', async () => {
    const file1Content = Buffer.from('File 1 data');
    const file2Content = Buffer.from('File 2 data');

    const originalFetch = global.fetch;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => file1Content,
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => file2Content,
      });

    try {
      await sendGmailRaw({
        to: 'client@example.com',
        subject: 'Multiple Docs',
        html: 'Documents here',
        global_message_id: 'msg-789',
        threadId: 'thread-789',
        oAuth2Client: {},
        attachments: [
          { url: 'https://storage.googleapis.com/b/doc1.pdf', filename: 'doc1.pdf', type: 'application/pdf' },
          { url: 'https://storage.googleapis.com/b/image.png', filename: 'image.png', type: 'image/png' },
        ],
      });

      const sendPayload = mockSend.mock.calls[0][0];
      const base64Str = sendPayload.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/');
      const decodedMessage = Buffer.from(base64Str, 'base64').toString('utf-8');

      expect(decodedMessage).toContain('Content-Type: application/pdf; name="doc1.pdf"');
      expect(decodedMessage).toContain(file1Content.toString('base64'));
      expect(decodedMessage).toContain('Content-Type: image/png; name="image.png"');
      expect(decodedMessage).toContain(file2Content.toString('base64'));
      expect(decodedMessage.endsWith('--__boundary_string_generated_123__--')).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
