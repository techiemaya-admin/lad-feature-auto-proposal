const util = require('util');

// Keys whose values must never reach logs (OAuth tokens, credentials, API keys).
const SENSITIVE_KEY = /(^|_|-)(access[-_]?token|refresh[-_]?token|id[-_]?token|token|authorization|password|passwd|secret|client[-_]?secret|api[-_]?key|private[-_]?key|cookie)s?$/i;
const MAX_DEPTH = 3;

function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  // Errors from HTTP clients (e.g. GaxiosError) carry the request config, including
  // Authorization headers; only keep the fields useful for debugging.
  if (value instanceof Error) {
    const out = { name: value.name, message: value.message };
    if (value.code !== undefined) out.code = value.code;
    const status = value.status || value.statusCode || (value.response && value.response.status);
    if (status !== undefined) out.status = status;
    if (value.stack) out.stack = value.stack;
    return out;
  }
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? '[Array]' : '[Object]';

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1, seen));
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(v, depth + 1, seen);
  }
  return out;
}

function formatArgs(args) {
  return args
    .map((a) => (typeof a === 'string' ? a : util.inspect(redact(a), { depth: MAX_DEPTH + 1, breakLength: Infinity })))
    .join(' ');
}

module.exports = {
  info: (...args) => {
    console.log('[INFO]', formatArgs(args));
  },
  error: (...args) => {
    console.error('[ERROR]', formatArgs(args));
  },
  warn: (...args) => {
    console.warn('[WARN]', formatArgs(args));
  },
  debug: (...args) => {
    if (process.env.DEBUG) console.debug('[DEBUG]', formatArgs(args));
  },
  _redact: redact,
};
