const logger = require('./logger');

let warnedNoSandbox = false;

function runningAsRoot() {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

/**
 * Launch options for headless Chrome. The Chrome sandbox stays on: it is the main
 * barrier between rendered content and the server if a renderer bug is exploited.
 * Chrome cannot sandbox itself as root, so run the service as a non-root user.
 * PUPPETEER_DISABLE_SANDBOX=true is an explicit, logged opt-out for environments
 * that cannot support the sandbox yet.
 */
function getLaunchOptions() {
  const disableSandbox = process.env.PUPPETEER_DISABLE_SANDBOX === 'true';
  if (!disableSandbox && runningAsRoot()) {
    throw new Error(
      'Chrome cannot run sandboxed as root. Run the service as a non-root user, '
      + 'or set PUPPETEER_DISABLE_SANDBOX=true to accept running Chrome without its sandbox.'
    );
  }
  if (disableSandbox && !warnedNoSandbox) {
    logger.warn('PUPPETEER_DISABLE_SANDBOX=true: headless Chrome is running without its sandbox');
    warnedNoSandbox = true;
  }
  return {
    headless: true,
    args: disableSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  };
}

function launchBrowser() {
  const options = getLaunchOptions();
  // Puppeteer 25 is ESM-only: load it lazily (Node >= 22.12 can require ES modules) so that
  // importing this module, e.g. in tests that never render a PDF, does not load Chrome tooling.
  const puppeteer = require('puppeteer');
  return puppeteer.launch(options);
}

module.exports = { launchBrowser, getLaunchOptions };
