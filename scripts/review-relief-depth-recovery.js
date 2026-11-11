async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], screenshots = [], labelIssues = [], layoutIssues = [];
  const contracts = {
    temperature: { kind: 'temperature-depth-profile', phases: [0, .2, 1], attr: 'data-temperature-state' },
    slope: { kind: 'textbook-contour-relief', phases: [0, .65, 1], attr: 'data-slope-state' },
    mitigation: { kind: 'independent-recovery-cases', phases: [0, .5, 1], attr: 'data-recovery-state', independent: true },
  };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const near = (a, b, epsilon = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = !d.twoD ? b?.entry?.art?.geometry : null;
    const box = el => { const r = el?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, hidden: el.hidden } : null; };
    let saved; try { saved = JSON.parse(localStorage.getItem('pep-geography-first-original-v2'))?.figures?.[d.active]; } catch {}
    window.__reliefReviewBuffers ??= { ids: new WeakMap(), next: 0 };
    const buffers = window.__reliefReviewBuffers;
    const meshes = g?.meshes.map(m => {
      const positions = m.geometry.attributes.position.array;
      if (!buffers.ids.has(positions)) buffers.ids.set(positions, ++buffers.next);
      return { id: m.uuid, buffer: buffers.ids.get(positions), visible: m.visible,
        role: m.userData.temperatureRole ?? m.userData.slopeRole ?? m.userData.recoveryRole,
        position: m.position.toArray(), scale: m.scale.toArray(), finite: Array.from(positions).every(Number.isFinite),
        kind: m.userData.kind, input: m.userData.modelInput?.kind };
    }) ?? [];
    const svg = document.querySelector('.flat-concept > svg');
    return { id: d.active, twoD: d.twoD, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, process: d.process, model: d.render?.geometry, meshes, saved,
      render: d.render ? { triangles: d.render.triangles, calls: d.render.calls, geometries: d.render.geometries, textures: d.render.textures } : null,
      labels: d.render?.labels ?? [], bounds: b?.processBounds,
      camera: b ? [...b.camera.position.toArray(), ...b.camera.quaternion.toArray()] : null,
      root: g?.root.position.toArray(), range: Number(document.querySelector('#phase').value),
      rangeText: document.querySelector('#phase').getAttribute('aria-valuetext'),
      nodes: Array.from(document.querySelectorAll('[data-process-node]'), n => ({ text: n.textContent.trim(), selected: n.getAttribute('aria-pressed') })),
      conditions: Array.from(document.querySelectorAll('#selections [data-selection]:not([data-process-node])'), n => ({ text: n.textContent, selected: n.getAttribute('aria-pressed') })),
      note: { ...box(document.querySelector('#process-note')), title: document.querySelector('#process-title').textContent, text: document.querySelector('#process-text').textContent },
      dock: box(document.querySelector('.capsule')), header: box(document.querySelector('#desk-header')),
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      svg: svg ? { box: box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])), images: svg.querySelectorAll('image').length,
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
    check(!!s.process && s.nodes.length === c.phases.length && s.nodes.filter(n => n.selected === 'true').length === 1, `${name}: one continuous playhead and one active bookmark`);
    check(s.nodes[s.process.activeStop]?.selected === 'true' && near(s.range, Math.round(s.phase * 1000)) && s.rangeText.includes(s.process.title), `${name}: range, nodes and accessible explanation agree`);
    check(s.note.title === s.process.title && s.note.text === s.process.text, `${name}: one short visible explanation follows the same state`);
    if (s.twoD) {
      const data = JSON.parse(s.svg.attrs[c.attr]);
      check(s.svg.images === 0 && near(data.phase, s.phase) && data.stageIndex === s.process.activeStop, `${name}: native SVG reads the same observation state`);
      return;
    }
    const m = s.model;
    check(m?.kind === c.kind && near(m.phase, s.phase) && m.stageIndex === s.process.activeStop && m.selection === s.selection, `${name}: actual raised geometry and caption share one state`);
    check(m.geometryBuffersReused && s.meshes.every(m => m.finite) && s.root[1] > 0, `${name}: finite retained geometry stands above the original page`);
    if (s.id === 'temperature') {
      check(near(m.state.depthKm, s.phase * 5) && !m.source.newObservations && !m.state.phaseIsTime, `${name}: the playhead observes depth rather than changing the measured ocean`);
    } else if (s.id === 'slope') {
      check(near(m.state.relativeHeightM, 6.4) && m.source.surveyedDEM === false && m.state.landformEvolutionSimulated === false, `${name}: original spot-height difference remains 6.4m and lift is observational`);
    } else {
      check(m.state.casesConnectedByTime === false && m.state.calibratedTime === false && s.conditions.length === 2, `${name}: Yushu rescue and Beichuan recovery remain separate cases`);
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
    for (const mesh of g.meshes.filter(m => m.visible && m.userData.kind !== 'text-label' && m.userData.modelInput?.kind === kind && (selection === undefined || m.userData.modelInput.selection === selection))) {
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
        if (hit?.object === mesh && hit.input?.kind === kind) return { x, y, mesh: mesh.uuid };
      }
    }
    return null;
  }, { kind, selection });
  const drag = async () => {
    await settled(); const target = await physicalTarget('phase-track');
    if (!target) throw Error('No exposed physical progress handle');
    const before = await read(); await page.mouse.move(target.x, target.y); await page.mouse.down(); await frames();
    const grabbed = await read(); check(!grabbed.playing && near(before.phase, grabbed.phase), `${before.id}: grabbing the real paper tab pauses without a jump`);
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
        await page.mouse.move(point.x, point.y, { steps: 7 }); await frames(); const s = await read(); inspect(s, `${s.id}/real-drag-${phase}`);
        check(near(s.phase, phase, .002) && !s.playing, `${s.id}: real forward and reverse dragging reaches ${phase}`);
        check(s.camera.every((n, i) => near(n, before.camera[i], .0001)), `${s.id}: the camera stays fixed under the pointer`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const held = await read(); check(near(held.saved.phase, held.phase), `${held.id}: release saves the held position`);
  };
  const layout = async name => {
    await page.waitForFunction(() => { const d = window.textbookDiagnostics; return d.twoD || d.render?.modelState === 'live'; });
    await page.waitForFunction(() => !document.querySelector('#process-note').hidden);
    if (!(await read()).twoD) await settled();
    await frames(); await page.waitForTimeout(650); const s = await read();
    const inside = b => b && !b.hidden && b.left >= -1 && b.top >= -1 && b.right <= s.viewport.width + 1 && b.bottom <= s.viewport.height + 1;
    const overlap = (a, b) => a && b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const issues = [];
    if (!inside(s.note) || !inside(s.dock) || overlap(s.note, s.header) || overlap(s.note, s.dock) || s.viewport.scrollWidth > s.viewport.width + 1) issues.push('caption/control layout');
    if (s.twoD ? overlap(s.svg.box, s.note) || overlap(s.svg.box, s.dock) : overlap(s.note, s.bounds)) issues.push('caption/model overlap');
    if (issues.length) layoutIssues.push({ name, issues, note: s.note, bounds: s.bounds, svg: s.svg?.box });
    check(!issues.length, `${name}: explanation and controls remain beside the model`);
    const labels = s.twoD ? s.svg.labels.filter(l => l.visible) : s.labels, minimum = s.viewport.width < 680 ? 15 : 18;
    const bad = labels.filter(l => l.fontPx < minimum || !inside(l) || overlap(l, s.note) || overlap(l, s.dock) || overlap(l, s.header));
    const collisions = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.text, b.text]));
    if (bad.length || collisions.length) labelIssues.push({ name, minimum, labels, bad, collisions });
    check(labels.length > 0 && !bad.length && !collisions.length, `${name}: actual labels are legible, separate and unobstructed`);
    const path = `output/playwright/continuous-${name}.png`; await page.screenshot({ path, fullPage: false }); screenshots.push(path); states.push({ name, ...s });
  };
  let fatal = null;
  try {
    if (process.env.REVIEW_LAYOUT_ONLY === 'phone-slope') {
      await page.setViewportSize({ width: 390, height: 844 });
      await go('slope', '2d'); await setPhase(1000); await layout('phone-slope');
      return { base, checks, failures, errors, labelIssues, layoutIssues, states, screenshots,
        evidenceScope: 'Focused phone-sized contour-label layout check only; no full interaction acceptance.' };
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    for (const id of Object.keys(contracts)) {
      await go(id); const initial = await setPhase(0), buffers = initial.meshes.map(m => [m.id, m.buffer]);
      for (const value of [0, 113, 200, 373, 563, 831, 1000, 373]) {
        const s = await setPhase(value); inspect(s, `${id}/phase-${value}`);
        check(equal(buffers, s.meshes.map(m => [m.id, m.buffer])), `${id}/${value}: actual meshes and position buffers are retained`);
      }
      if (id === 'temperature') {
        await setPhase(350); await page.waitForTimeout(400);
        await page.locator('#cPause').click();
        const liveReadouts = await page.evaluate(async () => {
          const samples = [];
          for (let i = 0; i < 18; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            const d = window.textbookDiagnostics;
            samples.push({ phase: d.state.phase, caption: d.process.title,
              visible: document.querySelector('#process-title').textContent,
              opacity: Number(getComputedStyle(document.querySelector('#process-note-copy')).opacity) });
          }
          return samples;
        });
        await pause();
        check(liveReadouts.at(-1).phase > liveReadouts[0].phase && liveReadouts.every(s => s.visible === s.caption), 'temperature: playing continuously updates the visible depth readout');
        check(liveReadouts.every(s => s.opacity > .99), 'temperature: changing depth numbers never restarts the explanation fade');
      }
      for (let node = 0; node < contracts[id].phases.length; node++) {
        const from = await read(); await page.locator(`[data-process-node="${node}"]`).click(); await frames(); const during = await read();
        if (!near(from.phase, contracts[id].phases[node])) check(during.process.seeking, `${id}/${node}: the shortcut moves the same playhead continuously`);
        await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames(); const s = await read(); inspect(s, `${id}/node-${node}`);
        check(near(s.phase, contracts[id].phases[node]) && !s.playing, `${id}/${node}: shortcut arrives exactly and pauses`);
      }
      if (!contracts[id].independent) {
        await settled(); const pick = await physicalTarget('select', 1);
        check(!!pick, `${id}: a non-label object is selectable through the production raycaster`);
        if (pick) { await page.mouse.click(pick.x, pick.y); await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames();
          check(near((await read()).phase, contracts[id].phases[1]), `${id}: physical and DOM selections locate the same node`); }
      }
      await setPhase(500); await drag(); const scrubbed = await read();
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(id => {
        const d = window.textbookDiagnostics; return d?.active === id && !d.figureBusy && d.render?.modelState === 'live';
      }, id, { timeout: 45000 });
      await frames(); const restored = await read(); check(near(restored.phase, scrubbed.phase) && !restored.playing, `${id}: refresh restores paused progress`);
      await setPhase(id === 'temperature' ? 200 : 1000); await layout(`desktop-${id}`);
      if (contracts[id].independent) {
        await page.locator('#selections [data-selection="1"]').click(); await pause(); await setPhase(1000);
        inspect(await read(), 'mitigation/independent-case-1'); await layout('desktop-beichuan');
      }
      const held = await read();
      await page.locator('#cContents').click(); await page.locator('#mode').click();
      await page.waitForFunction(() => window.textbookDiagnostics.twoD && !window.textbookDiagnostics.figureBusy); await frames();
      const vector = await read(); inspect(vector, `${id}/same-native-svg`); check(near(held.phase, vector.phase), `${id}: renderer switching preserves the exact playhead`);
      await page.locator(`.flat-concept [data-model-selection="${contracts[id].independent ? vector.selection : 0}"]`).first().focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking); await frames();
      const selectedVector = await read();
      check(contracts[id].independent ? selectedVector.selection === vector.selection && near(selectedVector.phase, vector.phase) : near(selectedVector.phase, contracts[id].phases[0]), `${id}: SVG keyboard selection preserves meaning`);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const id of Object.keys(contracts)) { await go(id); await setPhase(500); await drag(); await layout(`tablet-${id}`); }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of Object.keys(contracts)) { await go(id, '2d'); const s = await setPhase(1000); inspect(s, `${id}/phone-svg`); await layout(`phone-${id}`); }
  } catch (error) { fatal = String(error?.stack ?? error); failures.push(fatal); }
  return { base, checks, failures, errors, labelIssues, layoutIssues, states, screenshots, fatal,
    evidenceScope: 'Sampled depth/relief/recovery user flows, actual range keys and mesh dragging, independent case switches, paused refresh and native SVG keyboard access. Screenshots at desktop, simulated tablet and phone sizes; physical hardware, measured FPS and classroom/scientific external review remain unverified.' };
}
