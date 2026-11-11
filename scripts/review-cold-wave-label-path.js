async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], labelIssues = [], states = [], screenshots = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, text) => (ok ? checks : failures).push(text);
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const settle = async () => {
    let last, stable = 0;
    for (let i = 0; i < 80; i++) {
      const now = await page.evaluate(() => {
        const c = window.textbookDebug.camera; return [...c.position.toArray(), ...c.quaternion.toArray()];
      });
      stable = last && now.every((x, i) => Math.abs(x - last[i]) < 1e-5) ? stable + 1 : 0;
      if (stable >= 3) return;
      last = now; await page.waitForTimeout(60);
    }
    throw Error('Cold-air camera did not settle');
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?figure=cold-wave&3d&inspect`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const d = window.textbookDiagnostics; return d?.ready && d.active === 'cold-wave' && !d.figureBusy && d.render?.modelState === 'live';
  }, null, { timeout: 45000 });
  for (const [width, height] of [[1366, 900], [1366, 768], [1024, 768], [713, 818]]) {
    await page.setViewportSize({ width, height }); await settle();
    for (let i = 0; i <= 40; i++) {
      const value = i * 25;
      await page.locator('#phase').evaluate((el, value) => {
        el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      await frame();
      const s = await page.evaluate(() => {
        const d = window.textbookDiagnostics, dock = document.querySelector('.capsule').getBoundingClientRect();
        return { phase: d.state.phase, modelPhase: d.render.geometry.phase, playing: d.playing,
          labels: d.render.labels, width: innerWidth, dockTop: dock.top,
          headerBottom: document.querySelector('#desk-header').getBoundingClientRect().bottom };
      });
      const small = s.labels.filter(l => l.fontPx < 17.9);
      const outside = s.labels.filter(l => l.left < -1 || l.right > width + 1 || l.top < s.headerBottom - 1 || l.bottom > s.dockTop - 3);
      const overlaps = s.labels.flatMap((a, i) => s.labels.slice(i + 1).filter(b =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2).map(b => [a.text, b.text]));
      const name = `${width}×${height}/${value}`;
      check(!s.playing && Math.abs(s.phase - s.modelPhase) < 1e-7, `${name}: the visible scene shares the paused playhead`);
      check(!small.length && !outside.length && !overlaps.length, `${name}: moving pull-tab stays clear of fixed labels and controls`);
      if (small.length || outside.length || overlaps.length) labelIssues.push({ name, small, outside, overlaps });
      states.push({ width, height, phase: s.phase, labels: s.labels });
      if ([500, 625].includes(value)) {
        const path = `output/playwright/cold-wave-clear-${width}-${height}-${value}.png`;
        await page.screenshot({ path }); screenshots.push(path);
      }
    }
  }
  return { base, checks, failures, errors, labelIssues, states, screenshots,
    evidenceScope: 'Actual default-camera label projections over the complete forward-seek path at 2.5% intervals, at four desktop/tablet-sized viewports. Does not certify every rotated camera or a physical touchscreen.' };
}
