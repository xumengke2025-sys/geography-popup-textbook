async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, text) => (ok ? checks : failures).push(text);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 600)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'waves' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const refs = window.__waveBuffers ?? (window.__waveBuffers = { map: new WeakMap(), next: 1 });
    const id = object => { if (!refs.map.has(object)) refs.map.set(object, refs.next++); return refs.map.get(object); };
    const live = object => { for (let n = object; n; n = n.parent) if (!n.visible) return false; return true; };
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      model: d.render?.geometry, labels: d.render?.labels,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.waves,
      render: { calls: d.render?.calls, geometries: d.render?.geometries, triangles: d.render?.triangles, textures: d.render?.textures },
      meshes: !d.twoD && g ? g.meshes.filter(live).map(m => ({ role: m.userData.waveRole, text: m.userData.text,
        restX: m.userData.restX, particleX: m.userData.particleX, particleHeight: m.userData.particleHeight,
        xyz: m.position.toArray(), scale: m.scale.toArray(), geometry: m.geometry.uuid,
        position: id(m.geometry.attributes.position), array: id(m.geometry.attributes.position.array),
        index: m.geometry.index ? id(m.geometry.index) : null })) : [],
    };
  });
  const distance = (a, b) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));
  const sameCamera = (a, b) => distance(a.position, b.position) < .0001 && distance(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  const settle = async () => {
    let old, count = 0;
    for (let i = 0; i < 90; i++) {
      const p = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      count = old && distance(old, p) < .000005 ? count + 1 : 0;
      if (count >= 4) return;
      old = p; await page.waitForTimeout(75);
    }
    throw Error('Wave framing did not settle');
  };
  // The native range receives real keyboard events; review code never assigns
  // production phase or calls the on-model interaction callback directly.
  const phase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < value / 100; i++) await range.press('PageUp');
    await frames();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
  };
  const inspectLabels = async name => {
    const s = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize(), labels = s.labels ?? [];
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = labels.filter(l => l.fontPx < 18);
    const overlap = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (labels.length !== 2 || outside.length || small.length || overlap.length) labelIssues.push({ name, labels, outside, small, overlap });
    check(labels.length === 2 && !outside.length && !small.length && !overlap.length, `${name}: two short labels are readable and separated`);
  };
  // Projection and ray casts only locate exposed real solids. Subsequent
  // click/drag actions always use the mouse, including its grab offset.
  const target = async role => {
    const hit = await page.evaluate(role => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const vector = () => b.camera.position.clone().set(0, 0, 0);
      for (const mesh of g.meshes.filter(m => m.userData.waveRole === role)) {
        const a = mesh.geometry.attributes.position, index = mesh.geometry.index;
        mesh.geometry.computeBoundingBox(); const positions = [mesh.geometry.boundingBox.getCenter(vector())];
        const count = (index?.count ?? a.count) / 3, step = Math.max(1, Math.floor(count / 280));
        for (let i = 0; i < count; i += step) {
          const p = vector();
          for (let j = 0; j < 3; j++) p.add(vector().fromBufferAttribute(a, index ? index.getX(i * 3 + j) : i * 3 + j));
          positions.push(p.multiplyScalar(1 / 3));
        }
        for (const local of positions) {
          const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
          const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
          if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 12 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const h = b.pickModel(x, y);
          if (h?.object === mesh) return { x, y, input: h.input?.kind ?? null, label: h.input?.label ?? '', role };
        }
      }
      return null;
    }, role);
    if (!hit) throw Error(`No exposed wave target ${role}`);
    targets.push(hit); return hit;
  };
  const selectParticle = async () => {
    await settle(); const hit = await target('particle'), before = await read();
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, 'water particle exposes its click meaning on real pointer hover');
    await page.mouse.click(hit.x, hit.y); await frames(); const after = await read();
    check(after.selection === (before.selection === 1 ? 0 : 1) && after.phase === before.phase, 'clicking the same physical water point toggles emphasis without replaying');
    check(JSON.stringify(after.model.particle) === JSON.stringify(before.model.particle) && JSON.stringify(after.model.heightProbes) === JSON.stringify(before.model.heightProbes), 'particle selection never changes the scientific state');
    return after;
  };
  const clickParticleEdge = async () => {
    await settle();
    const hit = await page.evaluate(() => {
      const b = window.textbookDebug, g = b.entry.art.geometry, particle = g.meshes.find(m => m.userData.waveRole === 'particle');
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true); particle.geometry.computeBoundingSphere();
      const rect = b.renderer.domElement.getBoundingClientRect(), point = particle.geometry.boundingSphere.center.clone().applyMatrix4(particle.matrixWorld).project(b.camera);
      const center = { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI * 2 * i / 16, x = center.x + 20.5 * Math.cos(angle), y = center.y + 20.5 * Math.sin(angle), h = b.pickModel(x, y);
        if (h?.object === particle && h.input?.kind === 'select') return { x, y, center, distance: Math.hypot(x - center.x, y - center.y), kind: h.input.kind };
      }
      return null;
    });
    check(!!hit && hit.distance > 20 && hit.distance < 22, 'the delicate water point has an unobstructed 44-pixel target beyond its visible sphere');
    if (hit) {
      const before = await read(); await page.mouse.click(hit.x, hit.y); await frames(); const after = await read();
      check(after.selection === (before.selection === 1 ? 0 : 1) && after.phase === before.phase && !after.playing, 'a real click near the 44-pixel target edge toggles only particle emphasis');
      targets.push({ role: 'particle-44px-edge', ...hit });
    }
  };
  const dragPhase = async requested => {
    await settle(); const hit = await target('phase-handle');
    const grab = await page.evaluate(({ x, y }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, mesh = g.meshes.find(m => m.userData.waveRole === 'phase-handle'), track = mesh.userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
      const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), phase = window.textbookDiagnostics.state.phase;
      return { offset: [track.start[0] + (track.end[0] - track.start[0]) * phase - p.x, track.start[1] + (track.end[1] - track.start[1]) * phase - p.y] };
    }, hit);
    const projected = await page.evaluate(({ requested, offset }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.waveRole === 'phase-handle').userData.modelInput.track;
      const rect = b.renderer.domElement.getBoundingClientRect();
      return requested.map(phase => {
        const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0], track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      });
    }, { requested, offset: grab.offset });
    const before = await read(), samples = [];
    await page.mouse.move(hit.x, hit.y); await page.mouse.down();
    try {
      for (const p of projected) {
        await page.mouse.move(p.x, p.y, { steps: 7 }); await frames(); const s = await read(); samples.push(s);
        check(Math.abs(s.phase - p.phase) < .002 && !s.playing, `paper handle: real drag seeks to ${p.phase} and pauses`);
        check(s.model.trackedSurfaceError < 1e-7, `paper handle ${p.phase}: same particle remains on the actual wave surface`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const after = await read();
    check(sameCamera(before.camera, after.camera), 'dragging the wave handle never rotates the scene');
    check(Math.abs(after.saved.phase - after.phase) < 1e-8 && after.saved.selection === after.selection, 'release saves the exact wave conditions');
    states.push({ name: 'direct-handle-drag', before, after, samples });
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=waves&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if ((await read()).playing) await page.locator('#cPause').click();
  if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
  check(await page.locator('#selections [data-selection]').allTextContents().then(names => JSON.stringify(names) === JSON.stringify(['整体', '追踪水质点'])), 'only whole-wave and same-water-point observation controls are present');
  await page.locator('#selections [data-selection="0"]').click();
  const samples = [];
  for (const value of [0, 200, 400, 700, 1000, 400]) {
    await phase(value); const s = await read(); samples.push(s);
    check(s.model.kind === 'surface-wave' && s.model.closedVolume && s.model.bitmapSurfaces === 0 && s.model.imageMappedMeshes === 0, `${value}: the wave is a solid closed cutaway with no picture texture`);
    check(s.model.trackedSurfaceError < 1e-7, `${value}: one material point follows the same mathematical surface`);
    check(s.model.reference.quantities === 'schematic' && s.model.reference.includesStokesDrift === false && s.model.reference.markerIsRealBuoy === false, `${value}: the idealized particle and uncalibrated quantities stay explicit`);
    check(s.meshes.find(m => m.role === 'water-volume').scale.every(n => n === 1), `${value}: surface vertices move without scaling a flat object`);
  }
  const buffers = s => s.meshes.map(({ role, geometry, position, array, index }) => ({ role, geometry, position, array, index }));
  check(samples.every(s => JSON.stringify(buffers(s)) === JSON.stringify(buffers(samples[0]))), 'forward and reverse seeking reuse all mesh, geometry, index and position buffers');
  check(JSON.stringify(samples[0].model.particle) === JSON.stringify(samples[4].model.particle) && JSON.stringify(samples[0].model.heightProbes) === JSON.stringify(samples[4].model.heightProbes), 'a full period returns the same particle and water surface with no accumulated translation');
  check(JSON.stringify(samples[2].model.particle) === JSON.stringify(samples[5].model.particle) && JSON.stringify(samples[2].model.heightProbes) === JSON.stringify(samples[5].model.heightProbes), 'reverse keyboard seeking exactly restores phase .4');
  const topology = await page.evaluate(() => {
    const b = window.textbookDebug, mesh = b.entry.art.geometry.meshes.find(m => m.userData.waveRole === 'water-volume'), g = mesh.geometry, a = g.attributes.position, edges = new Map();
    const key = i => [a.getX(i), a.getY(i), a.getZ(i)].map(n => Math.round(n * 1e5)).join(',');
    for (let i = 0; i < g.index.count; i += 3) {
      const triangle = [0, 1, 2].map(j => key(g.index.getX(i + j)));
      for (let j = 0; j < 3; j++) { const pair = [triangle[j], triangle[(j + 1) % 3]].sort().join('|'); edges.set(pair, (edges.get(pair) ?? 0) + 1); }
    }
    g.computeBoundingBox();
    return { openEdges: [...edges.values()].filter(n => n !== 2).length, edges: edges.size,
      height: g.boundingBox.max.y - g.boundingBox.min.y, width: g.boundingBox.max.x - g.boundingBox.min.x,
      zDepth: g.boundingBox.max.z - g.boundingBox.min.z, vertices: a.count };
  });
  check(topology.openEdges === 0 && topology.height / topology.width > .24 && topology.zDepth / topology.width > .3, 'the ocean has a closed, thick three-dimensional volume with every geometric edge shared twice');
  await inspectLabels('desktop-phase-0.4');
  await page.screenshot({ path: 'output/playwright/wave-process-desktop-400.png' });
  const tracked = await selectParticle();
  check(tracked.selection === 1 && !tracked.playing, 'the real water particle reveals its closed orbit');
  await page.screenshot({ path: 'output/playwright/wave-process-desktop-tracked-400.png' });
  await selectParticle();
  await clickParticleEdge();
  if ((await read()).selection !== 0) await page.locator('#selections [data-selection="0"]').click();
  await dragPhase([.2, .7, 1, 0, .4]);
  const paused = await read(); await page.waitForTimeout(320);
  check(JSON.stringify((await read()).model) === JSON.stringify(paused.model), 'paused shape, particle and orbit do not advance');
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames(); const reloaded = await read();
  check(Math.abs(reloaded.phase - .4) < .002 && !reloaded.playing && reloaded.selection === 0, 'refresh restores the saved wave condition in a paused state');
  await settle(); const surface = await target('water-volume'), beforeRotate = await read();
  await page.mouse.move(surface.x, surface.y); await page.mouse.down(); await page.mouse.move(surface.x + 50, surface.y + 9, { steps: 8 }); await page.mouse.up(); await frames();
  const rotated = await read();
  check(!sameCamera(beforeRotate.camera, rotated.camera) && rotated.phase === beforeRotate.phase && rotated.selection === beforeRotate.selection, 'ordinary drag still rotates the solid without changing the wave conditions');
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await phase(400);
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(); await inspectLabels('tablet-phase-0.4');
  await page.screenshot({ path: 'output/playwright/wave-process-tablet-400.png' });
  const beforeFlat = await read();
  await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.twoD); await frames();
  const svg = () => page.locator('.flat-model-svg').evaluate(el => ({ role: el.getAttribute('role'), aria: el.getAttribute('aria-label'),
    images: el.querySelectorAll('image').length, phase: Number(el.dataset.wavePhase), selection: Number(el.dataset.waveSelection),
    probes: JSON.parse(el.dataset.heightProbes), orbit: !!el.querySelector('[data-wave-orbit]'),
    particle: [...el.querySelectorAll('[data-wave-particle]')].map(m => ({ x: Number(m.dataset.x), height: Number(m.dataset.height), restX: Number(m.dataset.restX) })),
  }));
  const flat = await svg();
  check((await read()).phase === beforeFlat.phase && !(await read()).playing, 'switching to vector mode preserves the paused wave state');
  check(flat.role === 'group' && !flat.images && flat.particle.length === 1, 'fallback is native accessible vector geometry with one persistent particle');
  check(Math.abs(flat.particle[0].x - beforeFlat.model.particle.x) < .0000006 && Math.abs(flat.particle[0].height - beforeFlat.model.particle.height) < .0000006 && flat.probes.every((p, i) => Math.abs(p.height - beforeFlat.model.heightProbes[i].height) < .0000006), 'vector point and surface probes equal the production Three.js scientific state');
  check(flat.aria.includes('不含洋流') && flat.aria.includes('不是实际浮标运动'), 'vector explanation states model limits without inventing real measurements');
  const point = page.locator('.flat-model-svg [data-model-selection="1"]');
  await point.click(); await frames();
  check((await read()).selection === 1 && (await svg()).orbit && (await read()).phase === beforeFlat.phase, 'clicking the vector particle reveals the same closed orbit without replay');
  await point.focus(); await page.keyboard.press('Enter'); await frames();
  check((await read()).selection === 0 && !(await svg()).orbit && await point.evaluate(el => el === document.activeElement), 'Enter hides the vector orbit and preserves the same keyboard focus');
  await page.keyboard.press('Space'); await frames();
  check((await read()).selection === 1 && !(await read()).playing && await point.evaluate(el => el === document.activeElement), 'Space shows the vector orbit while keeping playback paused and focus retained');
  await phase(0); const startFlat = await svg(); await phase(1000); const endFlat = await svg();
  check(JSON.stringify(startFlat.particle) === JSON.stringify(endFlat.particle) && JSON.stringify(startFlat.probes) === JSON.stringify(endFlat.probes), 'vector mode closes the same complete period');
  await phase(400);
  await page.screenshot({ path: 'output/playwright/wave-process-flat-tracked-400.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await frames();
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const box = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text')].map(text => { const r = text.getBoundingClientRect(), m = text.getScreenCTM(); return { text: text.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      px: parseFloat(getComputedStyle(text).fontSize) * Math.hypot(m.a, m.b) }; });
    return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, labels };
  });
  check(phone.labels.length === 2 && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.box.left - 1 && l.right <= phone.box.right + 1), 'phone keeps both necessary vector labels at least 18 pixels and in bounds');
  await page.screenshot({ path: 'output/playwright/wave-process-phone-tracked-400.png' });
  const maxCalls = Math.max(...samples.map(s => s.render.calls), tracked.render.calls);
  check(maxCalls <= 120, `draw-call budget remains below 120 (measured ${maxCalls})`);
  states.push({ name: 'production-wave-states', samples, tracked, topology, reloaded, rotated, beforeFlat, flat, startFlat, endFlat, phone });
  check(!errors.length, 'no browser exceptions or console errors');
  return { base, browser: page.context().browser().version(), checks, failures, errors, states, targets, labelIssues };
}
