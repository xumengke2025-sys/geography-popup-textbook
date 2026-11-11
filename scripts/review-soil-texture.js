async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], labelIssues = [], states = [], targets = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'soil-texture' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const review = window.__soilTextureReview ?? (window.__soilTextureReview = { buffers: new WeakMap(), next: 1, grains: new Map() });
    const identity = a => { if (!review.buffers.has(a)) review.buffers.set(a, review.next++); return review.buffers.get(a); };
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const meshes = !d.twoD && g ? g.meshes.filter(visible).map(mesh => {
      const role = mesh.userData.soilTextureRole, a = mesh.geometry.attributes.position;
      let stationary = true;
      if (role === 'soil-grains') {
        if (!review.grains.has(mesh.geometry.uuid)) review.grains.set(mesh.geometry.uuid, new Float32Array(a.array));
        const original = review.grains.get(mesh.geometry.uuid); stationary = a.array.every((v, i) => v === original[i]);
      }
      const actualWater = [];
      if (role === 'water-portions') {
        const stride = mesh.userData.waterPortionStride;
        for (let id = 0; id < 36; id++) {
          const center = [0, 0, 0];
          for (let k = 0; k < stride; k++) { const vertex = id * stride + k; center[0] += a.getX(vertex); center[1] += a.getY(vertex); center[2] += a.getZ(vertex); }
          actualWater.push({ id, center: center.map(n => n / stride) });
        }
      }
      return { role, sample: mesh.userData.soilTextureSample, text: mesh.userData.text, geometry: mesh.geometry.uuid,
        buffer: identity(a), stationary, grainCount: mesh.userData.grainCount, fraction: mesh.userData.fraction,
        position: mesh.position.toArray(), scale: mesh.scale.toArray(), actualWater };
    }) : [];
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      geometry: d.render?.geometry, labels: d.render?.labels, meshes,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.['soil-texture'],
      render: { triangles: d.render?.triangles, calls: d.render?.calls, geometries: d.render?.geometries, textures: d.render?.textures },
    };
  });
  const total = inv => Object.entries(inv).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0);
  const inventoryBalanced = s => s.geometry.samples.every(sample => Math.abs(total(sample.inventory) - 36) < 1e-8);
  const equalRain = s => s.geometry.samples.every(sample => sample.inventory.waiting === s.geometry.samples[0].inventory.waiting && sample.inventory.falling === s.geometry.samples[0].inventory.falling);
  const waterScience = s => s.geometry.samples.map(sample => ({ portions: sample.portions, inventory: sample.inventory, collected: sample.collected, reservoir: sample.reservoir }));
  const identical = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const sameCamera = (a, b) => distance(a.position, b.position) < .0001 && distance(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  const setPhase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < Math.round(value / 100); i++) await range.press('PageUp');
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-7, value);
  };
  const settle = async () => {
    let previous, stable = 0;
    for (let i = 0; i < 90; i++) {
      const position = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = previous && distance(position, previous) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = position; await page.waitForTimeout(80);
    }
    throw Error('Camera framing did not settle');
  };
  const inspectLabels = async name => {
    const s = await read(), labels = s.labels ?? [], dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize();
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3), small = labels.filter(l => l.fontPx < 18);
    const overlap = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (labels.length !== 3 || outside.length || small.length || overlap.length) labelIssues.push({ name, labels, outside, small, overlap });
    check(labels.length === 3 && !outside.length && !small.length && !overlap.length, `${name}: three short labels are readable, separated and above the dock`);
  };
  const target = async request => {
    const result = await page.evaluate(request => {
      const b = window.textbookDebug, g = b.entry.art.geometry; b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
      const vector = () => b.camera.position.clone().set(0, 0, 0);
      const candidates = g.meshes.filter(m => visible(m) && m.userData.soilTextureRole === request.role && (request.sample === undefined || m.userData.soilTextureSample === request.sample));
      for (const mesh of candidates) {
        const a = mesh.geometry.attributes.position, ix = mesh.geometry.index, count = (ix?.count ?? a.count) / 3;
        mesh.geometry.computeBoundingBox(); const points = [mesh.geometry.boundingBox.getCenter(vector())];
        for (let t = 0; t < count; t += Math.max(1, Math.floor(count / 360))) {
          const center = vector(); for (let k = 0; k < 3; k++) center.add(vector().fromBufferAttribute(a, ix ? ix.getX(t * 3 + k) : t * 3 + k)); points.push(center.multiplyScalar(1 / 3));
        }
        for (const local of points) {
          const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera), x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
          if (x < 10 || x > innerWidth - 10 || y < 10 || y > dock.top - 8 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const hit = b.pickModel(x, y); if (hit?.object === mesh && hit.input) return { x, y, role: request.role, sample: request.sample, label: hit.input.label };
        }
      }
      return null;
    }, request);
    if (!result) throw Error(`No real exposed model target: ${JSON.stringify(request)}`);
    targets.push(result); return result;
  };
  const dragWater = async phases => {
    await settle(); const hit = await target({ role: 'water-handle' });
    const offset = await page.evaluate(({ x, y }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.soilTextureHandle).userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y); const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
      const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), phase = window.textbookDiagnostics.state.phase;
      return [track.start[0] + (track.end[0] - track.start[0]) * phase - p.x, track.start[1] + (track.end[1] - track.start[1]) * phase - p.y];
    }, hit);
    const points = await page.evaluate(({ phases, offset }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.soilTextureHandle).userData.modelInput.track, rect = b.renderer.domElement.getBoundingClientRect();
      return phases.map(phase => {
        const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0], track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera); return { phase, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      });
    }, { phases, offset });
    const before = await read(), samples = []; await page.mouse.move(hit.x, hit.y); await page.mouse.down();
    try { for (const p of points) {
      await page.mouse.move(p.x, p.y, { steps: 5 }); await frames(); const s = await read(); samples.push(s);
      check(Math.abs(s.phase - p.phase) < .002 && !s.playing && equalRain(s) && inventoryBalanced(s), `water drag ${p.phase}: all three samples share the real paused input and conserved rain`);
    } } finally { await page.mouse.up(); }
    await frames(); const after = await read();
    check(sameCamera(before.camera, after.camera), 'dragging the water drop never rotates the camera');
    check(Math.abs(after.saved.phase - after.phase) < 1e-7, 'releasing the water drop saves its exact progress');
    states.push({ name: 'real-water-drag', before, samples, after });
  };
  const actualWaterMatchesModel = s => {
    const l = s.geometry.geometryLayout;
    return s.meshes.filter(m => m.role === 'water-portions').every(mesh => mesh.actualWater.every(p => {
      const expected = s.geometry.samples[mesh.sample].portions[p.id], center = [l.centers[mesh.sample] + (expected.u - .5) * l.width, l.top - expected.depth * l.height, l.z0 + l.waterV * l.depth];
      return distance(p.center, center) < .0002;
    }));
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=soil-texture&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
  check(identical(await page.locator('#selections button').allTextContents(), ['砂土', '壤土', '黏土']), 'the original three controls keep their textbook names and order');
  const samples = [];
  for (const value of [0, 200, 400, 700, 1000, 400]) {
    await setPhase(value); const s = await read(); samples.push(s);
    check(s.geometry.kind === 'soil-texture' && equalRain(s) && inventoryBalanced(s), `${value}: three simultaneous columns conserve equal rain`);
    check(s.meshes.filter(m => m.role === 'soil-grains').length === 3 && s.meshes.filter(m => m.role === 'soil-grains').every(m => m.stationary), `${value}: all fixed three-dimensional soil grains stay unchanged`);
    check(s.meshes.filter(m => m.role === 'water-portions').length === 3 && actualWaterMatchesModel(s), `${value}: actual water-buffer coordinates match every model portion`);
    if (value === 400 || value === 1000) { await inspectLabels(`desktop-${value}`); await page.screenshot({ path: `output/playwright/soil-texture-desktop-${value}.png` }); }
  }
  check(!identical(waterScience(samples[0]), waterScience(samples[2])) && identical(waterScience(samples[2]), waterScience(samples[5])), 'water progresses physically and reverse scrubbing restores exactly the same state');
  check(samples.every(s => identical(s.meshes.filter(m => ['soil-grains', 'water-portions'].includes(m.role)).map(m => [m.geometry, m.buffer]), samples[0].meshes.filter(m => ['soil-grains', 'water-portions'].includes(m.role)).map(m => [m.geometry, m.buffer]))), 'soil geometries and actual water BufferAttributes are reused');
  const end = samples[4];
  check(identical(end.geometry.samples.map(s => s.inventory.retained), [6, 21, 28]) && identical(end.geometry.samples.map(s => s.inventory.collected), [30, 15, 8]), 'the same final rain leaves least water in sand and progressively more in loam and clay');
  check(end.meshes.filter(m => m.role === 'collected-water').map(m => m.fraction).every((f, i, all) => !i || f < all[i - 1]), 'the actual lower cups retain visibly different collected volumes');
  await setPhase(400); await settle();
  for (const sample of [1, 2, 0]) {
    const before = await read(), hit = await target({ role: 'soil-grains', sample }); await page.mouse.click(hit.x, hit.y); await frames(); const after = await read();
    check(after.selection === sample && after.phase === before.phase && identical(waterScience(before), waterScience(after)), `sample ${sample}: clicking the real grains changes emphasis only`);
  }
  const label = await target({ role: 'sample-label', sample: 1 }); await page.mouse.click(label.x, label.y); await frames();
  check((await read()).selection === 1 && (await read()).phase === .4, 'the physical short label selects the same sample without restarting rain');
  await dragWater([.2, .4, .8, .4]);
  await setPhase(400); const beforeReload = await read(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  const restored = await read();
  check(restored.selection === beforeReload.selection && !restored.playing && identical(waterScience(restored), waterScience(beforeReload)), 'refresh restores selected sample, rain and collected/retained water while paused');
  await setPhase(900); await page.locator('#cPause').click();
  await page.waitForFunction(() => !window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase === 1, null, { timeout: 45000 });
  const finished = await read(); await page.waitForTimeout(250); const held = await read();
  check(identical(waterScience(finished), waterScience(held)), 'one-shot playback stops without emptying the cups or erasing retained water');
  await settle(); const replay = await target({ role: 'replay-tag' }); await page.mouse.click(replay.x, replay.y); await frames();
  const restarted = await read(); check(restarted.playing && restarted.phase < .15 && restarted.geometry.samples.every(s => s.inventory.collected === 0), 'clicking the real paper rain tag refills equal reservoirs and replays all samples together');
  await page.locator('#cPause').click(); await setPhase(400);
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(); await inspectLabels('tablet-400');
  await page.screenshot({ path: 'output/playwright/soil-texture-tablet-400.png' });
  await setPhase(1000); await inspectLabels('tablet-finished'); await page.screenshot({ path: 'output/playwright/soil-texture-tablet-1000.png' });
  await setPhase(400); const before2d = await read(); await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.twoD);
  check(!(await read()).playing && (await read()).phase === before2d.phase, 'switching to vectors preserves the paused progress');
  const readSvg = () => page.locator('.flat-model-svg').evaluate(svg => ({ role: svg.getAttribute('role'), images: svg.querySelectorAll('image').length, aria: svg.getAttribute('aria-label'),
    water: [...svg.querySelectorAll('[data-soil-texture-water]')].map(el => ({ sample: Number(el.dataset.sample), id: Number(el.dataset.waterId), u: Number(el.dataset.u), depth: Number(el.dataset.depth), status: el.dataset.status, amount: Number(el.dataset.amount) })),
    collected: [...svg.querySelectorAll('[data-soil-texture-collection]')].map(el => ({ sample: Number(el.dataset.soilTextureCollection), fraction: Number(el.dataset.fraction) })),
  }));
  const svg = await readSvg();
  const expectedVisible = before2d.geometry.samples.flatMap(sample => sample.portions.filter(p => p.status !== 'waiting' && p.status !== 'collected').map(p => ({ ...p, sample: sample.index })));
  check(svg.images === 0 && svg.role === 'group' && svg.water.length === expectedVisible.length, '2D fallback is a native vector comparison with every currently visible water portion');
  check(svg.water.every((p, i) => p.id === expectedVisible[i].id && p.sample === expectedVisible[i].sample && p.status === expectedVisible[i].status && ['u', 'depth', 'amount'].every(k => Math.abs(p[k] - expectedVisible[i][k]) < .0000006)), 'all SVG water positions and remaining amounts match the actual three-dimensional state');
  check(svg.aria.includes('不是实测值') && svg.aria.includes('下部自由排水'), 'the model limits remain accessible in vectors');
  const control = n => page.locator(`.flat-model-svg [data-soil-texture-part="sample"][data-model-selection="${n}"]`);
  const originalPhase = (await read()).phase; await control(2).click(); await frames();
  check((await read()).selection === 2 && (await read()).phase === originalPhase, 'clicking a vector sample changes emphasis without changing rain');
  await control(0).focus(); await page.keyboard.press('Enter'); await frames();
  check((await read()).selection === 0 && await control(0).evaluate(el => el === document.activeElement), 'Enter selects a sample and keeps keyboard focus');
  await page.keyboard.press('Space'); await frames();
  check((await read()).selection === 0 && !(await read()).playing && await control(0).evaluate(el => el === document.activeElement), 'Space stays on the sample without starting an unrelated playback');
  await setPhase(1000); const svgEnd = await readSvg();
  await page.locator('.flat-model-svg [data-model-replay]').click(); await frames();
  check((await read()).playing && (await read()).phase < .15, 'the small vector rain tag replays the same shared process');
  await page.locator('#cPause').click(); await setPhase(1000); check(identical((await readSvg()).collected, svgEnd.collected), 'replay and scrubbing reproduce the same final collected quantities');
  await page.setViewportSize({ width: 390, height: 844 }); await frames();
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const bounds = svg.getBoundingClientRect(), labels = [...svg.querySelectorAll('text')].map(el => {
      const r = el.getBoundingClientRect(), m = el.getScreenCTM(); return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b) };
    }); return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, labels };
  });
  check(phone.labels.length === 3 && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.bounds.left - 1 && l.right <= phone.bounds.right + 1 && l.bottom <= phone.bounds.bottom + 1), 'phone shows all three textbook names clearly without clipping');
  await page.screenshot({ path: 'output/playwright/soil-texture-phone-finished.png' });
  await setPhase(400); await page.screenshot({ path: 'output/playwright/soil-texture-phone-400.png' });
  states.push({ name: 'production-comparison', samples, beforeReload, restored, finished, restarted, before2d, svg, svgEnd, phone });
  check(!errors.length, 'no browser errors');
  return { base, browser: page.context().browser().version(), checks, failures, errors, labelIssues, states, targets };
}
