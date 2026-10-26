const { getLaunchOptions } = require('../browser');

describe('getLaunchOptions (Chrome sandbox policy)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PUPPETEER_DISABLE_SANDBOX;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('keeps the sandbox on for a non-root user', () => {
    jest.spyOn(process, 'getuid').mockReturnValue(1000);
    const options = getLaunchOptions();
    expect(options.headless).toBe(true);
    expect(options.args).toEqual([]);
  });

  it('refuses to launch as root instead of silently dropping the sandbox', () => {
    jest.spyOn(process, 'getuid').mockReturnValue(0);
    expect(() => getLaunchOptions()).toThrow(/non-root user/);
  });

  it('disables the sandbox only when explicitly opted out', () => {
    jest.spyOn(process, 'getuid').mockReturnValue(0);
    process.env.PUPPETEER_DISABLE_SANDBOX = 'true';
    expect(getLaunchOptions().args).toEqual(['--no-sandbox', '--disable-setuid-sandbox']);
  });

  it('ignores values other than "true" for the opt-out', () => {
    jest.spyOn(process, 'getuid').mockReturnValue(0);
    process.env.PUPPETEER_DISABLE_SANDBOX = '1';
    expect(() => getLaunchOptions()).toThrow();
  });
});
