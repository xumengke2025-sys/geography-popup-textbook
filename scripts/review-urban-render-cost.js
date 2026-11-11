async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], screenshots = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'urban-waterlogging' && !d.figureBusy && d.render?.modelState === 'live';
  }, null, { timeout: 45000 });
  const settle = async () => {
    let last, stable = 0;
    for (let i = 0; i < 70; i++) {
      const camera = await page.evaluate(() => {
        const c = window.textbookDebug.camera;
        return [...c.position.toArray(), ...c.quaternion.toArray()];
      });
      stable = last && camera.every((n, j) => Math.abs(n - last[j]) < 1e-5) ? stable + 1 : 0;
      if (stable >= 3) return;
      last = camera; await page.waitForTimeout(60);
    }
    throw Error('City scene camera did not settle');
  };
  const setSides = async side => {
    await page.evaluate(side => {
      const geometry = window.textbookDebug.entry.art.geometry;
      for (const mesh of geometry.meshes.filter(m => m.userData.urbanRole &&
        !['paper-house', 'process-label', 'condition-label'].includes(m.userData.urbanRole))) {
        mesh.material.side = side; mesh.material.needsUpdate = true;
      }
    }, side);
    await frame();
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug;
    const g = d.render.geometry;
    return {
      phase: d.state.phase, selection: d.state.selection, playing: d.playing,
      render: { calls: d.render.calls, triangles: d.render.triangles },
      state: { packets: g.packets, inventory: g.inventory, stage: g.stage, bufferReuse: g.geometryBuffersReused },
      visibleSolids: b.entry.art.geometry.meshes.filter(m => m.visible && m.userData.urbanRole && m.userData.kind !== 'text-label')
        .map(m => ({ role: m.userData.urbanRole, position: m.position.toArray(), scale: m.scale.toArray(),
          vertices: m.geometry.attributes.position.count, id: m.userData.urbanPacketId })),
      labels: b.entry.art.geometry.meshes.filter(m => m.userData.kind === 'text-label')
        .map(m => ({ text: m.userData.text, side: m.material.side })),
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?figure=urban-waterlogging&3d&inspect`, { waitUntil: 'domcontentloaded' });
  await ready();
  for (const selection of [0, 1, 2]) {
    await page.locator(`#selections [data-selection="${selection}"]`).click();
    await ready();
    for (const value of [0, 550, 1000]) {
      await page.locator('#phase').evaluate((el, value) => {
        el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      await settle();
      await setSides(2); const double = await read();
      if (value === 1000) {
        const path = `output/playwright/urban-double-${selection}.png`;
        await page.screenshot({ path }); screenshots.push(path);
      }
      await setSides(0); const front = await read();
      if (value === 1000) {
        const path = `output/playwright/urban-front-${selection}.png`;
        await page.screenshot({ path }); screenshots.push(path);
      }
      const name = `${selection}/${value}`;
      check(!front.playing, `${name}: comparison is made with model time frozen`);
      check(JSON.stringify(double.state) === JSON.stringify(front.state), `${name}: scientific state and all water destinations are unchanged`);
      check(JSON.stringify(double.visibleSolids) === JSON.stringify(front.visibleSolids), `${name}: all physical objects, identities and geometry are retained`);
      check(JSON.stringify(double.labels) === JSON.stringify(front.labels) && front.labels.every(l => l.side === 2), `${name}: text labels keep their readable double-sided material`);
      check(front.render.calls < double.render.calls && front.render.calls <= 120, `${name}: the complete city scene fits the 120 draw-call target`);
      states.push({ selection, phase: value / 1000, before: double.render, after: front.render, waterCount: front.state.packets.length,
        inventory: front.state.inventory });
    }
  }
  await page.setViewportSize({ width: 1024, height: 768 }); await settle();
  await page.screenshot({ path: 'output/playwright/urban-front-tablet.png' });
  return { base, checks, failures, errors, states, screenshots,
    scope: 'Actual Chrome GPU submission counts at identical camera and paused scientific states, for every independent city condition. Back-face passes only; no meshes or water markers are removed. No claim of school-hardware FPS or physical-tablet testing.' };
}
