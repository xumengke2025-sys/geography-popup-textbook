import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
async function files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory()
    ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat().sort();
}
const verification = path.join(root, 'docs/verification');
await fs.mkdir(verification, { recursive: true });
const baselineReports = [
  'fullbook-final-review.json', 'fullbook-phone-final-review.json',
  'fullbook-portable-final-review.json', 'fullbook-transaction-edge-final.json',
  'fullbook-resource-final.json', 'fullbook-breeze-motion-final.json',
  'fullbook-mode-entry-final.json', 'fullbook-dock-layout-final.json',
  'fullbook-river-process-final.json', 'fullbook-astronomy-final.json',
  'fullbook-water-rain-final.json', 'fullbook-gis-final.json', 'current-breeze-motion.json',
  'current-haze-process.json', 'current-delta-process.json',
  'current-soil-sorting.json', 'current-quake-warning.json',
  'fullbook-direct-model-input-current.json', 'current-transaction-interaction.json',
  'current-model-input.json', 'current-book-transactions.json',
  'current-karst-process.json', 'current-soil-profile.json', 'current-disaster-chain.json',
  'current-wave-process.json', 'current-tide-process.json', 'current-soil-texture.json',
  'current-water-texture-integration.json', 'current-water-texture-transactions.json',
  'current-workbench-navigation.json', 'current-workbench-visual.json',
  'current-salinity-process.json', 'current-coastal-process.json',
  'current-landslide-process.json', 'current-strata-process.json',
  'current-air-remote-process.json', 'current-process-supplements.json',
  'current-vertical-water-process.json',
  'current-ocean-energy-storm.json',
  'current-continuous-timeline.json', 'current-relief-depth-recovery.json', 'current-astronomy-native.json',
  'current-book-completion-fullbook.json',
  'current-book-completion-portable.json', 'current-book-completion-recovery.json',
  'current-book-completion-transactions-edge.json', 'current-book-completion-workspace.json',
  'previous-book-completion-timeline-20261106.json',
  'current-continuous-systems.json', 'current-book-completion-timeline.json',
  'current-delta-render-cost.json', 'current-continuous-systems-portable.json',
  'final-current-fullbook-desktop.json',
  'final-current-timeline.json', 'final-current-collection.json', 'final-current-urban-render-cost.json',
  'final-current-native-phone.json', 'final-current-cold-wave-labels.json', 'final-current-portable.json',
  'final-current-insolation.json', 'final-current-inventory.json', 'completion-current-native-phone.json',
  'final-current-e2e.json',
  'completion-current-label-clearance.json', 'completion-current-portable.json',
  'playback-current-portable.json',
  'current-playback-speed.json', 'experience-interactions.json',
  'experience-layout.json', 'experience-causality.json', 'experience-portable.json',
  'polish-targeted.json', 'polish-speed.json',
  'polish-final.json', 'polish-portable.json',
  'all-review-compact-final.json', 'all-review-observation-final.json',
  'all-review-craft-final.json', 'all-review-motion-final.json',
  'all-review-speed-final.json', 'all-review-portable-final.json',
];
const currentReports = [
  'reading-framing-final.json', 'reading-framing-inventory.json',
  'reading-framing-speed.json', 'reading-framing-portable.json',
];
const dist = await files(path.join(root, 'dist'));
const source = (await files(path.join(root, 'src'))).filter(f => /\.(ts|css|js)$/.test(f));
const hashFiles = async list => Object.fromEntries(await Promise.all(list.map(async f => [relative(f), sha(await fs.readFile(f))])));
const distHashes = await hashFiles(dist);
const checks = {};
for (const name of [...baselineReports, ...currentReports]) {
  const original = path.join(root, 'output/playwright', name);
  const bytes = await fs.readFile(original);
  const report = JSON.parse(bytes);
  if (report.errors?.length || report.failures?.length || report.labelIssues?.length || report.layoutIssues?.length || report.externalRequests?.length || report.requestFailures?.length)
    throw Error(`Unresolved browser failures: ${name}`);
  const current = currentReports.includes(name);
  if (current) {
    const resource = report.reviewedEntry;
    if (!resource || distHashes[`dist${resource.path}`] !== resource.sha256)
      throw Error(`Review is not bound to the current production entry: ${name}`);
    if (!report.reviewedStyles?.length || report.reviewedStyles.some(style => distHashes[`dist${style.path}`] !== style.sha256))
      throw Error(`Review is not bound to the current production stylesheet: ${name}`);
  }
  await fs.writeFile(path.join(verification, name), bytes);
  checks[name] = {
    sha256: sha(bytes), browser: report.browser, base: report.base,
    relationshipToBuild: current ? 'current-production-targeted-review' : 'previous-stable-baseline-only',
    reviewedEntry: report.reviewedEntry ?? null,
    reviewedStyles: report.reviewedStyles ?? null,
    checks: report.checks?.length ?? null, errors: report.errors?.length ?? null,
    failures: report.failures?.length ?? null,
    layoutIssues: report.layoutIssues?.length ?? null,
    labelIssues: report.labelIssues?.length ?? null,
    externalRequests: report.externalRequests?.length ?? null,
    requestFailures: report.requestFailures?.length ?? null,
  };
}
const unitBytes = await fs.readFile(path.join(root, 'work/interaction-finish-20261106/unit-results.json'));
const units = JSON.parse(unitBytes);
if (!units.success) throw Error('Unit test report contains failures');
await fs.writeFile(path.join(verification, 'reading-framing-unit.json'), unitBytes);
const manifest = {
  generatedAt: new Date().toISOString(), entry: 'src/textbook-main.ts',
  referenceCommit: '48591ddc5f0a22e6eb2a5a41c424a426599061ca', nodeVersion: process.version,
  scope: { originalPageCount: 132, spreadCount: 67, figureCount: 60, nativeSvgFallbacks: 60, textbookCropFallbacks: 0 },
  build: 'TypeScript and Vite production build passed before manifest generation',
  currentDist: { fileCount: dist.length, bytes: (await Promise.all(dist.map(f => fs.stat(f)))).reduce((n, s) => n + s.size, 0) },
  distSha256: distHashes, sourceSha256: await hashFiles(source), checks,
  previousStableBuild: 'docs/verification/previous-workbench-build-20261105.json',
  previousProcessBuild: 'docs/verification/previous-continuous-timeline-base-20261105.json',
  previousTimelineBuild: 'docs/verification/previous-continuous-timeline-build-20261105.json',
  previousPhysicalProcessBuild: 'docs/verification/previous-physical-process-build-20261105.json',
  previousVerticalWaterBase: 'docs/verification/previous-vertical-water-base-20261105.json',
  previousOceanEnergyStormBase: 'docs/verification/previous-ocean-energy-storm-base-20261106.json',
  previousReliefDepthBase: 'docs/verification/previous-relief-depth-base-20261106.json',
  previousBookCompletionBase: 'docs/verification/previous-book-completion-base-20261106.json',
  previousContinuousBookBase: 'docs/verification/previous-continuous-book-base-20261106.json',
  previousFullbookDelivery: 'docs/verification/previous-fullbook-delivery-20261106.json',
  previousPlaybackBase: 'docs/verification/previous-playback-base-20261106.json',
  earlierStableBuild: 'docs/verification/previous-stable-build-20261105.json',
  lastLabelClearanceReview: 'docs/verification/completion-current-label-clearance.json',
  lastFullDesktopRepresentativeReview: 'docs/verification/reading-framing-inventory.json',
  sourceDeltaSinceFullbookReview: 'docs/verification/completion-label-layout-delta.json',
  sourceDeltaSincePlaybackBase: 'docs/verification/experience-source-delta.json',
  previousExperienceBase: 'docs/verification/previous-experience-base-20261106.json',
  previousPolishBase: 'docs/verification/previous-polish-base-20261106.json',
  sourceDeltaSincePolishBase: 'docs/verification/polish-source-delta.json',
  previousAllReviewBase: 'docs/verification/previous-all-review-base-20261106.json',
  sourceDeltaSinceAllReviewBase: 'docs/verification/all-review-source-delta.json',
  previousReadingFramingBase: 'docs/verification/previous-reading-framing-base-20261106.json',
  sourceDeltaSinceReadingFramingBase: 'docs/verification/reading-framing-source-delta.json',
  intermediateRepresentativeReview: 'docs/verification/experience-inventory.json',
  previousDesktopConditionReview: 'docs/verification/final-current-fullbook-desktop.json',
  verificationScope: 'Prior audits retain their original production fingerprints. This follow-through implements the five agreed improvements: perspective-correct framing above actual controls, small-object discovery and press feedback, clearer retained receiving results, low-vegetation geometry/viewing angle, and source-page fit/zoom/location. Current reports cover all 60 representative compositions at 1366x900, targeted desktop/tablet views, real small-water-marker hover/press/click, source reading at 1366/390/320, speed behavior and portable request isolation. All 60 representative images and the 18 targeted scene images were viewed, with source-reader and key object images also inspected at original size. Reports must match final JS/CSS; counts overlap and are not summed as coverage. 444 source logic tests passed. This is not every angle/frame, real hardware, independent scientific review or classroom outcome acceptance.',
  unitTests: { passed: units.numPassedTests, failed: units.numFailedTests, files: units.testResults.length,
    startTime: units.startTime, report: 'docs/verification/reading-framing-unit.json',
    scope: 'Scientific model and retained logic; not full current UI acceptance' },
  limitations: [
    'Simulated viewports do not verify physical tablet, phone, school PC, or projection hardware.',
    'Request isolation is not physical disconnection or a fresh Windows machine installation test.',
    '60 model entry points do not mean every angle, intermediate state, scientific claim, or visual treatment is fully reviewed.',
    'Earlier Edge, WebGL restoration, specialist-handle and nine-flow E2E reports retain their previous-build status. Current playback review rechecks speed-related teacher isolation and both render modes.',
    'Intermediate representative reviews retain their findings and original builds. The current 60-model representative layout review covers one paused composition per model, not all conditions, views or frames.',
    'No classroom learning outcome, long-duration hardware FPS, or persistent renderer book-destruction acceptance.',
    'Earlier tests/e2e target a superseded interface and are excluded from the standard E2E command. Earlier current-e2e results retain their baseline build identity; this update uses the explicit targeted review scripts.',
    'Original page images preserve layout but do not provide a full searchable or screen-reader-accessible textbook text layer.',
    'Delta material-pass comparisons are paused desktop samples, not a whole-book draw-call or school-hardware FPS guarantee.',
    'Earlier city draw-call checks use a frozen default camera and retain all twelve water markers. They are not low-end school-hardware FPS or every camera-angle acceptance.',
  ],
};
await fs.writeFile(path.join(verification, 'current-build.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ manifest: 'docs/verification/current-build.json', distFiles: dist.length,
  distBytes: manifest.currentDist.bytes, baselineReports: baselineReports.length, currentReports: currentReports.length, sourceFiles: source.length }));
