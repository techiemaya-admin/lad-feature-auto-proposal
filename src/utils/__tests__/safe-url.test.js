const { isAllowedImageUrl, isAllowedPdfAssetUrl, isHttpUrl, fetchAllowedImage } = require('../safe-url');

describe('safe-url', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOWED_IMAGE_HOSTS;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('isAllowedImageUrl', () => {
    it('accepts https URLs on allowlisted hosts', () => {
      expect(isAllowedImageUrl('https://storage.googleapis.com/bucket/logo.png?X-Goog-Signature=abc')).toBe(true);
    });

    it.each([
      'http://storage.googleapis.com/bucket/logo.png',
      'https://169.254.169.254/computeMetadata/v1/',
      'https://localhost/admin',
      'https://10.0.0.5/internal',
      'https://storage.googleapis.com.evil.com/x.png',
      'https://user:pass@storage.googleapis.com/x.png',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not a url',
      '',
      null,
    ])('rejects %p', (url) => {
      expect(isAllowedImageUrl(url)).toBe(false);
    });

    it('honours extra hosts from ALLOWED_IMAGE_HOSTS', () => {
      process.env.ALLOWED_IMAGE_HOSTS = 'cdn.example.com, images.example.org';
      expect(isAllowedImageUrl('https://cdn.example.com/logo.png')).toBe(true);
      expect(isAllowedImageUrl('https://images.example.org/logo.png')).toBe(true);
    });
  });

  it('isAllowedPdfAssetUrl also allows Google Fonts but nothing internal', () => {
    expect(isAllowedPdfAssetUrl('https://fonts.googleapis.com/css2?family=Inter')).toBe(true);
    expect(isAllowedPdfAssetUrl('https://fonts.gstatic.com/s/inter.woff2')).toBe(true);
    expect(isAllowedPdfAssetUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
  });

  it('isHttpUrl only accepts http(s)', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,hi')).toBe(false);
  });

  describe('fetchAllowedImage', () => {
    function mockResponse({ ok = true, contentType = 'image/png', length, body = Buffer.from('png') } = {}) {
      return {
        ok,
        status: ok ? 200 : 404,
        headers: { get: (h) => (h === 'content-type' ? contentType : h === 'content-length' ? length : null) },
        arrayBuffer: async () => body,
      };
    }

    it('does not fetch non-allowlisted URLs', async () => {
      global.fetch = jest.fn();
      expect(await fetchAllowedImage('http://169.254.169.254/latest/meta-data')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches allowlisted images without following redirects', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse());
      const buf = await fetchAllowedImage('https://storage.googleapis.com/b/logo.png');
      expect(buf).toEqual(Buffer.from('png'));
      expect(global.fetch).toHaveBeenCalledWith('https://storage.googleapis.com/b/logo.png', expect.objectContaining({ redirect: 'error' }));
    });

    it('rejects non-image responses and oversized images', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse({ contentType: 'text/html' }));
      await expect(fetchAllowedImage('https://storage.googleapis.com/b/x')).rejects.toThrow('content type');
      global.fetch = jest.fn().mockResolvedValue(mockResponse({ length: String(50 * 1024 * 1024) }));
      await expect(fetchAllowedImage('https://storage.googleapis.com/b/x')).rejects.toThrow('too large');
    });
  });
});
