async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], targets = [], labelIssues = [], layoutIssues = [], screenshots = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const storageKey = 'pep-geography-first-original-v2';
  let fatal = null;
  const contracts = {
    heating: { kind: 'air-heating-process', stops: [.28, .52, .82, 1], labels: ['太阳短波', '地面增温', '地面长波', '大气吸收'] },
    thermal: { kind: 'thermal-circulation-process', stops: [0, .24, .5, .74, 1], labels: ['受热均匀', '冷热不均', '垂直运动', '同高气压', '完整环流'] },
    remote: { kind: 'remote-sensing-process', stops: [.22, .45, .69, 1], labels: ['获取信息', '传输信息', '处理分析', '输出成果'] },
  };
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
    const box = element => {
      if (!element) return null;
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        hidden: element.hidden || style.display === 'none' || style.visibility === 'hidden' || !r.width || !r.height };
    };
    const hash = attribute => {
      if (!attribute) return null; let value = 2166136261;
      const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
      for (const byte of bytes) value = Math.imul(value ^ byte, 16777619); return value >>> 0;
    };
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const meshes = !d.twoD && g ? g.meshes.map(mesh => ({
      role: mesh.userData.airProcessRole ?? mesh.userData.airRole ?? mesh.userData.remoteRole ?? mesh.userData.role ?? mesh.name ?? '',
      sampleId: mesh.userData.remoteSampleId ?? mesh.userData.sampleId,
      copy: mesh.userData.remoteCopy ?? mesh.userData.copy,
      tone: mesh.userData.remoteTone ?? mesh.userData.tone,
      journey: mesh.userData.remoteJourney, journeyProgress: mesh.userData.remoteProgress,
      arrowId: mesh.userData.airArrowId, arrowReveal: mesh.userData.airReveal,
      arrowTipVertex: mesh.userData.airTipVertex === undefined ? null : (() => {
        const a = mesh.geometry.attributes.position, i = mesh.userData.airTipVertex, scale = g.width / 100;
        return [a.getX(i) / scale, a.getY(i) / scale, (a.getZ(i) + 96 + 72 * scale) / scale];
      })(),
      kind: mesh.userData.kind, input: mesh.userData.modelInput?.kind, selection: mesh.userData.modelInput?.selection,
      mesh: mesh.uuid, geometry: mesh.geometry.uuid, positionBuffer: mesh.geometry.attributes.position.uuid,
      positions: mesh.geometry.attributes.position.count, hash: hash(mesh.geometry.attributes.position), indexHash: hash(mesh.geometry.index),
      finite: Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite),
      position: mesh.position.toArray(), scale: mesh.scale.toArray(), visible: visible(mesh),
      opacity: Array.isArray(mesh.material) ? mesh.material.map(m => m.opacity) : mesh.material.opacity,
      // Colors reach WebGL as float32 uniforms, like the float32 vertices.
      // Compare that actual render precision exactly; retain raw phase below.
      material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => ({ type: m.type, color: m.color?.toArray().map(Math.fround),
        emissive: m.emissive?.toArray().map(Math.fround), opacity: m.opacity, transparent: m.transparent, map: m.map?.uuid ?? null })),
    })) : [];
    const svg = document.querySelector('.flat-concept > svg'), markup = svg?.outerHTML ?? ''; let svgHash = 2166136261;
    for (let i = 0; i < markup.length; i++) svgHash = Math.imul(svgHash ^ markup.charCodeAt(i), 16777619);
    const note = document.querySelector('#process-note'), range = document.querySelector('#phase');
    let saved = null; try { saved = JSON.parse(localStorage.getItem(key) ?? 'null')?.figures?.[d.active] ?? null; } catch {}
    return { id: d.active, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, twoD: d.twoD, process: d.process, model: d.render?.geometry ?? null,
      flow: !d.twoD && g ? [...g.flow, ...g.accentStrokes].map(line => ({ width: line.width, points: line.points.map(p => p.toArray()) })) : [],
      labels: d.render?.labels ?? [], meshes,
      range: { value: Number(range.value), progress: range.style.getPropertyValue('--process-progress'),
        text: range.getAttribute('aria-valuetext'), focused: document.activeElement === range },
      nodes: Array.from(document.querySelectorAll('#figure-controls [data-process-node]'), n => ({
        index: Number(n.dataset.processNode), text: n.textContent.trim(), pressed: n.getAttribute('aria-pressed'), box: box(n) })),
      note: { ...box(note), position: note.dataset.position, title: document.querySelector('#process-title').textContent,
        text: document.querySelector('#process-text').textContent, stage: document.querySelector('#process-stage').textContent,
        titleFont: parseFloat(getComputedStyle(document.querySelector('#process-title')).fontSize),
        textFont: parseFloat(getComputedStyle(document.querySelector('#process-text')).fontSize) },
      header: box(document.querySelector('#desk-header')), dock: box(document.querySelector('.capsule')),
      modelBounds: b?.processBounds ?? null,
      camera: b ? { position: b.camera.position.toArray(), quaternion: b.camera.quaternion.toArray(), orbit: b.orbit, elevation: b.elevation } : null,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      svg: svg ? { ...box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])),
        hash: svgHash >>> 0, images: svg.querySelectorAll('image').length, bytes: markup.length,
        airState: svg.hasAttribute('data-air-state') ? JSON.parse(svg.getAttribute('data-air-state')) : null,
        sources: Array.from(svg.querySelectorAll('[data-remote-sample]'), el => ({ id: el.dataset.remoteSample, tone: Number(el.dataset.tone) })),
        copies: Array.from(svg.querySelectorAll('[data-remote-copy]'), el => ({ id: el.dataset.sampleId, tone: Number(el.dataset.tone), copy: el.dataset.remoteCopy })),
        packets: Array.from(svg.querySelectorAll('[data-remote-packet]'), el => ({ id: el.dataset.sampleId, kind: el.dataset.remotePacket, progress: Number(el.dataset.progress) })),
        labels: Array.from(svg.querySelectorAll('text'), text => {
          const r = text.getBoundingClientRect(), matrix = text.getScreenCTM();
          return { text: text.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            fontPx: parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b),
            opacity: Number(getComputedStyle(text).opacity) };
        }) } : null,
      reduced: document.querySelector('#reduced').checked, saved,
    };
  }, storageKey);
  const pause = async () => { if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); } };
  const setReduced = async value => {
    if (await page.locator('#reduced').isChecked() === value) return;
    await page.locator('#desk-settings').click(); await page.locator('#reduced').setChecked(value);
    await page.locator('#settings-dialog [data-close]').click(); await frames();
  };
  const go = async (id, mode = '3d') => {
    await page.goto(`${base}/?figure=${encodeURIComponent(id)}&${mode}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ready(id); await frames(); await setReduced(false); await pause();
  };
  const phase = async value => {
    await pause(); const range = page.locator('#phase'); await range.focus();
    if (value <= 500) {
      await range.press('Home'); for (let i = 0; i < Math.floor(value / 100); i++) await range.press('PageUp');
      for (let i = 0; i < value % 100; i++) await range.press('ArrowRight');
    } else {
      await range.press('End'); const rest = 1000 - value;
      for (let i = 0; i < Math.floor(rest / 100); i++) await range.press('PageDown');
      for (let i = 0; i < rest % 100; i++) await range.press('ArrowLeft');
    }
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
    return read();
  };
  const settled = async () => {
    if ((await read()).twoD) { await page.waitForTimeout(850); await frames(); return; }
    let previous = null, stable = 0;
    for (let i = 0; i < 100; i++) {
      const current = await page.evaluate(() => [...window.textbookDebug.camera.position.toArray(), ...window.textbookDebug.camera.quaternion.toArray()]);
      stable = previous && current.every((v, j) => Math.abs(v - previous[j]) < .000005) ? stable + 1 : 0;
      if (stable >= 4) return;
      previous = current; await page.waitForTimeout(75);
    }
    throw Error('Air/remote camera did not settle before the physical-pointer or layout check');
  };
  const sameCamera = (a, b) => a && b && a.position.every((v, i) => close(v, b.position[i], .0001))
    && a.quaternion.every((v, i) => close(v, b.quaternion[i], .000001)) && a.orbit === b.orbit && a.elevation === b.elevation;
  const bufferSignature = s => s.meshes.map(m => [m.mesh, m.geometry, m.positions, m.indexHash]);
  const geometrySignature = s => [s.meshes.map(m => [m.role, m.hash, m.position, m.scale, m.visible, m.opacity, m.material]), s.flow];
  // A physical pointer is inverted through camera and mesh transforms. Keep
  // actual buffers/material/visibility/flow exact, with the same 1e-8 numeric
  // tolerance already used for phases on double-precision object transforms.
  const sameRayPickedGeometry = (a, b) => equal(a.flow, b.flow) && a.meshes.length === b.meshes.length && a.meshes.every((mesh, index) => {
    const other = b.meshes[index];
    return equal([mesh.role, mesh.hash, mesh.visible, mesh.opacity, mesh.material], [other.role, other.hash, other.visible, other.opacity, other.material])
      && mesh.position.every((v, i) => close(v, other.position[i])) && mesh.scale.every((v, i) => close(v, other.scale[i]));
  });
  const inspect = (s, name) => {
    const c = contracts[s.id];
    check(!!c && !!s.process && s.nodes.length === c.stops.length, `${name}: the lesson exposes its agreed process nodes`);
    check(close(s.range.value, Math.round(s.phase * 1000), 1e-7) && close(parseFloat(s.range.progress), s.phase * 100, 1e-7),
      `${name}: range thumb and fill use the exact lesson phase`);
    check(!!s.process && equal(s.nodes.filter(n => n.pressed === 'true').map(n => n.index), [s.process.activeStop]),
      `${name}: exactly the current stage node is highlighted`);
    check(!!s.process && s.note.title === s.process.title && s.note.stage === s.process.stage && s.note.text.length > 0
      && s.range.text?.includes(s.process.title), `${name}: visible and accessible explanation read the same process`);
    if (!s.twoD) {
      check(s.model?.kind === c.kind && close(s.model?.phase, s.phase) && s.model?.bitmapSurfaces === 0 && s.model?.imageMappedMeshes === 0,
        `${name}: production Three.js geometry uses the same phase without bitmap surfaces`);
      check(s.meshes.length > 0 && s.meshes.every(m => m.finite), `${name}: actual vertex buffers remain finite`);
      check(s.model.originalPagePreserved === true, `${name}: the original textbook page remains the base`);
      if (s.id === 'remote') inspectRemote(s, name); else inspectAir(s, name);
    }
  };
  const startTrace = () => page.evaluate(() => {
    if (window.__airRemoteReviewTrace) window.__airRemoteReviewTrace.active = false;
    const trace = { active: true, start: performance.now(), samples: [] }; window.__airRemoteReviewTrace = trace;
    const sample = () => {
      if (!trace.active) return;
      const d = window.textbookDiagnostics, range = document.querySelector('#phase');
      trace.samples.push({ ms: performance.now() - trace.start, phase: d.state?.phase, playing: d.playing,
        seeking: d.process?.seeking, stop: d.process?.activeStop, processKey: d.process?.key, caption: d.state?.caption,
        modelPhase: d.render?.geometry?.phase, modelStage: d.render?.geometry?.stage,
        range: Number(range.value), focused: document.activeElement === range,
        pressed: Array.from(document.querySelectorAll('#figure-controls [data-process-node][aria-pressed="true"]'), n => Number(n.dataset.processNode)) });
      if (trace.samples.length < 2000) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  const finishTrace = () => page.evaluate(() => {
    const trace = window.__airRemoteReviewTrace; trace.active = false;
    return { elapsedMs: performance.now() - trace.start, samples: trace.samples };
  });
  const inspectTrace = (trace, name, twoD) => {
    check(trace.samples.length >= 2 && trace.samples.every(s => close(s.range, Math.round(s.phase * 1000), 1e-7)),
      `${name}: native range follows all sampled animation frames`);
    if (!twoD) check(trace.samples.every(s => close(s.modelPhase, s.phase)), `${name}: actual geometry follows all sampled animation frames`);
    check(trace.samples.every(s => equal(s.pressed, [s.stop])), `${name}: highlighted node follows all sampled animation frames`);
  };
  const seek = async (id, index) => {
    const before = await read(), to = contracts[id].stops[index], name = `${id}/node-${index}`;
    await startTrace(); await page.locator(`#figure-controls [data-process-node="${index}"]`).click();
    await page.waitForFunction(to => {
      const d = window.textbookDiagnostics; return d.process && !d.process.seeking && Math.abs(d.state.phase - to) < 1e-8;
    }, to, { timeout: 15000 });
    await frames(); const after = await read(), trace = await finishTrace(); inspect(after, name); inspectTrace(trace, name, after.twoD);
    check(close(after.phase, to) && !after.playing && !after.process.seeking, `${name}: actual shortcut lands at its exact paused phase`);
    check(after.process.activeStop === index, `${name}: shortcut and pure-model stage agree`);
    if (!close(before.phase, to)) {
      const moving = trace.samples.filter(s => s.seeking && !close(s.phase, before.phase, 1e-5) && !close(s.phase, to, 1e-5));
      check(moving.length >= 3 && new Set(moving.map(s => s.phase.toFixed(5))).size >= 3,
        `${name}: shortcut reveals changing intermediate geometry before its destination`);
    }
    states.push({ name, before, after, trace }); return after;
  };
  const physicalTarget = async (kind = 'phase-track', selection) => {
    const hit = await page.evaluate(({ kind, selection }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry; b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const r = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const v = () => b.camera.position.clone().set(0, 0, 0);
      for (const m of g.meshes.filter(m => m.userData.modelInput?.kind === kind && (selection === undefined || m.userData.modelInput.selection === selection) && m.visible)) {
        const a = m.geometry.attributes.position, idx = m.geometry.index; m.geometry.computeBoundingBox();
        const points = [m.geometry.boundingBox.getCenter(v())], count = Math.floor((idx?.count ?? a.count) / 3), step = Math.max(1, Math.floor(count / 300));
        for (let i = 0; i < count; i += step) {
          const q = v(); for (let j = 0; j < 3; j++) q.add(v().fromBufferAttribute(a, idx ? idx.getX(i * 3 + j) : i * 3 + j));
          points.push(q.multiplyScalar(1 / 3));
        }
        for (const local of points) {
          const p = local.clone().applyMatrix4(m.matrixWorld).project(b.camera), x = r.left + (p.x + 1) * r.width / 2, y = r.top + (1 - p.y) * r.height / 2;
          if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 12 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const actual = b.pickModel(x, y);
          if (actual?.object === m && actual.input?.kind === kind) return { x, y, mesh: m.uuid, label: actual.input.label, track: actual.input.track, kind, selection: actual.input.selection };
        }
      } return null;
    }, { kind, selection });
    check(!!hit, `${(await read()).id}: the actual ${kind} control can be reached above the dock`);
    if (!hit) throw Error(`No exposed actual air/remote ${kind} target`); targets.push(hit); return hit;
  };
  const drag = async requested => {
    await settled(); const hit = await physicalTarget(), before = await read(), name = `${before.id}/physical-drag-${before.viewport.width}`;
    await page.mouse.move(hit.x, hit.y); await frames();
    check(await page.locator('#scene canvas').getAttribute('title') === hit.label, `${name}: physical handle exposes its meaning on hover`);
    await page.mouse.down(); await frames(); const grasp = await read();
    check(!grasp.playing && close(grasp.phase, before.phase), `${name}: grasp pauses without jumping`);
    const offset = await page.evaluate(({ x, y, mesh }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track;
      g.root.updateWorldMatrix(true, true); b.setRay(x, y);
      const origin = g.root.worldToLocal(b.ray.ray.origin.clone()), direction = g.root.worldToLocal(b.ray.ray.origin.clone().add(b.ray.ray.direction)).sub(origin);
      const p = origin.clone().addScaledVector(direction, (track.start[2] - origin.z) / direction.z), t = window.textbookDiagnostics.state.phase;
      return [track.start[0] + (track.end[0] - track.start[0]) * t - p.x, track.start[1] + (track.end[1] - track.start[1]) * t - p.y];
    }, hit);
    const points = await page.evaluate(({ requested, offset, mesh }) => {
      const b = window.textbookDebug, g = b.entry.art.geometry, track = g.meshes.find(m => m.uuid === mesh).userData.modelInput.track;
      const r = b.renderer.domElement.getBoundingClientRect();
      return requested.map(phase => {
        const p = b.camera.position.clone().set(track.start[0] + (track.end[0] - track.start[0]) * phase - offset[0],
          track.start[1] + (track.end[1] - track.start[1]) * phase - offset[1], track.start[2]);
        p.applyMatrix4(g.root.matrixWorld).project(b.camera);
        return { phase, x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
      });
    }, { requested, offset, mesh: hit.mesh });
    const samples = [];
    try {
      for (const p of points) {
        await page.mouse.move(p.x, p.y, { steps: 7 }); await frames(); const s = await read(); samples.push(s); inspect(s, `${name}/${p.phase}`);
        check(close(s.phase, p.phase, .002) && !s.playing, `${name}: real positive/reverse drag reaches ${p.phase}`);
        check(sameCamera(before.camera, s.camera), `${name}/${p.phase}: physical scrub never moves the camera`);
      }
    } finally { await page.mouse.up(); }
    await frames(); const released = await read(); await page.waitForTimeout(250); const held = await read();
    check(released.phase === held.phase && !held.playing && equal(geometrySignature(released), geometrySignature(held)), `${name}: release retains the same physical result`);
    check(close(held.saved?.phase, held.phase) && held.saved.selection === held.selection, `${name}: release saves the exact phase and stage selection`);
    states.push({ name, before, grasp, offset, samples, released, held }); return held;
  };
  const inspectLayout = async name => {
    await page.waitForFunction(() => !document.querySelector('#process-note').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(850); await settled(); await frames(); const s = await read(), vp = s.viewport;
    const overlap = (a, b) => !!a && !!b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2
      && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const inside = b => b.left >= -1 && b.right <= vp.width + 1 && b.top >= -1 && b.bottom <= vp.height + 1;
    const issues = [];
    if (s.note.hidden || !inside(s.note)) issues.push('note outside viewport');
    if (overlap(s.note, s.header)) issues.push('note overlaps header');
    if (overlap(s.note, s.dock)) issues.push('note overlaps dock');
    if (vp.scrollWidth > vp.width + 1) issues.push('horizontal overflow');
    if (!s.twoD && overlap(s.note, s.modelBounds)) issues.push('note overlaps physical model');
    if (s.twoD && (overlap(s.svg, s.note) || overlap(s.svg, s.dock) || overlap(s.svg, s.header))) issues.push('vector diagram overlaps note/header/dock');
    if (!inside(s.dock) || s.nodes.some(n => !inside(n.box))) issues.push('dock or process node outside viewport');
    check(!issues.length, `${name}: process note, controls and demonstration remain separate and inside the viewport`);
    check(s.note.titleFont >= (vp.width < 680 ? 17 : 18) && s.note.textFont >= (vp.width < 680 ? 15 : 16), `${name}: process explanation retains readable type`);
    const labels = s.twoD ? s.svg.labels.filter(l => l.text?.trim() && l.opacity > .05 && l.right - l.left > 1 && l.bottom - l.top > 1) : s.labels;
    const bad = labels.filter(l => l.fontPx < 18 || !inside(l) || overlap(l, s.note) || overlap(l, s.dock) || overlap(l, s.header));
    const collisions = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.text, b.text]));
    check(labels.length > 0 && !bad.length && !collisions.length, `${name}: actual model labels stay at least 18 CSS pixels, unobstructed and separate`);
    if (bad.length || collisions.length) labelIssues.push({ name, viewport: vp, labels, bad, collisions });
    if (issues.length) layoutIssues.push({ name, note: s.note, svg: s.svg, dock: s.dock, header: s.header, modelBounds: s.modelBounds, issues });
    states.push({ name, ...s }); return s;
  };
  const capture = async name => { const path = `output/playwright/air-remote-${name}.png`; await page.screenshot({ path }); screenshots.push(path); };

  const remoteSignature = model => model.samples.map(sample => ({ id: sample.id, tone: sample.tone,
    captured: sample.captured, received: sample.received, processed: sample.processed, output: sample.output,
    acquisition: sample.acquisition, transmission: sample.transmission,
    processingTransfer: sample.processingTransfer, outputTransfer: sample.outputTransfer }));
  const inspectAir = (s, name) => {
    const m = s.model, t = s.phase;
    const smooth = (start, end) => { const q = Math.max(0, Math.min(1, (t - start) / (end - start))); return q * q * (3 - 2 * q); };
    const expected = s.id === 'heating'
      ? { shortwave: smooth(0, .28), groundWarmth: smooth(.28, .52), longwave: smooth(.52, .82), airWarmth: smooth(.65, 1) }
      : { thermalContrast: smooth(0, .24), vertical: smooth(.24, .5), pressure: smooth(.5, .74), horizontal: smooth(.74, 1) };
    check(m.effect === (s.id === 'heating' ? 'heat' : 'circulation') && m.units === 'teaching-reveal'
      && Object.entries(expected).every(([key, value]) => close(m.visibility[key], value)),
    `${name}: physical reveal follows its agreed causal teaching curve without invented weather units`);
    check(m.stageIndex === s.process.activeStop && m.arrowTips.every(a => a.reveal >= 0 && a.reveal <= 1 && a.tip.length === 3 && a.tip.every(Number.isFinite)),
      `${name}: real arrow tips and teaching node use one finite process state`);
    check(m.arrowTips.every(arrow => {
      const mesh = s.meshes.find(mesh => mesh.arrowId === arrow.id), tip = mesh?.arrowTipVertex;
      return mesh && close(mesh.arrowReveal, arrow.reveal) && mesh.visible === (arrow.reveal > .001) && tip
        && close(tip[0], arrow.tip[0], .0001) && close(tip[1], arrow.tip[1], .0001) && Math.abs(tip[2] - arrow.tip[2]) < .341;
    }), `${name}: actual closed-arrow vertex tips, visibility and reveal match the scientific process`);
    if (s.id === 'thermal') {
      check(equal(m.comparisonHeights, [12, 51]) && equal(m.columns.map(c => c.id), ['B', 'A', 'C']),
        `${name}: the original B–A–C relation compares pressure on two fixed horizontal levels`);
      check(m.columns.every(c => c.id === 'A' ? c.relativeWarmth >= 0 && c.nearPressure === (t === 0 ? 'equal' : 'low')
        && c.upperPressure === (t === 0 ? 'equal' : 'high') : c.relativeWarmth <= 0 && c.nearPressure === (t === 0 ? 'equal' : 'high')
        && c.upperPressure === (t === 0 ? 'equal' : 'low')), `${name}: warm ascent and cold descent agree with same-height relative pressure`);
      check(m.loops.length === 2 && m.loops.every(path => equal(path[0], path.at(-1))), `${name}: the two closed circulation cells have no disconnected endpoints`);
    }
  };
  const inspectRemote = (s, name) => {
    if (s.twoD) return;
    const m = s.model, ids = Array.from({ length: 12 }, (_, i) => `sample-${i}`);
    check(m.sampleCount === 12 && equal(m.samples.map(sample => sample.id), ids), `${name}: the same finite twelve samples retain their identities`);
    check(m.retainedInformationCopies === true && m.sensorIlluminatesTarget === false && m.measuredSamples === false && m.predictsDisasters === false,
      `${name}: passive optical sensing does not invent active illumination, measurement or forecasts`);
    check(m.processing.operation === 'restore-known-spatial-order' && m.processing.identifiesLandCover === false,
      `${name}: processing restores known positions without pretending to classify unknown land cover`);
    for (const key of ['captured', 'received', 'processed', 'output']) {
      check(m.counts[key] === m.samples.filter(sample => sample[key]).length, `${name}: ${key} count agrees with sample flags`);
    }
    check(m.samples.every(sample => (!sample.received || sample.captured) && (!sample.processed || sample.received) && (!sample.output || sample.processed)),
      `${name}: every visible information copy follows capture, reception and processing in order`);
    check(m.samples.every(sample => ['acquisition', 'transmission', 'processingTransfer', 'outputTransfer'].every(key => {
      const journey = sample[key]; return journey && journey.progress >= 0 && journey.progress <= 1 && journey.point.every(Number.isFinite);
    })), `${name}: every actual packet reads a finite continuous deterministic journey`);
    check(equal(s.meshes.filter(mesh => mesh.role === 'sample-source' && mesh.visible).map(mesh => ({ id: mesh.sampleId, tone: mesh.tone })),
      m.samples.map(sample => ({ id: sample.id, tone: sample.tone }))), `${name}: twelve genuine source meshes preserve the sample pattern`);
    for (const key of ['captured', 'received', 'processed', 'output']) {
      check(equal(s.meshes.filter(mesh => mesh.role === 'sample-copy' && mesh.copy === key && mesh.visible).map(mesh => ({ id: mesh.sampleId, tone: mesh.tone })),
        m.samples.filter(sample => sample[key]).map(sample => ({ id: sample.id, tone: sample.tone }))),
      `${name}: actual ${key} mesh visibility and tone match the retained sample state`);
    }
    const actualPackets = s.meshes.filter(mesh => mesh.role === 'information-packet' && mesh.visible);
    const expectedPackets = m.samples.flatMap(sample => ['acquisition', 'transmission', 'processingTransfer', 'outputTransfer']
      .filter(key => sample[key].active).map(key => ({ id: sample.id, kind: key, progress: sample[key].progress })));
    check(equal(actualPackets.map(mesh => ({ id: mesh.sampleId, kind: mesh.journey, progress: mesh.journeyProgress })), expectedPackets),
      `${name}: actual moving token meshes match active sample journeys exactly`);
  };
  const inspectSvg = (s, solid, name) => {
    inspect(s, name);
    check(s.twoD && close(s.phase, solid.phase) && s.selection === solid.selection && !s.playing,
      `${name}: native SVG restores the identical paused lesson input`);
    check(s.process.key === solid.process.key && s.process.title === solid.process.title && s.process.activeStop === solid.process.activeStop,
      `${name}: SVG and Three.js use the identical explanation and node`);
    check(!!s.svg && s.svg.images === 0 && s.svg.bytes > 300, `${name}: the diagram is native changing SVG rather than an image`);
    if (s.id === 'remote') {
      check(s.svg.attrs['data-remote-stage'] === solid.model.stage && close(Number(s.svg.attrs['data-remote-phase']), solid.phase),
        `${name}: vector stage and phase match the physical information chain`);
      check(equal(s.svg.sources, solid.model.samples.map(sample => ({ id: sample.id, tone: sample.tone }))),
        `${name}: native vector source preserves exactly the same twelve sample identities and tones`);
      for (const key of ['captured', 'received', 'processed', 'output']) {
        check(Number(s.svg.attrs[`data-remote-${key}`]) === solid.model.counts[key]
          && equal(s.svg.copies.filter(copy => copy.copy === key).map(copy => ({ id: copy.id, tone: copy.tone })),
            solid.model.samples.filter(sample => sample[key]).map(sample => ({ id: sample.id, tone: sample.tone }))),
        `${name}: retained vector ${key} results match the actual sample state`);
      }
    } else {
      check(close(Number(s.svg.attrs['data-air-phase']), solid.phase) && s.svg.attrs['data-air-stage'] === solid.model.stage,
        `${name}: vector air process uses the exact physical phase and stage`);
      const a = s.svg.airState;
      check(!!a && equal(a, Object.fromEntries(Object.keys(a).map(key => [key, solid.model[key]]))),
        `${name}: native vector air process matches every shared scientific field from the physical scene`);
    }
  };

  try {
  const solids = {};
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const id of Object.keys(contracts)) {
    await go(id); const c = contracts[id];
    // A source contract is intentionally checked literally: independent old
    // selections must not silently substitute for these causal bookmarks.
    check(equal((await read()).nodes.map(n => n.text), c.labels), `${id}: process bookmarks preserve the agreed teaching sequence`);
    await phase(0); const first = await read(); inspect(first, `${id}/initial`);
    let previous = first;
    for (let index = 0; index < c.stops.length; index++) {
      const s = await seek(id, index);
      if (id === 'remote') {
        check(['captured', 'received', 'processed', 'output'].every(key => s.model.counts[key] >= previous.model.counts[key]),
          `remote/node-${index}: completed information copies persist at later nodes`);
        check(s.model.counts[['captured', 'received', 'processed', 'output'][index]] === 12,
          `remote/node-${index}: the node completes its twelve-sample operation`);
      }
      previous = s;
    }
    check(!equal(geometrySignature(first), geometrySignature(previous)), `${id}: actual meshes or stroke buffers change through the process`);
    check(equal(bufferSignature(first), bufferSignature(previous)), `${id}: seeking reuses existing mesh topology instead of reallocating all scene objects`);
    const reference = await phase(430); await phase(910); await phase(150); const returned = await phase(430);
    check(equal(geometrySignature(reference), geometrySignature(returned)), `${id}: forward and reverse native scrubbing restores identical actual geometry`);
    if (id === 'remote') {
      check(equal(remoteSignature(reference.model), remoteSignature(returned.model)), 'remote: reverse seeking restores exactly the same sample journeys and retained results');
    }
    const dragged = await drag([.43, .91, .15, .43]);
    check(sameRayPickedGeometry(reference, dragged), `${id}: actual physical dragging returns to the native slider result within ray-inversion precision`);
    states.push({ name: `${id}/physical-vs-native-precision`, referencePhase: reference.phase, physicalPhase: dragged.phase, phaseDifference: dragged.phase - reference.phase,
      coordinateTolerance: 1e-8, exactVertexBuffers: equal(reference.meshes.map(m => m.hash), dragged.meshes.map(m => m.hash)), exactFlow: equal(reference.flow, dragged.flow) });
    solids[id] = await phase(1000); inspect(solids[id], `${id}/completed`);
    if (id === 'remote') {
      check(equal(solids[id].model.counts, { captured: 12, received: 12, processed: 12, output: 12 }), 'remote: the final scene preserves all four complete information copies');
    }
    await inspectLayout(`desktop/${id}`); await capture(`desktop-${id}`);
    if (id === 'remote') {
      await settled(); const target = await physicalTarget('select', 0);
      await startTrace(); await page.mouse.click(target.x, target.y);
      await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking && Math.abs(window.textbookDiagnostics.state.phase - .22) < 1e-8, null, { timeout: 15000 });
      await frames(); const picked = await read(), trace = await finishTrace(); inspect(picked, 'remote/physical-node-selection'); inspectTrace(trace, 'remote/physical-node-selection', false);
      check(picked.process.activeStop === 0 && !picked.playing, 'remote: clicking the actual raised apparatus seeks the shared acquisition node');
      check(trace.samples.filter(s => s.seeking && s.phase > .22 && s.phase < 1).length >= 3, 'remote: an actual apparatus click reveals intermediate information states');
      states.push({ name: 'remote/physical-node-selection', target, after: picked, trace }); await phase(1000);
    }
    const before = await read(); await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready(id); await frames(); const restored = await read();
    check(close(restored.phase, before.phase) && restored.selection === before.selection && !restored.playing && restored.process.key === before.process.key,
      `${id}: refresh restores the exact completed condition paused`);
    states.push({ name: `${id}/phase-restoration`, reference, returned, before, restored });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const id of Object.keys(contracts)) {
    await go(id); await phase(1000); await inspectLayout(`tablet-3d/${id}`); await capture(`tablet-3d-${id}`);
    await phase(370); await drag([.7, .28, .6]);
    await go(id, '2d'); const restored = await read();
    await phase(1000); const flat = await read(); inspectSvg(flat, solids[id], `tablet-2d/${id}`);
    await inspectLayout(`tablet-2d/${id}`); await capture(`tablet-2d-${id}`);
    await phase(0); const first = await read();
    for (let index = 0; index < contracts[id].stops.length; index++) await seek(id, index);
    const last = await read();
    check(first.svg.hash !== last.svg.hash, `${id}: the native vector picture changes across actual process-node clicks`);
    states.push({ name: `${id}/tablet-svg`, restored, first, last });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of Object.keys(contracts)) {
    await go(id, '2d'); await phase(1000); const flat = await read(); inspectSvg(flat, solids[id], `phone-2d/${id}`);
    await inspectLayout(`phone-2d/${id}`); await capture(`phone-2d-${id}`);
    const start = await seek(id, 0), end = await seek(id, contracts[id].stops.length - 1);
    check(start.svg.hash !== end.svg.hash, `${id}: phone SVG remains operable through real process controls`);
  }
  await go('remote', '2d'); await phase(0); await setReduced(true);
  const reducedBefore = await read(); await page.locator('#figure-controls [data-process-node="3"]').click(); await frames(); const reduced = await read();
  check(reduced.reduced && reduced.phase === 1 && !reduced.playing && !reduced.process.seeking,
    'reduced motion locates the final remote node directly without a second animation state');
  states.push({ name: 'reduced-motion-direct-seek', before: reducedBefore, after: reduced }); await setReduced(false);
  await phase(0); const svgButton = page.locator('.flat-concept [data-remote-node="2"]'); await svgButton.focus();
  await startTrace(); await svgButton.press('Enter');
  await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking && Math.abs(window.textbookDiagnostics.state.phase - .69) < 1e-8, null, { timeout: 15000 });
  await frames(); const keyboardPicked = await read(), keyboardTrace = await finishTrace();
  const keyboardFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-model-selection'));
  check(keyboardPicked.phase === .69 && keyboardPicked.process.activeStop === 2 && keyboardFocus === '2',
    'remote: keyboard activation of the actual vector workstation seeks processing and retains focus through SVG redraws');
  inspectTrace(keyboardTrace, 'remote/vector-keyboard-selection', true); states.push({ name: 'remote/vector-keyboard-selection', after: keyboardPicked, trace: keyboardTrace, focusedSelection: keyboardFocus });
  } catch (error) {
    fatal = { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2500) };
    failures.push(`Fatal browser workflow: ${fatal.message}`);
    try { states.push({ name: 'fatal-workflow', snapshot: await read() }); await capture('fatal-workflow'); } catch {}
  }
  check(errors.length === 0, 'air and remote production workflows have no browser runtime or console errors');
  return { base, checks, failures, errors, fatal, labelIssues, layoutIssues, states, targets, screenshots,
    evidenceScope: 'Actual native range keyboard input, process-node clicks and ray-picked Three.js phase-track dragging; passive frame/geometry/SVG sampling only. No production state setter is invoked. Captured screenshots require separate visual inspection; simulated tablet dimensions do not verify real touch hardware.' };
}
