async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'karst' && !d.figureBusy && !d.turning && d.render?.modelState === 'live'
      && window.textbookDebug.entry.art.diagnostics.kind === 'karst-dissolution';
  }, null, { timeout: 45000 });
  const phase = async n => {
    await page.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, n);
    await frames();
  };
  const read = () => page.evaluate(() => {
    const debug = window.textbookDebug, art = debug.entry.art, model = art.diagnostics;
    const body = art.geometry.meshes.find(m => m.userData.karstRole === 'limestone');
    return { model, render: window.textbookDiagnostics.render, playing: window.textbookDiagnostics.playing,
      rockScale: body.scale.toArray(), selected: window.textbookDiagnostics.state.selection };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?figure=karst&3d&inspect`, { waitUntil: 'domcontentloaded' }); await ready();
  await page.evaluate(() => document.fonts.ready); await frames();
  if ((await read()).playing) await page.locator('#cPause').click();
  check(await page.locator('#selections [data-selection]').count() === 6, 'six original landform comparisons remain available');
  await page.evaluate(() => {
    const g = window.textbookDebug.entry.art.geometry, rock = g.meshes.find(m => m.userData.karstRole === 'limestone');
    window.__karstRefs = { meshes: [...g.meshes], rock, position: rock.geometry.attributes.position,
      array: rock.geometry.attributes.position.array, geometry: rock.geometry, index: rock.geometry.index,
      water: g.meshes.find(m => m.userData.karstRole === 'surface-water').geometry.attributes.position };
  });
  const names = ['溶沟', '洼地', '峰丛', '峰林', '孤峰', '残丘'];
  let maximumCalls = 0;
  for (let selection = 0; selection < 6; selection++) {
    await page.locator(`#selections [data-selection="${selection}"]`).click(); await phase(0);
    await page.evaluate(() => window.__karstInitial = Array.from(window.__karstRefs.array));
    const initial = await read();
    await phase(550); const middle = await read();
    await page.evaluate(() => window.__karstMiddle = Array.from(window.__karstRefs.array));
    await phase(1000); const final = await read();
    if ([0, 1, 3, 5].includes(selection)) await page.screenshot({ path: `output/playwright/karst-process-${selection}-1000.png` });
    check(final.model.selectedForm === names[selection] && final.selected === selection, `${names[selection]}: original control selects its own limestone form`);
    check(final.model.kind === 'karst-dissolution' && final.model.bitmapSurfaces === 0 && final.model.imageMappedMeshes === 0,
      `${names[selection]}: the relief is independent solid geometry`);
    check(final.rockScale.every(n => n === 1), `${names[selection]}: dissolution changes surface vertices instead of shrinking a whole model`);
    check(await page.evaluate(() => {
      const initial = window.__karstInitial, current = window.__karstRefs.array;
      let changed = 0;
      for (let i = 1; i < current.length; i += 3) {
        if (current[i] > initial[i] + .00001) return false;
        if (initial[i] - current[i] > .1) changed++;
      }
      return changed > 1800;
    }), `${names[selection]}: thousands of surface vertices erode without any rock growing upward`);
    check(final.model.universalTimeSequence === false && final.model.reference.quantities === 'schematic',
      `${names[selection]}: comparison is not a universal equal-time evolution clock`);
    check(middle.model.waterPaths.every(path => path.points.every((point, i) => !i || point.height < path.points[i - 1].height)),
      `${names[selection]}: rainfall has a downhill surface route into a fissure`);
    await phase(550);
    check(await page.evaluate(() => Array.from(window.__karstRefs.array).every((n, i) => n === window.__karstMiddle[i])),
      `${names[selection]}: reverse seeking restores exactly the same solid surface`);
    const same = await read();
    check(JSON.stringify(same.model.heightProbes) === JSON.stringify(middle.model.heightProbes), `${names[selection]}: same input restores the same model state`);
    check(same.render.labels.every(label => label.fontPx >= 18), `${names[selection]}: short Chinese labels remain readable`);
    for (const state of [initial, middle, final]) maximumCalls = Math.max(maximumCalls, state.render.calls);
    states.push({ selection, name: names[selection], initial: { erosion: initial.model.erosion, probes: initial.model.heightProbes },
      middle: { erosion: middle.model.erosion, probes: middle.model.heightProbes, paths: middle.model.waterPaths },
      final: { erosion: final.model.erosion, probes: final.model.heightProbes }, render: same.render });
    if ([0, 1, 3, 5].includes(selection)) await page.screenshot({ path: `output/playwright/karst-process-${selection}-550.png` });
  }
  check(await page.evaluate(() => {
    const g = window.textbookDebug.entry.art.geometry, r = window.__karstRefs;
    return g.meshes.length === r.meshes.length && g.meshes.every((m, i) => m === r.meshes[i])
      && r.rock.geometry === r.geometry && r.rock.geometry.attributes.position === r.position
      && r.position.array === r.array && r.rock.geometry.index === r.index
      && g.meshes.find(m => m.userData.karstRole === 'surface-water').geometry.attributes.position === r.water;
  }), 'all six comparisons and seek directions reuse the same mesh, index and attribute buffers');
  check(maximumCalls <= 120, `draw-call budget is at most 120 (measured ${maximumCalls})`);
  const held = await read(); await page.waitForTimeout(350);
  check(JSON.stringify((await read()).model) === JSON.stringify(held.model), 'paused erosion, water and geometry do not advance');
  // A real mouse drag on the on-model water handle; projection only chooses
  // screen coordinates and does not invoke a production interaction handler.
  await page.locator('#selections [data-selection="0"]').click(); await phase(250); await page.waitForTimeout(700);
  const target = await page.evaluate(() => {
    const b = window.textbookDebug, g = b.entry.art.geometry, mesh = g.meshes.find(m => m.userData.erosionHandle);
    if (!mesh) return null;
    b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
    const rect = b.renderer.domElement.getBoundingClientRect(), track = mesh.userData.modelInput.track;
    const project = p => {
      const q = b.camera.position.clone().set(...p).applyMatrix4(g.root.matrixWorld).project(b.camera);
      return { x: rect.left + (q.x + 1) * rect.width / 2, y: rect.top + (1 - q.y) * rect.height / 2 };
    };
    const start = project(mesh.position.toArray()), hit = b.pickModel(start.x, start.y);
    const end = project(track.start.map((n, i) => n + (track.end[i] - n) * .77));
    return { start, end, kind: hit?.input?.kind, objectMatches: hit?.object === mesh,
      camera: { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray() } };
  });
  check(target?.kind === 'phase-track' && target.objectMatches, 'the visible water handle is an actual phase-track ray target');
  if (target?.kind === 'phase-track' && target.objectMatches) {
    await page.mouse.move(target.start.x, target.start.y); await page.mouse.down();
    await page.mouse.move(target.end.x, target.end.y, { steps: 10 }); await page.mouse.up(); await frames();
    const dragged = await read();
    check(Math.abs(dragged.model.phase - .77) < .003 && !dragged.playing, 'dragging the water handle changes erosion and leaves it paused');
    check(await page.evaluate(before => {
      const camera = window.textbookDebug.camera;
      return camera.position.toArray().every((v, i) => Math.abs(v - before.position[i]) < .0001)
        && camera.quaternion.toArray().every((v, i) => Math.abs(v - before.quaternion[i]) < .000001);
    }, target.camera), 'direct erosion drag keeps the camera stable');
  }
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(650); await phase(650);
  await page.screenshot({ path: 'output/playwright/karst-process-tablet.png' });
  await page.goto(`${base}/?figure=karst&2d`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.active === 'karst' && !window.textbookDiagnostics.figureBusy);
  await page.locator('#selections [data-selection="3"]').click(); await phase(550);
  const svg = page.locator('.flat-concept svg');
  check(await svg.locator('image').count() === 0, 'flat explanation is native SVG rather than a cropped illustration');
  check(await svg.getAttribute('data-karst-form') === '3', '2D selects the same original peak-forest comparison');
  const flatProbes = JSON.parse(await svg.getAttribute('data-height-probes'));
  check(flatProbes.every((probe, i) => Math.abs(probe.height - states[3].middle.probes[i].height) < .00001), '2D and solid geometry share the same surface heights');
  check((await svg.getAttribute('aria-label')).includes('不是所有地区必经的等时序列'), 'accessible description preserves the non-universal and schematic boundary');
  await page.screenshot({ path: 'output/playwright/karst-process-flat.png' });
  check(!errors.length, 'no browser exceptions or console errors');
  return { base, browser: page.context().browser().version(), checks, failures, errors, maximumCalls, states };
}
