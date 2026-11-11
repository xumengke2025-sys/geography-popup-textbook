async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/?figure=water&3d&inspect`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'water' && !d.figureBusy && !d.turning && d.render?.modelState === 'live';
  }, undefined, { timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  const phase = async value => {
    await page.locator('#phase').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const sample = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, g = window.textbookDebug.entry.art.geometry;
    let index = -1, top = -Infinity;
    g.flow.forEach((line, i) => {
      if (line.points.length === 71 && line.points[0].y > line.points[70].y && line.points[0].y > top) {
        index = i; top = line.points[0].y;
      }
    });
    const line = g.flow[index];
    return { phase: d.render.geometry.phase, selection: d.render.geometry.selection, playing: d.playing,
      rain: g.flow.slice(-7).map(x => ({ start: x.points[0].toArray(), end: x.points[1].toArray() })),
      precipitationPath: line ? { start: line.points[0].toArray(), end: line.points[70].toArray(),
        arrowTips: g.flow.slice(index + 1, index + 4).map(x => x.points[1].toArray()) } : null };
  });
  for (const [selection, name] of [[0, 'sea-land'], [1, 'land-internal'], [2, 'sea-internal']]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click();
    const record = { selection, name, samples: [] };
    for (const value of [100, 110, 100, 110]) { await phase(value); record.samples.push(await sample()); }
    const [a, b] = record.samples;
    record.rainDeltaY = a.rain.map((line, i) => b.rain[i].start[1] - line.start[1]);
    record.arrowDeltaY = a.precipitationPath.arrowTips.map((tip, i) => b.precipitationPath.arrowTips[i][1] - tip[1]);
    check(record.rainDeltaY.every(v => v < 0), `${name}: all seven rain lines fall during forward progress`);
    check(record.arrowDeltaY.every(v => v < 0), `${name}: main precipitation arrows travel down with the fine rain`);
    check(b.precipitationPath.start[1] > b.precipitationPath.end[1], `${name}: precipitation path is cloud-to-surface`);
    check(b.rain.length === 7 && b.rain.every(line => line.start[1] >= line.end[1]), `${name}: seven rain lines retain downward segments`);
    check(JSON.stringify(record.samples[1]) === JSON.stringify(record.samples[3]), `${name}: reverse dragging returns exactly the same state`);
    await page.waitForTimeout(200); const held = await sample();
    check(JSON.stringify(record.samples[3]) === JSON.stringify(held) && !held.playing, `${name}: pause freezes rain and arrow positions`);
    await page.screenshot({ path: `output/playwright/water-rain-fix-${name}.png` });
    await phase(0); const cloud = await sample();
    await phase(332); const landing = await sample();
    await phase(334); const respawn = await sample();
    record.reset = { cloud: cloud.rain[0], landing: landing.rain[0], respawn: respawn.rain[0] };
    const travel = cloud.rain[0].start[1] - landing.rain[0].start[1];
    check(travel > 0 && respawn.rain[0].start[1] > landing.rain[0].start[1]
      && Math.abs(respawn.rain[0].start[1] - cloud.rain[0].start[1]) < travel * .01,
      `${name}: a rain line reaches the receiving surface then respawns near the cloud base`);
    states.push(record);
  }
  check(!errors.length, 'no browser exceptions');
  return { purpose: 'Targeted verification of cloud-to-surface rain fix only', diagnosticInspection: true, base,
    browser: page.context().browser().version(), viewport: { width: 1440, height: 1000 }, errors, checks, failures, states };
}
