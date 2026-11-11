import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Standalone fallback when the persistent playwright-cli daemon is unresponsive.
const source = await fs.readFile(process.argv[2] ?? 'scripts/review-elevated-browser.js', 'utf8');
const review = Function(`return (${source.trim()})`)();
const browser = await chromium.launch({ channel: process.env.REVIEW_BROWSER ?? 'chrome', headless: true, timeout: 30000 });
try {
  const page = await browser.newPage();
  page.__reviewBase = process.env.REVIEW_BASE_URL;
  page.__reviewStart = Number(process.env.REVIEW_START ?? 0);
  if (process.env.REVIEW_CHECKPOINT) page.__writeReviewCheckpoint = async result => {
    await fs.writeFile(process.env.REVIEW_CHECKPOINT, JSON.stringify({ ...result, checkpointAt: new Date().toISOString() }, null, 2));
  };
  page.setDefaultTimeout(20000);
  const externalRequests = [], requestFailures = [];
  if (process.env.REVIEW_OFFLINE === '1') {
    const origin = new URL(page.__reviewBase ?? 'http://127.0.0.1:5173').origin;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
        externalRequests.push(url.origin + url.pathname);
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });
    page.on('requestfailed', request => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  }
  const screenshot = page.screenshot.bind(page);
  page.screenshot = async options => {
    if (process.env.REVIEW_SCREENSHOT_PREFIX && options.path)
      options = { ...options, path: options.path.replace(/([^/\\]+)$/, `${process.env.REVIEW_SCREENSHOT_PREFIX}$1`) };
    const result = await screenshot(options);
    console.log(`Captured ${options.path}`);
    return result;
  };
  console.log('Review browser launched');
  const result = await review(page);
  const mainUrl = await page.locator('script[type="module"][src]').last().getAttribute('src');
  if (mainUrl) {
    const url = new URL(mainUrl, page.url()), response = await page.request.get(url.href);
    if (!response.ok()) throw Error(`Cannot fingerprint reviewed entry: ${url.pathname}`);
    result.reviewedEntry = { path: url.pathname, sha256: crypto.createHash('sha256').update(await response.body()).digest('hex') };
  }
  result.reviewedStyles = await Promise.all((await page.locator('link[rel="stylesheet"][href]').evaluateAll(links => links.map(link => link.href))).map(async href => {
    const url = new URL(href, page.url()), response = await page.request.get(url.href);
    if (!response.ok()) throw Error(`Cannot fingerprint reviewed stylesheet: ${url.pathname}`);
    return { path: url.pathname, sha256: crypto.createHash('sha256').update(await response.body()).digest('hex') };
  }));
  result.reviewedAt = new Date().toISOString();
  result.browser ??= page.context().browser().version();
  if (process.env.REVIEW_OFFLINE === '1') {
    result.externalRequests = externalRequests;
    result.requestFailures = requestFailures;
  }
  await fs.writeFile(process.env.REVIEW_OUTPUT ?? 'output/playwright/elevated-review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ errors: result.errors, checks: result.checks?.length, catalog: result.states?.length,
    states: result.states ? undefined : { day: result.day?.render, night: result.night?.render } }));
  if (result.errors?.length || result.failures?.length || result.labelIssues?.length || result.layoutIssues?.length || externalRequests.length || requestFailures.length)
    throw Error('Review reported failures; see its JSON result.');
} finally {
  await browser.close();
}
