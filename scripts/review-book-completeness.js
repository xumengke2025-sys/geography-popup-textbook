async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], labelIssues = [], layoutIssues = [], screenshots = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text().slice(0, 500)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && (id === undefined || d.active === id)
      && (!d.active || d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const settle = async () => {
    await ready(); await frames();
    let last, stable = 0;
    for (let i = 0; i < 60; i++) {
      const camera = await page.evaluate(() => window.textbookDebug ? [...window.textbookDebug.camera.position.toArray(), ...window.textbookDebug.camera.quaternion.toArray()] : []);
      stable = last && camera.every((n, j) => Math.abs(n - last[j]) < 1e-5) ? stable + 1 : 0;
      if (stable >= 3) return;
      last = camera; await page.waitForTimeout(60);
    }
    throw Error('The model camera did not settle');
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, r = d.render;
    const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
    const svg = document.querySelector('.flat-concept > svg');
    return { active: d.active, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, twoD: d.twoD, process: d.process,
      geometry: r?.geometry, labels: r?.labels ?? [], models: r?.models,
      resources: r ? { geometries: r.geometries, textures: r.textures, images: r.images, hiRes: r.hiRes } : null,
      render: r ? { calls: r.calls, triangles: r.triangles } : null,
      header: box(document.querySelector('#desk-header')), dock: box(document.querySelector('.capsule')),
      width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      svg: svg ? { imageCount: svg.querySelectorAll('image').length, box: box(svg), invalid: /NaN|Infinity|undefined/.test(svg.outerHTML),
        labels: Array.from(svg.querySelectorAll('text'), el => { const b = box(el), c = el.getScreenCTM();
          return { text: el.textContent, ...b, fontPx: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(c.a, c.b) }; }) } : null,
      controls: Array.from(document.querySelectorAll('.capsule button,.capsule input')).filter(el => el.getClientRects().length && !el.closest('[hidden]')).map(el => ({ id: el.id, ...box(el) })),
    };
  });
  const choose = async selector => { await page.locator(selector).click(); await settle(); };
  const phase = async value => {
    const slider = page.locator('#phase'); await slider.focus(); await slider.press(value < 500 ? 'Home' : 'End');
    if (value === 500) for (let i = 0; i < 5; i++) await slider.press('PageDown');
    await settle(); return read();
  };
  const open = async id => {
    await page.locator('#cContents').click(); await page.locator('#contents-models').click();
    await page.locator('#contents-search').fill('');
    await page.locator(`#model-contents [data-figure="${id}"]`).click(); await ready(id); await settle();
  };
  const inspect = (s, name, visual = true) => {
    check(s.active && !s.playing && Number.isFinite(s.phase), `${name}: an inspectable paused state is available`);
    check(!s.overflow && s.controls.every(b => b.left >= -1 && b.right <= s.width + 1 && b.top >= -1 && b.bottom <= s.height + 1), `${name}: current controls fit the viewport`);
    if (s.overflow) layoutIssues.push({ name, issue: 'document overflow', width: s.width });
    if (s.twoD) {
      check(s.svg && !s.svg.invalid && !s.svg.imageCount, `${name}: the fallback is a valid native vector demonstration`);
    } else {
      const g = s.geometry;
      // Several correctly scaled relief sections set their own lift in their
      // construction. A fixed 34-mm wrapper default is not a model invariant.
      check(g?.solids > 0 && g.sceneElevation > 0 && g.unfoldProgress === 1 && g.originalPagePreserved && g.imageMappedMeshes === 0, `${name}: actual geometry is raised above the original page`);
      check(g?.extent?.every(n => Number.isFinite(n) && n > 0), `${name}: scene extent stays finite`);
    }
    if (!visual) return;
    const labels = s.twoD ? s.svg?.labels ?? [] : s.labels;
    const minimum = s.twoD && s.width < 600 ? 15 : 18;
    const small = labels.filter(l => l.fontPx < minimum - .1);
    const outside = labels.filter(l => l.left < -1 || l.right > s.width + 1 || l.top < s.header.bottom - 1 || l.bottom > s.dock.top - 3);
    const overlaps = labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2).map(b => [a.text, b.text]));
    if (small.length || outside.length || overlaps.length) labelIssues.push({ name, small, outside, overlaps, labels });
    check(!small.length && !outside.length && !overlaps.length, `${name}: labels remain readable and separate from each other and the workspace controls`);
  };
  const capture = async name => { const file = `output/playwright/complete-${name}.png`; await page.screenshot({ path: file }); screenshots.push(file); };

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${base}/?3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 }); await ready();
  await page.locator('#cContents').click(); await page.locator('#contents-models').click();
  const ids = await page.locator('#model-contents [data-figure]').evaluateAll(nodes => nodes.map(n => n.dataset.figure));
  await page.locator('#close-contents').click();
  const counts = await page.evaluate(() => ({ pages: window.textbookDiagnostics.originalPageCount, sections: window.textbookDiagnostics.sectionCount, studies: window.textbookDiagnostics.studyCount, figures: window.textbookDiagnostics.figureCount }));
  check(ids.length === 60 && new Set(ids).size === 60 && counts.pages === 132 && counts.sections === 17 && counts.studies === 6, 'the original book and all teaching units have accessible unique demonstration entries');
  const captureIds = ['habitable','solar-distribution','geo-time','seismic-waves','external-spheres','air-composition','greenhouse','pressure-wind','wind-forces','water-renewal','density','desalination','karst-cave','river-valley','aeolian','terrain-observation','karst-livelihood','vegetation','soil-composition','soil-factors','soil-care','urban-waterlogging','flood','drought','cold-wave','gnss','warehouse'];
  const startIndex = Number(page.__reviewStart ?? 0);
  for (const [index, id] of ids.entries()) {
    if (index < startIndex) continue;
    await open(id);
    const cases = [];
    const conditions = await page.locator('#selections [data-selection]:not([data-process-node])').count();
    const nodes = await page.locator('#figure-controls [data-process-node]').count();
    for (let c = 0; c < Math.max(conditions, 1); c++) {
      if (conditions) await choose(`#selections [data-selection="${c}"]:not([data-process-node])`);
      for (const value of [0, 500, 1000]) {
        const s = await phase(value); inspect(s, `desktop/${id}/${c}/${value}`, value === 500); cases.push(s);
      }
      // Independent types can have different numbers of process bookmarks.
      // Inspect the actual rail of the currently selected condition.
      const conditionNodes = await page.locator('#figure-controls [data-process-node]').count();
      for (let node = 0; node < conditionNodes; node++) {
        await choose(`#figure-controls [data-process-node="${node}"]`);
        const s = await read(); inspect(s, `desktop/${id}/${c}/node-${node}`); cases.push(s);
      }
    }
    await phase(500);
    if (captureIds.includes(id)) await capture(`desktop-${id}`);
    await page.locator('#fold').click(); await ready(null); await settle();
    const closed = await read();
    check(closed.models === 0, `${id}: returning to the book releases the active model`);
    states.push({ id, conditions, nodes, cases, closed: closed.resources });
    await page.__writeReviewCheckpoint?.({ base, checks, failures, errors, states, labelIssues, layoutIssues, screenshots, startIndex });
    console.log(`Reviewed ${index + 1}/${ids.length}: ${id}`);
  }
  check(errors.length === 0, 'the complete current book traversal has no runtime or console errors');
  return { base, checks, failures, errors, states, labelIssues, layoutIssues, screenshots, startIndex,
    evidenceScope: 'Current production desktop traversal through the actual model directory, every independent condition at beginning/middle/end, and every continuous bookmark. Native keyboard range input, actual elevated geometry and sampled label rectangles. This does not certify every camera angle, physical hardware or scientific claim.' };
}
