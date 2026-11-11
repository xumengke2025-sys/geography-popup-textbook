async page => {
  const errors = [], consoleErrors = [], states = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const prefix = process.env.REVIEW_PREFIX ?? 'water-current';
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy, null, { timeout: 60000 });
  const phase = async value => {
    await page.locator('#phase').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await page.waitForTimeout(350);
  };
  const capture = async name => {
    await page.waitForTimeout(1300);
    const state = await page.evaluate(() => ({ diagnostics: window.textbookDiagnostics,
      camera: window.textbookDebug ? { position: window.textbookDebug.camera.position.toArray(), up: window.textbookDebug.camera.up.toArray(), target: window.textbookDebug.focus.toArray() } : null,
      userAgent: navigator.userAgent }));
    const labels = state.diagnostics.render?.labels ?? [], overlaps = [];
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 0 && overlapY > 0) overlaps.push({ a: a.text, b: b.text, overlapX, overlapY });
    }
    const screenshot = `output/playwright/${prefix}-${name}.png`;
    await page.screenshot({ path: screenshot });
    states.push({ name, viewport: page.viewportSize(), screenshot,
      labelMetrics: { count: labels.length, minimumFontPx: labels.length ? Math.min(...labels.map(l => l.fontPx)) : null, overlaps }, ...state });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?page=47`, { waitUntil: 'domcontentloaded' });
  await ready();
  await page.locator('#hotspots [data-figure="water"]').click();
  await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 60000 });
  await phase(250);
  for (const [name, selection] of [['land-sea', 0], ['land', 1], ['sea', 2]]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click();
    await capture(`desktop-${name}`);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const [name, selection] of [['land-sea', 0], ['land', 1], ['sea', 2]]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click();
    await capture(`tablet-${name}`);
  }
  if (process.env.REVIEW_TYPHOON !== 'false') {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?page=103`, { waitUntil: 'domcontentloaded' });
  await ready();
  await page.locator('#hotspots [data-figure="typhoon"]').click();
  await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 60000 });
  await phase(250);
  await capture('typhoon-perspective');
  // A developer-only camera position makes the sense of rotation unambiguous.
  // It is recorded separately from the normal user camera.
  await page.evaluate(() => { window.textbookDebug.orbit = 0; window.textbookDebug.elevation = 30; window.textbookDebug.zoom = .84; });
  await capture('typhoon-top-250');
  await phase(350);
  await capture('typhoon-top-350');
  }
  return { generatedAt: new Date().toISOString(), browser: 'independent headless Chrome session',
    base, errors, consoleErrors, states,
    limits: ['Tablet is a desktop browser viewport, not a physical touch tablet.', 'Top typhoon inspection uses a developer-only top camera.', 'Visual judgments are recorded separately after inspecting the screenshots.'] };
}
