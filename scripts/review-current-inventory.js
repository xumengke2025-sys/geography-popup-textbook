async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], labelIssues = [], layoutIssues = [], screenshots = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text().slice(0, 500)); });
  await page.setViewportSize({ width: 1366, height: 900 });
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && (!id || d.active === id)
      && (!d.active || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const settle = async () => {
    await ready(); let last, stable = 0;
    await page.waitForFunction(() => !window.textbookDiagnostics.process || !document.querySelector('#process-note').hidden);
    for (let i = 0; i < 80; i++) {
      const camera = await page.evaluate(() => {
        const b = window.textbookDebug;
        return b ? [...b.camera.position.toArray(), ...b.camera.quaternion.toArray()] : [];
      });
      if (!camera.length) throw Error('The inventory needs its explicit local inspection entry to observe camera settlement');
      stable = last && camera.every((n, j) => Math.abs(n - last[j]) < 1e-4) ? stable + 1 : 0;
      if (stable >= 3) return;
      last = camera; await page.waitForTimeout(50);
    }
    throw Error('Camera did not settle for the visual inventory');
  };
  await page.goto(`${base}/?3d&inspect`, { waitUntil: 'domcontentloaded' }); await ready();
  await page.locator('#cContents').click(); await page.locator('#contents-models').click();
  const entries = await page.locator('#model-contents [data-figure]').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.figure, title: n.textContent })));
  check(entries.length === 60, 'The full current catalog contains 60 connected demonstrations');
  for (let index = 0; index < entries.length; index++) {
    const { id, title } = entries[index];
    if (index) { await page.locator('#cContents').click(); await page.locator('#contents-models').click(); }
    await page.locator(`#model-contents [data-figure="${id}"]`).click(); await ready(id);
    if ((await page.evaluate(() => window.textbookDiagnostics)).playing) await page.locator('#cPause').click();
    // This inventory is for rendered composition, not an interaction test.
    // Existing condition/node reports and current-e2e test those separately.
    const preferred = { 'geo-time': 2, 'seismic-waves': 0, 'karst-cave': 1, 'pressure-wind': 0,
      'aeolian': 0, 'vegetation': 0, 'soil-factors': 4, 'soil-composition': 1 };
    const selection = preferred[id] ?? 0;
    const button = page.locator(`#selections [data-selection="${selection}"]`);
    if (await button.count()) await button.click();
    await page.locator('#phase').evaluate(el => {
      el.value = '600'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    const state = await page.evaluate(() => {
      const d = window.textbookDiagnostics, r = d.render;
      const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
      const note=document.querySelector('#process-note');
      return { active: d.active, phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, process: d.process,
        geometry: r.geometry, labels: r.labels, calls: r.calls, triangles: r.triangles,
        header: box(document.querySelector('#desk-header')), dock: box(document.querySelector('.capsule')),
        note:d.process?{...box(note),hidden:note.hidden,text:document.querySelector('#process-text').textContent}:null,
        width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(state.active === id && !state.playing, `${id}: the current model is available and paused`);
    const g = state.geometry;
    check(g.solids > 0 && g.imageMappedMeshes === 0 && g.sceneElevation > 0 && g.unfoldProgress === 1 && g.originalPagePreserved,
      `${id}: solid Three.js objects stand above the preserved original page`);
    check(g.extent.every(n => Number.isFinite(n) && n > 0), `${id}: finite spatial extent`);
    const small = state.labels.filter(l => l.fontPx < 17.9);
    const outside = state.labels.filter(l => l.left < -1 || l.right > state.width + 1 || l.top < state.header.bottom - 1 || l.bottom > state.dock.top - 3);
    const overlap = state.labels.flatMap((a, i) => state.labels.slice(i + 1)
      .filter(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
      .map(b => [a.text, b.text]));
    if (small.length || outside.length || overlap.length) labelIssues.push({ id, small, outside, overlap });
    if (state.overflow) layoutIssues.push({ id, issue: 'document overflow' });
    if(state.note){
      const note=state.note;
      const coversLabels=state.labels.filter(l=>Math.min(note.right,l.right)-Math.max(note.left,l.left)>2
        &&Math.min(note.bottom,l.bottom)-Math.max(note.top,l.top)>2);
      check(!note.hidden&&note.text.length>0,`${id}: current explanation is visible after camera settlement`);
      if(note.hidden||note.left<0||note.right>state.width+1||note.top<state.header.bottom-1||note.bottom>state.dock.top-3||coversLabels.length)
        layoutIssues.push({id,issue:'explanation reading space',note,coversLabels});
    }
    states.push({ id, title, ...state });
    const path = `output/playwright/current-inventory-${id}.png`;
    await page.screenshot({ path }); screenshots.push(path);
    if (page.__writeReviewCheckpoint) await page.__writeReviewCheckpoint({ states: states.map(({ id, calls, triangles }) => ({ id, calls, triangles })), errors, failures, labelIssues, layoutIssues });
    if ((index + 1) % 5 === 0) console.log(`Rendered ${index + 1}/${entries.length} current textbook models`);
  }
  check(!errors.length, 'No browser exceptions or console errors in the rendered inventory');
  return { base, checks, failures, errors, states, labelIssues, layoutIssues, screenshots,
    evidenceScope: 'One representative rendered composition per demonstration at 1366x900; not every condition, camera angle, scientific statement, or physical device.' };
}
