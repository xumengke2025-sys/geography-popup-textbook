import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], samples = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/scripts/gis-preview.html', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => window.gisPreview);
  const seek = async phase => {
    await page.evaluate(p => window.gisPreview.seek(p), phase);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await page.evaluate(() => window.gisPreview.read()); samples.push(state); return state;
  };
  for (const [phase, name] of [[0, 'separated'], [.52, 'aligned'], [.73, 'counting'], [1, 'result']]) {
    await seek(phase);
    await page.screenshot({ path: `output/playwright/gis-world-${name}.png` });
  }
  const a = await seek(.735); await seek(0); await seek(1); const b = await seek(.735);
  const checks = {
    oneSetOf33StationMeshes: samples.every(s => s.actualStationMeshes === 33),
    noBitmapModels: samples.every(s => s.texturesOnNonLabels === 0),
    deterministicReverseSeek: JSON.stringify(a.stationPositions) === JSON.stringify(b.stationPositions) && JSON.stringify(a.counts) === JSON.stringify(b.counts),
    finalCounts: JSON.stringify(samples[3].counts.map(c => c.count)) === '[5,15,13]',
  };
  const result = { scope: 'GIS isolated real Popout world and shared SVG; not full-book acceptance', errors, checks, samples };
  await fs.writeFile('output/playwright/gis-world-review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ errors, checks, draws: samples[3].calls, triangles: samples[3].triangles }));
  if (errors.length || Object.values(checks).some(v => !v)) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ errors, runnerError: error.message })); process.exitCode = 1;
} finally { await browser.close(); }
