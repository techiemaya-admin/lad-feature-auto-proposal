const util = require('util');

function formatArgs(args) {
  return args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 3 }))).join(' ');
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
};
