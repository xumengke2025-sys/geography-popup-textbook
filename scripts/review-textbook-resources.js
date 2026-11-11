async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const errors = [], failures = [], checks = [], samples = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy);
  const sample = async (label) => {
    await page.waitForTimeout(120);
    const d = await page.evaluate(() => window.textbookDiagnostics);
    samples.push({ label, spread: d.spread, ...Object.fromEntries(['geometries', 'textures', 'images', 'hiRes', 'models'].map(k => [k, d.render[k]])) });
  };
  const open = async id => {
    await page.locator('#cContents').click();
    await page.locator('.figure-index').evaluate(el => { el.open = true; });
    await page.locator(`#contents [data-figure="${id}"]`).click();
    await page.waitForFunction(id => window.textbookDiagnostics.active === id && window.textbookDiagnostics.render?.modelState === 'live' && !window.textbookDiagnostics.figureBusy, id);
  };
  const close = async () => {
    await page.locator('#fold').click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.models === 0);
  };
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
  await page.locator('#cStill').click();
  await sample('baseline');
  for (const id of ['cosmic-scale', 'breeze', 'vegetation', 'gnss']) {
    const group = [];
    for (let n = 0; n < 5; n++) {
      await open(id); await sample(`${id}/${n}/open`);
      await close(); await sample(`${id}/${n}/closed`);
      group.push(samples.at(-1));
    }
    check(group.slice(1).every(d => d.textures === group[0].textures), `${id}: repeated opening and closing returns to the same texture count`);
    check(group.every(d => d.geometries === group[0].geometries && d.models === 0), `${id}: no retained model geometries after closing`);
    console.log(JSON.stringify({ id, closed: group.map(s => ({ textures: s.textures, geometries: s.geometries, images: s.images, hiRes: s.hiRes })) }));
  }
  const ids = await page.locator('.figure-index [data-figure]').evaluateAll(nodes => nodes.map(el => el.dataset.figure));
  const rounds = [];
  for (let round = 0; round < 2; round++) {
    const closed = [];
    for (const id of ids) {
      await open(id); await close(); await sample(`round-${round}/${id}/closed`);
      closed.push(samples.at(-1));
    }
    rounds.push(closed);
    console.log(JSON.stringify({ round, models: closed.length, first: closed[0].textures, last: closed.at(-1).textures, geometryCounts: [...new Set(closed.map(s => s.geometries))] }));
  }
  check(rounds[1].at(-1).textures <= rounds[0].at(-1).textures, 'a second traversal of all 60 models does not increase the final texture count');
  check(rounds.every(r => r.every(s => s.geometries === 12 && s.models === 0)), 'all models release their geometry after both complete traversals');
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), errors, failures, checks, samples, rounds };
}
