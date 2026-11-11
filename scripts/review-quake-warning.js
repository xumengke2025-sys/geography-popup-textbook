async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const clearLabels = labels => labels.every((a, i) => labels.slice(i + 1).every(b =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1.5 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1.5));
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = flat => page.waitForFunction(flat => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'earthquake' && !d.turning && !d.figureBusy && (flat || d.render?.modelState === 'live');
  }, flat, { timeout: 45000 });
  const phase = async value => {
    await page.locator('#phase').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await frame();
  };
  const selection = async value => { await page.locator(`#selections [data-selection="${value}"]`).click(); await frame(); };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, g = window.textbookDebug?.entry?.art.geometry;
    const hash = value => { let n = 2166136261; for (const c of JSON.stringify(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); };
    return { playing: d.playing, ...d.render.geometry, labels: d.render.labels,
      roles: g.meshes.filter(m => m.userData.quakeRole).map(m => ({ role: m.userData.quakeRole, visible: m.visible, position: m.position.toArray() })),
      motionHash: hash({ meshes: g.meshes.map(m => [m.visible, ...m.position.toArray()]),
        flow: [...g.flow, ...g.accentStrokes].map(l => l.points.map(p => p.toArray())) }) };
  });
  await page.goto(`${base}/?figure=earthquake&3d&inspect`, { waitUntil: 'domcontentloaded' }); await ready(false);
  await page.evaluate(() => document.fonts.ready);
  await selection(0); await phase(400);
  const structure = await read(); states.push({ mode: 'structure', state: structure });
  check(structure.view === 'structure' && structure.labels.some(l => l.text === '震源深度') && structure.epicenterDirectlyAboveFocus,
    'the original source / epicentre cutaway remains available');
  check(clearLabels(structure.labels), 'source, epicentre and depth labels remain separate');
  await page.screenshot({ path: 'output/playwright/quake-warning-structure.png' });
  const sampled = [];
  for (const choice of [1, 2]) {
    await selection(choice);
    for (const value of [0, 100, 250, 290, 320, 400, 860, 1000]) {
      await phase(value); const s = await read(); sampled.push({ selection: choice, phase: value, state: s });
      const alert = s.roles.find(r => r.role === 'warning-received');
      const signal = s.roles.find(r => r.role === 'communication-signal');
      check(alert?.visible === s.alerted && s.labels.filter(l => l.text === s.caption).length === 1 && s.caption.length <= 5
        && s.labels.every(l => !/预警已到|非震前|通信/.test(l.text)), `${choice}/${value}: arrival uses an unlabelled signal and a single short status`);
      check(signal?.visible === (s.sent && !s.alerted), `${choice}/${value}: real communication signal starts only after detection and ends at receipt`);
      check(clearLabels(s.labels), `${choice}/${value}: visible labels do not overlap`);
      if (choice === 1 && value === 400) await page.screenshot({ path: 'output/playwright/quake-warning-far-lead.png' });
      if (choice === 2 && value === 290) await page.screenshot({ path: 'output/playwright/quake-warning-near-no-lead.png' });
    }
  }
  const far = sampled.find(s => s.selection === 1 && s.phase === 400).state;
  const near = sampled.find(s => s.selection === 2 && s.phase === 290).state;
  check(far.detected && far.sent && far.alerted && !far.sArrived && far.hasLead, 'the distant town receives a post-event warning before S arrival');
  check(near.sArrived && !near.alerted && !near.hasLead, 'near-field strong shaking can precede warning receipt');
  await selection(1); await phase(400); const before = await read();
  await page.waitForTimeout(300); const paused = await read();
  check(before.motionHash === paused.motionHash && !paused.playing, 'pausing freezes actual wave, signal and settlement meshes');
  await phase(900); await phase(100); await phase(400); const reversed = await read();
  check(before.motionHash === reversed.motionHash, 'forward and reverse dragging restore identical visible geometry');
  const label = reversed.labels.find(l => l.text === '远处聚落');
  await page.mouse.click((label.left + label.right) / 2, (label.top + label.bottom) / 2); await frame();
  const picked = await read();
  check(picked.targetId === 'near' && picked.phase === .4, 'clicking the raised settlement label switches spatial comparison while preserving event time');
  await selection(1); await phase(998); await page.locator('#cPause').click(); await page.waitForTimeout(600);
  const stopped = await read(); await page.waitForTimeout(200); const held = await read();
  check(stopped.phase === 1 && !stopped.playing && held.phase === 1 && held.stage === 'result', 'one play stops at the result rather than wrapping to an unoccurred earthquake');
  await page.locator('#restart').click(); await frame(); const replay = await read();
  check(replay.phase === 0 && !replay.occurred && !replay.alerted, 'replay resets all event and warning state without a leftover alert');
  check(replay.view === 'warning' && replay.targetId === 'far', 'replay preserves the selected distant warning comparison');
  await selection(2); await phase(400); await page.locator('#restart').click(); await frame(); const replayNear = await read();
  check(replayNear.phase === 0 && replayNear.view === 'near' && replayNear.targetId === 'near' && !replayNear.alerted, 'replay preserves the selected near-field comparison and clears its prior alert');
  await selection(1); await phase(400); await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(500);
  const narrow = await read(), dock = await page.locator('.capsule').boundingBox();
  check(narrow.labels.every(l => l.left >= 0 && l.right <= 1024 && l.top >= 0 && l.bottom < dock.y), '1024px: visible labels stay in view and above the control dock');
  check(narrow.labels.every(l => l.fontPx >= 18), '1024px: every visible model label is at least 18 CSS pixels');
  check(clearLabels(narrow.labels), '1024px: distant warning labels do not overlap');
  await page.screenshot({ path: 'output/playwright/quake-warning-1024.png' });
  const narrowComparisons = [];
  for (const choice of [0, 2]) {
    await selection(choice); await phase(290); const state = await read(); narrowComparisons.push(state);
    check(state.labels.every(l => l.left >= 0 && l.right <= 1024 && l.top >= 0 && l.bottom < dock.y), `1024px/${choice}: labels remain within the view above the dock`);
    check(state.labels.every(l => l.fontPx >= 18) && clearLabels(state.labels), `1024px/${choice}: labels remain legible and separate`);
    await page.screenshot({ path: `output/playwright/quake-warning-${choice === 0 ? 'structure' : 'near'}-1024.png` });
  }
  states.push({ mode: 'three-dimensional', samples: sampled, before, paused, reversed, picked, stopped, replay, replayNear, narrow, narrowComparisons });

  await page.goto(`${base}/?figure=earthquake&2d&inspect`, { waitUntil: 'domcontentloaded' }); await ready(true);
  const flatSamples = [];
  for (const choice of [1, 2]) {
    await selection(choice);
    for (const value of [0, 250, 290, 320, 400, 860, 1000]) {
      await phase(value);
      const flat = await page.locator('.flat-concept svg[data-quake-view]').evaluate(el => ({
        stage: el.getAttribute('data-quake-stage'), detected: el.getAttribute('data-quake-detected') === 'true',
        alerted: el.getAttribute('data-quake-alerted') === 'true', sArrived: el.getAttribute('data-quake-s-arrived') === 'true',
        images: el.querySelectorAll('image').length, texts: [...el.querySelectorAll('text')].map(t => t.textContent),
      }));
      const solid = sampled.find(s => s.selection === choice && s.phase === value).state;
      check(flat.stage === solid.stage && flat.detected === solid.detected && flat.alerted === solid.alerted && flat.sArrived === solid.sArrived,
        `${choice}/${value}: SVG and 3D agree on event order and warning result`);
      check(flat.images === 0 && flat.texts.filter(t => t === solid.caption).length === 1
        && flat.texts.every(t => !/预警已到|非震前|通信/.test(t)), `${choice}/${value}: native vector view keeps one short status without repeated declarations`);
      flatSamples.push({ selection: choice, phase: value, ...flat });
    }
  }
  await selection(1); await phase(400); await page.locator('.flat-concept').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/quake-warning-flat-1024.png' });
  states.push({ mode: 'two-dimensional', samples: flatSamples });
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), purpose: 'Targeted earthquake warning event and rendering verification', errors, checks, failures, states };
}
