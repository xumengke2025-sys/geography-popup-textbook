async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.active === 'delta' && !window.textbookDiagnostics.figureBusy && !window.textbookDiagnostics.turning && window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 45000 });
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const phase = async n => {
    await page.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, n);
    await frame();
  };
  const read = () => page.evaluate(() => {
    const art = window.textbookDebug.entry.art, g = art.geometry;
    const bed = g.meshes.find(m => m.userData.deltaPart === 'sediment-bed');
    return { diagnostics: window.textbookDiagnostics, model: art.diagnostics,
      bed: { vertices: bed.geometry.attributes.position.count, positions: Array.from(bed.geometry.attributes.position.array), scale: bed.scale.toArray() },
      grains: g.meshes.filter(m => m.userData.deltaPart === 'sediment-grain').map(m => ({ id: m.userData.grainId, visible: m.visible, stage: m.userData.sedimentStage, grainClass: m.userData.grainClass, position: m.position.toArray(), scale: m.scale.toArray() })) };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?figure=delta&3d&inspect`, { waitUntil: 'domcontentloaded' }); await ready();
  await page.evaluate(() => document.fonts.ready);
  if ((await read()).diagnostics.playing) await page.locator('#cPause').click();
  await page.locator('#selections [data-selection="2"]').click();
  await phase(0);
  await page.evaluate(() => {
    const meshes = window.textbookDebug.entry.art.geometry.meshes;
    const bed = meshes.find(m => m.userData.deltaPart === 'sediment-bed');
    window.__deltaRefs = { bed, attribute: bed.geometry.attributes.position, array: bed.geometry.attributes.position.array,
      grains: meshes.filter(m => m.userData.deltaPart === 'sediment-grain') };
  });
  let initial, middle, final;
  for (const value of [0, 200, 300, 440, 550, 700, 1000]) {
    await phase(value); const state = await read();
    states.push({ phase: value / 1000, model: state.model, render: state.diagnostics.render });
    if (!initial) initial = state; if (value === 550) middle = state; if (value === 1000) final = state;
    check(state.grains.length === 54, `${value}: permanent 54-parcel pool`);
    check(state.bed.scale.every(x => x === 1), `${value}: sediment does not grow by scaling a flat fan`);
    check(state.model.bitmapSurfaces === 0 && state.model.imageMappedMeshes === 0 && state.model.solids > 0, `${value}: the explanatory scene is independent solid Three geometry`);
    if ([300, 550, 1000].includes(value)) await page.screenshot({ path: `output/playwright/delta-process-${value}.png` });
  }
  check(initial.model.deposition === 0 && states[1].model.deposition === 0 && JSON.stringify(initial.model.shorelineAdvance) === JSON.stringify(states[1].model.shorelineAdvance), 'fronts do not advance before parcels begin settling');
  check(final.model.deposited === 54 && final.model.transported === 0 && final.model.settling === 0, 'all parcels end as retained deposits instead of recycling into the river');
  const retained = middle.grains.filter(g => g.stage === 'deposited');
  check(retained.length > 0 && middle.model.settling > 0 && middle.model.transported > 0, 'the inspected middle frame contains slowed transport, falling parcels and retained deposits together');
  check(retained.every(g => JSON.stringify(g.position) === JSON.stringify(final.grains[g.id].position) && final.grains[g.id].visible), 'the same stopped objects remain visible at exactly their original deposit positions');
  check(final.bed.positions.filter((x, i) => i % 3 === 1 && x > initial.bed.positions[i] + .01).length > 400, 'a substantial number of real sediment vertices rise from parcel accumulation');
  check(await page.evaluate(() => {
    const g = window.textbookDebug.entry.art.geometry, bed = g.meshes.find(m => m.userData.deltaPart === 'sediment-bed');
    return bed === window.__deltaRefs.bed && bed.geometry.attributes.position === window.__deltaRefs.attribute
      && bed.geometry.attributes.position.array === window.__deltaRefs.array
      && g.meshes.filter(m => m.userData.deltaPart === 'sediment-grain').every((m, i) => m === window.__deltaRefs.grains[i]);
  }), 'terrain attributes, backing arrays and all parcel objects retain their identity');
  await phase(550); const seek = await read();
  check(JSON.stringify(seek.grains) === JSON.stringify(middle.grains) && JSON.stringify(seek.bed) === JSON.stringify(middle.bed), 'backward seeking restores exact particle and solid geometry');
  await phase(100); await phase(550); const forward = await read();
  check(JSON.stringify(forward.grains) === JSON.stringify(middle.grains) && JSON.stringify(forward.bed) === JSON.stringify(middle.bed), 'forward seeking to the same phase is identical');
  await phase(610); const fallA = await read();
  await page.screenshot({ path: 'output/playwright/delta-process-fall-before.png', clip: { x: 375, y: 340, width: 650, height: 350 } });
  await phase(630); const fallB = await read();
  await page.screenshot({ path: 'output/playwright/delta-process-fall-after.png', clip: { x: 375, y: 340, width: 650, height: 350 } });
  check(fallA.grains[2].stage === 'settling' && fallB.grains[2].stage === 'settling'
    && fallB.grains[2].position[1] < fallA.grains[2].position[1]
    && fallB.grains[2].position[0] === fallA.grains[2].position[0] && fallB.grains[2].position[2] === fallA.grains[2].position[2], 'a fine parcel drops vertically into the bed instead of orbiting or shrinking');
  await phase(250); const speedA = await read(); await phase(480); const speedB = await read();
  check(speedB.model.grains[2].pathSpeed < speedA.model.grains[2].pathSpeed, 'the same fine parcel slows along the river-mouth outflow');
  await phase(550); const pauseA = await read(); await page.waitForTimeout(450); const pauseB = await read();
  check(JSON.stringify(pauseA.grains) === JSON.stringify(pauseB.grains) && JSON.stringify(pauseA.bed) === JSON.stringify(pauseB.bed), 'pause freezes both sediment positions and terrain');
  await page.locator('#cPause').click(); await page.waitForTimeout(650); const played = await read();
  check(played.model.phase > .55, 'normal playback visibly advances the shared scientific phase');
  await page.locator('#cPause').click(); await phase(990); await page.locator('#cPause').click(); await page.waitForTimeout(500);
  check(!(await read()).diagnostics.playing && (await read()).model.phase === 1, 'the complete deposition holds at the final state');
  for (const selection of [0, 1, 2]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click(); await phase(selection === 0 ? 260 : selection === 1 ? 550 : 1000);
    const state = await read();
    check(state.model.stage === selection, `${selection}: original control index remains connected`);
    const labels = state.diagnostics.render.labels;
    check(labels.every(l => l.fontPx >= 18), `${selection}: visible Chinese labels retain readable measured size`);
    if (selection === 1) await page.screenshot({ path: 'output/playwright/delta-process-settling.png' });
  }
  await page.setViewportSize({ width: 1024, height: 768 }); await frame();
  await page.screenshot({ path: 'output/playwright/delta-process-tablet.png' });
  await page.goto(`${base}/?figure=delta&2d`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.active === 'delta' && !window.textbookDiagnostics.figureBusy);
  await page.locator('#selections [data-selection="2"]').click(); await phase(550);
  const flatA = await page.locator('.flat-concept svg').getAttribute('aria-label');
  check(await page.locator('.flat-concept svg image').count() === 0, '2D delta uses native vector geometry, not a textbook crop');
  const flatCount = await page.locator('.flat-concept [data-delta-deposited]').getAttribute('data-delta-deposited');
  check(Number(flatCount) === middle.model.deposited, '2D and Three share the same deposited-parcel state');
  await phase(1000);
  check(await page.locator('.flat-concept [data-stage="deposited"]').count() === 54, '2D retains the same 54 landed parcels');
  check(flatA.includes('三角洲形态多样'), 'accessible description preserves the schematic and non-universal shape boundary');
  await page.screenshot({ path: 'output/playwright/delta-process-flat.png' });
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), checks, errors, failures, states };
}
