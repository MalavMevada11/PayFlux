const puppeteer = require('puppeteer');

/**
 * Singleton browser pool with auto-healing.
 *
 * - Keeps ONE Chromium instance alive across all PDF requests.
 * - If the browser crashes or disconnects, the next request automatically
 *   spawns a fresh one (self-healing).
 * - A cooldown timer prevents infinite restart loops: if the browser crashes
 *   more than MAX_CRASHES times within COOLDOWN_MS, it stops retrying and
 *   throws so the caller gets a clear error.
 */

// NOTE: Do NOT use --single-process — it crashes Chromium during page.pdf()
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-translate',
  '--no-first-run',
];

const MAX_CRASHES  = 3;          // max consecutive crashes before cooldown
const COOLDOWN_MS  = 30_000;     // 30s cooldown after crash-loop detected

let _browser       = null;       // the shared Puppeteer Browser
let _launching     = null;       // in-flight launch promise (dedup)
let _crashCount    = 0;          // consecutive crash counter
let _lastCrashTime = 0;          // timestamp of last crash

/**
 * Returns a healthy Puppeteer Browser instance.
 * Creates one if none exists. Recreates if the previous one died.
 * Throws after MAX_CRASHES consecutive failures within COOLDOWN_MS.
 */
async function getBrowser() {
  // Check crash-loop cooldown
  if (_crashCount >= MAX_CRASHES) {
    const elapsed = Date.now() - _lastCrashTime;
    if (elapsed < COOLDOWN_MS) {
      throw new Error(
        `PDF browser crashed ${_crashCount} times. Cooling down for ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)}s. Try again later.`
      );
    }
    // Cooldown expired — reset counter and allow retry
    _crashCount = 0;
  }

  // If browser exists and is connected, return it
  if (_browser && _browser.connected) {
    return _browser;
  }

  // If another call is already launching, wait for it
  if (_launching) {
    return _launching;
  }

  // Launch a new browser
  _launching = (async () => {
    try {
      console.log('⟳ Launching Puppeteer browser...');
      const browser = await puppeteer.launch({
        headless: true,
        args: LAUNCH_ARGS,
      });

      // Listen for unexpected disconnect → mark as dead
      browser.on('disconnected', () => {
        console.warn('⚠ Puppeteer browser disconnected unexpectedly');
        if (_browser === browser) {
          _browser = null;
          _crashCount++;
          _lastCrashTime = Date.now();
        }
      });

      _browser = browser;
      _crashCount = 0; // successful launch resets the counter
      console.log('✓ Puppeteer browser ready (PID:', browser.process()?.pid, ')');
      return browser;
    } catch (err) {
      _crashCount++;
      _lastCrashTime = Date.now();
      throw err;
    } finally {
      _launching = null;
    }
  })();

  return _launching;
}

/**
 * Generate a PDF buffer from an HTML string.
 * Handles page lifecycle and auto-heals on browser failure.
 *
 * @param {string} html   - Full HTML document
 * @param {object} [opts] - Puppeteer page.pdf() options
 * @returns {Promise<Buffer>}
 */
async function generatePdf(html, opts = {}) {
  const MAX_RETRIES = 1; // one retry on browser crash
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let page;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();

      // Set content — domcontentloaded is enough since our HTML is self-contained
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfOpts = {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        ...opts,
      };
      const buf = await page.pdf(pdfOpts);
      return Buffer.from(buf);
    } catch (err) {
      lastError = err;
      console.error(`PDF generation attempt ${attempt + 1} failed:`, err.message);

      // If browser crashed, null it out so next attempt relaunches
      if (_browser && !_browser.connected) {
        _browser = null;
      }

      if (attempt < MAX_RETRIES) {
        console.log('⟳ Retrying PDF generation...');
      }
    } finally {
      // Always close the page (tab), never the browser
      if (page) {
        try { await page.close(); } catch (_) { /* page may already be dead */ }
      }
    }
  }

  throw lastError || new Error('PDF generation failed after retries');
}

/**
 * Gracefully shut down the browser (call on process exit).
 */
async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
  }
}

module.exports = { getBrowser, generatePdf, closeBrowser };
