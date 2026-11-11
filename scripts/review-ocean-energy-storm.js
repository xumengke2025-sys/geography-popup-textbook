async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], screenshots = [], labelIssues = [], layoutIssues = [];
  const contracts = {
    currents: { kind: 'ocean-current-advection', phases: [0, .5, 1], attr: 'data-current-state' },
    sun: { kind: 'solar-heating-process', phases: [.22, .44, .72, 1], attr: 'data-solar-heating-state' },
    typhoon: { kind: 'typhoon-structure-process', phases: [.25, .5, .75, 1], attr: 'data-typhoon-state' },
  };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const near = (a, b, e = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= e;
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = !d.twoD ? b?.entry?.art?.geometry : null;
    const box = el => { const r = el?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, hidden: el.hidden } : null; };
    const svg = document.querySelector('.flat-concept > svg');
    let saved = null; try { saved = JSON.parse(localStorage.getItem('pep-geography-first-original-v2'))?.figures?.[d.active]; } catch {}
    window.__oceanReviewBuffers ??= { ids: new WeakMap(), next: 0 };
    const buffers = window.__oceanReviewBuffers;
    const meshes = g?.meshes.map(m => {
      const positions = m.geometry.attributes.position.array;
      if (!buffers.ids.has(positions)) buffers.ids.set(positions, ++buffers.next);
      let hash = 2166136261; for (const n of positions) hash = Math.imul(hash ^ Math.round(n * 100000), 16777619);
      return { id: m.uuid, buffer: buffers.ids.get(positions), hash: hash >>> 0, visible: m.visible,
        role: m.userData.currentRole ?? m.userData.solarHeatingRole ?? m.userData.typhoonRole,
        sampleId: m.userData.currentSampleId ?? m.userData.solarWaterId ?? m.userData.solarRadiationId,
        position: m.position.toArray(), scale: m.scale.toArray(), color: m.material?.color?.getHexString(),
        medium: m.userData.medium, finite: Array.from(positions).every(Number.isFinite),
        kind: m.userData.kind, input: m.userData.modelInput?.kind };
    }) ?? [];
    return { id: d.active, twoD: d.twoD, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, process: d.process, model: d.render?.geometry, meshes, saved,
      render: d.render ? { triangles: d.render.triangles, calls: d.render.calls, geometries: d.render.geometries, textures: d.render.textures } : null,
      labels: d.render?.labels ?? [], bounds: b?.processBounds,
      camera: b ? [...b.camera.position.toArray(), ...b.camera.quaternion.toArray()] : null,
      root: g?.root.position.toArray(), range: Number(document.querySelector('#phase').value),
      progress: document.querySelector('#phase').style.getPropertyValue('--process-progress'),
      rangeText: document.querySelector('#phase').getAttribute('aria-valuetext'),
      nodes: Array.from(document.querySelectorAll('[data-process-node]'), n => ({ text: n.textContent.trim(), selected: n.getAttribute('aria-pressed'), box: box(n) })),
      note: { ...box(document.querySelector('#process-note')), title: document.querySelector('#process-title').textContent,
        text: document.querySelector('#process-text').textContent },
      dock: box(document.querySelector('.capsule')), header: box(document.querySelector('#desk-header')),
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      reduced: document.querySelector('#reduced').checked,
      svg: svg ? { box: box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])),
        images: svg.querySelectorAll('image').length,
        labels: Array.from(svg.querySelectorAll('text'), el => { const r = el.getBoundingClientRect(), c = el.getScreenCTM();
          return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            fontPx: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(c.a, c.b), visible: Number(getComputedStyle(el).opacity) > .05 }; }) } : null };
  });
  const pause = async () => { if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); } };
  const go = async (id, mode = '3d') => {
    await page.goto(`${base}/?figure=${id}&${mode}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && (d.twoD || d.render.modelState === 'live'); }, id, { timeout: 45000 });
    await frames(); await pause();
  };
  const setPhase = async value => {
    await pause(); const range = page.locator('#phase'); await range.focus();
    await range.press(value <= 500 ? 'Home' : 'End');
    const distance = value <= 500 ? value : 1000 - value;
    for (let i = 0; i < Math.floor(distance / 100); i++) await range.press(value <= 500 ? 'PageUp' : 'PageDown');
    for (let i = 0; i < distance % 100; i++) await range.press(value <= 500 ? 'ArrowRight' : 'ArrowLeft');
    await frames(); return read();
  };
  const inspect = (s, name) => {
    const c = contracts[s.id];
    check(!!s.process && s.nodes.length === c.phases.length && s.nodes.filter(n => n.selected === 'true').length === 1,
      `${name}: one continuous process has exactly one active bookmark`);
    check(s.nodes[s.process.activeStop]?.selected === 'true' && near(s.range, Math.round(s.phase * 1000))
      && near(parseFloat(s.progress), s.phase * 100) && s.rangeText.includes(s.process.title), `${name}: slider, bookmark and accessible text agree`);
    check(s.note.title === s.process.title && s.note.text === s.process.text, `${name}: visible caption reads the current shared state`);
    if (s.twoD) {
      const data = JSON.parse(s.svg.attrs[c.attr]);
      check(s.svg.images === 0 && near(data.phase, s.phase) && data.stageIndex === s.process.activeStop,
        `${name}: native vector demonstration retains the same paused playhead without a page image`);
      return;
    }
    const m = s.model;
    check(m?.kind === c.kind && near(m.phase, s.phase) && m.stageIndex === s.process.activeStop && m.selection === s.selection,
      `${name}: the actual raised model and explanation share a single state`);
    check(m.geometryBuffersReused && m.originalPagePreserved && s.meshes.every(m => m.finite) && s.root[1] > 0,
      `${name}: retained finite geometry occupies space above the unaltered textbook`);
    if (s.id === 'currents') {
      check(m.sampleCount === 12 && m.retainedCount === 12 && m.tracerWorld.length === 12 && m.allTracersVisible
        && !m.wraps && !m.respawns, `${name}: twelve fixed water identities migrate without spawning or wrapping`);
      check(m.notGeoreferenced && !m.actualTrajectory && !m.actualCoastline && m.namedCurrent === null && !m.measuredSpeed,
        `${name}: the supplementary sea is explicitly schematic, not the Gulf Stream or a measured trajectory`);
      if (s.phase === 1) check(m.endpointRetained && m.samples.every(p => p.endpointReached), `${name}: all twelve end positions remain available for comparison`);
    } else if (s.id === 'sun') {
      check(m.closedWaterPaths && m.sharedStorage && m.finiteWaterMarkers && !m.waterMarkersRespawn && !m.lightBecomesWater
        && !m.depictsPhotovoltaicElectricity, `${name}: thermal collection uses a shared storage and finite closed water paths; light and water retain separate identities`);
      check(m.radiationIds.every(id => !m.waterIds.includes(id)), `${name}: no radiation marker becomes a water marker`);
      if (s.phase === 1) check(m.retained.roomsHeated && m.retained.waterReturned === m.water.length, `${name}: room heat and all returned water markers are retained at the endpoint`);
    } else {
      check(m.frontCutaway && m.trueEyeOpening && m.cloudBodiesAreStationary && m.structuresRetained && !m.freeRunningRotation
        && !m.forecast && !m.measuredWindSpeed, `${name}: one stationary cutaway retains a real eye opening and is not a genesis forecast`);
      check(m.arrowWorld.every(a => a.actualTip.every((n, i) => near(n, a.tip[i], .00002))), `${name}: arrow mesh tips follow the same spatial paths as the scientific state`);
    }
  };
  const settled = async () => {
    let previous, stable = 0;
    for (let i = 0; i < 100; i++) {
      const next = await page.evaluate(() => [...window.textbookDebug.camera.position.toArray(), ...window.textbookDebug.camera.quaternion.toArray()]);
      stable = previous && next.every((n, j) => near(n, previous[j], .000005)) ? stable + 1 : 0;
      if (stable >= 4) return; previous = next; await page.waitForTimeout(75);
    }
    throw Error('Camera did not settle');
  };
  const physicalTarget = async (kind, selection) => page.evaluate(({ kind, selection }) => {
    const b = window.textbookDebug, g = b.entry.art.geometry, r = b.renderer.domElement.getBoundingClientRect();
    g.root.updateWorldMatrix(true, true);
    const candidates = g.meshes.filter(m => m.visible && m.userData.kind !== 'text-label' && m.userData.modelInput?.kind === kind
      && (selection === undefined || m.userData.modelInput.selection === selection));
    for (const mesh of candidates) {
      const a = mesh.geometry.attributes.position, idx = mesh.geometry.index, count = (idx ? idx.count : a.count) / 3;
      mesh.geometry.computeBoundingBox(); const points = [mesh.geometry.boundingBox.getCenter(b.camera.position.clone())];
      for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 180))) {
        const q = b.camera.position.clone().set(0, 0, 0);
        for (let j = 0; j < 3; j++) q.add(b.camera.position.clone().fromBufferAttribute(a, idx ? idx.getX(i * 3 + j) : i * 3 + j));
        points.push(q.multiplyScalar(1 / 3));
      }
      for (const local of points) {
        const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera), x = r.left + (p.x + 1) * r.width / 2, y = r.top + (1 - p.y) * r.height / 2;
        if (x < 10 || x > innerWidth - 10 || y < 10 || y > innerHeight - 10 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
        const hit = b.pickModel(x, y);
        if (hit?.object === mesh && hit.input?.kind === kind) return { x, y, mesh: mesh.uuid, label: hit.input.label,
          role: mesh.userData.currentRole ?? mesh.userData.solarHeatingRole ?? mesh.userData.typhoonRole };
      }
    }
    return null;
  }, { kind, selection });
  const drag = async () => {
    await settled(); const target = await physicalTarget('phase-track');
    if (!target) throw Error('No exposed physical progress handle');
    const before = await read(); await page.mouse.move(target.x, target.y); await page.mouse.down(); await frames();
    const grabbed = await read(); check(!grabbed.playing && near(before.phase, grabbed.phase), `${before.id}: grasping actual geometry pauses without jumping`);
    const offset = await page.evaluate(({ x, y, mesh }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, t = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const o = g.root.worldToLocal(b.ray.ray.origin.clone()), d = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(o);
      const p = o.clone().addScaledVector(d, (t.start[2] - o.z) / d.z), phase = window.textbookDiagnostics.state.phase;
      return [t.start[0] + (t.end[0] - t.start[0]) * phase - p.x, t.start[1] + (t.end[1] - t.start[1]) * phase - p.y];
    }, target);
    try {
      for (const phase of [.83, .21, .63]) {
        const point = await page.evaluate(({ mesh, offset, phase }) => {
          const b = window.textbookDebug, g = b.entry.art.geometry, t = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track, r = b.renderer.domElement.getBoundingClientRect();
          const p = b.camera.position.clone().set(t.start[0] + (t.end[0] - t.start[0]) * phase - offset[0], t.start[1] + (t.end[1] - t.start[1]) * phase - offset[1], t.start[2]);
          p.applyMatrix4(g.root.matrixWorld).project(b.camera); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
        }, { mesh: target.mesh, offset, phase });
        await page.mouse.move(point.x, point.y, { steps: 7 }); await frames(); const s = await read(); inspect(s, `${s.id}/actual-drag-${phase}`);
        check(near(s.phase, phase, .002) && !s.playing, `${s.id}: forward and reverse physical dragging reaches ${phase}`);
        check(s.camera.every((n, i) => near(n, before.camera[i], .0001)), `${s.id}: changing progress does not move the camera under the pointer`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const held = await read(); check(near(held.saved.phase, held.phase), `${held.id}: release saves the exact actual drag state`);
  };
  const layout = async name => {
    await page.waitForFunction(() => !document.querySelector('#process-note').hidden, null, { timeout: 10000 });
    if (!(await read()).twoD) await settled(); await page.waitForTimeout(350); await frames(); const s = await read();
    const inside = b => b && b.left >= -1 && b.right <= s.viewport.width + 1 && b.top >= -1 && b.bottom <= s.viewport.height + 1;
    const overlap = (a, b) => a && b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const issues = [];
    if (!inside(s.note) || !inside(s.dock) || overlap(s.note, s.header) || overlap(s.note, s.dock) || s.viewport.scrollWidth > s.viewport.width + 1) issues.push('caption/dock/header layout');
    if (s.twoD ? overlap(s.svg.box, s.note) || overlap(s.svg.box, s.dock) : overlap(s.note, s.bounds)) issues.push('caption overlaps demonstration');
    if (issues.length) layoutIssues.push({ name, issues, note: s.note, bounds: s.bounds, svg: s.svg?.box });
    check(!issues.length, `${name}: caption, model and controls occupy separate visible regions`);
    const labels = s.twoD ? s.svg.labels.filter(l => l.visible) : s.labels;
    const minimum = s.viewport.width < 680 ? 15 : 18;
    const bad = labels.filter(l => l.fontPx < minimum || !inside(l) || overlap(l, s.note) || overlap(l, s.dock) || overlap(l, s.header));
    const collisions = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.text, b.text]));
    if (bad.length || collisions.length) labelIssues.push({ name, minimum, labels, bad, collisions });
    check(labels.length > 0 && !bad.length && !collisions.length, `${name}: all actual labels are legible (${minimum}px), separate and unobstructed`);
    const path = `output/playwright/continuous-${name}.png`; await page.screenshot({ path, fullPage: false }); screenshots.push(path);
    states.push({ name, ...s }); return s;
  };
  let fatal = null;
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    for (const id of Object.keys(contracts)) {
      await go(id); const initial = await setPhase(0), signatures = [];
      const buffers = initial.meshes.map(m => [m.id, m.buffer]);
      for (const value of [0, 187, 393, 618, 849, 1000, 393]) {
        const s = await setPhase(value); inspect(s, `${id}/phase-${value}`);
        check(equal(buffers, s.meshes.map(m => [m.id, m.buffer])), `${id}/${value}: progress reuses actual mesh identities and position buffers`);
        signatures.push(JSON.stringify(s.meshes.map(m => [m.hash, m.position, m.scale, m.color])));
      }
      check(new Set(signatures).size >= 4 && signatures[2] === signatures[6], `${id}: intermediate geometry/material changes are continuous and reverse seeking returns exactly`);
      for (let node = 0; node < contracts[id].phases.length; node++) {
        const from = await read(); await page.locator(`[data-process-node="${node}"]`).click(); await frames();
        const during = await read();
        if (!near(from.phase, contracts[id].phases[node])) check(during.process.seeking && during.phase !== from.phase,
          `${id}/${node}: clicking a bookmark visibly moves the same playhead`);
        await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames(); const s = await read();
        inspect(s, `${id}/node-${node}`); check(near(s.phase, contracts[id].phases[node]) && !s.playing, `${id}/${node}: bookmark arrives at its exact paused phase`);
      }
      await settled(); const pick = await physicalTarget('select', 1);
      check(!!pick, `${id}: an actual non-label model part is clickable through the production raycaster`);
      if (pick) { await page.mouse.click(pick.x, pick.y); await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames();
        check(near((await read()).phase, contracts[id].phases[1]), `${id}: physical object and DOM bookmark locate the same phase`); }
      await setPhase(500); await drag(); const scrubbed = await read();
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(id => window.textbookDiagnostics?.active === id && !window.textbookDiagnostics.figureBusy, id, { timeout: 45000 });
      await frames(); const restored = await read(); check(near(restored.phase, scrubbed.phase) && !restored.playing, `${id}: refresh preserves the observed condition and pauses`);
      await setPhase(id === 'currents' ? 630 : 1000); await layout(`desktop-${id}`);
      await go(id, '2d'); const vector = await read(); inspect(vector, `${id}/same-native-svg`);
      await page.locator('.flat-concept [data-model-selection="0"]').first().focus();
      await page.keyboard.press('Enter'); await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames();
      check(near((await read()).phase, contracts[id].phases[0]), `${id}: native vector objects provide a keyboard bookmark`);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const id of Object.keys(contracts)) { await go(id); await setPhase(id === 'currents' ? 500 : 1000); await drag(); await layout(`tablet-${id}`); }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of Object.keys(contracts)) { await go(id, '2d'); const s = await setPhase(id === 'currents' ? 1000 : 850); inspect(s, `${id}/phone-native-svg`); await layout(`phone-${id}`); }
  } catch (error) { fatal = String(error?.stack ?? error); failures.push(fatal); }
  return { base, checks, failures, errors, labelIssues, layoutIssues, states, screenshots, fatal,
    evidenceScope: 'Actual shortcut clicks, native range keyboard changes, physical non-label mesh selection and forward/reverse rail dragging, paused reload, native SVG keyboard access, and sampled 1366/1024/390 viewports. Scientific state and finite geometry inspected passively. Physical devices, measured FPS, classroom/scientific external review remain unverified.' };
}
