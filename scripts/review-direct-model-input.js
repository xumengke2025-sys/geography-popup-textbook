async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const browser = page.context().browser().version();
  const checks = [], failures = [], errors = [], states = [], targets = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === id && !d.figureBusy && !d.turning && d.render?.modelState === 'live';
  }, id, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug;
    return { active: d.active, phase: d.state?.phase, selection: d.state?.selection, playing: d.playing,
      geometry: d.render?.geometry, pages: d.pages, view: d.render?.view,
      camera: { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation },
      reduced: b.reduced,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.[d.active],
    };
  });
  const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const sameCamera = (a, b) => distance(a.position, b.position) < .0001 && distance(a.quaternion, b.quaternion) < .000001
    && a.orbit === b.orbit && a.elevation === b.elevation;
  const settleCamera = async () => {
    let previous, stable = 0;
    // Resizing legitimately reframes the book with an eased camera. Wait for
    // that existing movement before projecting a path, so it cannot be
    // mistaken for a drag changing the viewing angle.
    for (let attempt = 0; attempt < 90; attempt++) {
      const current = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = previous && distance(previous, current) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = current; await page.waitForTimeout(80);
    }
    throw Error('Camera did not finish its existing framing movement before the direct-input check');
  };
  const phaseDistance = (a, b) => Math.abs(((a - b + 1.5) % 1) - .5);
  const expectedDirection = phase => {
    const delta = .85 * Math.cos(2 * Math.PI * (phase - 7 / 12)) - .25 * Math.cos(2 * Math.PI * (phase - 2 / 3));
    return Math.abs(delta) <= .02 ? 0 : delta > 0 ? 1 : -1;
  };
  const caseOf = async (name, work) => {
    try { await work(); }
    catch (error) { failures.push(`${name}: ${error.message}`); }
  };
  const open = async id => {
    await page.goto(`${base}/?figure=${id}&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ready(id); await page.evaluate(() => document.fonts.ready); await frames();
  };
  // Read-only projection and real ray hits choose the target. All interactions
  // below use page.mouse on the canvas; no production handler is invoked here.
  const target = async request => {
    const point = await page.evaluate(request => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect();
      const dock = document.querySelector('.capsule').getBoundingClientRect();
      const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
      const meshes = g.meshes.filter(mesh => visible(mesh) && mesh.userData.modelInput && (
        request.kind === 'phase-dial' ? mesh.userData.daylightHandle === true
          : request.label ? mesh.userData.labelForLayer === request.layer : mesh.userData.layer === request.layer && !!mesh.userData.layerPart
      ));
      meshes.sort((a, z) => Number(!a.userData.layerPart?.startsWith('section')) - Number(!z.userData.layerPart?.startsWith('section')));
      const vec = () => b.camera.position.clone().set(0, 0, 0);
      for (const mesh of meshes) {
        const positions = mesh.geometry.attributes.position, index = mesh.geometry.index;
        const candidates = [];
        mesh.geometry.computeBoundingBox();
        candidates.push(mesh.geometry.boundingBox.getCenter(vec()));
        const count = (index?.count ?? positions.count) / 3, step = Math.max(1, Math.floor(count / 450));
        for (let triangle = 0; triangle < count; triangle += step) {
          const center = vec();
          for (let k = 0; k < 3; k++) center.add(vec().fromBufferAttribute(positions, index ? index.getX(triangle * 3 + k) : triangle * 3 + k));
          candidates.push(center.multiplyScalar(1 / 3));
        }
        for (const candidate of candidates) {
          const projected = candidate.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
          const x = rect.left + (projected.x + 1) * rect.width / 2, y = rect.top + (1 - projected.y) * rect.height / 2;
          if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 10 || projected.z < -1 || projected.z > 1) continue;
          if (document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const hit = b.pickModel(x, y);
          if (!hit?.input || hit.object !== mesh) continue;
          return { x, y, label: hit.input.label, kind: hit.input.kind, layer: mesh.userData.layer,
            part: mesh.userData.layerPart, isLabel: mesh.userData.labelForLayer !== undefined,
            viewport: { width: innerWidth, height: innerHeight }, dockGap: dock.top - y };
        }
      }
      return null;
    }, request);
    if (!point) throw Error(`No unobstructed actual mesh hit for ${JSON.stringify(request)}`);
    targets.push(point); return point;
  };
  const dialGrab = (x, y, offset = null) => page.evaluate(({ x, y, offset }) => {
    const b = window.textbookDebug, g = b.entry.art.geometry;
    const input = g.meshes.find(mesh => mesh.userData.daylightHandle)?.userData.modelInput;
    const { center, radiusX, radiusY } = input.dial;
    g.root.updateWorldMatrix(true, true); b.setRay(x, y);
    // Independent ray/plane arithmetic in the root coordinates. This only
    // reads the scene and never invokes a production interaction handler.
    const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
    const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
    const point = origin.clone().addScaledVector(direction, (center[2] - origin.z) / direction.z);
    const phase = window.textbookDiagnostics.state.phase, angle = (phase - .25) * Math.PI * 2;
    const grabOffset = [point.x - center[0] - Math.cos(angle) * radiusX, point.y - center[1] - Math.sin(angle) * radiusY];
    const actualOffset = offset ?? grabOffset;
    const expectedPhase = ((Math.atan2((point.y - actualOffset[1] - center[1]) / radiusY,
      (point.x - actualOffset[0] - center[0]) / radiusX) / (Math.PI * 2) + .25) % 1 + 1) % 1;
    return { offset: grabOffset, point: point.toArray(), expectedPhase };
  }, { x, y, offset });
  const dialPoints = (phases, offset = [0, 0]) => page.evaluate(({ phases, offset }) => {
    const b = window.textbookDebug, g = b.entry.art.geometry;
    const input = g.meshes.find(mesh => mesh.userData.daylightHandle)?.userData.modelInput;
    if (!input?.dial) throw Error('No time dial in the actual geometry');
    const { center, radiusX, radiusY } = input.dial, rect = b.renderer.domElement.getBoundingClientRect();
    b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
    return phases.map(phase => {
      const angle = (phase - .25) * Math.PI * 2;
      const p = b.camera.position.clone().set(center[0] + Math.cos(angle) * radiusX + offset[0], center[1] + Math.sin(angle) * radiusY + offset[1], center[2]);
      p.applyMatrix4(g.root.matrixWorld).project(b.camera);
      return { phase: ((phase % 1) + 1) % 1, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    });
  }, { phases, offset });
  const dragDial = async (name, phases) => {
    await settleCamera();
    const hit = await target({ kind: 'phase-dial' });
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `${name}: the visible handle gives its drag hint on hover`);
    await page.mouse.down(); await frames();
    const before = await read(), samples = [];
    const grab = await dialGrab(hit.x, hit.y);
    check(!before.playing, `${name}: grasping the day/moon handle pauses playback`);
    try {
      for (const point of await dialPoints(phases, grab.offset)) {
        await page.mouse.move(point.x, point.y, { steps: 4 }); await frames();
        const state = await read(); samples.push({ requested: point.phase, ...state });
        check(phaseDistance(state.phase, point.phase) < .002, `${name}: dragging reaches phase ${point.phase.toFixed(3)}`);
        const direction = expectedDirection(state.phase);
        check(state.geometry.groundX === -direction && state.geometry.upperX === direction,
          `${name}: phase ${point.phase.toFixed(3)} keeps lower and upper flow consistent`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const after = await read();
    await page.waitForTimeout(250); const held = await read();
    check(!held.playing && held.phase === after.phase && held.geometry.flowPhase === after.geometry.flowPhase, `${name}: release stays paused and freezes circulation travel`);
    check(sameCamera(before.camera, held.camera), `${name}: dragging time does not rotate or move the camera`);
    check(phaseDistance(held.saved?.phase, held.phase) < .000001 && held.saved?.selection === held.selection, `${name}: releasing saves the same model input`);
    states.push({ name, before, grab, samples, after: held });
    return held;
  };
  const edgeDialTarget = () => page.evaluate(() => {
    const b = window.textbookDebug, g = b.entry.art.geometry;
    b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const mesh = g.meshes.find(mesh => mesh.userData.daylightHandle && visible(mesh));
    if (!mesh) return null;
    mesh.geometry.computeBoundingSphere();
    const rect = b.renderer.domElement.getBoundingClientRect();
    const p = mesh.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
    const center = { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    const all = g.meshes.filter(visible);
    for (let i = 0; i < 16; i++) {
      // A half-step angle avoids treating one of the sun's fine ray strokes
      // as empty space; the point is also outside the solid icon geometry.
      const angle = (i + .5) / 16 * Math.PI * 2;
      const x = center.x + Math.cos(angle) * 18, y = center.y + Math.sin(angle) * 18;
      if (document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
      b.setRay(x, y);
      const raw = b.ray.intersectObjects(all, false)[0];
      if (raw?.object.userData.daylightHandle) continue;
      const padded = b.pickModel(x, y);
      if (padded?.input?.kind !== 'phase-dial' || padded.object !== mesh) continue;
      return { x, y, center, centerDistance: Math.hypot(x - center.x, y - center.y),
        outsideVisibleMesh: true, rawHit: raw?.object.userData.kind ?? null, label: padded.input.label,
        viewport: { width: innerWidth, height: innerHeight } };
    }
    return null;
  });
  const microDragFromEdge = async name => {
    await settleCamera();
    const hit = await edgeDialTarget();
    if (!hit) throw Error(`${name}: no padded hit 18 CSS px from the visible day/moon icon`);
    targets.push({ ...hit, kind: 'phase-dial-edge' });
    check(hit.outsideVisibleMesh && Math.abs(hit.centerDistance - 18) < .00001, `${name}: the padded target is 18 CSS px from the icon center and outside its actual mesh`);
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `${name}: the padded empty space exposes the actual handle hint`);
    const initial = await read();
    await page.mouse.down(); await frames();
    const grasped = await read(), grab = await dialGrab(hit.x, hit.y), samples = [];
    check(!grasped.playing && phaseDistance(grasped.phase, initial.phase) < .000001, `${name}: pressing outside the icon grabs it without a phase jump`);
    try {
      for (const pixels of [3, 8, 12, 8, 0]) {
        const expected = await dialGrab(hit.x + pixels, hit.y, grab.offset);
        await page.mouse.move(hit.x + pixels, hit.y); await frames();
        const state = await read(); samples.push({ pixels, expected: expected.expectedPhase, ...state });
        check(phaseDistance(state.phase, pixels === 3 ? initial.phase : expected.expectedPhase) < .0003,
          `${name}: ${pixels}px movement retains the original grab offset without jumping`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const held = await read();
    check(!held.playing && phaseDistance(held.phase, initial.phase) < .0003, `${name}: the small round-trip returns smoothly to the original phase and stays paused`);
    check(sameCamera(initial.camera, held.camera), `${name}: an edge grab never becomes camera rotation`);
    check(phaseDistance(held.saved?.phase, held.phase) < .000001, `${name}: releasing an edge grab saves the final input`);
    states.push({ name, hit, grab, initial, grasped, samples, after: held });
  };
  const clickLayer = async layer => {
    const hit = await target({ kind: 'select', layer });
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `earth layer ${layer}: the physical surface has its hover hint`);
    await page.mouse.click(hit.x, hit.y);
    const selection = layer < 2 ? layer + 1 : 3;
    await page.waitForFunction(selection => window.textbookDiagnostics.state.selection === selection, selection);
    await page.waitForTimeout(650); await frames();
    const selected = await read();
    check(selected.selection === selection && selected.geometry.selected === selection && !selected.playing, `earth layer ${layer}: clicking its actual solid selects the correct layer and pauses`);
    check(await page.locator(`#selections [data-selection="${selection}"]`).getAttribute('aria-pressed') === 'true', `earth layer ${layer}: the bottom shortcut follows the direct selection`);
    if (layer === 0 || layer === 2) await page.screenshot({ path: `output/playwright/direct-input-earth-${layer === 0 ? 'crust' : 'core'}.png` });
    const again = await target({ kind: 'select', layer });
    await page.mouse.click(again.x, again.y);
    await page.waitForFunction(() => window.textbookDiagnostics.state.selection === 0);
    await page.waitForTimeout(650); await frames();
    const reset = await read();
    check(reset.selection === 0 && reset.geometry.selected === 0 && reset.geometry.layerGroups.every(group => group.visible && group.labelVisible), `earth layer ${layer}: clicking the selected solid again restores the whole earth`);
    states.push({ name: `earth-layer-${layer}`, selected, reset });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await caseOf('day/moon desktop direct manipulation', async () => {
    await open('breeze');
    if ((await read()).reduced) await page.locator('#cStill').click();
    await page.waitForTimeout(250);
    check(!(await read()).reduced, 'the direct dragging checks run with normal motion enabled');
    await page.locator('#selections [data-selection="0"]').click();
    await page.locator('#cPause').click(); await frames();
    check((await read()).playing, 'breeze bottom play still starts playback before direct manipulation');
    const night = await dragDial('forward day-to-night', [.6, .78, .79, .8, .81, .82, .9, 1.02]);
    check(night.geometry.selected === 'night' && night.selection === 1 && night.geometry.groundX === 1, 'forward time dragging changes the same model to land breeze');
    const calm = states.at(-1).samples.find(sample => Math.abs(sample.requested - .8) < .00001);
    check(calm.geometry.strength === 0 && calm.geometry.flowRate === 0 && calm.geometry.flagArea > 1, 'the dragged transition has calm circulation while the flag retains a real surface');
    await page.screenshot({ path: 'output/playwright/direct-input-breeze-night.png' });
    const day = await dragDial('backward night-to-day', [-.08, -.18, -.2, -.22, -.35, -.57]);
    check(day.geometry.selected === 'day' && day.selection === 0 && day.geometry.groundX === -1, 'backward time dragging restores sea breeze');
    check(day.geometry.pressure.landGround === '相对低压' && day.geometry.pressure.seaGround === '相对高压', 'the daytime pressure labels follow the dragged thermal state');
    await page.screenshot({ path: 'output/playwright/direct-input-breeze-day.png' });
    const savedPhase = day.phase;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready('breeze');
    const restored = await read(); states.push({ name: 'breeze-refresh', restored });
    check(phaseDistance(restored.phase, savedPhase) < .000001 && !restored.playing, 'refresh restores the released nonpreset phase and stays paused');
    await page.locator('#selections [data-selection="1"]').click(); await frames();
    check((await read()).phase === 0 && !(await read()).playing, 'the nighttime bottom shortcut remains usable');
    await page.locator('#selections [data-selection="0"]').click(); await frames();
    check((await read()).phase === .5 && !(await read()).playing, 'the daytime bottom shortcut remains usable');
  });
  await caseOf('1024 day/moon manipulation', async () => {
    if ((await read()).active !== 'breeze') await open('breeze');
    await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(500);
    const night = await dragDial('1024 day-to-night', [.65, .78, .8, .85, .98]);
    check(night.geometry.selected === 'night' && night.geometry.groundX === 1, '1024×768: the real day/moon control remains operable');
    const layout = await page.evaluate(() => {
      const b = window.textbookDebug, d = document.querySelector('.capsule').getBoundingClientRect();
      return { labels: b.stats.labels, dock: { top: d.top, bottom: d.bottom }, pages: window.textbookDiagnostics.pages,
        hasOriginalBook: b.book.group.visible !== false && b.stats.models === 1 };
    });
    check(layout.hasOriginalBook && layout.pages.length === 2, '1024×768: direct controls keep the original open book below the model');
    check(layout.labels.every(label => label.left >= 0 && label.right <= 1024 && label.top >= 0 && label.bottom < layout.dock.top - 4), '1024×768: model labels remain clear of the bottom controls');
    states.push({ name: '1024-layout', layout });
    await page.screenshot({ path: 'output/playwright/direct-input-breeze-1024.png' });
  });
  await caseOf('earth direct layer selection', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await open('earth');
    if ((await read()).reduced) await page.locator('#cStill').click();
    await page.locator('#selections [data-selection="0"]').click(); await page.waitForTimeout(350);
    for (const layer of [0, 1, 2, 3]) await clickLayer(layer);
    const start = await target({ kind: 'select', layer: 1 });
    const before = await read();
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    try { await page.mouse.move(start.x + 65, start.y + 14, { steps: 9 }); }
    finally { await page.mouse.up(); }
    await page.waitForTimeout(400); const after = await read();
    check(after.selection === before.selection && after.geometry.selected === before.geometry.selected, 'dragging a physical earth layer rotates without selecting it');
    check(after.camera.orbit !== before.camera.orbit || after.camera.elevation !== before.camera.elevation, 'earth surface dragging still changes the viewing angle');
    states.push({ name: 'earth-surface-rotation', before, after });
    for (const selection of [1, 2, 3, 0]) {
      await page.locator(`#selections [data-selection="${selection}"]`).click(); await frames();
      const state = await read();
      check(state.selection === selection && state.geometry.selected === selection, `earth bottom shortcut ${selection} still works after direct manipulation`);
    }
    await page.screenshot({ path: 'output/playwright/direct-input-earth-whole.png' });
  });
  await caseOf('713 day/moon minimum target and continuous edge grab', async () => {
    await page.setViewportSize({ width: 713, height: 818 }); await open('breeze');
    if ((await read()).reduced) await page.locator('#cStill').click();
    await page.locator('#selections [data-selection="0"]').click(); await frames();
    await microDragFromEdge('713 sun edge grab');
    await page.locator('#selections [data-selection="1"]').click(); await frames();
    await microDragFromEdge('713 moon edge grab');
    await page.screenshot({ path: 'output/playwright/direct-input-breeze-713-edge.png' });
  });
  check(!errors.length, 'no browser exceptions or console errors in the direct-input flow');
  return { scope: 'Targeted real-mouse model input: day/moon dragging, 18px edge grabs and earth layer clicks on 1440×1000, 1024×768 and 713×818 desktop; not real-touch or whole-book acceptance',
    base, browser, checks, failures, errors, states, targets };
}
