async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173', checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 600)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => { const d = window.textbookDiagnostics; return d?.ready && d.active === 'salinity' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live'); }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const live = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
    return { phase: d.state.phase, selection: d.state.selection, playing: d.playing, twoD: d.twoD, model: d.render?.geometry,
      labels: d.render?.labels, camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation, zoom: b.zoom } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.salinity,
      render: { calls: d.render?.calls, triangles: d.render?.triangles, geometries: d.render?.geometries, textures: d.render?.textures },
      meshes: !d.twoD && g ? g.meshes.filter(m => m.userData.salinityRole).map(m => ({ role: m.userData.salinityRole, visible: live(m),
        uuid: m.geometry.uuid, bufferCount: m.geometry.attributes.position.count, data: m.userData, position: m.position.toArray(),
        finite: Array.from(m.geometry.attributes.position.array).every(Number.isFinite) })) : [],
      svg: d.twoD ? { water: document.querySelector('[data-model="salinity"]')?.getAttribute('data-water'),
        salt: document.querySelector('[data-model="salinity"]')?.getAttribute('data-salt'), concentration: document.querySelector('[data-model="salinity"]')?.getAttribute('data-concentration') } : null };
  });
  const phase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < value / 100; i++) await range.press('PageUp');
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
  };
  const settle = async () => {
    let last, stable = 0;
    for (let i = 0; i < 70; i++) {
      const next = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = last && Math.max(...next.map((n, i) => Math.abs(n - last[i]))) < .000005 ? stable + 1 : 0;
      if (stable >= 3) return;
      last = next; await page.waitForTimeout(80);
    }
    throw Error('Salinity camera did not settle');
  };
  const target = async role => {
    const hit = await page.evaluate(role => {
      const b = window.textbookDebug, g = b.entry.art.geometry, canvas = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      for (const m of g.meshes.filter(m => m.userData.salinityRole === role && m.visible)) {
        m.geometry.computeBoundingSphere(); const positions = [m.geometry.boundingSphere.center.clone()], a = m.geometry.attributes.position, index = m.geometry.index;
        const count = (index?.count ?? a.count) / 3, step = Math.max(1, Math.floor(count / 260));
        for (let i = 0; i < count; i += step) {
          const v = b.camera.position.clone().set(0, 0, 0);
          for (let j = 0; j < 3; j++) v.add(b.camera.position.clone().fromBufferAttribute(a, index ? index.getX(i * 3 + j) : i * 3 + j));
          positions.push(v.multiplyScalar(1 / 3));
        }
        for (const position of positions) {
          const v = position.clone().applyMatrix4(m.matrixWorld).project(b.camera);
          const x = canvas.left + (v.x + 1) * canvas.width / 2, y = canvas.top + (1 - v.y) * canvas.height / 2;
          const h = b.pickModel(x, y);
          if (x > 5 && x < innerWidth - 5 && y > 5 && y < dock.top - 8 && h?.object === m) return { x, y, input: h.input, object: m.uuid };
        }
      } return null;
    }, role);
    if (!hit) throw Error(`No exposed salinity target: ${role}`);
    targets.push({ role, ...hit }); return hit;
  };
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?figure=salinity&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if ((await read()).playing) await page.locator('#cPause').click();
  check(JSON.stringify(await page.locator('#selections [data-selection]').allTextContents()) === JSON.stringify(['蒸发增强', '降水增多', '河流注入']), 'three original textbook condition choices remain');
  const starts = [], ends = [];
  for (const mode of [0, 1, 2]) {
    await page.locator(`#selections [data-selection="${mode}"]`).click();
    if ((await read()).playing) await page.locator('#cPause').click();
    await phase(0); starts.push((await read()).model);
    for (const value of [0, 300, 600, 1000, 600]) {
      await phase(value); const s = await read(), m = s.model, inv = m.inventory; states.push({ name: `mode-${mode}-phase-${value}`, ...s });
      check(m.kind === 'salinity-balance' && m.bitmapSurfaces === 0 && m.imageMappedMeshes === 0, `${mode}/${value}: raised physical basin has no textbook-image surface`);
      check(Math.abs(inv.total - inv.expected) < 1e-8 && inv.basin > 0 && inv.inTransit >= -1e-8, `${mode}/${value}: every water portion remains in the inventory`);
      check(m.saltMass === 2 && m.grainCount === 24 && m.saltMarksDissolved, `${mode}/${value}: the same dissolved salt inventory stays in the basin`);
      check(Math.abs(m.concentration - 2 / (m.waterAmount + 2)) < 1e-10, `${mode}/${value}: concentration follows the current water amount`);
      check(s.meshes.every(m => m.finite), `${mode}/${value}: all physical vertex buffers remain finite`);
      const actual = s.meshes.find(m => m.role === 'sea-water');
      check(actual.data.waterAmount === m.waterAmount && actual.data.concentration === m.concentration, `${mode}/${value}: actual water solid uses the same scientific state`);
      if (value === 1000) ends.push(m);
    }
    const same = states.filter(s => s.name === `mode-${mode}-phase-600`);
    check(JSON.stringify(same[0].model) === JSON.stringify(same[1].model), `${mode}: backwards seeking restores the exact same derived state`);
    const ids = states.filter(s => s.selection === mode).map(s => s.meshes.map(m => [m.role, m.uuid, m.bufferCount]));
    check(ids.every(a => JSON.stringify(a) === JSON.stringify(ids[0])), `${mode}: scrubbing reuses fixed geometry buffers`);
    await phase(1000); await settle();
    const s = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize(), labels = s.labels;
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 2);
    const small = labels.filter(l => l.fontPx < 18);
    const overlap = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (outside.length || small.length || overlap.length) labelIssues.push({ mode, labels, outside, small, overlap });
    check(labels.length === 3 && !outside.length && !small.length && !overlap.length, `${mode}: three short labels are clear and separated`);
    await page.screenshot({ path: `output/playwright/salinity-${mode}-end.png` });
    // Clicking the real source begins the same finite trial again.
    const source = await target(mode === 0 ? 'evaporation-source' : mode === 1 ? 'rain-source' : 'river');
    await page.mouse.click(source.x, source.y); await frames();
    check((await read()).phase < .08 && (await read()).selection === mode, `${mode}: physical source restarts this condition from its initial water`);
    if ((await read()).playing) await page.locator('#cPause').click();
  }
  check(starts.every(s => s.waterAmount === 54 && s.saltMass === 2 && s.concentration === starts[0].concentration), 'all three conditions share identical initial water and salt');
  check(ends[0].waterAmount === 36 && ends[1].waterAmount === 72 && ends[2].waterAmount === 72, 'evaporation removes water; rain and river add the same fresh water');
  await phase(400); await settle();
  const beforeDrag = await read(), hit = await target('water-handle');
  const points = await page.evaluate(({ phases }) => {
    const b = window.textbookDebug, m = b.entry.art.geometry.meshes.find(m => m.userData.salinityRole === 'water-handle'), track = m.userData.modelInput.track;
    const rect = b.renderer.domElement.getBoundingClientRect();
    return phases.map(phase => { const v = b.camera.position.clone().set(...track.start.map((n, i) => n + (track.end[i] - n) * phase)).applyMatrix4(m.parent.matrixWorld).project(b.camera);
      return { phase, x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }; });
  }, { phases: [.7, .2, .9] });
  await page.mouse.move(hit.x, hit.y); await page.mouse.down();
  try { for (const point of points) { await page.mouse.move(point.x, point.y, { steps: 8 }); await frames(); const s = await read(); check(Math.abs(s.phase - point.phase) < .004 && !s.playing, `direct water handle seeks to ${point.phase} and pauses`); } }
  finally { await page.mouse.up(); }
  await frames(); const afterDrag = await read();
  check(Math.abs(afterDrag.saved.phase - afterDrag.phase) < 1e-8, 'releasing the water handle saves the inspected conditions');
  // The settled camera still approaches its target with exponential lerp.
  // Inspect actual camera drift and exact input angles rather than requiring
  // floating-point position equality between different render frames.
  const cameraDrift = {
    position: Math.max(...beforeDrag.camera.position.map((n, i) => Math.abs(n - afterDrag.camera.position[i]))),
    quaternion: Math.max(...beforeDrag.camera.quaternion.map((n, i) => Math.abs(n - afterDrag.camera.quaternion[i]))),
  };
  states.push({ name: 'direct-drag-camera', before: beforeDrag.camera, after: afterDrag.camera, drift: cameraDrift });
  check(beforeDrag.camera.orbit === afterDrag.camera.orbit && beforeDrag.camera.elevation === afterDrag.camera.elevation && beforeDrag.camera.zoom === afterDrag.camera.zoom && cameraDrift.position < .0005 && cameraDrift.quaternion < .000005, 'direct process dragging leaves camera input angles unchanged with negligible settling drift');
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  const restored = await read(); check(Math.abs(restored.phase - afterDrag.phase) < 1e-8 && restored.selection === afterDrag.selection && !restored.playing, 'reload restores the inspected trial and remains paused');
  const sourceState = restored.model;
  await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready(); await frames(); const flat = await read();
  check(flat.twoD && +flat.svg.water === sourceState.waterAmount && +flat.svg.salt === sourceState.saltMass && Math.abs(+flat.svg.concentration - sourceState.concentration) < 1e-10, 'SVG fallback uses the exact same inventory and concentration');
  await page.setViewportSize({ width: 390, height: 844 }); await frames();
  await page.goto(`${base}/?figure=salinity&2d&inspect`, { waitUntil: 'domcontentloaded' }); await ready(); await frames();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile SVG and controls do not overflow horizontally');
  await page.screenshot({ path: 'output/playwright/salinity-phone.png' });
  return { base, checks, failures, errors, labelIssues, states, targets, starts, ends };
}
