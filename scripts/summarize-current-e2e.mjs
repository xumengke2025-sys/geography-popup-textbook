import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Preserve the standard Playwright report, and bind its real browser
// resource attachments to the same built artifacts used for delivery.
const input = 'output/playwright/current-e2e-results.json';
const original = await fs.readFile(input);
const raw = JSON.parse(original);
const results = [];
function visit(suite, parents = []) {
  const titles = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) for (const test of spec.tests) {
    results.push({ title:[...titles, spec.title].join(' › '), file:spec.file, line:spec.line,
      status:test.status, expectedStatus:test.expectedStatus, results:test.results });
  }
  for (const child of suite.suites ?? []) visit(child, titles);
}
for (const suite of raw.suites) visit(suite);
if (raw.errors.length || raw.stats.unexpected || raw.stats.flaky || raw.stats.skipped || results.length !== 9
  || results.some(test => test.status !== 'expected' || test.expectedStatus !== 'passed'
    || test.results.length !== 1 || test.results[0].status !== 'passed')) throw Error('Current E2E contains incomplete or unsuccessful cases');
const resources = [];
for (const test of results) {
  const attachment = test.results[0].attachments.find(item => item.name === 'reviewed-resources');
  if (!attachment?.body) throw Error(`Missing browser resource provenance: ${test.title}`);
  const resource = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
  for (const file of [resource.reviewedEntry, ...resource.reviewedStyles]) {
    const built = await fs.readFile(path.join('dist', file.path));
    const actual = crypto.createHash('sha256').update(built).digest('hex');
    if (actual !== file.sha256) throw Error(`E2E did not review the current build: ${file.path}`);
  }
  resources.push(resource);
}
if (resources.some(resource => JSON.stringify(resource) !== JSON.stringify(resources[0]))) throw Error('E2E cases used different resource builds');
const report = { ...resources[0], reviewedAt:new Date(new Date(raw.stats.startTime).valueOf()+raw.stats.duration).toISOString(),
  browser:'Chrome via Playwright channel chrome (version not recorded by this fixture)',
  rawReport:input, rawReportSha256:crypto.createHash('sha256').update(original).digest('hex'),
  checks:results.map(test => test.title), failures:[], errors:[],
  cases:results.map(test => ({title:test.title, file:test.file, line:test.line, durationMs:test.results[0].duration, status:'passed'})),
  evidenceScope:'Nine current-book DOM user flows with a fresh context per test. Each case attaches the script and stylesheet bytes served to its real browser. Not all 60 model states or physical-device acceptance.' };
await fs.writeFile('output/playwright/final-current-e2e.json', JSON.stringify(report,null,2)+'\n');
await fs.copyFile(input, 'docs/verification/current-e2e-results.json');
console.log(JSON.stringify({cases:results.length, reviewedEntry:report.reviewedEntry, output:'output/playwright/final-current-e2e.json'}));
