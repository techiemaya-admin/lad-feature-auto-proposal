process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: jest.fn().mockReturnValue({ file: jest.fn() }) })),
}));

const requestHandlers = [];
const mockPage = {
  setJavaScriptEnabled: jest.fn(),
  setRequestInterception: jest.fn(),
  on: jest.fn((event, handler) => { if (event === 'request') requestHandlers.push(handler); }),
  setContent: jest.fn(),
  pdf: jest.fn(),
};
const mockBrowser = { newPage: jest.fn(async () => mockPage), close: jest.fn() };
jest.mock('puppeteer', () => ({ launch: jest.fn(async () => mockBrowser) }));
jest.mock('../../../../utils/gcsUploader', () => ({
  uploadToGCS: jest.fn(async () => 'https://storage.googleapis.com/b/proposal.pdf'),
  uploadBufferToGCS: jest.fn(),
}));

const proposalDraftService = require('../proposal-draft.service');
const aiService = require('../ai-response.service');

const baseData = {
  lead_name: '<img src="http://169.254.169.254/computeMetadata/v1/">',
  lead_email: 'x@example.com"><script>alert(1)</script>',
  company_name: 'Acme & Co',
  company_email: 'sales@acme.test',
  company_phone: '123',
  company_website: 'acme.test',
  company_logo: 'https://storage.googleapis.com/bucket/logo.png',
  company_tagline: '<iframe src="file:///etc/passwd"></iframe>',
  total_base_price: 100,
  total_discount: 0,
  total_surcharge: 0,
  final_price: 100,
  items: [{ description: '<b>Catering</b>', qty: 2, unit_price: 50, line_total: 100 }],
};

describe('Proposal HTML escaping', () => {
  it('escapes lead, company and item values from untrusted sources', async () => {
    const html = await proposalDraftService.generateProposalForLeadHtml(baseData);
    expect(html).not.toContain('<img src="http://169.254.169.254');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<b>Catering</b>');
    expect(html).toContain('&lt;img src=&quot;http://169.254.169.254');
    expect(html).toContain('Acme &amp; Co');
  });

  it('renders an allowlisted logo but drops internal or non-https logo URLs', async () => {
    const ok = await proposalDraftService.generateProposalForLeadHtml(baseData);
    expect(ok).toContain('<img src="https://storage.googleapis.com/bucket/logo.png" alt="logo">');

    const bad = await proposalDraftService.generateProposalForLeadHtml({ ...baseData, company_logo: 'http://10.0.0.1/admin' });
    expect(bad).not.toContain('10.0.0.1');
  });
});

describe('Puppeteer PDF renderer hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestHandlers.length = 0;
    // Simulate a non-root service user so Chrome launches with its sandbox
    jest.spyOn(process, 'getuid').mockReturnValue(1000);
    delete process.env.PUPPETEER_DISABLE_SANDBOX;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('launches Chrome with its sandbox enabled', async () => {
    const puppeteer = require('puppeteer');
    await aiService.generateProposalWithoutQuotationTemplate(baseData, '/tmp/x.pdf', 'proposals/x.pdf');

    const options = puppeteer.launch.mock.calls[0][0];
    expect(options.headless).toBe(true);
    expect(options.args).not.toContain('--no-sandbox');
    expect(options.args).not.toContain('--disable-setuid-sandbox');
  });

  it('disables JavaScript and blocks non-allowlisted requests', async () => {
    await aiService.generateProposalWithoutQuotationTemplate(baseData, '/tmp/x.pdf', 'proposals/x.pdf');

    expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(requestHandlers).toHaveLength(1);

    const handle = (url) => {
      const req = { url: () => url, continue: jest.fn(), abort: jest.fn() };
      requestHandlers[0](req);
      return req;
    };
    expect(handle('http://169.254.169.254/computeMetadata/v1/').abort).toHaveBeenCalled();
    expect(handle('http://localhost:3001/api/tenants').abort).toHaveBeenCalled();
    expect(handle('file:///etc/passwd').abort).toHaveBeenCalled();
    expect(handle('https://storage.googleapis.com/bucket/logo.png').continue).toHaveBeenCalled();
    expect(handle('https://fonts.googleapis.com/css2?family=Inter').continue).toHaveBeenCalled();
    expect(handle('data:image/png;base64,AAAA').continue).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('closes the browser even when rendering fails', async () => {
    mockPage.setContent.mockRejectedValueOnce(new Error('render failed'));
    await expect(aiService.generateProposalWithoutQuotationTemplate(baseData, '/tmp/x.pdf', 'proposals/x.pdf')).rejects.toThrow('render failed');
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
