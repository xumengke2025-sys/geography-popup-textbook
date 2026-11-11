async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], labelIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'soil-factors' && !d.figureBusy && !d.turning
      && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, g = window.textbookDebug?.entry?.art?.geometry;
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      geometry: d.render?.geometry, labels: d.render?.labels, render: {
        geometries: d.render?.geometries, textures: d.render?.textures, models: d.render?.models,
        triangles: d.render?.triangles, calls: d.render?.calls, state: d.render?.modelState,
      }, meshes: !d.twoD && g ? g.meshes.filter(visible).map(m => ({ role: m.userData.soilSortingRole,
        kind: m.userData.kind, text: m.userData.text, id: m.userData.soilGrainId, size: m.userData.soilGrainSize,
        u: m.userData.u, v: m.userData.v, height: m.userData.height, deposited: m.userData.deposited,
        xyz: m.position.toArray(), geometry: m.geometry.uuid, positionBuffer: m.geometry.attributes.position.uuid,
      })) : [] };
  });
  const setPhase = async value => {
    await page.locator('#phase').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await frames();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-7, value);
  };
  const select = async n => {
    await page.locator(`#selections [data-selection="${n}"]`).click(); await frames();
  };
  const grainPositions = s => s.meshes.filter(m => m.role === 'grain').map(({ id, u, v, height, deposited, xyz }) => ({ id, u, v, height, deposited, xyz }));
  const identical = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const inspectLabels = async name => {
    const state = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize();
    const labels = state.labels ?? [];
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = labels.filter(l => l.fontPx < 18);
    const pairs = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (labels.length !== 3 || outside.length || small.length || pairs.length) labelIssues.push({ name, viewport: vp, outside, small, pairs, labels, modelState: state.render.state });
    check(labels.length === 3 && !outside.length && !small.length && !pairs.length, `${name}: three clear nonoverlapping labels above the controls`);
  };
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=soil-factors&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  check(await page.locator('#selections button').count() === 5, 'four existing choices plus relief sorting are reachable');
  for (let selection = 0; selection < 4; selection++) {
    await select(selection); await setPhase(500);
    const s = await read();
    check(s.geometry.factor === ['parent-material', 'biological-cycle', 'climate', 'time'][selection], `legacy ${selection}: original factor preserved`);
    check(!s.meshes.some(m => m.role), `legacy ${selection}: all sorting meshes hidden`);
    check(s.meshes.filter(m => m.kind === 'text-label').length === 3, `legacy ${selection}: exactly original three labels visible`);
  }
  await select(4);
  const samples = [];
  for (const value of [0, 200, 500, 750, 1000, 500]) {
    await setPhase(value); const s = await read(); samples.push(s);
    check(s.meshes.filter(m => m.role === 'grain').length === 54, `${value}: the same 54 real particle meshes are visible`);
    check(!s.meshes.some(m => !m.role), `${value}: legacy soil model does not overlap the landscape`);
    check(s.geometry.sorting?.reference?.notAllSoilFormationFactors === true && s.geometry.sorting?.ratesAreSchematic === true,
      `${value}: textbook scope and uncalibrated rates remain explicit`);
    if (value === 500) await inspectLabels('desktop-midpoint');
    if (value === 500 || value === 1000) await page.screenshot({ path: `output/playwright/soil-sorting-desktop-${value}.png` });
  }
  const initial = samples[0], middle = samples[2], end = samples[4];
  check(!identical(grainPositions(initial), grainPositions(middle)), 'particles actually move in the production Three.js geometry');
  check(identical(grainPositions(middle), grainPositions(samples[5])), 'reverse scrubbing returns the exact same positions');
  const finalGrains = end.meshes.filter(m => m.role === 'grain');
  const range = size => finalGrains.filter(m => m.size === size).map(m => m.u);
  check(Math.max(...range('coarse')) < Math.min(...range('medium')) && Math.max(...range('medium')) < Math.min(...range('fine')),
    'final material remains visibly sorted from coarse to fine downslope');
  check(finalGrains.every(m => m.deposited) && !end.meshes.some(m => m.role === 'water'), 'end retains every deposited particle after water recedes');
  check(samples.every(s => identical(s.meshes.filter(m => m.role === 'grain').map(m => m.geometry), initial.meshes.filter(m => m.role === 'grain').map(m => m.geometry))),
    'particle geometry objects are reused during forward and reverse transport');
  await setPhase(500); await page.locator('#cPause').click(); await page.waitForTimeout(600);
  const moving = await read();
  check(moving.playing && moving.phase > .5 && !identical(grainPositions(moving), grainPositions(middle)), 'play advances both time and actual particles');
  await page.locator('#cPause').click(); await frames(); const paused = await read();
  await page.waitForTimeout(400); const held = await read();
  check(!held.playing && held.phase === paused.phase && identical(grainPositions(held), grainPositions(paused)), 'pause freezes all particle positions');
  await setPhase(990); await page.locator('#cPause').click();
  await page.waitForFunction(() => !window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase === 1);
  const finished = await read(); await page.waitForTimeout(350); const kept = await read();
  check(kept.phase === 1 && identical(grainPositions(kept), grainPositions(finished)), 'one-shot playback ends without erasing the final distribution');
  await page.locator('#cPause').click(); await frames();
  check((await read()).phase < .2 && (await read()).playing, 'playing again restarts the once-only process from its beginning');
  await page.locator('#cPause').click(); await setPhase(620); const beforeReload = await read();
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  const reloaded = await read();
  check(reloaded.selection === 4 && !reloaded.playing && identical(grainPositions(reloaded), grainPositions(beforeReload)), 'refresh restores the sorting choice and deterministic paused positions');
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(800);
  await setPhase(500); await inspectLabels('tablet-midpoint');
  await page.screenshot({ path: 'output/playwright/soil-sorting-tablet-500.png' });
  await setPhase(1000); await inspectLabels('tablet-finished');
  await page.screenshot({ path: 'output/playwright/soil-sorting-tablet-1000.png' });
  await setPhase(620); const before2d = await read();
  await page.locator('#cContents').click(); await page.locator('#mode').click();
  await ready(); await page.waitForFunction(() => window.textbookDiagnostics.twoD);
  if ((await read()).playing) await page.locator('#cPause').click();
  await setPhase(620);
  const readSvg = () => page.locator('.flat-model-svg').evaluate(svg => ({
    count: svg.querySelectorAll('[data-soil-grain]').length, images: svg.querySelectorAll('image').length,
    stage: svg.dataset.soilSorting, aria: svg.getAttribute('aria-label'),
    grains: [...svg.querySelectorAll('[data-soil-grain]')].map(el => ({ id: Number(el.dataset.soilGrain),
      u: Number(el.dataset.u), v: Number(el.dataset.v), height: Number(el.dataset.height), deposited: el.dataset.deposited === 'true' })).sort((a, b) => a.id - b.id),
  }));
  const svg = await readSvg(), production = before2d.meshes.filter(m => m.role === 'grain').sort((a, b) => a.id - b.id);
  check(svg.count === 54 && svg.images === 0, '2D is a native vector landscape with the same 54 particles');
  check(svg.grains.every((p, i) => ['u', 'v', 'height'].every(key => Math.abs(p[key] - production[i][key]) < .0000006) && p.deposited === production[i].deposited),
    'every 2D particle and deposition flag matches its actual 3D counterpart');
  check(svg.aria.includes('不是全部成土因素') && svg.aria.includes('不表示真实侵蚀或成土速率'), '2D keeps the scientific limits');
  await setPhase(1000); const svgEnd = await readSvg(); await setPhase(200); const svgEarly = await readSvg(); await setPhase(1000);
  check(!identical(svgEnd.grains, svgEarly.grains) && identical(svgEnd.grains, (await readSvg()).grains), '2D advances and reverses deterministically with final particles retained');
  await page.setViewportSize({ width: 390, height: 844 }); await frames();
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const bounds = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text')].map(el => { const r = el.getBoundingClientRect(), m = el.getScreenCTM();
      return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b) }; });
    return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, labels };
  });
  check(phone.labels.length === 3 && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.bounds.left - 1 && l.right <= phone.bounds.right + 1),
    'phone labels remain inside the vector diagram and at least 18 pixels');
  await page.screenshot({ path: 'output/playwright/soil-sorting-phone-finished.png' });
  states.push({ initial, middle, end, paused: held, finished, reloaded, before2d, svg, svgEnd, phone });
  check(!errors.length, 'no browser exceptions');
  return { base, checks, failures, errors, states, labelIssues };
}
