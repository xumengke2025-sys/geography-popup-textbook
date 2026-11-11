async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'soil' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const bufferIds = window.__soilProfileReviewBuffers ?? (window.__soilProfileReviewBuffers = { map: new WeakMap(), next: 1 });
    const bufferId = buffer => { if (!bufferIds.map.has(buffer)) bufferIds.map.set(buffer, bufferIds.next++); return bufferIds.map.get(buffer); };
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      geometry: d.render?.geometry, labels: d.render?.labels,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.soil,
      render: { geometries: d.render?.geometries, textures: d.render?.textures, calls: d.render?.calls, triangles: d.render?.triangles },
      meshes: !d.twoD && g ? g.meshes.filter(visible).map(m => ({ role: m.userData.soilProfileRole, layer: m.userData.soilProfileLayer,
        text: m.userData.text, id: m.userData.soilProfileMaterial, u: m.userData.u, depth: m.userData.depth,
        offset: m.userData.offset, travel: m.userData.travel, status: m.userData.status, xyz: m.position.toArray(),
        geometry: m.geometry.uuid, positionBuffer: bufferId(m.geometry.attributes.position),
      })) : [],
    };
  });
  const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const sameCamera = (a, b) => distance(a.position, b.position) < .0001 && distance(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  const settleCamera = async () => {
    let previous, stable = 0;
    for (let attempt = 0; attempt < 90; attempt++) {
      const current = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = previous && distance(previous, current) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = current; await page.waitForTimeout(80);
    }
    throw Error('Camera framing did not settle before testing a real pointer target');
  };
  // Native range keyboard input, rather than assigning production state or
  // dispatching a synthetic input event. All requested phases are tenths.
  const setPhase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < Math.round(value / 100); i++) await range.press('PageUp');
    await frames();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-7, value);
  };
  const markerPositions = s => s.meshes.filter(m => m.role === 'material').sort((a, b) => a.id - b.id).map(({ id, u, depth, offset, status, xyz }) => ({ id, u, depth, offset, status, xyz }));
  const sameMarkers = (a, b) => a.length === b.length && a.every((p, i) => p.id === b[i].id && p.status === b[i].status && ['u', 'depth', 'offset'].every(k => Math.abs(p[k] - b[i][k]) < 1e-9));
  const inspectLabels = async (name, expected = 2) => {
    const state = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize(), labels = state.labels ?? [];
    const outside = labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = labels.filter(l => l.fontPx < 18);
    const pairs = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (labels.length !== expected || outside.length || small.length || pairs.length) labelIssues.push({ name, viewport: vp, expected, outside, small, pairs, labels });
    check(labels.length === expected && !outside.length && !small.length && !pairs.length, `${name}: only necessary labels remain readable and separated`);
  };
  // Read-only ray tests locate exposed parts. Every interaction that follows
  // uses the real mouse or keyboard, never the production model-input handler.
  const target = async request => {
    const hit = await page.evaluate(request => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
      const candidates = g.meshes.filter(m => visible(m) && m.userData.soilProfileRole === request.role && (request.layer === undefined || m.userData.soilProfileLayer === request.layer));
      const vector = () => b.camera.position.clone().set(0, 0, 0);
      for (const mesh of candidates) {
        const a = mesh.geometry.attributes.position, index = mesh.geometry.index;
        mesh.geometry.computeBoundingBox(); const points = [mesh.geometry.boundingBox.getCenter(vector())];
        const count = (index?.count ?? a.count) / 3, step = Math.max(1, Math.floor(count / 320));
        for (let i = 0; i < count; i += step) {
          const center = vector();
          for (let k = 0; k < 3; k++) center.add(vector().fromBufferAttribute(a, index ? index.getX(i * 3 + k) : i * 3 + k));
          points.push(center.multiplyScalar(1 / 3));
        }
        for (const local of points) {
          const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
          const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
          if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 10 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const actual = b.pickModel(x, y);
          if (actual?.object === mesh && actual.input) return { x, y, label: actual.input.label, role: request.role, layer: request.layer };
        }
      }
      return null;
    }, request);
    if (!hit) throw Error(`No exposed real mesh target for ${JSON.stringify(request)}`);
    targets.push(hit); return hit;
  };
  const clickLayer = async layer => {
    await settleCamera(); const hit = await target({ role: 'layer', layer });
    const before = await read(); await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `layer ${layer}: actual solid exposes its click hint`);
    await page.mouse.click(hit.x, hit.y); await frames();
    const selection = before.selection === layer ? -1 : layer;
    await page.waitForFunction(n => window.textbookDiagnostics.state.selection === n, selection);
    const after = await read();
    check(after.selection === selection && after.phase === before.phase && !after.playing, `layer ${layer}: clicking changes only extraction, preserving process progress`);
    check(after.meshes.filter(m => m.role === 'layer').length === 6, `layer ${layer}: all six real volumes remain present as a whole-column reference`);
    return after;
  };
  const dragWater = async phases => {
    await settleCamera(); const hit = await target({ role: 'water-handle' });
    const grab = await page.evaluate(({ x, y }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, mesh = g.meshes.find(m => m.userData.soilProfileHandle), track = mesh.userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
      const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), phase = window.textbookDiagnostics.state.phase;
      return { offset: [track.start[0] + (track.end[0] - track.start[0]) * phase - p.x, track.start[1] + (track.end[1] - track.start[1]) * phase - p.y] };
    }, hit);
    const screen = await page.evaluate(({ phases, offset }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.soilProfileHandle).userData.modelInput.track, rect = b.renderer.domElement.getBoundingClientRect();
      return phases.map(phase => {
        const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0], track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      });
    }, { phases, offset: grab.offset });
    const before = await read(), samples = [];
    await page.mouse.move(hit.x, hit.y); await page.mouse.down(); await frames();
    try {
      for (const p of screen) {
        await page.mouse.move(p.x, p.y, { steps: 5 }); await frames(); const s = await read(); samples.push(s);
        check(Math.abs(s.phase - p.phase) < .002 && !s.playing, `water handle: real drag reaches ${p.phase} and pauses the process`);
        check(s.geometry.inventory.source + s.geometry.inventory.moving + s.geometry.inventory.deposited === 24, `water handle ${p.phase}: actual moving material remains conserved`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const after = await read();
    check(sameCamera(before.camera, after.camera), 'dragging the water control never rotates the model');
    check(Math.abs(after.saved.phase - after.phase) < 1e-7 && after.saved.selection === after.selection, 'releasing the water drop saves the exact current conditions');
    states.push({ name: 'direct-water-drag', before, grab, samples, after });
    return after;
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=soil&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
  const initial = await read();
  check(initial.selection === -1 && initial.geometry.selection === -1, 'first visit shows the whole undisturbed column with sentinel -1');
  check(await page.locator('#selections button').allTextContents().then(names => JSON.stringify(names) === JSON.stringify(['有机层', '腐殖质层', '淋溶层', '淀积层', '母质层', '母岩层'])), 'six existing textbook layer controls keep their names and order');
  const samples = [];
  for (const value of [0, 200, 600, 900, 1000, 600]) {
    await setPhase(value); const s = await read(); samples.push(s);
    check(s.geometry.kind === 'soil-profile' && s.meshes.filter(m => m.role === 'material').length === 24, `${value}: the production view has 24 actual material meshes`);
    check(s.geometry.inventory.source + s.geometry.inventory.moving + s.geometry.inventory.deposited === 24, `${value}: source, transport and deposit counts balance`);
    if (value === 600 || value === 1000) { await inspectLabels(`desktop-${value}`); await page.screenshot({ path: `output/playwright/soil-profile-desktop-${value}.png` }); }
  }
  check(!sameMarkers(markerPositions(samples[0]), markerPositions(samples[2])), 'material physically leaves the pale leaching layer');
  check(sameMarkers(markerPositions(samples[2]), markerPositions(samples[5])), 'reverse keyboard scrubbing restores exactly the same positions');
  const end = samples[4];
  check(end.geometry.inventory.deposited === 24 && end.meshes.filter(m => m.role === 'material').every(m => m.status === 'deposited' && m.depth > .45 && m.depth < .70), 'the same material remains in the darker illuviation layer at the end');
  check(!end.meshes.some(m => m.role === 'water'), 'infiltration water recedes while the deposited portion remains');
  check(samples.every(s => JSON.stringify(s.meshes.filter(m => m.role === 'material').map(m => m.geometry)) === JSON.stringify(initial.meshes.filter(m => m.role === 'material').map(m => m.geometry))), 'fixed material geometry is reused during forward and reverse movement');
  check(samples.every(s => JSON.stringify(s.meshes.filter(m => m.role === 'water').map(m => m.positionBuffer)) === JSON.stringify(samples.find(s => s.meshes.some(m => m.role === 'water'))?.meshes.filter(m => m.role === 'water').map(m => m.positionBuffer)) || !s.meshes.some(m => m.role === 'water')), 'the same water buffers are reused while visible');
  await setPhase(600); const selected = await clickLayer(2);
  check(selected.geometry.layers[2].offset > 0 && selected.geometry.layers.filter(p => p.offset > 0).length === 1, 'only the selected layer is pulled from the continuous column');
  await page.screenshot({ path: 'output/playwright/soil-profile-desktop-extracted.png' });
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  let reloaded = await read(); check(reloaded.selection === 2 && reloaded.phase === .6 && !reloaded.playing, 'refresh preserves an extracted layer and paused process');
  await clickLayer(2); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  reloaded = await read(); check(reloaded.selection === -1 && reloaded.geometry.layers.every(p => p.offset === 0), 'refresh preserves whole-column sentinel -1 without clamping it to layer zero');
  await dragWater([.2, .6, .9, .6]);
  await setPhase(900); await page.locator('#cPause').click();
  await page.waitForFunction(() => !window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase === 1, null, { timeout: 45000 });
  const finished = await read(); await page.waitForTimeout(300); const retained = await read();
  check(sameMarkers(markerPositions(finished), markerPositions(retained)), 'one-shot playback stops and preserves the final deposit');
  await page.locator('#cPause').click(); await frames();
  check((await read()).playing && (await read()).phase < .2, 'playing the finished process again restarts from the beginning');
  await page.locator('#cPause').click(); await setPhase(600);
  await page.setViewportSize({ width: 1024, height: 768 }); await settleCamera(); await inspectLabels('tablet-midpoint');
  await page.screenshot({ path: 'output/playwright/soil-profile-tablet-600.png' });
  const before2d = await read();
  await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready();
  await page.waitForFunction(() => window.textbookDiagnostics.twoD);
  const switched = await read();
  check(!switched.playing && switched.phase === before2d.phase, 'switching a paused model to vector mode preserves its exact progress and remains paused');
  const readSvg = () => page.locator('.flat-model-svg').evaluate(svg => ({ images: svg.querySelectorAll('image').length, role: svg.getAttribute('role'),
    aria: svg.getAttribute('aria-label'), stage: svg.dataset.soilProfile,
    materials: [...svg.querySelectorAll('[data-soil-profile-material]')].map(el => ({ id: Number(el.dataset.soilProfileMaterial), u: Number(el.dataset.u), depth: Number(el.dataset.depth), offset: Number(el.dataset.offset), status: el.dataset.status })).sort((a, b) => a.id - b.id),
  }));
  const svg = await readSvg(), production = markerPositions(before2d);
  check(svg.images === 0 && svg.materials.length === 24 && svg.role === 'group', 'fallback is an accessible native vector column with 24 material markers');
  check(svg.materials.every((p, i) => p.status === production[i].status && ['u', 'depth', 'offset'].every(k => Math.abs(p[k] - production[i][k]) < .0000006)), 'all vector material coordinates and deposit states match the actual Three.js geometry');
  check(svg.aria.includes('不代表全部土壤矿物质') && svg.aria.includes('不表示真实成土年限'), 'fallback states the limited scope and uncalibrated timescale');
  const layerControl = n => page.locator(`.flat-model-svg [data-soil-profile-part="layer"][data-model-selection="${n}"]`);
  const phaseBefore = (await read()).phase;
  await layerControl(2).click(); await frames(); check((await read()).selection === 2 && (await read()).phase === phaseBefore, 'vector layer click extracts only that layer without restarting the rain');
  await layerControl(2).click(); await frames(); check((await read()).selection === -1, 'clicking the vector layer again restores the whole column');
  await layerControl(3).focus(); await page.keyboard.press('Enter'); await frames();
  check((await read()).selection === 3 && await layerControl(3).evaluate(el => el === document.activeElement), 'Enter extracts a vector layer and preserves keyboard focus');
  await page.keyboard.press('Space'); await frames();
  check((await read()).selection === -1 && !(await read()).playing && await layerControl(3).evaluate(el => el === document.activeElement), 'Space restores the same layer, retains focus and never starts playback');
  await setPhase(1000); const svgEnd = await readSvg(); await setPhase(200); const svgEarly = await readSvg(); await setPhase(1000);
  check(!sameMarkers(svgEnd.materials, svgEarly.materials) && sameMarkers(svgEnd.materials, (await readSvg()).materials), 'the vector process is reversible and retains the same final deposit');
  await page.setViewportSize({ width: 390, height: 844 }); await frames();
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const bounds = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text')].map(el => { const r = el.getBoundingClientRect(), m = el.getScreenCTM(); return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b) }; });
    return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, labels };
  });
  check(phone.labels.length === 2 && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.bounds.left - 1 && l.right <= phone.bounds.right + 1), 'phone fallback keeps the two necessary labels at least 18 pixels and inside the diagram');
  await page.screenshot({ path: 'output/playwright/soil-profile-phone-finished.png' });
  states.push({ name: 'production-samples', initial, samples, selected, reloaded, finished, before2d, svg, svgEnd, svgEarly, phone });
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), checks, failures, errors, states, targets, labelIssues };
}
