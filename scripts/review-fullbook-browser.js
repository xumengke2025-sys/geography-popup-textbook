async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [], labelIssues = [], resources = [];
  const check = (value, label) => { (value ? checks : failures).push(label); };
  page.on('pageerror', e => errors.push(e.message));
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy);
  const diag = () => page.evaluate(() => window.textbookDiagnostics);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
  await page.locator('#cStill').click();
  const open = async id => {
    await page.locator('#cContents').click();
    await page.locator('.figure-index').evaluate(e => { e.open = true; });
    await page.locator(`#contents [data-figure="${id}"]`).click();
    await page.waitForFunction(id => window.textbookDiagnostics.active === id && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.modelState === 'live', id);
  };
  const fold = async () => {
    await page.locator('#fold').click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active && window.textbookDiagnostics.render?.models === 0);
  };
  const setPhase = async value => {
    await page.locator('#phase').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.render?.geometry?.phase - value / 1000) < 1e-7, value);
  };
  const getLabelIssues = async (id, selection) => {
    const d = await diag(), r = d.render, dock = await page.locator('.capsule').boundingBox(), vp = page.viewportSize();
    const outside = r.labels.filter(l => l.left < 0 || l.right > vp.width || l.top < 0 || l.bottom > dock.y - 3);
    const small = r.labels.filter(l => l.fontPx < 18);
    const pairs = r.labels.flatMap((a, i) => r.labels.slice(i + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2).map(b => [a.text, b.text]));
    if (outside.length || small.length || pairs.length) labelIssues.push({ viewport: vp, id, selection, outside, small, pairs, labels: r.labels });
  };
  const ids = await page.locator('.figure-index [data-figure]').evaluateAll(nodes => nodes.map(n => n.dataset.figure));
  check(ids.length === 60, '60 spatial explanations are connected to the original textbook');
  check((await diag()).sectionCount === 17 && (await diag()).studyCount === 6, '17 sections and 6 problem studies are present');
  const screenshots = ['cosmic-scale', 'solar-activity', 'mars-base', 'greenhouse', 'wind-forces', 'haze', 'salinity', 'density', 'desalination', 'delta', 'coastal-landform', 'terrain-observation', 'karst-livelihood', 'vegetation', 'soil-factors', 'urban-waterlogging', 'flood', 'gnss', 'warehouse'];
  for (const [index, id] of ids.entries()) {
    await open(id);
    const initial = (await diag()).render;
    check(initial.geometry.solids > 0 && initial.geometry.sceneElevation >= 34 && initial.geometry.imageMappedMeshes === 0, `${id}: genuine elevated geometry without image-mapped surfaces`);
    const options = await page.locator('#selections button').count();
    const samples = [];
    for (let selection = 0; selection < Math.max(1, options); selection++) {
      if (options) await page.locator(`#selections [data-selection="${selection}"]`).click();
      for (const value of [0, 500, 1000]) {
        await setPhase(value);
        const d = (await diag()).render;
        check(d.geometry.extent.every(Number.isFinite) && d.geometry.extent.every(n => n > 0), `${id}/${selection}/${value}: finite spatial extent`);
        samples.push({ selection, phase: value / 1000, geometry: d.geometry });
      }
      await setPhase(500); await getLabelIssues(id, selection);
    }
    const d = (await diag()).render;
    states.push({ id, options, samples, labels: d.labels, triangles: d.triangles, calls: d.calls });
    if (screenshots.includes(id)) await page.screenshot({ path: `output/playwright/fullbook-${id}.png` });
    await fold();
    resources.push({ id, ...((({ geometries, textures, images }) => ({ geometries, textures, images }))((await diag()).render)) });
    if ((index + 1) % 10 === 0) console.log(`Checked ${index + 1}/${ids.length} models`);
  }
  for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    for (const id of ['breeze', 'mars-base', 'wind-forces', 'salinity', 'coastal-landform', 'terrain-observation', 'vegetation', 'soil-factors', 'urban-waterlogging', 'warehouse']) {
      await open(id); await setPhase(500); await getLabelIssues(id, 0);
      const box = await page.locator('.capsule').boundingBox();
      check(box.x >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${id}/${size.width}: controls fit`);
      if (size.width === 1024 && ['vegetation', 'warehouse', 'mars-base'].includes(id)) await page.screenshot({ path: `output/playwright/fullbook-tablet-${id}.png` });
      await fold();
    }
  }
  check(!errors.length, 'no browser exceptions');
  console.log(`Label issues: ${labelIssues.length}; functional failures: ${failures.length}`);
  return { base, browser: page.context().browser().version(), errors, failures, checks, states, labelIssues, resources };
}
