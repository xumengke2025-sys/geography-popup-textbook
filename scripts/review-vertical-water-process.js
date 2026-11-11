async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [], layoutIssues = [], screenshots = [];
  const storageKey = 'pep-geography-first-original-v2';
  const check = (ok, name) => (ok ? checks : failures).push(name);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const near = (a, b) => typeof a === 'number' || typeof b === 'number' ? close(a, b)
    : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => near(v, b[i]))
      : a && b && typeof a === 'object' && typeof b === 'object' ? equal(Object.keys(a), Object.keys(b)) && Object.keys(a).every(k => near(a[k], b[k])) : a === b;
  const digest = value => { const str = JSON.stringify(value); let hash = 2166136261; for (let i = 0; i < str.length; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 16777619); return hash >>> 0; };
  const contracts = {
    atmosphere: { kind: 'atmosphere-height-observation', stops: [.12, .42, .82], labels: ['对流层', '平流层', '高层大气'] },
    forest: { kind: 'forest-strata-observation', stops: [0, .5, 1], labels: ['乔木层', '灌木层', '草本层'] },
    water: [
      { kind: 'water-cycle-process', stops: [.18, .34, .48, .64, .84, 1], labels: ['海水蒸发', '水汽输送', '凝结成云', '陆地降水', '两路回流', '回到海洋'] },
      { kind: 'water-cycle-process', stops: [.26, .52, .82, 1], labels: ['蒸发与蒸腾', '陆地凝结', '陆地降水', '补给陆地'] },
      { kind: 'water-cycle-process', stops: [.26, .52, .86, 1], labels: ['海水蒸发', '海上凝结', '海面降水', '回到海洋'] },
    ],
  };
  const contract = s => s.id === 'water' ? contracts.water[s.selection] : contracts[s.id];
  let fatal = null;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === id && !d.turning && !d.figureBusy && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const read = () => page.evaluate(key => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b?.entry?.art?.geometry;
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        hidden: el.hidden || style.display === 'none' || style.visibility === 'hidden' || !r.width || !r.height }; };
    const hash = attribute => { if (!attribute) return null; let value = 2166136261;
      for (const byte of new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)) value = Math.imul(value ^ byte, 16777619);
      return value >>> 0; };
    // A review-owned WeakMap observes buffer identities without adding fields to production objects.
    const refs = window.__verticalWaterReviewBufferRefs ??= { map: new WeakMap(), next: 1 };
    const bufferId = attribute => { if (!attribute) return null; if (!refs.map.has(attribute.array)) refs.map.set(attribute.array, refs.next++); return refs.map.get(attribute.array); };
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const meshes = !d.twoD && g ? g.meshes.map(mesh => ({
      role: mesh.userData.atmosphereRole ?? mesh.userData.forestRole ?? mesh.userData.waterCycleRole ?? mesh.userData.role ?? mesh.name ?? '',
      layer: mesh.userData.atmosphereLayer ?? mesh.userData.forestLayer,
      plantIds: mesh.userData.forestPlantIds, partIds: mesh.userData.forestPartIds, sampleId: mesh.userData.waterSampleId,
      input: mesh.userData.modelInput?.kind, selection: mesh.userData.modelInput?.selection, kind: mesh.userData.kind,
      mesh: mesh.uuid, geometry: mesh.geometry.uuid, positionBuffer: bufferId(mesh.geometry.attributes.position), indexBuffer: bufferId(mesh.geometry.index),
      positions: mesh.geometry.attributes.position.count, hash: hash(mesh.geometry.attributes.position), indexHash: hash(mesh.geometry.index),
      finite: Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite), visible: visible(mesh),
      position: mesh.position.toArray(), scale: mesh.scale.toArray(), world: mesh.getWorldPosition(b.camera.position.clone().set(0, 0, 0)).toArray(),
      material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => ({ type: m.type, color: m.color?.toArray().map(Math.fround),
        emissive: m.emissive?.toArray().map(Math.fround), opacity: m.opacity, transparent: m.transparent, map: m.map?.uuid ?? null })),
    })) : [];
    const svg = document.querySelector('.flat-concept > svg'), markup = svg?.outerHTML ?? ''; let svgHash = 2166136261;
    for (let i = 0; i < markup.length; i++) svgHash = Math.imul(svgHash ^ markup.charCodeAt(i), 16777619);
    const note = document.querySelector('#process-note'), range = document.querySelector('#phase');
    let saved = null; try { saved = JSON.parse(localStorage.getItem(key) ?? 'null')?.figures?.[d.active] ?? null; } catch {}
    const parse = name => svg?.hasAttribute(name) ? JSON.parse(svg.getAttribute(name)) : null;
    return { id: d.active, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, twoD: d.twoD, process: d.process, model: d.render?.geometry ?? null, labels: d.render?.labels ?? [], meshes,
      root: !d.twoD && g ? { position: g.root.position.toArray(), scale: g.root.scale.toArray() } : null,
      flow: !d.twoD && g ? [...g.flow, ...g.accentStrokes].map(line => ({ width: line.width, points: line.points.map(p => p.toArray()) })) : [],
      range: { value: Number(range.value), progress: range.style.getPropertyValue('--process-progress'),
        text: range.getAttribute('aria-valuetext'), focused: document.activeElement === range,
        label: document.querySelector('label[for="phase"]').textContent, box: box(range) },
      nodes: Array.from(document.querySelectorAll('#figure-controls [data-process-node]'), n => ({ index: Number(n.dataset.processNode),
        text: n.textContent.trim(), pressed: n.getAttribute('aria-pressed'), box: box(n), parent: n.parentElement.id })),
      choices: Array.from(document.querySelectorAll('#selections [data-selection]:not([data-process-node])'), n => ({ index: Number(n.dataset.selection),
        text: n.textContent.trim(), pressed: n.getAttribute('aria-pressed'), box: box(n) })),
      nodeRail: { ...box(document.querySelector('#process-stops')), scrollWidth: document.querySelector('#process-stops').scrollWidth,
        clientWidth: document.querySelector('#process-stops').clientWidth, scrollLeft: document.querySelector('#process-stops').scrollLeft },
      note: { ...box(note), position: note.dataset.position, title: document.querySelector('#process-title').textContent,
        stage: document.querySelector('#process-stage').textContent, text: document.querySelector('#process-text').textContent,
        titleFont: parseFloat(getComputedStyle(document.querySelector('#process-title')).fontSize),
        textFont: parseFloat(getComputedStyle(document.querySelector('#process-text')).fontSize) },
      header: box(document.querySelector('#desk-header')), dock: box(document.querySelector('.capsule')), modelBounds: b?.processBounds ?? null,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollY },
      svg: svg ? { ...box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])), hash: svgHash >>> 0,
        images: svg.querySelectorAll('image').length, bytes: markup.length,
        atmosphere: parse('data-atmosphere-state'), water: parse('data-water-cycle-state'),
        forestPlants: Array.from(svg.querySelectorAll('[data-forest-plant]'), el => ({ id: el.dataset.forestPlant, layer: Number(el.dataset.forestLayer), shape: el.innerHTML })),
        forestHeight: Number(svg.querySelector('[data-forest-observation-plane]')?.getAttribute('data-height')),
        samples: Array.from(svg.querySelectorAll('[data-water-sample]'), el => ({ id: el.dataset.waterSample, medium: el.dataset.medium,
          position: JSON.parse(el.dataset.position) })),
        labels: Array.from(svg.querySelectorAll('text'), el => { const r = el.getBoundingClientRect(), matrix = el.getScreenCTM();
          return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            fontPx: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(matrix.a, matrix.b), opacity: Number(getComputedStyle(el).opacity) }; }),
      } : null, reduced: document.querySelector('#reduced').checked, saved };
  }, storageKey);
  const buffers = s => s.meshes.map(m => [m.mesh, m.geometry, m.positionBuffer, m.indexBuffer, m.positions, m.hash, m.indexHash]);
  const geometry = s => [s.meshes.map(m => [m.role, m.hash, m.position, m.scale, m.visible, m.material]), s.flow];
  const plants = s => s.meshes.filter(m => m.role.startsWith('plant-')).map(m => [m.role, m.plantIds, m.partIds, m.hash, m.position, m.scale, m.visible, m.material]);
  const snapshot = s => { const { meshes, flow, ...rest } = s; return { ...rest, meshCount: meshes.length, vertexBufferDigest: digest(buffers(s)),
    geometryDigest: digest(geometry(s)), flowCount: flow.length, meshes: meshes.map(m => ({ role: m.role, mesh: m.mesh, geometry: m.geometry,
      positionBuffer: m.positionBuffer, indexBuffer: m.indexBuffer, hash: m.hash, positions: m.positions, visible: m.visible, layer: m.layer, sampleId: m.sampleId })) }; };
  const pause = async () => { if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); } };
  const setReduced = async value => { if (await page.locator('#reduced').isChecked() === value) return;
    await page.locator('#desk-settings').click(); await page.locator('#reduced').setChecked(value);
    await page.locator('#settings-dialog [data-close]').click(); await frames(); };
  const go = async (id, mode = '3d') => { await page.goto(`${base}/?figure=${id}&${mode}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ready(id); await frames(); await setReduced(false); await pause(); };
  const phase = async value => { await pause(); const range = page.locator('#phase'); await range.focus();
    if (value <= 500) { await range.press('Home'); for (let i = 0; i < Math.floor(value / 100); i++) await range.press('PageUp');
      for (let i = 0; i < value % 100; i++) await range.press('ArrowRight');
    } else { await range.press('End'); const rest = 1000 - value;
      for (let i = 0; i < Math.floor(rest / 100); i++) await range.press('PageDown'); for (let i = 0; i < rest % 100; i++) await range.press('ArrowLeft'); }
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
    return read(); };
  const choose = async index => { const before = await read(); if (before.selection !== index) {
    await page.locator(`#selections [data-selection="${index}"]:not([data-process-node])`).click(); await frames(); await pause(); }
    const after = await read(); check(after.selection === index && !after.playing && !after.process.seeking, `water/condition-${index}: actual independent cycle choice selects only its own condition`);
    return after; };
  const settled = async () => { if ((await read()).twoD) { await page.waitForTimeout(850); await frames(); return; }
    let previous = null, stable = 0; for (let i = 0; i < 100; i++) {
      const next = await page.evaluate(() => [...window.textbookDebug.camera.position.toArray(), ...window.textbookDebug.camera.quaternion.toArray()]);
      stable = previous && next.every((v, j) => Math.abs(v - previous[j]) < .000005) ? stable + 1 : 0;
      if (stable >= 4) return; previous = next; await page.waitForTimeout(75); }
    throw Error('Vertical/water camera did not settle before physical pointer or layout sampling'); };
  const sameCamera = (a, b) => a && b && a.position.every((v, i) => close(v, b.position[i], .0001))
    && a.quaternion.every((v, i) => close(v, b.quaternion[i], .000001)) && a.orbit === b.orbit && a.elevation === b.elevation;
  const inspect = (s, name) => {
    const c = contract(s);
    check(!!c && !!s.process && equal(s.nodes.map(n => n.text), c.labels), `${name}: agreed process nodes are present in order`);
    check(close(s.range.value, Math.round(s.phase * 1000), 1e-7) && close(parseFloat(s.range.progress), s.phase * 100, 1e-7), `${name}: native range thumb and fill share the actual model phase`);
    check(!!s.process && equal(s.nodes.filter(n => n.pressed === 'true').map(n => n.index), [s.process.activeStop]), `${name}: exactly the current teaching node is highlighted`);
    check(s.note.title === s.process?.title && s.note.stage === s.process?.stage && s.note.text === s.process?.text && s.range.text?.includes(s.process.title), `${name}: note, slider and accessible wording describe one state`);
    check(s.id === 'water' ? s.choices.length === 3 && equal(s.choices.filter(n => n.pressed === 'true').map(n => n.index), [s.selection])
      : s.choices.length === 0 && s.range.label === '观察位置', `${name}: independent conditions remain distinct from observation or process bookmarks`);
    if (s.twoD) return;
    const m = s.model;
    check(m?.kind === c.kind && close(m.phase, s.phase) && m.selection === s.selection && m.stageIndex === s.process.activeStop,
      `${name}: raised Three.js model, phase, condition and node share one state`);
    check(m?.bitmapSurfaces === 0 && m?.imageMappedMeshes === 0 && m?.originalPagePreserved === true,
      `${name}: original textbook is preserved below genuine geometry without model bitmap surfaces`);
    check(s.meshes.length > 0 && s.meshes.every(m => m.finite) && s.root.position[1] > 0, `${name}: finite real geometry occupies the space above the page`);
    if (s.id === 'atmosphere') {
      check(m.fixedBuffers && m.sharedFlatState && m.volumeSection && m.units === 'schematic-height' && m.heightIsTime === false
        && !m.calibratedHeight && !m.calibratedTemperature && !m.upperTemperatureMonotonic && m.motionIsDominantNotExclusive,
      `${name}: altitude is a qualitative observation, with nonmonotonic upper temperature and dominant rather than exclusive motions`);
      check(equal(m.probe, m.profilePoint) && near(m.probeWorld, m.profilePointWorld), `${name}: actual temperature probe lies on the shared profile point`);
      check(s.meshes.filter(m => m.role === 'layer-sheet').length === 3 && s.meshes.filter(m => m.role === 'layer-sheet').every(m => m.visible),
        `${name}: all three atmospheric volume layers remain visible while the probe moves`);
      check(m.selectedLayer === ['troposphere', 'stratosphere', 'upper-atmosphere'][s.selection] && s.note.title === m.caption,
        `${name}: selected atmospheric layer and explanation agree`);
    } else if (s.id === 'forest') {
      const ids = [...new Set(s.meshes.flatMap(m => m.plantIds ?? []))].sort();
      check(m.allLayersRetained && m.plantStructuresAreStatic && m.allPlantMeshesVisible && m.geometryBuffersReused
        && m.phaseMeaning === 'vertical-observation-position' && !m.phaseMeansElapsedTime && !m.depictsGrowth && !m.depictsSuccession
        && !m.heightsAreMeasured && !m.lightIsMeasured, `${name}: this is one retained forest, not growth, succession or measured illuminance`);
      check(m.plantCount === 25 && equal(m.layerPlantCounts, [5, 6, 14]) && equal(ids, m.plants.map(p => p.id).sort())
        && s.meshes.filter(m => m.role.startsWith('plant-')).every(m => m.visible), `${name}: actual solid meshes retain all 25 plants across three coexisting strata`);
      check(close(m.observationHeight, 42 - 39 * s.phase) && close(m.relativeLight, 1 - .84 * s.phase)
        && s.note.title === m.selectedLayer && s.note.text === m.caption, `${name}: observation height, relative light and forest explanation move together`);
    } else {
      const ids = Array.from({ length: 6 }, (_, i) => `water-0${i + 1}`), reference = m.reference;
      check(equal(m.samples.map(s => s.id), ids) && m.stableSampleIdentities && !m.samplesRespawn && m.units === 'finite-symbolic-tracers',
        `${name}: six finite water tracers retain their identities instead of respawning particles`);
      check(reference.cyclesAreIndependentSelections && reference.progressMeansTeachingOrder && reference.sampleCountIsNotWaterAmount
        && reference.branchCountsAreNotRunoffFractions && reference.vaporIsInvisible && reference.vaporMarksAreSymbols
        && reference.cloudIsCondensedLiquidWater && !reference.measuredFlowRate && !reference.measuredTime && !reference.measuredWaterBudget,
      `${name}: independent cycle types, invisible vapor, condensed clouds and symbolic timing remain explicit`);
      check(m.geometryBuffersReused && m.processNodesAreNotCycleSelections && !m.cyclic && m.distinctSurfaceAndSubsurfaceReturns,
        `${name}: process bookmarks and separate surface/cutaway routes reuse a finite scene`);
      check(m.inventory.total === 6 && Object.entries(m.inventory).filter(([k]) => k !== 'total').reduce((sum, [, n]) => sum + n, 0) === 6,
        `${name}: source, atmosphere and retained returns account for exactly the same six tracers`);
      check(m.samples.every(sample => sample.position.every(Number.isFinite) && sample.route.length > 0
        && sample.route.every(leg => leg.start < leg.end && leg.points.every(p => p.every(Number.isFinite)))), `${name}: every tracer follows a finite deterministic route`);
      check(m.samples.every(sample => { const actual = s.meshes.filter(mesh => mesh.sampleId === sample.id && mesh.visible);
        const role = sample.medium === 'vapor' ? 'symbolic-vapor-mark' : sample.medium === 'rain' ? 'persistent-rain-mark' : 'persistent-liquid-mark';
        return actual.length === 1 && actual[0].role === role && near(actual[0].world, m.sampleWorld.find(p => p.id === sample.id)?.point); }),
      `${name}: exactly one actual phase-appropriate solid per tracer occupies its shared world position`);
      if (s.selection === 1) check(m.samples.every(sample => sample.destination === 'land' && sample.branch === 'land-return')
        && equal([...new Set(m.samples.map(sample => sample.source))].sort(), ['land-water', 'plant']), `${name}: land interior recycling retains water on land and includes transpiration`);
      if (s.selection === 2) check(m.samples.every(sample => sample.source === 'sea' && sample.destination === 'sea' && sample.branch === 'sea-return'),
        `${name}: marine interior recycling stays on its sea return route`);
      if (s.phase === 1) check(m.endpointRetained && m.inventory.returned === 6 && m.samples.every(sample => sample.returned), `${name}: completed tracers remain at their receiver for comparison`);
    }
  };
  const startTrace = () => page.evaluate(() => {
    if (window.__verticalWaterReviewTrace) window.__verticalWaterReviewTrace.active = false;
    const trace = { active: true, start: performance.now(), samples: [] }; window.__verticalWaterReviewTrace = trace;
    const sample = () => { if (!trace.active) return; const d = window.textbookDiagnostics, svg = document.querySelector('.flat-concept > svg');
      trace.samples.push({ ms: performance.now() - trace.start, phase: d.state?.phase, selection: d.state?.selection,
        seeking: d.process?.seeking, playing: d.playing, stop: d.process?.activeStop, processKey: d.process?.key,
        title: document.querySelector('#process-title').textContent, processTitle: d.process?.title,
        range: Number(document.querySelector('#phase').value), modelPhase: d.render?.geometry?.phase,
        modelSelection: d.render?.geometry?.selection, modelStage: d.render?.geometry?.stageIndex,
        svgPhase: svg ? Number(svg.getAttribute('data-atmosphere-phase') ?? svg.getAttribute('data-forest-phase') ?? svg.getAttribute('data-water-cycle-phase')) : null,
        pressed: Array.from(document.querySelectorAll('#figure-controls [data-process-node][aria-pressed="true"]'), n => Number(n.dataset.processNode)) });
      if (trace.samples.length < 2000) requestAnimationFrame(sample); }; requestAnimationFrame(sample);
  });
  const finishTrace = () => page.evaluate(() => { const trace = window.__verticalWaterReviewTrace; trace.active = false;
    return { elapsedMs: performance.now() - trace.start, samples: trace.samples }; });
  const inspectTrace = (trace, name, twoD) => {
    check(trace.samples.length >= 2 && trace.samples.every(s => s.range === Math.round(s.phase * 1000) && s.title === s.processTitle
      && equal(s.pressed, [s.stop])), `${name}: range, note and active bookmark follow every sampled transition frame`);
    check(trace.samples.every(s => twoD ? close(s.svgPhase, s.phase, .000501) : close(s.modelPhase, s.phase)
      && s.modelSelection === s.selection && s.modelStage === s.stop), `${name}: rendered model follows each actual intermediate playhead state`);
  };
  const seek = async index => { const before = await read(), c = contract(before), to = c.stops[index], name = `${before.id}/${before.selection}/node-${index}/${before.twoD ? 'svg' : 'solid'}`;
    await startTrace(); await page.locator(`#figure-controls [data-process-node="${index}"]`).click();
    await page.waitForFunction(to => { const d = window.textbookDiagnostics; return !d.process.seeking && Math.abs(d.state.phase - to) < 1e-8; }, to, { timeout: 15000 });
    await frames(); const after = await read(), trace = await finishTrace(); inspect(after, name); inspectTrace(trace, name, after.twoD);
    check(close(after.phase, to) && !after.playing && !after.process.seeking && after.process.activeStop === index, `${name}: shortcut arrives at the exact paused stage`);
    if (before.id === 'water') check(after.selection === before.selection, `${name}: selecting a process stage never changes the independent cycle type`);
    if (!close(before.phase, to) && !before.reduced) check(trace.samples.filter(s => s.seeking && !close(s.phase, before.phase, 1e-5) && !close(s.phase, to, 1e-5)).length >= 3,
      `${name}: actual shortcut visibly traverses intermediate states`);
    states.push({ name, before: snapshot(before), after: snapshot(after), trace }); return after; };
  const physicalTarget = async (kind = 'phase-track', selection) => {
    const target = await page.evaluate(({ kind, selection }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry; b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const r = b.renderer.domElement.getBoundingClientRect(), v = () => b.camera.position.clone().set(0, 0, 0);
      const candidates = g.meshes.filter(m => m.userData.modelInput?.kind === kind && (selection === undefined || m.userData.modelInput.selection === selection) && m.visible);
      const role = m => m.userData.atmosphereRole ?? m.userData.forestRole ?? m.userData.waterCycleRole ?? '';
      candidates.sort((a, b) => Number(role(b).includes('handle')) - Number(role(a).includes('handle')));
      for (const mesh of candidates) {
        const a = mesh.geometry.attributes.position, idx = mesh.geometry.index; mesh.geometry.computeBoundingBox();
        const points = [mesh.geometry.boundingBox.getCenter(v())], count = Math.floor((idx?.count ?? a.count) / 3), step = Math.max(1, Math.floor(count / 300));
        for (let i = 0; i < count; i += step) { const q = v(); for (let j = 0; j < 3; j++) q.add(v().fromBufferAttribute(a, idx ? idx.getX(i * 3 + j) : i * 3 + j)); points.push(q.multiplyScalar(1 / 3)); }
        for (const local of points) {
          const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera), x = r.left + (p.x + 1) * r.width / 2, y = r.top + (1 - p.y) * r.height / 2;
          if (x < 12 || x > innerWidth - 12 || y < 12 || y > innerHeight - 12 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const actual = b.pickModel(x, y);
          if (actual?.object === mesh && actual.input?.kind === kind) return { x, y, mesh: mesh.uuid, role: role(mesh), label: actual.input.label, kind, selection: actual.input.selection };
        }
      } return null;
    }, { kind, selection });
    check(!!target, `${(await read()).id}: actual ${kind} geometry is reachable through the live raycaster`);
    if (!target) throw Error(`No exposed vertical/water ${kind} target`); targets.push(target); return target;
  };
  const drag = async requested => {
    await settled(); const target = await physicalTarget(), before = await read(), name = `${before.id}/${before.selection}/physical-drag-${before.viewport.width}`;
    await page.mouse.move(target.x, target.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === target.label, `${name}: hover exposes the meaning of the actual raised handle`);
    await page.mouse.down(); await frames(); const grasp = await read();
    check(!grasp.playing && close(grasp.phase, before.phase), `${name}: grasping the phase control pauses without a jump`);
    const offset = await page.evaluate(({ x, y, mesh }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const origin = g.root.worldToLocal(b.ray.ray.origin.clone()), direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), t = window.textbookDiagnostics.state.phase;
      return [track.start[0] + (track.end[0] - track.start[0]) * t - p.x, track.start[1] + (track.end[1] - track.start[1]) * t - p.y];
    }, target);
    const points = await page.evaluate(({ requested, offset, mesh }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track, r = b.renderer.domElement.getBoundingClientRect();
      return requested.map(phase => { const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0],
        track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]); p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; });
    }, { requested, offset, mesh: target.mesh });
    const samples = [];
    try { for (const p of points) { await page.mouse.move(p.x, p.y, { steps: 7 }); await frames(); const s = await read(); samples.push(snapshot(s)); inspect(s, `${name}/${p.phase}`);
      check(close(s.phase, p.phase, .002) && !s.playing, `${name}: genuine positive/reverse pointer motion reaches ${p.phase}`);
      check(sameCamera(before.camera, s.camera), `${name}/${p.phase}: scrubbing the real handle does not orbit the camera`); }
    } finally { await page.mouse.up(); }
    await frames(); const released = await read(); await page.waitForTimeout(250); const held = await read();
    check(released.phase === held.phase && !held.playing && equal(geometry(released), geometry(held)), `${name}: release preserves a stationary result`);
    check(close(held.saved?.phase, held.phase) && held.saved.selection === held.selection, `${name}: physical release saves the exact phase and independent selection`);
    states.push({ name, target, before: snapshot(before), grasp: snapshot(grasp), offset, samples, released: snapshot(released), held: snapshot(held) }); return held;
  };
  const inspectSvg = (s, solid, name) => {
    inspect(s, name);
    check(s.twoD && close(s.phase, solid.phase) && s.selection === solid.selection && !s.playing && s.process.key === solid.process.key,
      `${name}: SVG restores the same paused input and explanation as the solid`);
    check(!!s.svg && s.svg.images === 0 && s.svg.bytes > 300, `${name}: fallback is native interactive vector geometry, not an image`);
    if (s.id === 'atmosphere') check(!!s.svg.atmosphere && equal(s.svg.atmosphere,
      Object.fromEntries(Object.keys(s.svg.atmosphere).map(k => [k, solid.model[k]]))), `${name}: every shared atmospheric scientific field matches the solid exactly`);
    else if (s.id === 'forest') check(close(Number(s.svg.attrs['data-forest-phase']), solid.phase, .000501)
      && s.svg.attrs['data-forest-stage'] === solid.model.stage && Number(s.svg.attrs['data-forest-selection']) === solid.selection
      && close(s.svg.forestHeight, solid.model.observationHeight, .000501) && close(Number(s.svg.attrs['data-forest-light']), solid.model.relativeLight, .000501)
      && equal(s.svg.forestPlants.map(p => ({ id: p.id, layer: p.layer })).sort((a, b) => a.id.localeCompare(b.id)),
        solid.model.plants.map(p => ({ id: p.id, layer: p.layer })).sort((a, b) => a.id.localeCompare(b.id))),
    `${name}: vector forest preserves all plant identities, vertical probe and the same relative light`);
    else check(!!s.svg.water && equal(s.svg.water, Object.fromEntries(Object.keys(s.svg.water).map(k => [k, solid.model[k]])))
      && equal(s.svg.samples, solid.model.samples.map(sample => ({ id: sample.id, medium: sample.medium, position: sample.position }))),
    `${name}: vector water uses the exact same six identities, physical positions, mediums, inventory and independent cycle`);
  };
  const inspectLayout = async name => {
    await page.waitForFunction(() => !document.querySelector('#process-note').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(850); await settled(); await frames(); const s = await read(), vp = s.viewport;
    const overlap = (a, b) => !!a && !!b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const inside = b => !!b && b.left >= -1 && b.right <= vp.width + 1 && b.top >= -1 && b.bottom <= vp.height + 1;
    const clippedInside = (b, rail) => b.top >= rail.top - 1 && b.bottom <= rail.bottom + 1;
    const issues = [];
    if (!s.note || s.note.hidden || !inside(s.note)) issues.push('note outside viewport');
    if (overlap(s.note, s.header)) issues.push('note overlaps header');
    if (overlap(s.note, s.dock)) issues.push('note overlaps dock');
    if (vp.scrollWidth > vp.width + 1) issues.push('horizontal page overflow');
    if (!s.twoD && overlap(s.note, s.modelBounds)) issues.push('note overlaps physical model');
    if (s.twoD && (overlap(s.svg, s.note) || overlap(s.svg, s.dock) || overlap(s.svg, s.header))) issues.push('vector diagram overlaps note/header/dock');
    if (!inside(s.dock) || !inside(s.range.box) || s.choices.some(n => !inside(n.box))) issues.push('dock, range or independent condition outside viewport');
    for (const n of s.nodes) {
      if (n.parent !== 'process-stops') { if (!inside(n.box)) issues.push(`node ${n.index} outside viewport`); continue; }
      if (!inside(s.nodeRail) || !clippedInside(n.box, s.nodeRail)) issues.push(`node ${n.index} outside its clipped scroll rail`);
      if (n.pressed === 'true' && (n.box.left < s.nodeRail.left - 1 || n.box.right > s.nodeRail.right + 1)) issues.push('active node was not scrolled into view');
    }
    check(!issues.length, `${name}: note, controls and demonstration remain separate within the viewport; inactive rail content may scroll`);
    check(s.note.titleFont >= (vp.width < 680 ? 17 : 18) && s.note.textFont >= (vp.width < 680 ? 15 : 17), `${name}: process explanation meets the project reading sizes`);
    const labels = s.twoD ? s.svg.labels.filter(l => l.text?.trim() && l.opacity > .05 && l.right - l.left > 1 && l.bottom - l.top > 1) : s.labels;
    const minimum = vp.width < 680 ? 15 : 18;
    const bad = labels.filter(l => l.fontPx < minimum || !inside(l) || overlap(l, s.note) || overlap(l, s.dock) || overlap(l, s.header));
    const collisions = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.text, b.text]));
    check(labels.length > 0 && !bad.length && !collisions.length, `${name}: actual labels remain readable (${minimum}px), separate and unobstructed`);
    if (bad.length || collisions.length) labelIssues.push({ name, viewport: vp, minimumFontPx: minimum, labels, bad, collisions });
    if (issues.length) layoutIssues.push({ name, note: s.note, svg: s.svg, dock: s.dock, header: s.header, nodeRail: s.nodeRail, modelBounds: s.modelBounds, issues });
    states.push({ name, ...snapshot(s) }); return s;
  };
  const capture = async name => { const path = `output/playwright/vertical-water-${name}.png`; await page.screenshot({ path }); screenshots.push(path); };
  const toggleMode = async () => { await page.locator('#cContents').click(); await page.locator('#mode').click(); };
  const switchMode = async solid => { await toggleMode(); await ready(solid.id); await frames(); const flat = await read();
    inspectSvg(flat, solid, `${solid.id}/${solid.selection}/actual-mode-switch`); return flat; };
  try {
    const solids = {};
    await page.setViewportSize({ width: 1366, height: 900 });
    for (const id of ['atmosphere', 'forest', 'water']) {
      await go(id); if (id === 'water') await choose(0);
      const first = await phase(0); inspect(first, `${id}/initial`);
      for (let i = 0; i < contract(first).stops.length; i++) await seek(i);
      const last = await read();
      check(!equal(geometry(first), geometry(last)), `${id}: actual raised geometry changes when the student changes the shared observation`);
      check(equal(buffers(first), buffers(last)), `${id}: actual mesh objects and typed vertex/index buffers are reused across all nodes`);
      if (id === 'forest') check(equal(plants(first), plants(last)), 'forest: every actual plant structure, placement and visibility survives the full vertical observation');
      for (let i = contract(first).stops.length - 2; i >= 0; i--) await seek(i);
      const reference = await phase(430); await phase(910); await phase(150); const returned = await phase(430);
      check(equal(geometry(reference), geometry(returned)) && equal(reference.model, returned.model), `${id}: native forward/reverse scrubbing restores identical scientific state and actual geometry`);
      const dragged = await drag([.43, .91, .15, .43]);
      const sameMeshes = reference.meshes.length === dragged.meshes.length && reference.meshes.every((m, i) => {
        const b = dragged.meshes[i]; return equal([m.role, m.hash, m.visible, m.material], [b.role, b.hash, b.visible, b.material]) && near(m.position, b.position) && near(m.scale, b.scale); });
      check(sameMeshes && near(reference.flow, dragged.flow), `${id}: real ray-inverted dragging returns to native geometry within 1e-8 transform precision and exact vertex/material precision`);
      states.push({ name: `${id}/native-vs-physical`, reference: snapshot(reference), physical: snapshot(dragged),
        phaseDifference: dragged.phase - reference.phase, exactFlow: equal(reference.flow, dragged.flow), transformTolerance: 1e-8 });
      if (id !== 'water') {
        await phase(1000); await settled(); const target = await physicalTarget('select', 0); await startTrace(); await page.mouse.click(target.x, target.y);
        const to = contracts[id].stops[0]; await page.waitForFunction(to => !window.textbookDiagnostics.process.seeking && Math.abs(window.textbookDiagnostics.state.phase - to) < 1e-8, to, { timeout: 15000 });
        await frames(); const picked = await read(), trace = await finishTrace(); inspect(picked, `${id}/actual-layer-selection`); inspectTrace(trace, `${id}/actual-layer-selection`, false);
        check(!picked.playing && picked.process.activeStop === 0 && picked.selection === 0, `${id}: clicking the actual raised layer seeks the common observation position`);
        states.push({ name: `${id}/actual-layer-selection`, target, after: snapshot(picked), trace });
      }
      await phase(990); await page.locator('#cPause').click();
      await page.waitForFunction(() => window.textbookDiagnostics.state.phase === 1 && !window.textbookDiagnostics.playing, null, { timeout: 7000 });
      await frames(); const endpoint = await read(); await page.waitForTimeout(250); const retained = await read();
      check(endpoint.phase === retained.phase && !retained.playing && equal(geometry(endpoint), geometry(retained)), `${id}: finite playback stops at the end and retains the observed result`);
      solids[`${id}/0`] = retained; inspect(retained, `${id}/retained-endpoint`); await inspectLayout(`desktop/${id}`); await capture(`desktop-${id}`);
      const flat = await switchMode(retained); await toggleMode(); await ready(id); await frames(); const back = await read();
      check(!back.playing && close(back.phase, retained.phase) && back.selection === retained.selection && back.process.key === retained.process.key,
        `${id}: actual switch back to Three.js restores the shared condition paused`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready(id); await frames(); const restored = await read();
      check(close(restored.phase, retained.phase) && restored.selection === retained.selection && !restored.playing && restored.process.key === retained.process.key,
        `${id}: refresh restores the exact observation and bookmark paused`);
      states.push({ name: `${id}/switch-and-refresh`, solid: snapshot(retained), flat: snapshot(flat), back: snapshot(back), restored: snapshot(restored) });
    }
    // Additional scientific comparisons use visible native range input, not test setters.
    await go('atmosphere');
    const atmo = {}; for (const value of [120, 200, 260, 280, 420, 650, 740, 900]) atmo[value] = (await phase(value)).model;
    check(atmo[120].relativeTemperature > atmo[200].relativeTemperature && close(atmo[260].relativeTemperature, atmo[280].relativeTemperature)
      && atmo[420].localTemperatureTendency === 'increasing' && atmo[650].relativeTemperature > atmo[740].relativeTemperature
      && atmo[900].relativeTemperature > atmo[740].relativeTemperature, 'atmosphere: native input demonstrates cooling, the lower-stratosphere plateau, warming and the upper cooling/warming reversal');
    states.push({ name: 'atmosphere/temperature-evidence', states: atmo });
    await go('water');
    for (const selection of [0, 1, 2]) {
      const chosen = await choose(selection); inspect(chosen, `water/condition-${selection}/chosen`);
      const start = await phase(0); for (let i = 0; i < contracts.water[selection].stops.length; i++) await seek(i);
      const finish = await read(); check(equal(buffers(start), buffers(finish)), `water/condition-${selection}: cycle routes reuse all actual geometry buffers`);
      const reference = await phase(570); await phase(920); await phase(160); const returned = await phase(570);
      check(equal(reference.model, returned.model) && equal(geometry(reference), geometry(returned)), `water/condition-${selection}: reverse seek restores the same tracer identities, route positions and inventory`);
      const last = await phase(1000); inspect(last, `water/condition-${selection}/completed`); solids[`water/${selection}`] = last;
      await inspectLayout(`desktop/water-${selection}`); await capture(`desktop-water-${selection}`);
      const before = await read(); await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready('water'); await frames(); const after = await read();
      check(after.selection === selection && close(after.phase, before.phase) && !after.playing, `water/condition-${selection}: refresh retains cycle type separately from phase and remains paused`);
      states.push({ name: `water/condition-${selection}/restoration`, before: snapshot(before), after: snapshot(after) });
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const id of ['atmosphere', 'forest', 'water']) {
      await go(id); if (id === 'water') await choose(0); await phase(1000); await inspectLayout(`tablet-3d/${id}`); await capture(`tablet-3d-${id}`);
      await phase(370); await drag([.7, .28, .6]);
      await go(id, '2d'); if (id === 'water') await choose(0); await phase(1000); const flat = await read();
      inspectSvg(flat, solids[`${id}/0`], `tablet-2d/${id}`); await inspectLayout(`tablet-2d/${id}`); await capture(`tablet-2d-${id}`);
      const first = await phase(0); for (let i = 0; i < contract(first).stops.length; i++) await seek(i); const last = await read();
      check(first.svg.hash !== last.svg.hash, `${id}: native SVG changes through actual tablet-size process controls`);
      if (id === 'forest') check(equal(first.svg.forestPlants, last.svg.forestPlants), 'forest: vector observation retains the identical 25 plant silhouettes while its probe moves');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of ['atmosphere', 'forest', 'water']) {
      await go(id, '2d'); const selections = id === 'water' ? [0, 1, 2] : [0];
      for (const selection of selections) {
        if (id === 'water') await choose(selection); await phase(1000); const flat = await read(); inspectSvg(flat, solids[`${id}/${selection}`], `phone-2d/${id}-${selection}`);
        await inspectLayout(`phone-2d/${id}-${selection}`); await capture(`phone-2d-${id}-${selection}`);
        const start = await seek(0), end = await seek(contract(start).stops.length - 1);
        check(start.svg.hash !== end.svg.hash, `${id}/${selection}: phone vector remains operable through its actual process nodes`);
        await phase(0); await setReduced(true); await page.locator(`#figure-controls [data-process-node="${contract(start).stops.length - 1}"]`).click(); await frames(); const reduced = await read();
        check(reduced.reduced && close(reduced.phase, contract(start).stops.at(-1)) && !reduced.playing && !reduced.process.seeking,
          `${id}/${selection}: reduced motion uses the exact final shared state without a second animation state`);
        states.push({ name: `${id}/${selection}/reduced-motion`, after: snapshot(reduced) }); await setReduced(false);
      }
      if (id !== 'water') {
        await phase(1000); const node = page.locator(`.flat-concept [data-${id}-node="0"], .flat-concept [data-model-selection="0"]`).first(); await node.focus(); await startTrace(); await node.press('Enter');
        const to = contracts[id].stops[0]; await page.waitForFunction(to => !window.textbookDiagnostics.process.seeking && Math.abs(window.textbookDiagnostics.state.phase - to) < 1e-8, to, { timeout: 15000 });
        await frames(); const picked = await read(), trace = await finishTrace(), focus = await page.evaluate(() => document.activeElement?.getAttribute('data-model-selection'));
        check(close(picked.phase, to) && picked.selection === 0 && focus === '0' && !picked.playing, `${id}: native SVG keyboard activation seeks the shared layer and retains focus through redraws`);
        inspectTrace(trace, `${id}/vector-keyboard-selection`, true); states.push({ name: `${id}/vector-keyboard-selection`, after: snapshot(picked), focus, trace });
      }
    }
  } catch (error) {
    fatal = { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2500) };
    failures.push(`Fatal browser workflow: ${fatal.message}`);
    try { states.push({ name: 'fatal-workflow', snapshot: snapshot(await read()) }); await capture('fatal-workflow'); } catch {}
  }
  check(errors.length === 0, 'vertical-observation and water-cycle production workflows have no runtime or console errors');
  return { base, checks, failures, errors, fatal, labelIssues, layoutIssues, states, targets, screenshots,
    evidenceScope: 'Actual native range keyboard input, process-node and independent-condition clicks, mode switches, refreshes, SVG keyboard activation and ray-picked Three.js phase-track drags; only passive scientific/vertex/SVG sampling. No production state setter is invoked. Exact native reversibility uses raw geometry; ray inversion alone permits 1e-8 transform precision. Screenshots require visual inspection. Simulated tablet sizes do not certify real touch hardware or user aesthetic approval.' };
}
