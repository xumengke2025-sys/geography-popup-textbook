async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], screenshots = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text().slice(0, 300)); });
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && d.active === id && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const open = async (id, flat = false) => {
    await page.goto(`${base}/?figure=${id}&${flat ? '2d' : '3d'}&inspect`, { waitUntil: 'domcontentloaded' });
    await ready(id); await page.waitForTimeout(700);
  };
  const phase = async value => {
    const slider = page.locator('#phase'); await slider.focus(); await slider.press('Home');
    for (let i = 0; i < value / 100; i++) await slider.press('PageUp');
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => { const d = window.textbookDiagnostics; return d.twoD || d.render.geometry.phase === d.state.phase; });
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const svg = document.querySelector('.flat-concept>svg');
    return { id: d.active, phase: d.state.phase, selection: d.state.selection, caption: d.state.caption, playing: d.playing,
      twoD: d.twoD, model: d.render?.geometry, process: d.process,
      salts: g?.meshes.filter(m => m.userData.soilCareSaltId !== undefined).map(m => ({ id: m.userData.soilCareSaltId, uuid: m.uuid, visible: m.visible, position: m.position.toArray() })),
      geometryIds: g?.meshes.map(m => m.geometry.uuid), labels: d.render?.labels,
      svg: svg ? { saltCount: svg.querySelectorAll('[data-salt-id]').length,
        vaporCount: svg.querySelectorAll('[data-composition-symbol="water-vapor-tracer"]').length,
        impurityCount: svg.querySelectorAll('[data-composition-symbol="impurity-grain"]').length,
        images: svg.querySelectorAll('image').length, invalid: /NaN|Infinity|undefined/.test(svg.outerHTML) } : null };
  });
  const capture = async name => { const file = `output/playwright/completion-${name}.png`; await page.screenshot({ path: file }); screenshots.push(file); };
  const clickReplay = async selection => {
    const target = await page.evaluate(selection => {
      const b = window.textbookDebug, g = b.entry.art.geometry, rect = b.renderer.domElement.getBoundingClientRect();
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      for (const mesh of g.meshes.filter(m => m.visible && m.userData.kind === 'text-label' && m.userData.modelInput?.kind === 'replay' && m.userData.modelInput.selection === selection)) {
        const p = mesh.getWorldPosition(b.camera.position.clone()).project(b.camera);
        const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
        if (b.pickModel(x, y)?.object === mesh) return { x, y };
      }
      return null;
    }, selection);
    check(!!target, `condition/${selection}: a real paper title has an unobstructed replay target`);
    if (target) { await page.mouse.click(target.x, target.y); await page.waitForTimeout(120); }
  };
  const choice = async i => { await page.locator(`#selections [data-selection="${i}"]`).click(); await phase(0); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await open('soil-care');
  const starts = [];
  for (const selection of [0, 1, 2]) {
    await choice(selection); const a = await read(); starts.push(a);
    const steps = [];
    for (const value of [0, 100, 500, 900, 1000, 500]) {
      await phase(value); const s = await read(); steps.push(s);
      check(s.model.kind === 'soil-care' && s.model.phase === s.phase, `soil/${selection}/${value}: real geometry shares the playhead`);
      check(s.salts.length === 20 && s.salts.every(p => p.visible) && s.geometryIds.join() === a.geometryIds.join(), `soil/${selection}/${value}: retained salt meshes do not disappear or rebuild`);
      check(s.process.title === s.model.caption && s.model.retainedSalt + s.model.drainedSalt === 1, `soil/${selection}/${value}: short note and salt inventory agree`);
      check(s.salts.every(p => Math.abs(p.position[0] / bWidth(s) - s.model.packets[p.id].u) < 1e-7), `soil/${selection}/${value}: mesh positions follow the same salt packets`);
    }
    states.push({ id: 'soil-care', selection, steps });
  }
  // Position ratios cancel the scene scale: every salt uses the same width.
  function bWidth(s) { const p = s.model.packets.find(p => p.u > 0), mesh = s.salts.find(m => m.id === p.id); return mesh.position[0] / p.u; }
  check(starts.every(s => JSON.stringify(s.salts.map(p => p.position)) === JSON.stringify(starts[0].salts.map(p => p.position))), 'all soil conditions begin with the same actual salt distribution');
  await choice(2); await phase(1000); const covered = await read();
  check(covered.model.retainedSalt === 1 && covered.model.drainedSalt === 0 && !covered.model.coverRemovesExistingSalt, 'cover retains existing salt and only reduces subsequent upward transfer');
  await capture('soil-cover');
  await clickReplay(2); const replayCover = await read();
  check(replayCover.phase === 0 && replayCover.selection === 2 && !replayCover.playing, 'clicking the raised cover title replays that same condition and respects reduced motion');
  await choice(1); await phase(1000); const washed = await read();
  check(washed.model.packets.filter(p => p.drained).length === 15 && washed.model.retainedSalt > 0, 'drained salt remains visible outside the soil and some is retained');
  await capture('soil-drain');
  for (const selection of [0, 1, 2]) {
    await open('soil-care', true); await choice(selection); await phase(1000); const s = await read();
    check(s.svg?.saltCount === 20 && s.svg.images === 0 && !s.svg.invalid && s.process.title === s.caption, `soil/${selection}: native SVG retains all salt markers and shared explanation`);
  }
  await open('aeolian');
  for (const selection of [0, 1, 2, 3]) {
    await choice(selection); await phase(500); const mid = await read();
    await phase(1000); const end = await read(); await page.waitForTimeout(250); const held = await read();
    check(end.model.state.phase === 1 && !end.playing && JSON.stringify(end.model.state) === JSON.stringify(held.model.state), `wind/${selection}: final landform is retained without automatic rewinding`);
    check(end.geometryIds.join() === mid.geometryIds.join(), `wind/${selection}: phase changes reuse real geometry`);
    check(!end.process && end.model.independentForms, `wind/${selection}: independent forms do not become a false sequence`);
    states.push({ id: 'aeolian', selection, mid, end });
  }
  await choice(0); await phase(1000); await capture('wind-end');
  await clickReplay(0); const replayWind = await read();
  check(replayWind.phase === 0 && replayWind.selection === 0 && !replayWind.playing, 'clicking the real wind-landform title explicitly restarts the retained process');
  const title = (await page.locator('#selections').allTextContents()).join('');
  check(title.includes('风蚀蘑菇') && title.includes('植被固沙'), 'the four independent wind-landform choices remain available');
  await open('air-composition'); await choice(1); await phase(500); const air = await read(); states.push(air);
  check(air.model.reference?.waterVaporVisible === false || air.model.waterVaporVisible === false || air.model.state?.reference?.waterVaporVisible === false, 'water-vapour construction explicitly describes invisible gas tracers');
  await capture('air-composition');
  await open('air-composition', true); await choice(1); const flatAir = await read();
  check(flatAir.svg?.vaporCount === 5 && flatAir.svg.impurityCount === 9 && flatAir.svg.images === 0, 'native SVG shares separate open vapour tracers and solid impurity symbols');
  await page.setViewportSize({ width: 390, height: 844 });
  await open('soil-care', true); await choice(2); await phase(500); await capture('phone-soil');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone-width native SVG has no horizontal document overflow');
  return { base, checks, failures, errors, states, screenshots,
    scope: 'Targeted production review of salt conservation, cover/drain interpretation, irreversible wind-landform progress, shared native SVG and invisible water-vapour symbols. Not classroom or physical-device acceptance.' };
}
