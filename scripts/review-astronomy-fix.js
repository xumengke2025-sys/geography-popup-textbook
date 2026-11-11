async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const browser = page.context().browser(), errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const inspect = async (id, work, reduced = true) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    try {
      const p = await context.newPage();
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(`${base}/?figure=${id}&3d&inspect`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && d.render?.modelState === 'live'; }, id, { timeout: 45000 });
      await p.evaluate(() => document.fonts.ready);
      await work(p);
    } finally { await context.close(); }
  };
  const frame = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const phase = async (p, value) => {
    await p.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await frame(p);
  };
  const positions = p => p.evaluate(() => window.textbookDebug.entry.art.geometry.meshes.filter(m => m.userData.body && m.userData.body !== 'sun').map(m => ({ body: m.userData.body, position: m.position.toArray() })));
  const maxDifference = (a, b) => Math.max(...a.map((v, i) => Math.hypot(...v.position.map((x, j) => x - b[i].position[j]))));
  await inspect('solar', async p => {
    const samples = [];
    for (const value of [0, 1000, 999, 998, 370, 800, 370, 50, 370]) {
      await phase(p, value);
      const labelRects = await p.evaluate(() => {
        const book = window.textbookDebug;
        return book.entry.art.geometry.meshes.filter(m => m.userData.kind === 'text-label').map(mesh => {
          mesh.updateMatrixWorld(true);
          const points = [], attribute = mesh.geometry.attributes.position;
          for (let i = 0; i < attribute.count; i++) {
            const v = mesh.position.clone().fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld).project(book.camera);
            points.push([v.x, v.y]);
          }
          return { text: mesh.userData.text, left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])), top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])) };
        });
      });
      const [a, b] = labelRects;
      check(Math.min(a.right, b.right) <= Math.max(a.left, b.left) || Math.min(a.bottom, b.bottom) <= Math.max(a.top, b.top), `solar ${value / 1000}: Sun and Earth label rectangles do not overlap`);
      samples.push({ phase: value / 1000, planets: await positions(p), labelRects });
    }
    const maxClosureError = maxDifference(samples[0].planets, samples[1].planets);
    const boundaryStep = maxDifference(samples[0].planets, samples[2].planets);
    const precedingStep = maxDifference(samples[2].planets, samples[3].planets);
    check(maxClosureError < 1e-9, 'solar: exact phase 0 and 1 close all eight orbits');
    check(Math.abs(boundaryStep - precedingStep) < .02, 'solar: boundary movement is the same scale as its preceding frame');
    check(maxDifference(samples[4].planets, samples[6].planets) === 0 && maxDifference(samples[4].planets, samples[8].planets) === 0, 'solar: forward and backward scrubbing returns exactly the same positions');
    const diagnostics = await p.evaluate(() => window.textbookDebug.entry.art.diagnostics);
    check(diagnostics.realOrbitalPeriodRatio === false && diagnostics.units === 'schematic', 'solar: motion retains explicit schematic period and distance semantics');
    states.push({ id: 'solar', samples, maxClosureError, boundaryStep, precedingStep, diagnostics });
    await p.screenshot({ path: 'output/playwright/astronomy-after-solar.png' });
  });
  const readEarth = p => p.evaluate(() => {
    const a = window.textbookDebug.entry.art;
    return { diagnostics: a.diagnostics, parts: a.geometry.meshes.filter(m => m.userData.layerPart).map(m => ({ layer: m.userData.layer, part: m.userData.layerPart, visible: m.visible, position: m.position.toArray(), radius: m.geometry.parameters?.radius ?? null })),
      labels: a.geometry.meshes.filter(m => m.userData.kind === 'text-label').map(m => ({ text: m.userData.text, visible: m.visible, position: m.position.toArray() })) };
  });
  await inspect('earth', async p => {
    const samples = [];
    await phase(p, 400);
    for (const selection of [0, 1, 2, 3, 0]) {
      await p.locator(`#selections [data-selection="${selection}"]`).click(); await frame(p);
      const state = await readEarth(p); samples.push(state);
      for (let i = 0; i < 4; i++) {
        const parts = state.parts.filter(q => q.layer === i), outer = parts.find(q => q.part === 'outer');
        const sections = parts.filter(q => q.part.startsWith('section-'));
        check(sections.every(q => q.visible === outer.visible && JSON.stringify(q.position) === JSON.stringify(outer.position)), `earth ${selection}: layer ${i} shell and section visibility/transforms agree`);
      }
      check(state.labels.filter(q => q.visible).length === [4, 1, 1, 2][selection], `earth ${selection}: only relevant layer labels are visible`);
      if (selection) await p.screenshot({ path: `output/playwright/astronomy-after-earth-${['full', 'crust', 'mantle', 'core'][selection]}.png` });
      if (selection === 1 || selection === 2) {
        for (const orbit of [-.8, .8]) for (const elevation of [.44, 1.45]) {
          await p.evaluate(({ orbit, elevation }) => { window.textbookDebug.orbit = orbit; window.textbookDebug.elevation = elevation; }, { orbit, elevation });
          await frame(p);
          const bounds = await p.evaluate(focus => {
            const book = window.textbookDebug, parts = book.entry.art.geometry.meshes.filter(m => m.userData.layerPart && m.visible);
            const boxes = [[], []];
            for (const mesh of parts) {
              mesh.updateMatrixWorld(true);
              const list = boxes[mesh.userData.layer === focus ? 1 : 0], attr = mesh.geometry.attributes.position;
              for (let i = 0; i < attr.count; i++) list.push(mesh.position.clone().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld).project(book.camera).x);
            }
            return boxes.map(values => ({ left: Math.min(...values), right: Math.max(...values) }));
          }, selection - 1);
          check(bounds[1].left > bounds[0].right, `earth ${selection}: shell and remaining interior have a clear projection gap at orbit=${orbit}, elevation=${elevation}`);
          if (orbit === -.8 && elevation === .44) await p.screenshot({ path: `output/playwright/astronomy-after-earth-${selection === 1 ? 'crust' : 'mantle'}-oblique.png` });
        }
        await p.evaluate(() => { window.textbookDebug.orbit = .18; window.textbookDebug.elevation = .64; }); await frame(p);
      }
    }
    const original = samples[0], reset = samples.at(-1);
    check(JSON.stringify(original.parts) === JSON.stringify(reset.parts), 'earth: returning to complete restores every part exactly');
    check(samples[1].parts.find(q => q.layer === 0 && q.part === 'outer').position.some(v => v !== 0), 'earth: selecting crust actually separates the thin outer shell');
    check(samples[2].parts.filter(q => q.layer === 0).every(q => !q.visible), 'earth: focusing mantle removes the whole crust, including both cut faces');
    check(samples[3].parts.filter(q => q.layer < 2).every(q => !q.visible), 'earth: focusing core removes complete crust and mantle groups');
    const crust = samples[1].parts.filter(q => q.layer === 0 && ['outer', 'inner'].includes(q.part));
    check(crust.length === 2 && crust[0].radius > crust[1].radius && (crust[0].radius - crust[1].radius) / crust[0].radius < .04, 'earth: separating crust preserves its thin shell geometry');
    states.push({ id: 'earth', samples });
    await p.screenshot({ path: 'output/playwright/astronomy-after-earth-full.png' });
  });
  await inspect('earth', async p => {
    await phase(p, 400);
    await p.locator('#selections [data-selection="1"]').click();
    await p.waitForTimeout(550);
    const sample = await readEarth(p);
    check(sample.diagnostics.layerGroups[0].offset[0] > 50 && sample.diagnostics.layerGroups[0].offset[0] < 65, 'earth: paused normal-motion selection completes its physical lift');
    check(sample.parts.filter(q => q.layer === 0 && q.part.startsWith('section')).every(q => JSON.stringify(q.position) === JSON.stringify(sample.parts.find(a => a.layer === 0 && a.part === 'outer').position)), 'earth: animated selection keeps cut faces attached to the shell');
    states.push({ id: 'earth-normal-motion', sample });
  }, false);
  await page.goto(`${base}/?figure=solar&3d`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready);
  check(!await page.evaluate(() => 'textbookDebug' in window) || base.includes(':5173'), 'production runtime inspection is opt-in');
  return { base, browser: browser.version(), diagnosticInspection: true, errors, failures, checks, states };
}
