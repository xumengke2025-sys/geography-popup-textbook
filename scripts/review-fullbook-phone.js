async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const errors = [], failures = [], checks = [], states = [], labelIssues = [];
  const check = (value, label) => (value ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?2d&page=38`, { waitUntil: 'domcontentloaded' });
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy);
  await ready();
  check((await page.evaluate(() => window.textbookDiagnostics)).twoD, 'phone enters the two-dimensional reading mode');
  const ids = await page.locator('.figure-index [data-figure]').evaluateAll(nodes => nodes.map(n => n.dataset.figure));
  check(ids.length === 60, 'all 60 demonstrations have keyboard-accessible menu entries');
  for (const [index, id] of ids.entries()) {
    await page.locator('#cContents').click();
    await page.locator('.figure-index').evaluate(e => { e.open = true; });
    await page.locator(`#contents [data-figure="${id}"]`).click();
    await ready();
    check(await page.evaluate(id => window.textbookDiagnostics.active === id, id), `${id}: opens in phone mode`);
    const optionCount = await page.locator('#selections button').count();
    for (let selection = 0; selection < Math.max(optionCount, 1); selection++) {
      if (optionCount) await page.locator(`#selections [data-selection="${selection}"]`).click();
      await page.locator('#phase').evaluate(el => { el.value = '500'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      const state = await page.locator('.flat-model-svg').evaluate(svg => {
        const box = svg.getBoundingClientRect();
        const labels = [...svg.querySelectorAll('text')].map(el => {
          const r = el.getBoundingClientRect(), m = el.getScreenCTM();
          return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b) };
        });
        const small = labels.filter(l => l.px < 18 - .05);
        const outside = labels.filter(l => l.left < box.left - 1 || l.right > box.right + 1 || l.top < box.top - 1 || l.bottom > box.bottom + 1);
        const pairs = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
        return { native: !svg.querySelector('image'), small, outside, pairs, labels, width: box.width, height: box.height, invalid: /NaN|Infinity|undefined/.test(svg.outerHTML) };
      });
      check(!state.invalid, `${id}/${selection}: valid vector markup`);
      if (state.native && (state.small.length || state.outside.length || state.pairs.length)) labelIssues.push({ id, selection, ...state });
      states.push({ id, selection, ...state });
    }
    const clipped = await page.locator('.capsule button:visible,.capsule input:visible').evaluateAll(nodes => nodes.filter(el => {
      const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > innerHeight + 1;
    }).map(el => el.id || el.textContent));
    check(!clipped.length, `${id}: all controls fit the phone viewport`);
    if (['breeze', 'mars-base', 'wind-forces', 'vegetation', 'terrain-observation', 'warehouse'].includes(id))
      await page.screenshot({ path: `output/playwright/fullbook-phone-${id}.png` });
    await page.locator('#fold').click(); await ready();
    if ((index + 1) % 20 === 0) console.log(`Phone checked ${index + 1}/${ids.length}`);
  }
  await page.locator('#cRead').click();
  await page.locator('#reader-image').evaluate(i => i.decode());
  check(await page.locator('#reader-image').evaluate(i => i.getBoundingClientRect().width) >= 700, 'original page remains readable through enlargement');
  await page.locator('#reader-close').click(); await ready();
  check(!errors.length, 'no phone browser exceptions');
  console.log(`Phone label issues ${labelIssues.length}`);
  return { base, browser: page.context().browser().version(), errors, failures, checks, states, labelIssues };
}
