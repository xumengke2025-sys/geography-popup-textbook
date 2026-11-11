async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const layerIds = ['A-lower', 'A-middle', 'A-upper', 'B-lower', 'B-middle', 'B-upper'];
  const matches = [4, 5, null, null, 0, 1];
  const fossilOwners = [
    { id: 'A-fan', layer: 0, kind: 'fan-shell', x: 18, y: 6 },
    { id: 'A-curled', layer: 0, kind: 'curled-shell', x: 31, y: 6 },
    { id: 'A-cone', layer: 1, kind: 'cone-imprint', x: 23, y: 18 },
    { id: 'A-round', layer: 2, kind: 'round-imprint', x: 18, y: 30 },
    { id: 'B-leaf', layer: 3, kind: 'leaf-shell', x: 70, y: 6 },
    { id: 'B-small', layer: 3, kind: 'small-shell', x: 84, y: 6 },
    { id: 'B-curled', layer: 4, kind: 'curled-shell', x: 72.5, y: 18 },
    { id: 'B-fan', layer: 4, kind: 'fan-shell', x: 85, y: 18 },
    { id: 'B-cone', layer: 5, kind: 'cone-imprint', x: 83, y: 30 },
  ];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const distance = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
  const sameCamera = (a, b) => distance(a.position, b.position) < .0001 && distance(a.quaternion, b.quaternion) < .000001 && a.orbit === b.orbit && a.elevation === b.elevation;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'history' && !d.figureBusy && !d.turning && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    // Review-only identities observe buffer reuse without touching lesson state.
    const ids = window.__strataReviewBuffers ?? (window.__strataReviewBuffers = { map: new WeakMap(), next: 1 });
    const id = value => { if (!ids.map.has(value)) ids.map.set(value, ids.next++); return ids.map.get(value); };
    const visible = mesh => { for (let node = mesh; node; node = node.parent) if (!node.visible) return false; return true; };
    return {
      phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, twoD: d.twoD,
      model: d.render?.geometry, labels: d.render?.labels ?? [], scale: g ? g.width / 100 : null,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      saved: JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.history,
      render: { calls: d.render?.calls, triangles: d.render?.triangles, geometries: d.render?.geometries, textures: d.render?.textures },
      meshes: !d.twoD && g ? g.meshes.filter(mesh => mesh.userData.strataRole).map(mesh => {
        const a = mesh.geometry.attributes.position; mesh.geometry.computeBoundingBox();
        return { role: mesh.userData.strataRole, layer: mesh.userData.strataLayer, layerId: mesh.userData.strataLayerId,
          fossilId: mesh.userData.strataFossilId, fossilKind: mesh.userData.fossilKind, text: mesh.userData.text,
          highlighted: mesh.userData.highlighted, visible: visible(mesh), xyz: mesh.position.toArray(),
          geometry: mesh.geometry.uuid, positionBuffer: id(a), vertexArray: id(a.array), vertices: a.count,
          depth: mesh.geometry.boundingBox.max.z - mesh.geometry.boundingBox.min.z,
          finite: Array.from(a.array).every(Number.isFinite) };
      }) : [],
    };
  });
  const phase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press('Home');
    for (let i = 0; i < Math.round(value / 100); i++) await range.press('PageUp');
    await frames();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-7, value);
  };
  const settle = async () => {
    let previous, stable = 0;
    for (let attempt = 0; attempt < 90; attempt++) {
      const current = await page.evaluate(() => window.textbookDebug.camera.position.toArray());
      stable = previous && distance(previous, current) < .000005 ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = current; await page.waitForTimeout(80);
    }
    throw Error('Strata camera framing did not settle before a real pointer interaction');
  };
  const selection = async value => {
    await page.locator(`#selections [data-selection="${value}"]`).click(); await frames();
    await page.waitForFunction(value => window.textbookDiagnostics.state.selection === value, value);
  };
  const bufferSignature = state => state.meshes.map(mesh => [mesh.role, mesh.layer, mesh.fossilId, mesh.geometry, mesh.positionBuffer, mesh.vertexArray, mesh.vertices]);
  const validateModel = (state, name) => {
    const model = state.model, focused = state.selection >= 2 ? state.selection - 2 : null;
    const match = focused === null ? null : matches[focused];
    const highlighted = focused === null ? [] : match === null ? [focused] : [focused, match];
    const gap = state.selection >= 1 ? 9 * state.phase * state.phase * (3 - 2 * state.phase) : 0;
    check(model?.kind === 'strata' && model.mechanism === 'fossil-correlation' && model.columns === 2 && model.layersPerColumn === 3, `${name}: two localities retain six physical textbook strata`);
    check(model.phase === state.phase && model.selection === state.selection && model.focused === focused && model.match === match && Math.abs(model.gap - gap) < 1e-8, `${name}: focus and layer spacing use the same lesson state`);
    check(model.timeIsEquallySpaced === false && model.missingMatchMeansMissingAge === false && model.reference?.printedPage === 15 && model.reference?.figure === '1.23', `${name}: spacing and unpaired specimens do not invent geological ages`);
    check(same(model.selectionOrder, layerIds) && model.layerGroups.length === 6 && model.layerGroups.every((layer, index) => layer.id === layerIds[index] && layer.highlighted === highlighted.includes(index) && Math.abs(layer.offsetY - (index % 3) * gap) < 1e-8 && layer.offsetZ === (highlighted.includes(index) ? 2.5 : 0)), `${name}: only the specimen and its established counterpart are emphasized`);
    const bodies = state.meshes.filter(mesh => mesh.role === 'layer'), fossils = state.meshes.filter(mesh => mesh.role === 'fossil');
    check(bodies.length === 6 && bodies.every(mesh => mesh.visible && mesh.depth > .001) && fossils.length === 9 && fossils.every(mesh => mesh.visible && mesh.depth > .001), `${name}: all six rock solids and nine fossil reliefs remain in the scene`);
    check(fossilOwners.every(expected => fossils.filter(mesh => mesh.fossilId === expected.id && mesh.layer === expected.layer && mesh.fossilKind === expected.kind).length === 1), `${name}: every visible fossil keeps its textbook shape and layer owner`);
    check(state.meshes.filter(mesh => mesh.layer !== undefined).every(mesh => {
      const layer = model.layerGroups[mesh.layer];
      return mesh.highlighted === layer.highlighted && distance(mesh.xyz, [0, layer.offsetY * state.scale, layer.offsetZ * state.scale]) < 1e-8;
    }) && state.meshes.every(mesh => mesh.finite), `${name}: fossils travel with their parent layers using finite vertex buffers`);
    const pairs = model.correlations;
    check(pairs.length === 2 && same(pairs.map(pair => [pair.a, pair.b]), [[0, 4], [1, 5]]) && pairs.every(pair => pair.visible === (focused === null || highlighted.includes(pair.a)) && pair.highlighted === (focused !== null && highlighted.includes(pair.a))), `${name}: only the two source-supported fossil correlations are drawn`);
    check(pairs.every(pair => Math.abs(pair.from[1] - (6 + (pair.a % 3) * (12 + gap))) < 1e-8 && Math.abs(pair.to[1] - (6 + (pair.b % 3) * (12 + gap))) < 1e-8 && pair.from[2] === model.layerGroups[pair.a].offsetZ && pair.to[2] === model.layerGroups[pair.b].offsetZ), `${name}: correlation endpoints follow the moving layer fronts`);
  };
  const inspectLabels = async name => {
    const state = await read(), dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize(), labels = state.labels;
    const outside = labels.filter(label => label.left < 0 || label.right > vp.width || label.top < 0 || label.bottom > dock.y - 3);
    const small = labels.filter(label => label.fontPx < 18);
    const overlap = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (!same(labels.map(label => label.text).sort(), ['A', 'B']) || outside.length || small.length || overlap.length) labelIssues.push({ name, viewport: vp, labels, outside, small, overlap });
    check(same(labels.map(label => label.text).sort(), ['A', 'B']) && !outside.length && !small.length && !overlap.length, `${name}: only two necessary locality labels remain clear and separated`);
  };
  // Read-only ray tests find a visible face. Interactions use actual pointer or
  // keyboard input; this script never invokes the production input handlers.
  const target = async request => {
    const hit = await page.evaluate(request => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const visible = mesh => { for (let node = mesh; node; node = node.parent) if (!node.visible) return false; return true; };
      const candidates = g.meshes.filter(mesh => visible(mesh) && mesh.userData.strataRole === request.role && (request.layer === undefined || mesh.userData.strataLayer === request.layer) && (request.fossilId === undefined || mesh.userData.strataFossilId === request.fossilId));
      const vector = () => b.camera.position.clone().set(0, 0, 0);
      for (const mesh of candidates) {
        const a = mesh.geometry.attributes.position, index = mesh.geometry.index;
        mesh.geometry.computeBoundingBox(); const points = [mesh.geometry.boundingBox.getCenter(vector())];
        if (mesh.userData.baseCenter) points.unshift(vector().set(...mesh.userData.baseCenter));
        const count = Math.floor((index?.count ?? a.count) / 3), step = Math.max(1, Math.floor(count / 320));
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
          if (actual?.object === mesh && actual.input) return { x, y, label: actual.input.label, input: actual.input, object: mesh.uuid, ...request };
        }
      }
      return null;
    }, request);
    if (!hit) throw Error(`No exposed real strata target for ${JSON.stringify(request)}`);
    targets.push(hit); return hit;
  };
  const clickPart = async request => {
    await settle(); const hit = await target(request), before = await read();
    const expected = before.selection === request.layer + 2 ? 1 : request.layer + 2;
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `${request.fossilId ?? layerIds[request.layer]}: actual mesh exposes its evidence hint`);
    await page.mouse.click(hit.x, hit.y); await frames();
    await page.waitForFunction(value => window.textbookDiagnostics.state.selection === value, expected);
    const after = await read(), name = `${request.fossilId ?? layerIds[request.layer]} at ${before.phase}`;
    check(after.selection === expected && after.phase === before.phase && !after.playing, `${name}: actual click preserves spacing and pauses with the expected focus`);
    check(await page.locator('#selections [data-selection="1"]').getAttribute('aria-pressed') === 'true', `${name}: all specimen focuses keep the existing separated-mode tab selected`);
    validateModel(after, name); states.push({ name, ...after }); return after;
  };
  const dragPhase = async phases => {
    await settle(); const hit = await target({ role: 'phase-handle' }), before = await read();
    // Preserve the true grab offset on the track plane instead of assuming
    // that the first ray hit passed through the paper tab's exact center.
    const grab = await page.evaluate(({ x, y }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(mesh => mesh.userData.strataHandle).userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const origin = g.root.worldToLocal(b.ray.ray.origin.clone());
      const direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), phase = window.textbookDiagnostics.state.phase;
      return { offset: [track.start[0] + (track.end[0] - track.start[0]) * phase - p.x, track.start[1] + (track.end[1] - track.start[1]) * phase - p.y] };
    }, hit);
    const points = await page.evaluate(({ phases, offset }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(mesh => mesh.userData.strataHandle).userData.modelInput.track, rect = b.renderer.domElement.getBoundingClientRect();
      return phases.map(phase => {
        const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0], track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
      });
    }, { phases, offset: grab.offset });
    const samples = []; await page.mouse.move(hit.x, hit.y); await page.mouse.down();
    try {
      for (const point of points) {
        await page.mouse.move(point.x, point.y, { steps: 7 }); await frames(); const state = await read(); samples.push(state);
        check(Math.abs(state.phase - point.phase) < .002 && state.selection === before.selection && !state.playing, `paper tab: real drag reaches ${point.phase} while preserving the fossil focus`);
        validateModel(state, `paper tab ${point.phase}`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const after = await read();
    check(sameCamera(before.camera, after.camera), 'dragging the strata paper tab never rotates the exhibit');
    check(Math.abs(after.saved.phase - after.phase) < 1e-7 && after.saved.selection === after.selection, 'releasing the tab saves the exact spacing and specimen focus');
    states.push({ name: 'direct-paper-tab-drag', before, grab, samples, after }); return after;
  };
  const readSvg = () => page.locator('.flat-model-svg').evaluate(svg => ({
    images: svg.querySelectorAll('image').length, role: svg.getAttribute('role'), aria: svg.getAttribute('aria-label'), desc: svg.querySelector('desc')?.textContent,
    phase: Number(svg.dataset.strataPhase), selection: Number(svg.dataset.strataSelection),
    layers: [...svg.querySelectorAll('[data-strata-layer]')].map(el => ({ id: el.dataset.strataLayer, offsetY: Number(el.dataset.strataOffsetY), selection: Number(el.dataset.modelSelection), toggle: Number(el.dataset.modelToggle), pressed: el.getAttribute('aria-pressed'), label: el.getAttribute('aria-label'), stroke: Number([...el.children].filter(node => node.localName === 'path')[2]?.getAttribute('stroke-width')) })),
    fossils: [...svg.querySelectorAll('[data-strata-fossil]')].map(el => ({ id: el.dataset.strataFossil, kind: el.dataset.fossilKind, owner: el.dataset.owner, x: Number(el.dataset.x), y: Number(el.dataset.y) })),
    correlations: [...svg.querySelectorAll('[data-strata-correlation]')].map(el => ({ key: el.dataset.strataCorrelation, path: el.getAttribute('d'), dash: el.getAttribute('stroke-dasharray') })),
    labels: [...svg.querySelectorAll('text')].map(el => el.textContent),
  }));
  const validateSvg = async name => {
    const state = await read(), svg = await readSvg(), focused = state.selection >= 2 ? state.selection - 2 : null;
    const match = focused === null ? null : matches[focused], highlighted = focused === null ? [] : match === null ? [focused] : [focused, match];
    const gap = state.selection >= 1 ? 9 * state.phase * state.phase * (3 - 2 * state.phase) : 0;
    check(svg.images === 0 && svg.role === 'group' && svg.layers.length === 6 && svg.fossils.length === 9 && same(svg.labels, ['A', 'B']), `${name}: fallback is a native six-layer vector exhibit with nine fossils and two labels`);
    check(svg.selection === state.selection && Math.abs(svg.phase - state.phase) < .00006 && svg.layers.every((layer, index) => layer.id === layerIds[index] && layer.selection === index + 2 && layer.toggle === 1 && layer.pressed === String(focused === index) && Math.abs(layer.offsetY - (index % 3) * gap) < .00006 && layer.stroke === (highlighted.includes(index) ? 2.6 : 1.2)), `${name}: native vector spacing, focus and counterpart outlines use the same state`);
    check(fossilOwners.every(expected => svg.fossils.some(fossil => fossil.id === expected.id && fossil.kind === expected.kind && fossil.owner === layerIds[expected.layer] && fossil.x === expected.x && Math.abs(fossil.y - expected.y - (expected.layer % 3) * gap) < .00006)), `${name}: every SVG fossil shares its physical specimen's owner and displacement`);
    const expectedKeys = focused === null ? ['paired-shells', 'cone'] : highlighted.includes(0) ? ['paired-shells'] : highlighted.includes(1) ? ['cone'] : [];
    check(same(svg.correlations.map(connection => connection.key), expectedKeys) && svg.correlations.every(connection => !!connection.dash), `${name}: fallback draws only source-supported correspondence lines`);
    check(svg.aria.includes('间距不是年代长短') && svg.desc.includes('不据此推断该时代不存在'), `${name}: vector accessibility text preserves the model's scientific limits`);
    return { state, svg };
  };

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?figure=history&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ready(); await page.evaluate(() => document.fonts.ready); await frames();
  if ((await read()).playing) await page.locator('#cPause').click();
  check(same(await page.locator('#selections [data-selection]').allTextContents(), ['同时代地层', '分层查看']), 'two original textbook mode controls remain unchanged');
  await selection(0); await phase(0); const initial = await read(); validateModel(initial, 'unseparated initial view');
  const buffers = bufferSignature(initial);
  await phase(1000); const wholeEnd = await read(); validateModel(wholeEnd, 'unseparated at full phase');
  check(wholeEnd.model.gap === 0 && wholeEnd.meshes.filter(mesh => mesh.role === 'phase-handle' || mesh.role === 'phase-rail').every(mesh => !mesh.visible), 'whole-column mode hides the separation tab and keeps both outcrops intact');
  states.push({ name: 'whole-column-reference', initial, wholeEnd });
  // Both closed and fully separated configurations must expose actual layers
  // and reliefs; no screen coordinates or hidden production action are used.
  for (const value of [0, 1000]) {
    await selection(1); await phase(value);
    for (let layer = 0; layer < 6; layer++) await clickPart({ role: 'layer', layer });
    const cancelled = await clickPart({ role: 'layer', layer: 5 });
    check(cancelled.selection === 1 && cancelled.model.focused === null && cancelled.model.layerGroups.every(layer => !layer.highlighted), `${value}: clicking the same layer cancels focus while retaining the separated mode`);
    for (const fossil of fossilOwners) {
      if ((await read()).selection === fossil.layer + 2) await selection(1);
      await clickPart({ role: 'fossil', layer: fossil.layer, fossilId: fossil.id });
    }
    await inspectLabels(`desktop-phase-${value}`);
    await page.screenshot({ path: `output/playwright/strata-desktop-${value}.png` });
  }
  await clickPart({ role: 'fossil', layer: 0, fossilId: 'A-fan' });
  const seekSamples = [];
  for (const value of [200, 600, 1000, 600]) {
    await phase(value); const state = await read(); validateModel(state, `keyboard seek ${value}`); seekSamples.push(state);
    check(state.selection === 2 && same(state.model.layerGroups.filter(layer => layer.highlighted).map(layer => layer.index), [0, 4]), `${value}: scrubbing retains A-lower and B-middle as the same evidence pair`);
  }
  check(same(seekSamples[1].model, seekSamples[3].model), 'backward seeking restores the exact same layer offsets and correlation endpoints');
  check([wholeEnd, ...states.filter(state => state.meshes), ...seekSamples].every(state => same(bufferSignature(state), buffers)), 'pointing and scrubbing reuse the same rock and fossil vertex buffers');
  await settle(); await inspectLabels('desktop-matched-pair');
  await page.screenshot({ path: 'output/playwright/strata-desktop-matched-pair.png' });
  states.push({ name: 'focus-preserving-keyboard-seek', samples: seekSamples });
  const dragged = await dragPhase([.2, .7, .4, .9, .6]);
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  const restoredPair = await read(); validateModel(restoredPair, 'restored paired focus');
  check(restoredPair.selection === 2 && Math.abs(restoredPair.phase - dragged.phase) < 1e-7 && !restoredPair.playing, 'refresh restores specimen selection 2 without clamping it to the mode tab');
  await clickPart({ role: 'fossil', layer: 5, fossilId: 'B-cone' });
  const beforeHighReload = await read(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await frames();
  const restoredHigh = await read(); validateModel(restoredHigh, 'restored highest specimen selection');
  check(restoredHigh.selection === 7 && restoredHigh.phase === beforeHighReload.phase && !restoredHigh.playing, 'refresh also preserves highest specimen selection 7 and remains paused');
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(); await inspectLabels('tablet-separated');
  await page.screenshot({ path: 'output/playwright/strata-tablet-separated.png' });
  const before2d = await read();
  await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready(); await frames();
  const fallback = await validateSvg('mode switch');
  check(fallback.state.twoD && fallback.state.selection === before2d.selection && fallback.state.phase === before2d.phase && !fallback.state.playing, 'switching to SVG retains the exact inspected specimen and spacing');
  check(fallback.svg.layers.every((layer, index) => Math.abs(layer.offsetY - before2d.model.layerGroups[index].offsetY) < .00006), 'all six SVG layer offsets match the actual Three.js specimen positions');
  const svgLayer = index => page.locator(`.flat-model-svg [data-strata-layer="${layerIds[index]}"]`);
  const flatPhase = (await read()).phase;
  for (let layer = 0; layer < 6; layer++) {
    if ((await read()).selection === layer + 2) await selection(1);
    await svgLayer(layer).click(); await frames();
    check((await read()).selection === layer + 2 && (await read()).phase === flatPhase && !(await read()).playing, `${layerIds[layer]}: real SVG click retains spacing and selects the physical layer`);
    await validateSvg(`SVG ${layerIds[layer]}`);
  }
  for (const fossil of fossilOwners) {
    if ((await read()).selection === fossil.layer + 2) await selection(1);
    await page.locator(`.flat-model-svg [data-strata-fossil="${fossil.id}"] path`).first().click(); await frames();
    check((await read()).selection === fossil.layer + 2 && (await read()).phase === flatPhase, `${fossil.id}: native vector relief selects its actual parent layer`);
    await validateSvg(`SVG ${fossil.id}`);
  }
  await selection(1); await svgLayer(0).focus(); await page.keyboard.press('Enter'); await frames();
  check((await read()).selection === 2 && await svgLayer(0).evaluate(el => el === document.activeElement), 'Enter selects the vector specimen and retains focus after SVG regeneration');
  await page.keyboard.press('Space'); await frames();
  check((await read()).selection === 1 && !(await read()).playing && (await read()).phase === flatPhase && await svgLayer(0).evaluate(el => el === document.activeElement), 'Space cancels the same vector focus without losing focus or starting playback');
  await page.keyboard.press('Enter'); await frames();
  await phase(1000); const svgEnd = await validateSvg('SVG fully separated');
  await phase(200); const svgEarly = await validateSvg('SVG partial separation');
  await phase(1000); const svgEndAgain = await validateSvg('SVG reverse seek');
  check(!same(svgEnd.svg.layers, svgEarly.svg.layers) && same(svgEnd.svg, svgEndAgain.svg), 'vector seeking changes the separation and exactly restores the same highlighted exhibit');
  await phase(600); await page.setViewportSize({ width: 390, height: 844 }); await frames();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone vector exhibit and controls have no horizontal overflow');
  const phone = await page.locator('.flat-model-svg').evaluate(svg => {
    const bounds = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text')].map(el => { const r = el.getBoundingClientRect(), m = el.getScreenCTM(); return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b) }; });
    return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, labels };
  });
  check(phone.labels.length === 2 && phone.labels.every(label => label.left >= phone.bounds.left - 1 && label.right <= phone.bounds.right + 1 && label.top >= phone.bounds.top - 1 && label.bottom <= phone.bounds.bottom + 1), 'phone fallback keeps both locality labels inside its diagram');
  await page.screenshot({ path: 'output/playwright/strata-phone.png' });
  await page.setViewportSize({ width: 1366, height: 900 }); await frames();
  const before3d = await validateSvg('SVG before return');
  await page.locator('#cContents').click(); await page.locator('#mode').click(); await ready(); await frames();
  const returned3d = await read(); validateModel(returned3d, 'returned Three.js view');
  check(!returned3d.twoD && returned3d.phase === before3d.state.phase && returned3d.selection === before3d.state.selection && !returned3d.playing, 'returning to Three.js preserves the current vector evidence and stays paused');
  check(before3d.svg.layers.every((layer, index) => Math.abs(layer.offsetY - returned3d.model.layerGroups[index].offsetY) < .00006), 'round trip between vector and physical exhibits retains all six layer displacements');
  states.push({ name: 'mode-and-device-evidence', restoredPair, restoredHigh, before2d, fallback, svgEnd, svgEarly, phone, before3d, returned3d });
  return { base, checks, failures, errors, labelIssues, states, targets,
    evidenceScope: 'Real Chrome pointer/keyboard interactions and shared-state consistency. Screenshots require visual review; desktop tablet viewport checks do not certify real touch hardware.' };
}
