async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [];
  const key = 'pep-geography-first-original-v2';
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && d.active === id && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const read = () => page.evaluate(key => {
    const d = window.textbookDiagnostics, g = d.render?.geometry;
    return { active: d.active, spread: d.spread, phase: d.state?.phase, selection: d.state?.selection,
      playing: d.playing, teacher: d.teacher, twoD: d.twoD, caption: d.state?.caption,
      modelPhase: g?.phase, kind: g?.kind, architecture: g?.architecture,
      geometries: d.render?.geometries, textures: d.render?.textures,
      saved: JSON.parse(localStorage.getItem(key) ?? 'null')?.figures?.[d.active] ?? null };
  }, key);
  const setPhase = async tenths => {
    await page.locator('#phase').focus(); await page.keyboard.press('Home');
    for (let i = 0; i < tenths; i++) await page.keyboard.press('PageUp');
    await frames();
    await page.waitForFunction(phase => Math.abs(window.textbookDiagnostics.state.phase - phase) < 1e-7, tenths / 10);
  };
  const chooseMode = async (id, twoD) => {
    await page.locator('#cContents').click(); await page.locator('#mode').click();
    await ready(id); await page.waitForFunction(twoD => window.textbookDiagnostics.twoD === twoD, twoD);
    await frames();
  };
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const id of ['waves', 'tides', 'soil-texture']) {
    console.log(`Integration: ${id}`);
    await page.goto(`${base}/?figure=${id}&3d&inspect`, { waitUntil: 'domcontentloaded' });
    await ready(id); await setPhase(4);
    await page.locator('#selections [data-selection="1"]').click();
    if (id === 'tides') check(Math.abs((await read()).phase - .25) < 1e-7 && !(await read()).playing,
      `${id}: rising-tide preset seeks to its actual phase and pauses`);
    else check(Math.abs((await read()).phase - .4) < 1e-7,
      `${id}: selecting an object preserves the shared process time`);
    await setPhase(4); const before = await read();
    check(before.architecture === 'three-dimensional-geometry' && !before.playing && Math.abs(before.modelPhase - .4) < 1e-7,
      `${id}: the raised geometry reads the same paused scientific phase`);
    check(before.saved?.phase === .4 && before.saved?.selection === before.selection,
      `${id}: a meaningful edit persists the student condition`);

    // Use the actual teacher button, not a synthetic mutation of student state.
    await page.locator('#cTeach').click(); await page.waitForFunction(() => window.textbookDiagnostics.teacher);
    await setPhase(8); await page.locator('#selections [data-selection="0"]').click();
    const during = await read();
    check(during.saved?.phase === before.saved.phase && during.saved?.selection === before.saved.selection,
      `${id}: teacher experiments leave the saved student record intact`);
    await page.locator('#cTeach').click(); await ready(id); await page.waitForFunction(() => !window.textbookDiagnostics.teacher);
    const restored = await read();
    check(restored.phase === before.phase && restored.selection === before.selection && !restored.playing,
      `${id}: leaving teacher mode restores the student's exact condition and pause`);

    await chooseMode(id, true); const flat = await read();
    check(flat.phase === before.phase && flat.selection === before.selection && !flat.playing,
      `${id}: changing to two dimensions preserves condition and pause`);
    check(await page.locator('.flat-concept svg').count() > 0 && await page.locator('.flat-concept image').count() === 0,
      `${id}: two-dimensional fallback is native SVG without a textbook picture stand-in`);
    await setPhase(7); const flatChanged = await read();
    await chooseMode(id, false); const raisedAgain = await read();
    check(raisedAgain.phase === flatChanged.phase && raisedAgain.selection === flatChanged.selection && !raisedAgain.playing,
      `${id}: returning to three dimensions keeps the edited two-dimensional state`);
    check(Math.abs(raisedAgain.modelPhase - raisedAgain.phase) < 1e-7,
      `${id}: the rebuilt geometry uses the restored phase immediately`);

    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(id);
    const refreshed = await read();
    check(refreshed.phase === raisedAgain.phase && refreshed.selection === raisedAgain.selection && !refreshed.playing,
      `${id}: refresh restores the bookmark while holding the animation`);
    await page.locator('#phase').focus(); const oldSpread = refreshed.spread;
    await page.keyboard.press('ArrowRight'); await frames();
    check((await read()).spread === oldSpread && (await read()).phase > refreshed.phase,
      `${id}: slider arrow keys change the process without turning a page`);

    const cycles = [];
    for (let i = 0; i < 3; i++) {
      await page.locator('#fold').click();
      await page.waitForFunction(() => !window.textbookDiagnostics.active && !window.textbookDiagnostics.figureBusy);
      // The camera is still settling after the fold. Exercise the accessible
      // page hotspot with Enter rather than chasing its moving screen box.
      const hotspot = page.locator(`#hotspots [data-figure="${id}"]`);
      await hotspot.focus(); await hotspot.press('Enter'); await ready(id); await frames();
      cycles.push(await read());
    }
    check(cycles.every(s => s.phase === cycles[0].phase && s.selection === cycles[0].selection && !s.playing),
      `${id}: folding and reopening retains the observation and pause`);
    check(cycles[2].geometries <= cycles[1].geometries && cycles[2].textures <= cycles[1].textures,
      `${id}: repeated model disposal and rebuild does not keep increasing GPU resources`);
    states.push({ id, before, restored, flat, raisedAgain, refreshed, cycles });
  }
  check(errors.length === 0, 'no browser exceptions during shared-mode integration');
  return { base, checks, failures, errors, states,
    limitations: ['Desktop browser viewport and real mouse/keyboard events; physical touch hardware was not tested.',
      'Three reopen cycles verify the new-model transaction sample, not long-duration GPU lifetime or the whole textbook.'] };
}
