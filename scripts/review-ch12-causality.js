async page => {
  const browser = page.context().browser();
  const result = { purpose: 'Targeted read-only causal review: chapters 1–2', base: page.__reviewBase ?? 'http://127.0.0.1:5173', errors: [], states: [] };
  const inspect = async (id, work, flat = false) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    try {
      const p = await context.newPage();
      p.on('pageerror', e => result.errors.push(`${id}: ${e.message}`));
      await p.goto(`${result.base}/?figure=${id}&${flat ? '2d' : '3d'}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForFunction(({ id, flat }) => {
        const d = window.textbookDiagnostics;
        return d?.ready && d.active === id && !d.figureBusy && !d.turning && (flat || d.render?.modelState === 'live');
      }, { id, flat }, { timeout: 45000 });
      await p.evaluate(() => document.fonts.ready);
      const record = { id, flat, samples: [] };
      result.states.push(record);
      await work(p, record);
    } finally { await context.close(); }
  };
  const setPhase = async (p, value) => {
    await p.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const sample = p => p.evaluate(() => {
    const d = window.textbookDiagnostics;
    const g = window.textbookDebug?.entry?.art.geometry;
    return { phase: d.state?.phase, selection: d.state?.selection, playing: d.playing,
      meshState: g?.meshes.map((m, i) => ({ i, type: m.geometry.type, kind: m.userData.kind, layer: m.userData.layer ?? null,
        visible: m.visible, position: m.position.toArray() })), render: d.render?.geometry };
  });
  await inspect('solar', async (p, record) => {
    for (const value of [999, 0]) { await setPhase(p, value); record.samples.push(await sample(p)); }
    const [before, after] = record.samples;
    record.boundaryDisplacements = before.meshState.filter(m => m.type === 'SphereGeometry').slice(1).map(m => {
      const q = after.meshState.find(a => a.i === m.i);
      return { meshIndex: m.i, distanceInModelMm: Math.hypot(...m.position.map((v, i) => v - q.position[i])) };
    });
  });
  await inspect('earth', async (p, record) => {
    await setPhase(p, 400);
    for (const selection of [0, 1, 2, 3]) {
      await p.locator(`#selections [data-selection="${selection}"]`).click();
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      record.samples.push(await sample(p));
    }
    record.completeEqualsCrust = JSON.stringify(record.samples[0].meshState) === JSON.stringify(record.samples[1].meshState);
    record.fixedCrossSectionMeshIndices = record.samples[0].meshState.filter(m => m.type === 'BufferGeometry' && m.layer === null).map(m => m.i);
  });
  await inspect('haze', async (p, record) => {
    await setPhase(p, 400);
    for (const selection of [0, 2]) {
      await p.locator(`#selections [data-selection="${selection}"]`).click();
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      record.samples.push(await sample(p));
    }
    record.visiblePollutionParticles = record.samples.map(s => s.meshState.filter(m => m.type === 'SphereGeometry' && m.visible).length);
    const before = record.samples[0].meshState.filter(m => m.type === 'SphereGeometry');
    record.retainedParticlesRepositioned = before.slice(0, 10).filter(m => {
      const after = record.samples[1].meshState.find(q => q.i === m.i);
      return m.position.some((v, i) => Math.abs(v - after.position[i]) > .00001);
    }).length;
  });
  await inspect('haze', async (p, record) => {
    await setPhase(p, 400);
    for (const selection of [0, 2]) {
      await p.locator(`#selections [data-selection="${selection}"]`).click();
      record.samples.push(await p.locator('.flat-concept .flat-model-svg').evaluate(svg => ({ circles: svg.querySelectorAll('circle').length })));
    }
  }, true);
  return result;
}
