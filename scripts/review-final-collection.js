async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], screenshots = [], labelIssues = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', e => errors.push(e.message));
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === id && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const seek = async value => {
    await page.locator('#phase').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await frame();
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const twoD of [false, true]) {
    await page.setViewportSize(twoD ? { width: 390, height: 844 } : { width: 1366, height: 900 });
    await page.goto(`${base}/?figure=desalination&${twoD ? '2d' : '3d'}&inspect`, { waitUntil: 'domcontentloaded' });
    await ready('desalination');
    for (const method of [0, 1]) {
      await page.locator(`#selections [data-selection="${method}"]`).click();
      for (const phase of [0, 500, 1000, 500, 1000]) {
        await seek(phase);
        const state = await page.evaluate(() => {
          const d = window.textbookDiagnostics, g = d.render?.geometry, svg = document.querySelector('.flat-concept > svg');
          return { phase: d.state.phase, playing: d.playing, twoD: d.twoD,
            pockets: g?.brinePockets, collected: g?.collectedPockets, retained: g?.retainedBrinePockets,
            allCollected: g?.separatedBrineCollected,
            svgPockets: svg?.querySelectorAll('[data-brine-pocket]').length,
            svgCollected: svg?.querySelectorAll('[data-collected="true"]').length };
        });
        const name = `${twoD ? 'SVG' : '3D'}/method-${method}/${phase}`;
        check(!state.playing && Math.abs(state.phase - phase / 1000) < 1e-7, `${name}: seeking freezes the requested scientific state`);
        if (phase === 1000) {
          check(twoD ? state.svgPockets === 16 && state.svgCollected === 12
            : state.pockets?.length === 16 && state.retained === 4 && state.collected === 12 && state.allCollected,
          `${name}: all twelve separated brine pockets reach the collector and four remain in the ice`);
        }
        states.push({ method, ...state });
      }
      const path = `output/playwright/final-collection-${twoD ? 'phone' : 'desktop'}-${method}.png`;
      await page.screenshot({ path }); screenshots.push(path);
    }
  }
  await page.goto(`${base}/?figure=gis&2d&inspect`, { waitUntil: 'domcontentloaded' }); await ready('gis');
  for (let value = 0; value <= 1000; value += 20) {
    await seek(value);
    const labels = await page.locator('.flat-concept > svg').evaluate(svg => Array.from(svg.querySelectorAll('text')).filter(el => {
      let opacity = 1;
      for (let n = el; n && n !== svg.parentElement; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
      return opacity > .01;
    }).map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
    const overlaps = labels.flatMap((a, i) => labels.slice(i + 1).filter(b =>
      Math.min(a.right, b.right) - Math.max(a.x, b.x) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 2).map(b => [a.text, b.text]));
    check(!overlaps.length, `GIS/${value}: visible titles remain separate throughout layer alignment`);
    if (overlaps.length) labelIssues.push({ phase: value / 1000, overlaps });
  }
  await seek(500);
  const path = 'output/playwright/final-collection-gis-phone-middle.png'; await page.screenshot({ path }); screenshots.push(path);
  check(!errors.length, 'collection and GIS transitions have no browser exceptions');
  return { base, checks, failures, errors, states, screenshots, labelIssues,
    evidenceScope: 'Current production 3D/SVG endpoints in both desalination methods with backward seeks; 51 paused native-SVG GIS positions at 390×844. Desktop uses 1366×900. This is not physical-device or teacher scientific acceptance.' };
}
