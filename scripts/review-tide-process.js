async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'tides' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const ids = window.__tideReviewBuffers ?? (window.__tideReviewBuffers = { map: new WeakMap(), next: 1 });
    const id = buffer => { if (!ids.map.has(buffer)) ids.map.set(buffer, ids.next++); return ids.map.get(buffer); };
    const hash = attribute => {
      let h = 2166136261;
      for (const value of new Uint8Array(attribute.array.buffer)) h = Math.imul(h ^ value, 16777619);
      return h >>> 0;
    };
    const meshes = !d.twoD && g ? g.meshes.filter(m => m.userData.tideRole).map(m => {
      const a = m.geometry.attributes.position, role = m.userData.tideRole, s = g.width / 100;
      const r = { role, uuid: m.uuid, geometry: m.geometry.uuid, material: m.material.uuid, buffer: id(a), hash: hash(a),
        xyz: m.position.toArray(), matrix: m.matrix.elements.slice(), vertices: a.count };
      if (role === 'fitted-seawater') {
        const half = a.count / 2, z0 = -96 - g.height * .9, tops = [], bottoms = [], edge = [];
        let topError = 0, bottomError = 0;
        for (let i = 0; i < half; i++) {
          const x = a.getX(i) / s, z = (a.getZ(i) - z0) / s;
          const q = (z - 6) / 49, offset = 2.5 * Math.sin(q * Math.PI * 1.4) + .7 * Math.sin(q * Math.PI * 3);
          const ground = 2.6 + .32 * Math.max(0, x - 30 + offset);
          topError = Math.max(topError, Math.abs(a.getY(i) / s - d.render.geometry.waterLevel));
          bottomError = Math.max(bottomError, Math.abs(a.getY(i + half) / s - ground));
          if (i % 43 === 42) edge.push([x, a.getY(i) / s, z]);
          if (i % 257 === 0) { tops.push([x, a.getY(i) / s, z]); bottoms.push(a.getY(i + half) / s); }
        }
        Object.assign(r, { topError, bottomError, edge, tops, bottoms });
      }
      if (role === 'floating-skiff') {
        m.geometry.computeBoundingBox(); r.keel = (m.geometry.boundingBox.min.y + m.position.y) / s;
        const rect = b.renderer.domElement.getBoundingClientRect(), points = [];
        for (let i = 0; i < a.count; i++) {
          const p = b.camera.position.clone().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).project(b.camera);
          points.push([rect.left + (p.x + 1) * rect.width / 2, rect.top + (1 - p.y) * rect.height / 2]);
        }
        r.screenBox = { left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])), top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])) };
      }
      return r;
    }) : [];
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      geometry: d.render?.geometry, labels: d.render?.labels, pages: d.pages,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.tides,
      render: { geometries: d.render?.geometries, textures: d.render?.textures, calls: d.render?.calls, triangles: d.render?.triangles }, meshes };
  });
  const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const sameCamera = (a, b) => delta(a.position, b.position) < .0001 && delta(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  const phaseDistance = (a, b) => Math.abs(((a - b + 1.5) % 1) - .5);
  const water = s => s.meshes.find(m => m.role === 'fitted-seawater');
  const signatures = s => s.meshes.map(m => [m.uuid, m.geometry, m.material, m.buffer]);
  const gauge = s => s.meshes.filter(m => m.role === 'fixed-tide-gauge').map(m => m.matrix);
  const setPhase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < Math.round(value / 100); i++) await range.press('PageUp');
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-7, value);
  };
  const settleCamera = async () => {
    let previous, stable = 0;
    for (let attempt = 0; attempt < 90; attempt++) {
      const current = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = previous && delta(previous, current) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = current; await page.waitForTimeout(80);
    }
    throw Error('Camera framing did not settle before locating the real tide handle');
  };
  const inspectLabels = async name => {
    const state = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize(), labels = state.labels ?? [];
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = labels.filter(l => l.fontPx < 18);
    const pairs = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    const skiff = state.meshes.find(m => m.role === 'floating-skiff').screenBox;
    const obscuresBoat = labels.filter(l => Math.min(l.right, skiff.right) > Math.max(l.left, skiff.left) + 2 && Math.min(l.bottom, skiff.bottom) > Math.max(l.top, skiff.top) + 2);
    if (labels.length !== 3 || outside.length || small.length || pairs.length || obscuresBoat.length) labelIssues.push({ name, viewport: vp, outside, small, pairs, obscuresBoat, labels, skiff });
    check(labels.length === 3 && !outside.length && !small.length && !pairs.length && !obscuresBoat.length, `${name}: three necessary labels stay readable, separated and clear of the skiff`);
  };
  const inspectGeometry = (s, name) => {
    const w = water(s), model = s.geometry, expected = 7.8 + 10.4 * (1 - Math.cos(s.phase * Math.PI * 2)) / 2;
    check(model.kind === 'tide' && Math.abs(model.waterLevel - expected) < 1e-9, `${name}: all visuals read the single continuous tide phase`);
    check(w.topError < .00005 && w.bottomError < .00005, `${name}: actual water vertices meet one level and the unchanged seabed`);
    check(w.edge.length === model.shoreline.length && w.edge.every((p, i) => delta(p, model.shoreline[i]) < .00005), `${name}: actual water edge is the same slope intersection as the shoreline state`);
    const hull = s.meshes.find(m => m.role === 'floating-skiff');
    check(Math.abs(hull.keel - model.boat.keel) < .00001 && model.boat.waterline === model.waterLevel && model.boat.draft === 1.15, `${name}: the real skiff follows that waterline with unchanged draft`);
    check(model.gauge.waterMark === model.waterLevel && model.gaugeStationary && model.realShoreIntersection && model.waterVolumeFollowsSeabed, `${name}: the fixed gauge and physical slope give consistent references`);
    check(!model.measuredTideHeight && !model.localTideTimes && !model.arrowsForLocalCurrent, `${name}: the diagram adds no measured heights, local timetable or arbitrary current arrow`);
  };
  // Read-only projection and ray tests identify an exposed solid handle.
  // Only the real mouse or native keyboard changes the production state.
  const target = () => page.evaluate(() => {
    const b = window.textbookDebug, g = b.entry.art.geometry;
    b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
    const mesh = g.meshes.find(m => m.userData.tideHandle), rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
    const v = () => b.camera.position.clone().set(0, 0, 0), a = mesh.geometry.attributes.position, idx = mesh.geometry.index;
    mesh.geometry.computeBoundingBox(); const candidates = [mesh.geometry.boundingBox.getCenter(v())];
    for (let i = 0; i < (idx?.count ?? a.count) / 3; i += 3) {
      const p = v(); for (let k = 0; k < 3; k++) p.add(v().fromBufferAttribute(a, idx ? idx.getX(i * 3 + k) : i * 3 + k));
      candidates.push(p.multiplyScalar(1 / 3));
    }
    for (const local of candidates) {
      const p = local.applyMatrix4(mesh.matrixWorld).project(b.camera), x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
      if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 10 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
      const actual = b.pickModel(x, y);
      if (actual?.object === mesh && actual.input) return { x, y, label: actual.input.label };
    }
    return null;
  });
  const dragDial = async (name, phases) => {
    await settleCamera(); const hit = await target();
    if (!hit) throw Error(`${name}: no exposed real tide handle`); targets.push({ name, ...hit });
    const before = await read(); await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `${name}: the solid handle exposes its drag hint`);
    await page.mouse.down(); await frames(); const grasped = await read();
    check(!grasped.playing && phaseDistance(grasped.phase, before.phase) < .02, `${name}: grasp pauses without a discontinuous phase jump`);
    const offset = await page.evaluate(({ x, y }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, { center, radiusX, radiusY } = g.meshes.find(m => m.userData.tideHandle).userData.modelInput.dial;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const o = g.root.worldToLocal(b.ray.ray.origin.clone()), d = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(o);
      const p = o.clone().addScaledVector(d, (center[2] - o.z) / d.z), angle = (window.textbookDiagnostics.state.phase - .25) * Math.PI * 2;
      return [p.x - center[0] - Math.cos(angle) * radiusX, p.y - center[1] - Math.sin(angle) * radiusY];
    }, hit);
    const screen = await page.evaluate(({ phases, offset }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, { center, radiusX, radiusY } = g.meshes.find(m => m.userData.tideHandle).userData.modelInput.dial, r = b.renderer.domElement.getBoundingClientRect();
      return phases.map(phase => {
        const angle = (phase - .25) * Math.PI * 2, p = b.camera.position.clone().set(center[0] + Math.cos(angle) * radiusX + offset[0], center[1] + Math.sin(angle) * radiusY + offset[1], center[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
      });
    }, { phases, offset });
    const samples = [];
    try {
      for (const p of screen) {
        await page.mouse.move(p.x, p.y, { steps: 5 }); await frames(); const s = await read(); samples.push(s);
        check(phaseDistance(s.phase, p.phase) < .002 && !s.playing, `${name}: actual pointer reaches ${p.phase}`); inspectGeometry(s, `${name}-${p.phase}`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const after = await read(); await page.waitForTimeout(250); const held = await read();
    check(sameCamera(before.camera, held.camera), `${name}: dragging the tide handle never rotates the camera`);
    check(!held.playing && held.phase === after.phase && water(held).hash === water(after).hash && JSON.stringify(held.meshes.map(m => m.xyz)) === JSON.stringify(after.meshes.map(m => m.xyz)), `${name}: releasing freezes water, skiff, shoreline and handle`);
    check(phaseDistance(held.saved.phase, held.phase) < .000001, `${name}: release saves the exact continuous input`);
    states.push({ name, before, offset, samples, after: held }); return held;
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=tides&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
  check(JSON.stringify(await page.locator('#selections button').allTextContents()) === JSON.stringify(['低潮', '涨潮', '高潮', '落潮']), 'the four textbook tide stage shortcuts keep their labels and order');
  const presetSamples = [];
  for (const [index, phase, caption] of [[0, 0, '低潮'], [1, .25, '涨潮'], [2, .5, '高潮'], [3, .75, '落潮']]) {
    await page.locator(`#selections [data-selection="${index}"]`).click(); await frames(); const s = await read(); presetSamples.push(s);
    check(s.phase === phase && s.geometry.caption === caption && !s.playing, `${caption}: preset chooses one exact model phase and pauses`);
    inspectGeometry(s, caption); await settleCamera(); await inspectLabels(`desktop-${index}`);
    await page.screenshot({ path: `output/playwright/tide-desktop-${index}.png` });
  }
  check(presetSamples[2].geometry.shorelineFront > presetSamples[0].geometry.shorelineFront, 'rising water actually advances the shoreline up the same beach');
  check(presetSamples.every(s => JSON.stringify(gauge(s)) === JSON.stringify(gauge(presetSamples[0]))), 'the red-white gauge never floats with the sea');
  check(presetSamples.every(s => JSON.stringify(signatures(s)) === JSON.stringify(signatures(presetSamples[0]))), 'all geometry, material and position-buffer identities are stable across presets');
  await setPhase(600); const falling = await read(); inspectGeometry(falling, 'keyboard-.6');
  check(falling.geometry.caption === '落潮', 'keyboard phase .6 says falling tide rather than rounding it back to high tide');
  await setPhase(200); const early = await read(); await setPhase(600); const repeat = await read();
  check(water(repeat).hash === water(falling).hash && water(early).hash !== water(falling).hash, 'native forward and reverse keyboard seeking restores the identical fitted water mesh');
  await setPhase(0); const start = await read(); await setPhase(1000); const end = await read();
  check(water(start).hash === water(end).hash && JSON.stringify(start.geometry.shoreline) === JSON.stringify(end.geometry.shoreline), 'the repeating cycle joins without a water or shore discontinuity');
  await setPhase(200); await page.locator('#cPause').click(); await page.waitForTimeout(250); const playing = await read();
  check(playing.playing && playing.phase > .2 && water(playing).hash !== water(early).hash, 'playback advances the same tide phase and physical water geometry');
  const dragged = await dragDial('desktop-tide-dial', [.3, .5, .6, .9, .3]);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready(); await frames(); const restored = await read();
  check(phaseDistance(restored.phase, dragged.phase) < .000001 && !restored.playing && water(restored).hash === water(dragged).hash, 'refresh restores the released continuous tide and remains paused');
  await page.setViewportSize({ width: 1024, height: 768 }); await settleCamera();
  const tablet = await dragDial('1024-tide-dial', [.5, .75, .25]); await inspectLabels('tablet-rising');
  await page.screenshot({ path: 'output/playwright/tide-tablet-rising.png' });
  check(tablet.render.triangles < 80000 && tablet.render.calls < 120, 'the 1024 live tide model stays within the requested scene budget');
  const before2d = await read(); await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.twoD); const switched = await read();
  check(!switched.playing && switched.phase === before2d.phase, 'switching to native vector mode preserves the exact tide and stays paused');
  const svg = () => page.locator('.flat-model-svg').evaluate(el => ({ images: el.querySelectorAll('image').length, role: el.getAttribute('role'),
    aria: el.getAttribute('aria-label'), stage: el.dataset.tideStage, phase: Number(el.dataset.tidePhase), level: Number(el.dataset.tideLevel), shore: Number(el.dataset.tideShore), boat: Number(el.dataset.tideBoat), gauge: Number(el.dataset.tideGaugeMark) }));
  const vector = await svg();
  check(vector.images === 0 && vector.role === 'img' && Math.abs(vector.level - before2d.geometry.waterLevel) < 1e-10 && Math.abs(vector.shore - before2d.geometry.shorelineFront) < 1e-10 && vector.boat === vector.level && vector.gauge === vector.level, 'the native SVG uses the same shore, boat, gauge and sea state without a sampled illustration');
  await setPhase(600); const svgFalling = await svg(); await setPhase(0); const svgLow = await svg(); await setPhase(600);
  check(svgFalling.stage === 'falling' && JSON.stringify(svgFalling) === JSON.stringify(await svg()) && svgLow.level < svgFalling.level, 'keyboard input also seeks deterministically in vector mode');
  await page.setViewportSize({ width: 390, height: 844 }); await frames(); await page.locator('.flat-model-svg').scrollIntoViewIfNeeded();
  const phone = await page.locator('.flat-model-svg').evaluate(el => {
    const r = el.getBoundingClientRect(), labels = [...el.querySelectorAll('text')].map(t => { const b = t.getBoundingClientRect(), m = t.getScreenCTM(); return { text: t.textContent, left: b.left, right: b.right, top: b.top, bottom: b.bottom, px: parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b) }; });
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, labels };
  });
  const pairs = phone.labels.flatMap((a, i) => phone.labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1));
  check(phone.labels.length === 3 && !pairs.length && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.left - 1 && l.right <= phone.right + 1), 'phone SVG keeps all three necessary labels at least 18 pixels, separated and inside its bounds');
  await page.screenshot({ path: 'output/playwright/tide-phone-falling.png' });
  states.push({ name: 'presets-and-keyboard', presetSamples, falling, early, repeat, start, end, playing, restored, before2d, vector, svgFalling, svgLow, phone });
  check(!errors.length, 'no browser exceptions or console errors');
  return { base, browser: page.context().browser().version(), checks, failures, errors, states, targets, labelIssues, limitations: ['No real touch-screen tablet was available; 1024×768 uses a desktop browser and real mouse input.'] };
}
