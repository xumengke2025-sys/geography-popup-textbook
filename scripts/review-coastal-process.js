async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, text) => (ok ? checks : failures).push(text);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 600)); });
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'coastal-landform' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const live = m => { for (let n = m; n; n = n.parent) if (!n.visible) return false; return true; };
    const refs = window.__coastalBufferRefs ?? (window.__coastalBufferRefs = { map: new WeakMap(), next: 1 });
    const id = o => { if (!refs.map.has(o)) refs.map.set(o, refs.next++); return refs.map.get(o); };
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      model: d.render?.geometry, labels: d.render?.labels,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.['coastal-landform'],
      render: { calls: d.render?.calls, triangles: d.render?.triangles, geometries: d.render?.geometries, textures: d.render?.textures },
      meshes: !d.twoD && g ? g.meshes.filter(live).map(m => {
        const a = m.geometry.attributes.position, role = m.userData.coastalRole;
        const sampled = ['fixed-inland-core', 'fixed-platform', 'finite-collapse-block'].includes(role);
        m.geometry.computeBoundingBox();
        return { role, scene: m.userData.coastalScene, blockId: m.userData.coastalBlockId, state: m.userData.coastalState,
          text: m.userData.text, kind: m.userData.kind, vertices: a.count,
          positions: sampled ? Array.from(a.array) : undefined,
          bounds: { min: m.geometry.boundingBox.min.toArray(), max: m.geometry.boundingBox.max.toArray() },
          xyz: m.position.toArray(), scale: m.scale.toArray(), buffer: [id(m.geometry), id(a), id(a.array), m.geometry.index ? id(m.geometry.index) : null] };
      }) : [] };
  });
  const dist = (a, b) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));
  const sameCamera = (a, b) => dist(a.position, b.position) < .0001 && dist(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  const phase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < Math.floor(value / 100); i++) await range.press('PageUp');
    for (let i = 0; i < value % 100; i++) await range.press('ArrowRight');
    await frame();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
  };
  const settle = async () => {
    let old, stable = 0;
    for (let i = 0; i < 90; i++) {
      const p = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = old && dist(old, p) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      old = p; await page.waitForTimeout(75);
    }
    throw Error('Coastal framing did not settle');
  };
  const labels = async name => {
    const s = await read(), vp = page.viewportSize(), dock = await page.locator('.capsule').boundingBox(), all = s.labels ?? [];
    const outside = all.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = all.filter(l => l.fontPx < 18);
    const overlap = all.flatMap((a, i) => all.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (outside.length || small.length || overlap.length) labelIssues.push({ name, labels: all, outside, small, overlap });
    check(all.length >= 1 && all.length <= (s.selection === 0 ? 2 : 3) && !outside.length && !small.length && !overlap.length, `${name}: short Chinese labels remain readable, separated and above the controls`);
  };
  const target = async () => {
    const hit = await page.evaluate(() => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      const mesh = g.meshes.find(m => m.userData.coastalRole === 'phase-handle');
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true); mesh.geometry.computeBoundingBox();
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const center = mesh.geometry.boundingBox.getCenter(b.camera.position.clone().set(0, 0, 0));
      for (const dx of [0, -.4, .4]) for (const dy of [0, -.3, .3]) {
        const p = center.clone().add(b.camera.position.clone().set(dx, dy, 0)).applyMatrix4(mesh.matrixWorld).project(b.camera);
        const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
        if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 12 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
        const h = b.pickModel(x, y);
        if (h?.object === mesh) return { x, y, kind: h.input?.kind, label: h.input?.label };
      }
      return null;
    });
    if (!hit) throw Error('No exposed real coastal phase-track handle');
    targets.push(hit); return hit;
  };
  const drag = async requested => {
    await settle(); const hit = await target();
    check(hit.kind === 'phase-track', 'the physical paper tab is a real phase-track ray target');
    const before = await read(), samples = [];
    // Observe the real pointerdown before the production handler pauses. The
    // playing handle can advance between any two awaited automation calls.
    await page.evaluate(() => {
      window.__coastalGrabAtDown = null;
      window.textbookDebug.renderer.domElement.addEventListener('pointerdown', () => {
        const d = window.textbookDiagnostics;
        window.__coastalGrabAtDown = { phase: d.state.phase, playing: d.playing };
      }, { capture: true, once: true });
    });
    await page.mouse.move(hit.x, hit.y); await page.mouse.down();
    let grab;
    try {
      await frame();
      grab = await page.evaluate(() => ({ atDown: window.__coastalGrabAtDown,
        phase: window.textbookDiagnostics.state.phase, playing: window.textbookDiagnostics.playing }));
      check(grab.atDown?.playing === true && !grab.playing, 'grabbing the paper tab during playback immediately pauses the process');
      check(!!grab.atDown && Math.abs(grab.phase - grab.atDown.phase) < 1e-9, 'pointerdown freezes the current process without a phase jump');
      // Reconstruct the same grab offset only after the real press has frozen
      // phase. Projecting beforehand would add the intervening playback delta
      // to every requested position, while endpoint clamping hid that error.
      const offset = await page.evaluate(({ x, y }) => {
        const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.coastalRole === 'phase-handle').userData.modelInput.track;
        g.root.updateWorldMatrix(true, true); b.setRay(x, y);
        const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
        const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
        const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), phase = window.textbookDiagnostics.state.phase;
        return [track.start[0] + (track.end[0] - track.start[0]) * phase - p.x, track.start[1] + (track.end[1] - track.start[1]) * phase - p.y];
      }, hit);
      const projected = await page.evaluate(({ requested, offset }) => {
        const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.userData.coastalRole === 'phase-handle').userData.modelInput.track;
        const rect = b.renderer.domElement.getBoundingClientRect();
        return requested.map(phase => {
          const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0], track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
          p.applyMatrix4(g.root.matrixWorld).project(b.camera);
          return { phase, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
        });
      }, { requested, offset });
      for (const p of projected) {
        await page.mouse.move(p.x, p.y, { steps: 8 }); await frame(); const s = await read();
        check(Math.abs(s.phase - p.phase) < .002 && !s.playing, `real paper-tab drag reaches ${p.phase} and pauses`);
        check(s.meshes.filter(m => m.role === 'finite-collapse-block').length === 3, `real drag ${p.phase}: the same finite three-block pool remains`);
        samples.push({ phase: s.phase, model: s.model });
      }
    } finally { await page.mouse.up(); }
    await frame(); const after = await read();
    check(sameCamera(before.camera, after.camera), 'dragging the tab does not rotate the book or model');
    check(Math.abs(after.saved.phase - after.phase) < 1e-8 && after.saved.selection === after.selection, 'tab release saves the exact coastal condition');
    states.push({ name: 'physical-handle', before: { phase: before.phase, playing: before.playing }, grab,
      after: { phase: after.phase, playing: after.playing, saved: after.saved }, samples });
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=coastal-landform&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frame();
  if ((await read()).playing) await page.locator('#cPause').click();
  if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
  await page.locator('#selections [data-selection="0"]').click();
  const samples = [];
  for (const value of [0, 250, 550, 800, 1000, 800, 550, 250, 0]) {
    await phase(value); const s = await read(); samples.push(s);
    check(s.model.kind === 'coastal-landforms' && s.model.fixedInlandCore && s.model.fixedPlatform && s.model.bitmapSurfaces === 0 && s.model.imageMappedMeshes === 0, `${value}: real coastal solids with fixed inland bedrock and platform`);
    check(s.meshes.every(m => m.scene !== 'landform-comparison'), `${value}: comparison landforms do not intrude into cliff-process mode`);
    check(s.meshes.filter(m => m.role === 'finite-collapse-block').length === 3, `${value}: three identifiable cliff blocks remain visible`);
    if ([0, 250, 550, 800, 1000].includes(value) && samples.length <= 5) {
      states.push({ name: `phase-${value}`, phase: s.phase, model: s.model, render: s.render });
      if ([250, 800, 1000].includes(value)) await page.screenshot({ path: `output/playwright/coastal-process-desktop-${value}.png` });
    }
  }
  const byRole = (s, role) => s.meshes.find(m => m.role === role);
  const blocks = s => s.meshes.filter(m => m.role === 'finite-collapse-block').sort((a, b) => a.blockId - b.blockId);
  for (const role of ['fixed-inland-core', 'fixed-platform']) check(samples.every(s => JSON.stringify(byRole(s, role)) === JSON.stringify(byRole(samples[0], role))), `${role}: actual position buffer, transform and bounds never move while the cliff retreats`);
  check(blocks(samples[1]).every((m, i) => m.positions[4 * 42 + 23] < blocks(samples[0])[i].positions[4 * 42 + 23] && m.positions[4 * 42 + 41] === blocks(samples[0])[i].positions[4 * 42 + 41]), 'phase .25 physically cuts a recess into the toe while leaving the upper seaward face fixed');
  check(blocks(samples[3]).every((m, i) => m.positions[4 * 42 + 40] < blocks(samples[2])[i].positions[4 * 42 + 40]), 'the same three upper front corners visibly drop between .55 and .8');
  check(samples[4].model.inventory.deposited === 3 && blocks(samples[4]).every(m => m.state === 'deposited') && samples[4].model.exposedPlatform > 8, 'the final blocks remain deposited and expose the original platform');
  const buffers = s => blocks(s).map(m => m.buffer);
  check(samples.every(s => JSON.stringify(buffers(s)) === JSON.stringify(buffers(samples[0]))), 'all slab geometries, indices and position buffers are reused');
  for (const [a, b] of [[0, 8], [1, 7], [2, 6], [3, 5]]) check(JSON.stringify(blocks(samples[a])) === JSON.stringify(blocks(samples[b])) && JSON.stringify(samples[a].model) === JSON.stringify(samples[b].model), `reverse seeking exactly restores phase ${samples[a].phase}`);
  await phase(1000); const final = await read(); await page.waitForTimeout(350);
  check(JSON.stringify(blocks(await read())) === JSON.stringify(blocks(final)) && !(await read()).playing, 'the endpoint remains still and retains all fallen blocks');
  await labels('desktop-final');
  await phase(250); await page.locator('#cPause').click(); await frame();
  check((await read()).playing, 'ordinary playback can advance the shared process before direct manipulation');
  await drag([.55, .8, 1, .25]);
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frame();
  check(Math.abs((await read()).phase - .25) < .002 && !(await read()).playing && (await read()).selection === 0, 'reload restores the saved process condition paused');
  for (const [n, role] of [[1, 'through-arch'], [2, 'sea-stack'], [3, 'depositional-beach']]) {
    await page.locator(`#selections [data-selection="${n}"]`).click(); await phase(550); const s = await read();
    check(s.meshes.every(m => m.scene !== 'cliff-process') && !!byRole(s, role) && byRole(s, role).kind === 'solid-geometry' && byRole(s, role).vertices >= 24, `mode ${n}: original ${role} remains real geometry without cliff-process slabs or handle`);
    check(s.model.archHasRealOpening && !s.model.requiredChronologicalSequence, `mode ${n}: independent coastal forms retain their scientific boundary`);
    states.push({ name: `comparison-${n}`, model: s.model, roles: s.meshes.map(m => m.role), render: s.render });
  }
  await page.locator('#selections [data-selection="0"]').click(); await phase(550); await settle(); await labels('desktop-collapse');
  const sameState = await read();
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(); await labels('tablet-collapse');
  await page.screenshot({ path: 'output/playwright/coastal-process-tablet-550.png' });
  await page.goto(`${base}/?figure=coastal-landform&2d`, { waitUntil: 'domcontentloaded', timeout: 45000 }); await ready(); await phase(550);
  const flat = await page.locator('.flat-model-svg').evaluate(svg => ({ images: svg.querySelectorAll('image').length, phase: Number(svg.dataset.phase), stage: svg.dataset.coastalProcess,
    undercut: Number(svg.dataset.undercut), probes: JSON.parse(svg.dataset.blockProbes), aria: svg.getAttribute('aria-label') }));
  check(!flat.images && Math.abs(flat.undercut - sameState.model.undercut) < .0001 && flat.stage === sameState.model.stage, 'SVG shares the exact undercut state with the actual Three.js cliff');
  check(flat.probes.every(p => p.state === sameState.model.blocks[p.id].state && Math.abs(p.fall - sameState.model.blocks[p.id].fall) < .0001 && dist(p.translation, sameState.model.blocks[p.id].translation) < .0001), 'SVG projects the same rigid block poses rather than playing a separate scene');
  check(flat.aria.includes('不表示真实年限') && flat.aria.includes('不是必经阶段'), 'the accessible vector description states both model boundaries');
  await phase(1000); check(await page.locator('[data-coastal-block][data-state="deposited"]').count() === 3, 'SVG keeps the same three deposited slabs at the endpoint');
  await page.screenshot({ path: 'output/playwright/coastal-process-flat-1000.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await frame();
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const box = svg.getBoundingClientRect();
    return { box: { left: box.left, right: box.right }, labels: [...svg.querySelectorAll('text')].map(text => {
      const r = text.getBoundingClientRect(), m = text.getScreenCTM();
      return { text: text.textContent, left: r.left, right: r.right, px: parseFloat(getComputedStyle(text).fontSize) * Math.hypot(m.a, m.b) };
    }) };
  });
  check(phone.labels.length <= 3 && phone.labels.every(l => l.px >= 18 - .05 && l.left >= phone.box.left - 1 && l.right <= phone.box.right + 1), 'phone SVG keeps the short necessary labels at least 18 pixels and in bounds');
  await page.screenshot({ path: 'output/playwright/coastal-process-phone-1000.png' });
  check(!errors.length, 'no browser exceptions or console errors');
  states.push({ name: 'shared-svg-state', flat, phone });
  return { base, browser: page.context().browser().version(), checks, failures, errors, states, targets, labelIssues };
}
