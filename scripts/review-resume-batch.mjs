import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Production-only audit. UI events own state; diagnostics are read as evidence.
const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4173';
const output = process.env.REVIEW_OUTPUT ?? 'output/playwright/reconstruction-audit';
await fs.mkdir(output, { recursive: true });
const inventory = JSON.parse(await fs.readFile('docs/handoff/catalog-branch-inventory.json', 'utf8'));
const wanted = process.argv.slice(2);
if (wanted.some(id => !inventory.some(f => f.id === id))) throw Error('Unknown scene ID; refusing an empty or partial audit.');
const scenes = wanted.length ? inventory.filter(f => wanted.includes(f.id)) : inventory;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = { base, browser: browser.version(), scope: 'production DOM phase/choice sampling and lifecycle; native mesh operations and visual acceptance are separate',
  scenes: [], errors: [], completeBranchAcceptance: false };
let pinnedEntry;
try {
  for (const figure of scenes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const item = { id: figure.id, branches: [], nodes: [], frames: [], errors: [], coverageGaps: [] };
    results.scenes.push(item);
    page.on('pageerror', e => item.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') item.errors.push(m.text()); });
    const read = () => page.evaluate(() => {
      const d = window.textbookDiagnostics, b = window.textbookDebug;
      return { active: d.active, speed: d.playbackSpeed, phase: d.state?.phase, selection: d.state?.selection,
        geometry: d.render?.geometry, render: { calls: d.render?.calls, triangles: d.render?.triangles },
        labels: d.render?.labels, modelState: d.render?.modelState,
        rootScale: b?.entry?.art.geometry.root.scale.toArray(), formation: d.render?.formation };
    });
    const seek = async value => {
      const slider = page.locator('#phase');
      if (await slider.isVisible()) {
        // Deterministic DOM input sampling, NOT a native model-handle test.
        // PageUp rounded .25/.75 and arbitrary public stops to tenths.
        await slider.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
        await page.waitForFunction(v => Math.abs(window.textbookDiagnostics.state.phase - v / 1000) <= .0011, value);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        return true;
      }
      return false; // Static observation: never claim an unperformed seek.
    };
    const capture = async name => {
      const path = `${output}/${figure.id}-${name}.png`;
      await page.screenshot({ path }); item.frames.push(path);
    };
    try {
      await page.goto(`${base}/?figure=${figure.id}&3d&inspect`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && d.render?.modelState === 'live'; }, figure.id, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      if (await page.locator('#cPause').getAttribute('aria-label') === '暂停演示') await page.locator('#cPause').click();
      const src = await page.locator('script[type="module"][src]').getAttribute('src');
      if (!src || !new URL(src, base).pathname.startsWith('/assets/')) throw Error('A fixed production build is required; source/HMR entries are not accepted.');
      const response = await page.request.get(new URL(src, base).href);
      if (!response.ok()) throw Error(`Cannot fingerprint ${src}`);
      item.entry = { path: src, sha256: crypto.createHash('sha256').update(await response.body()).digest('hex') };
      pinnedEntry ??= item.entry;
      if (JSON.stringify(item.entry) !== JSON.stringify(pinnedEntry)) throw Error('Production bundle changed during audit.');
      item.styles = await Promise.all((await page.locator('link[rel="stylesheet"][href]').evaluateAll(links => links.map(l => l.href))).map(async href => {
        const res = await page.request.get(href); if (!res.ok()) throw Error(`Cannot fingerprint ${href}`);
        return { path: new URL(href).pathname, sha256: crypto.createHash('sha256').update(await res.body()).digest('hex') };
      }));
      item.initial = await read();
      // Enumerate actual current controls rather than trusting the old ledger.
      const controls = await page.locator('#selections [data-selection]').evaluateAll(nodes => nodes.map(n => ({ selection: n.dataset.selection, text: n.textContent })));
      item.controls = controls;
      for (let index = 0; index < Math.max(1, controls.length); index++) {
        if (controls.length) {
          const control = page.locator(`#selections [data-selection="${controls[index].selection}"]`);
          if (await control.isVisible()) await control.click();
          else if (await page.locator('#condition-choice').isVisible()) await page.locator('#condition-choice').selectOption(controls[index].selection);
        }
        const phases = [...new Set([0, 250, 500, 750, 1000, ...(figure.controlPhases ?? []).map(p => Math.round(p * 1000)),
          ...figure.branches.flatMap(b => (b.timelineStops ?? []).map(s => Math.round(s.phase * 1000)))].filter(Number.isFinite))].sort((a,b) => a-b);
        for (const value of [...phases, ...phases.slice(0,-1).reverse()]) {
          const performed = await seek(value);
          item.branches.push({ control: controls[index] ?? null, target: performed ? value : null, requested: value,
            seekPerformed: performed, state: await read() });
          if (!performed) break;
        }
        // Public stop buttons have their own animated seek; record the actual
        // reached state rather than treating their label as a condition.
        const nodes = await page.locator('#figure-controls [data-process-node]').evaluateAll(ns => ns.map(n => ({ index: n.dataset.processNode, text: n.textContent })));
        for (const node of nodes) {
          const button = page.locator(`#figure-controls [data-process-node="${node.index}"]`);
          if (!await button.isVisible()) { item.coverageGaps.push(`Hidden process node: ${node.text}`); continue; }
          await button.click();
          await page.waitForFunction(() => !window.textbookDiagnostics.process?.seeking);
          await page.waitForTimeout(750);
          item.nodes.push({ control: controls[index] ?? null, node, state: await read() });
        }
        await capture(`branch-${index}-1440`);
      }
      const reached = new Set(item.branches.map(b => b.state.selection));
      item.coverageGaps.push(...figure.branches.filter(b => !reached.has(b.selection)).map(b => `Selection ${b.selection} requires native/2D coverage`));
      item.coverageGaps.push('Native part operations, inspections, evidence actions and full 2D paths require their dedicated checks.');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(650); await capture('1024');
      item.tablet = await read();
      // Real product fold and re-open, retaining the visible intermediate state.
      await page.locator('#fold').click();
      await page.waitForFunction(() => !window.textbookDiagnostics.figureBusy, null, { timeout: 30000 });
      await capture('paper');
      await page.locator('#cWatch').click();
      await page.waitForFunction(() => {
        const r=window.textbookDiagnostics.render;
        return ['peel','shade'].includes(r?.modelState) && r.geometry?.unfoldProgress > .28 && r.geometry.unfoldProgress < .9;
      }, null, { timeout: 15000 });
      await capture('forming');
      item.forming = await read();
      await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live' && !window.textbookDiagnostics.figureBusy, null, { timeout: 30000 });
      item.completed = await read();
    } catch (e) { item.failure = e.message; }
    await context.close();
    await fs.writeFile(`${output}/review.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ id: item.id, states: item.branches.length, frames: item.frames.length, failure: item.failure, errors: item.errors.length }));
  }
} finally { await browser.close(); }
if (results.scenes.some(s => s.failure || s.errors.length)) process.exitCode = 1;
