async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  const read = () => page.evaluate(() => ({ ...window.textbookDiagnostics, render: window.textbookDiagnostics.render }));
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.modelState === 'live');
  const phase = async value => {
    await page.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await page.waitForFunction(v => Math.abs(window.textbookDiagnostics.render.geometry.phase - v / 1000) < .00001, value);
    return read();
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?figure=river&3d`, { waitUntil: 'domcontentloaded' }); await ready();
  check(!(await read()).playing, 'the river can be opened paused');
  for (const value of [0, 350, 550, 680, 810, 1000]) {
    const d = await phase(value); states.push({ phase: value, render: d.render, state: d.state });
    check(d.render.geometry.channelDepth > 5, `${value}: a real bank and channel depth is present`);
    check(d.render.geometry.imageMappedMeshes === 0 && d.render.geometry.solids > 0, `${value}: independent geometry without the textbook photograph as a surface`);
    check(d.render.triangles < 80000, `${value}: within the scene triangle target`);
    if ([0, 550, 1000].includes(value)) await page.screenshot({ path: `output/playwright/river-process-${value}.png` });
  }
  const end = (await read()).render.geometry;
  check(end.closedOxbow && end.lakeFlow === 0 && end.shortcutFlow === 1, 'the separated lake stops receiving a through-flow');
  await phase(550); const seek = (await read()).render.geometry;
  check(Math.abs(seek.breach - states[2].render.geometry.breach) < 1e-8, 'backward scrubbing restores the same process geometry');
  await page.locator('#cPause').click(); await page.waitForTimeout(650);
  const playing = await read(); check(playing.render.geometry.phase > .55, 'play advances the landform process');
  await page.locator('#cPause').click(); const paused = await read(); await page.waitForTimeout(350);
  check((await read()).render.geometry.phase === paused.render.geometry.phase, 'pause freezes the process and flow');
  for (const [selection, preset] of [[0, 0], [1, .6], [2, 1]]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click();
    await page.waitForFunction(p => window.textbookDiagnostics.render.geometry.phase === p && !window.textbookDiagnostics.playing, preset);
    const d = await read(); check(d.render.geometry.phase === preset && !d.playing, `${selection}: the named stop seeks and stays paused`);
  }
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(350);
  const d = await read(), dock = await page.locator('.capsule').boundingBox();
  check(d.render.labels.every(l => l.fontPx >= 18 && l.left >= 0 && l.right <= 1024 && l.top >= 0 && l.bottom < dock.y), 'the inspected landscape tablet state keeps the lake label clear and readable');
  await page.screenshot({ path: 'output/playwright/river-process-tablet.png' });
  await page.goto(`${base}/?figure=river&2d`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.active === 'river' && !window.textbookDiagnostics.figureBusy);
  check(await page.locator('.flat-concept svg image').count() === 0, 'the 2D process uses shared vector geometry');
  await page.locator('#selections [data-selection="2"]').click();
  check((await read()).state.caption === '牛轭湖' && (await page.locator('.flat-concept').textContent()).includes('牛轭湖'), '2D and diagnostic captions follow the same process');
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), errors, failures, checks, states };
}
