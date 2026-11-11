async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?figure=delta&3d&inspect`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.active === 'delta' && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 45000 });
  const phase = async value => {
    await page.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await frame();
  };
  await page.locator('#selections [data-selection="2"]').click();
  const read = () => page.evaluate(() => ({ render: {calls:window.textbookDiagnostics.render.calls,triangles:window.textbookDiagnostics.render.triangles},
    geometry: window.textbookDiagnostics.render.geometry,
    grains: window.textbookDebug.entry.art.geometry.meshes.filter(m => m.userData.deltaPart === 'sediment-grain').map(m => ({id:m.userData.grainId, visible:m.visible, position:m.position.toArray(), scale:m.scale.toArray(), side:m.material.side})) }));
  for (const value of [550, 1000]) {
    await phase(value);
    await page.evaluate(() => { for (const m of window.textbookDebug.entry.art.geometry.meshes.filter(m => m.userData.deltaPart === 'sediment-grain')) { m.material.side = 2; m.material.needsUpdate = true; } });
    await frame(); const double = await read();
    await page.screenshot({path:`output/playwright/delta-double-${value}.png`});
    await page.evaluate(() => { for (const m of window.textbookDebug.entry.art.geometry.meshes.filter(m => m.userData.deltaPart === 'sediment-grain')) { m.material.side = 0; m.material.needsUpdate = true; } });
    await frame(); const front = await read();
    await page.screenshot({path:`output/playwright/delta-front-${value}.png`});
    const withoutSide = state => state.grains.map(({side,...rest})=>rest);
    check(JSON.stringify(withoutSide(double)) === JSON.stringify(withoutSide(front)), `${value}: identical parcel objects, visibility and positions`);
    check(JSON.stringify(double.geometry.grains) === JSON.stringify(front.geometry.grains), `${value}: unchanged scientific state`);
    check(front.render.calls < double.render.calls && front.render.calls <= 120, `${value}: closed parcel surfaces fit the draw-call target`);
    states.push({phase:value/1000, before:double.render, after:front.render, visibleGrains:front.grains.filter(g=>g.visible).length});
  }
  return {base, checks, failures, errors, states, scope:'Same desktop viewport, paused phases and geometry; this compares material face passes, not school-hardware FPS.'};
}
