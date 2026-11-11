async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], checks = [], failures = [], states = [], targets = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const phase = async value => {
    await page.locator('#phase').evaluate((el, n) => { el.value = String(n); el.dispatchEvent(new Event('input', { bubbles: true })); }, value); await frame();
  };
  const select = async value => { await page.locator(`#selections [data-selection="${value}"]`).click(); await frame(); };
  const ready = flat => page.waitForFunction(flat => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'disaster-chain' && !d.turning && !d.figureBusy
      && (flat || d.render?.modelState === 'live') && (flat || d.render?.geometry?.activeScenario);
  }, flat, { timeout: 45000 });
  const separate = labels => labels.every((a, i) => labels.slice(i + 1).every(b =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1.5 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1.5));
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = b.entry.art.geometry;
    const hash = value => { let n = 2166136261; for (const c of JSON.stringify(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); };
    const meshData = g.meshes.map(m => [m.visible, ...m.position.toArray(), ...m.scale.toArray(), ...m.rotation.toArray(),
      ...(m.userData.chainRole?.includes('aquifer') || ['saline-wedge', 'unsaturated-sediment', 'impounded-lake', 'downstream-flood'].includes(m.userData.chainRole)
        ? [...m.geometry.attributes.position.array] : [])]);
    window.__chainBuffers ??= g.meshes.map(m => [m.geometry, m.geometry.attributes.position, m.material]);
    return { ...d.render.geometry, playing: d.playing, selection: d.state.selection, labels: d.render.labels,
      roles: g.meshes.filter(m => m.userData.chainRole).map(m => ({ role: m.userData.chainRole, visible: m.visible,
        position: m.position.toArray(), scale: m.scale.toArray(), input: m.userData.modelInput })),
      geometryHash: hash(meshData), flowHash: hash([...g.flow, ...g.accentStrokes].map(l => l.points.map(p => p.toArray()))),
      buffersIdentical: g.meshes.length === window.__chainBuffers.length && g.meshes.every((m, i) =>
        m.geometry === window.__chainBuffers[i][0] && m.geometry.attributes.position === window.__chainBuffers[i][1] && m.material === window.__chainBuffers[i][2]),
      meshCount: g.meshes.length, gpu: { ...b.renderer.info.memory } };
  });
  const hit = async role => {
    const target = await page.evaluate(role => {
      const b = window.textbookDebug, g = b.entry.art.geometry;
      b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
      for (const mesh of g.meshes.filter(m => visible(m) && m.userData.chainRole === role && m.userData.modelInput)) {
        const a = mesh.geometry.attributes.position, ix = mesh.geometry.index, vec = () => b.camera.position.clone().set(0, 0, 0);
        mesh.geometry.computeBoundingBox(); const candidates = [mesh.geometry.boundingBox.getCenter(vec())];
        const count = (ix?.count ?? a.count) / 3;
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 240))) {
          const point = vec(); for (let k = 0; k < 3; k++) point.add(vec().fromBufferAttribute(a, ix ? ix.getX(i * 3 + k) : i * 3 + k));
          candidates.push(point.multiplyScalar(1 / 3));
        }
        for (const candidate of candidates) {
          const q = candidate.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
          const x = rect.left + (q.x + 1) * rect.width / 2, y = rect.top + (1 - q.y) * rect.height / 2;
          if (x < 10 || x > innerWidth - 10 || y < 10 || y > dock.top - 10 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
          const actual = b.pickModel(x, y);
          if (actual?.object === mesh && actual.input?.kind === 'replay') return { x, y, role, input: actual.input };
        }
      }
      return null;
    }, role);
    if (!target) { check(false, `actual unobstructed ${role} replay target exists`); return false; }
    targets.push(target); await page.mouse.click(target.x, target.y); await frame(); return true;
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/?figure=disaster-chain&3d&inspect`, { waitUntil: 'domcontentloaded' });
  await ready(false); await page.evaluate(() => document.fonts.ready); await frame();
  const sampled = [];
  for (const choice of [0, 1]) {
    await select(choice);
    for (const value of [0, 160, 350, 500, 650, 780, 880, 1000]) {
      await phase(value); const s = await read(); sampled.push({ selection: choice, phase: value, state: s });
      check(s.activeScenario === (choice ? 'earthquake' : 'drought'), `${choice}/${value}: correct selected conditional scene`);
      check(s.buffersIdentical, `${choice}/${value}: solid geometry, vertex buffers and materials are reused`);
      check(s.labels.filter(l => l.text === s.caption).length === 1 && s.labels.length <= 4, `${choice}/${value}: one short status and at most three locating labels`);
      check(separate(s.labels), `${choice}/${value}: visible labels do not overlap`);
      check(s.roles.filter(r => ['fresh-aquifer', 'saline-wedge', 'extraction-well'].includes(r.role)).every(r => r.visible === !choice), `${choice}/${value}: no stale coastal solids in the valley scene`);
      if (!choice) check(s.roles.find(r => r.role === 'fixed-sea').position[1] === sampled[0].state.roles.find(r => r.role === 'fixed-sea').position[1], `${value}: sea level is fixed while the saltwater wedge advances underground`);
      if ((choice === 0 && value === 1000) || (choice === 1 && [350, 780, 1000].includes(value)))
        await page.screenshot({ path: `output/playwright/disaster-chain-${choice ? 'quake' : 'drought'}-${value}.png` });
    }
  }
  for (const choice of [0, 1]) {
    await select(choice); await phase(650); const before = await read(); await page.waitForTimeout(250); const paused = await read();
    check(before.geometryHash === paused.geometryHash && before.flowHash === paused.flowHash && !paused.playing, `${choice}: pause freezes actual solids, water volumes and moving ink`);
    await phase(1000); await phase(0); await phase(650); const reversed = await read();
    check(before.geometryHash === reversed.geometryHash && before.flowHash === reversed.flowHash, `${choice}: reverse seeking restores identical geometry and flow`);
    await phase(998); await page.locator('#cPause').click(); await page.waitForTimeout(600); const end = await read();
    await page.waitForTimeout(180); const held = await read();
    check(end.phase === 1 && held.phase === 1 && !held.playing, `${choice}: playback stops at the consequences without wrapping to the starting landscape`);
    check(!choice ? held.drought.intrusion === 1 && held.drought.subsidence > 0 : held.earthquake.shake === 0 && held.earthquake.flood === 1 && held.earthquake.breach === 1,
      `${choice}: the final physical consequences remain while earthquake shaking ends`);
    if (await hit(choice ? 'landslide-block' : 'extraction-well')) {
      const replay = await read(); check(replay.phase === 0 && replay.selection === choice, `${choice}: the causal entity replays its own scene and preserves the selected branch`);
    }
    await phase(1000);
    if (await hit('replay')) { const replay = await read(); check(replay.phase === 0 && replay.selection === choice, `${choice}: the paper rewind entity resets only event progress`); }
    states.push({ mode: '3d-reverse-pause-replay', choice, before, paused, reversed, end, held });
  }
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(550);
  const compact = [];
  for (const choice of [0, 1]) for (const value of [0, 650, 1000]) {
    await select(choice); await phase(value); const s = await read(), dock = await page.locator('.capsule').boundingBox(); compact.push({ choice, value, state: s });
    check(s.labels.every(l => l.left >= 0 && l.right <= 1024 && l.top >= 0 && l.bottom < dock.y), `1024/${choice}/${value}: labels remain in view above the dock`);
    check(s.labels.every(l => l.fontPx >= 18), `1024/${choice}/${value}: every visible label is at least 18 CSS px`);
    check(separate(s.labels), `1024/${choice}/${value}: labels remain separate`);
    if (value === 1000) await page.screenshot({ path: `output/playwright/disaster-chain-${choice ? 'quake' : 'drought'}-1024.png` });
  }
  states.push({ mode: '3d', samples: sampled, compact });
  await page.goto(`${base}/?figure=disaster-chain&2d&inspect`, { waitUntil: 'domcontentloaded' }); await ready(true);
  const flat = [];
  for (const choice of [0, 1]) {
    await select(choice);
    for (const value of [0, 160, 350, 500, 650, 780, 880, 1000]) {
      await phase(value);
      const s = await page.locator('.flat-concept svg[data-chain-branch]').evaluate(el => ({
        branch: el.getAttribute('data-chain-branch'), stage: el.getAttribute('data-chain-stage'), phase: Number(el.getAttribute('data-chain-phase')),
        intrusion: Number(el.getAttribute('data-chain-intrusion')), subsidence: Number(el.getAttribute('data-chain-subsidence')),
        slide: Number(el.getAttribute('data-chain-slide')), breach: Number(el.getAttribute('data-chain-breach')), flood: Number(el.getAttribute('data-chain-flood')),
        images: el.querySelectorAll('image').length, texts: [...el.querySelectorAll('text')].map(t => t.textContent),
        keyboardReplays: el.querySelectorAll('[data-model-replay="true"][role="button"][tabindex="0"][aria-label]').length,
      }));
      const solid = sampled.find(s => s.selection === choice && s.phase === value).state;
      check(s.branch === solid.branch && s.stage === solid.stage && s.intrusion === solid.drought.intrusion && s.subsidence === solid.drought.subsidence
        && s.slide === solid.earthquake.slide && s.breach === solid.earthquake.breach && s.flood === solid.earthquake.flood,
      `${choice}/${value}: SVG and raised solids share the same causal state`);
      check(s.images === 0 && s.keyboardReplays >= 2 && s.texts.filter(t => t === solid.caption).length === 1,
        `${choice}/${value}: native SVG keeps one short status and keyboard replay`);
      flat.push({ choice, value, state: s });
    }
    await phase(650);
    const entity = page.locator(`.flat-concept [data-chain-role="${choice ? 'landslide' : 'well'}"]`);
    await entity.focus(); await page.keyboard.press('Enter'); await frame();
    const after = await page.locator('.flat-concept svg[data-chain-branch]').getAttribute('data-chain-phase');
    check(Number(after) === 0, `${choice}: the keyboard activates entity replay without switching topics`);
    await phase(1000); await page.locator('.flat-concept').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/disaster-chain-${choice ? 'quake' : 'drought'}-flat-1024.png` });
  }
  states.push({ mode: '2d', samples: flat });
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), purpose: 'Conditional disaster-chain physical process, direct replay and same-state SVG verification',
    errors, checks, failures, states, targets, realTouchTabletVerified: false };
}
