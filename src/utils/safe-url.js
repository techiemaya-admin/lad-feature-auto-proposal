/**
 * Guards for URLs the server itself fetches or renders (logos, template images, PDF assets).
 * Only https URLs on an explicit host allowlist are accepted, which rules out internal
 * hosts, IP literals, cloud metadata endpoints and non-http schemes (SSRF).
 */
const DEFAULT_IMAGE_HOSTS = ['storage.googleapis.com', 'cdn-icons-png.flaticon.com'];
const PDF_ASSET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

function getAllowedImageHosts() {
  const extra = (process.env.ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_IMAGE_HOSTS, ...extra];
}

function parseUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    return new URL(value.trim());
  } catch (_) {
    return null;
  }
}

/** True for https URLs whose host is on the image allowlist. */
function isAllowedImageUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || url.username || url.password) return false;
  return getAllowedImageHosts().includes(url.hostname.toLowerCase());
}

/** True for https URLs the PDF renderer may load (allowlisted images and Google Fonts). */
function isAllowedPdfAssetUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return getAllowedImageHosts().includes(host) || PDF_ASSET_HOSTS.includes(host);
}

/** True for plain http(s) links (no javascript:, data:, etc.). */
function isHttpUrl(value) {
  const url = parseUrl(value);
  return !!url && (url.protocol === 'https:' || url.protocol === 'http:');
}

/**
 * Fetches an image only from an allowlisted https host, without following redirects,
 * with a timeout and a size cap. Returns a Buffer, or null if refused or failed.
 */
async function fetchAllowedImage(value) {
  if (!isAllowedImageUrl(value)) return null;
  const res = await fetch(value, { redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType}`);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('Image too large');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image too large');
  return buffer;
}

module.exports = {
  isAllowedImageUrl,
  isAllowedPdfAssetUrl,
  isHttpUrl,
  fetchAllowedImage,
  MAX_IMAGE_BYTES,
};
