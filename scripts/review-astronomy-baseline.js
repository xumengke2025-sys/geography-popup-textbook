async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], states = [];
  const browser = page.context().browser();
  for (const id of ['solar', 'earth']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    try {
      const p = await context.newPage();
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(`${base}/?figure=${id}&3d`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && d.render?.modelState === 'live'; }, id, { timeout: 45000 });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(120);
      await p.screenshot({ path: `output/playwright/astronomy-before-${id}.png` });
      states.push(await p.evaluate(() => ({ id: window.textbookDiagnostics.active, diagnostics: window.textbookDebug.entry.art.diagnostics })));
    } finally { await context.close(); }
  }
  return { errors, states };
}
