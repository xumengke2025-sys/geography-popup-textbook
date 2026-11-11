async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], screenshots = [], labelIssues = [], layoutIssues = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  const near = (a, b, epsilon = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < epsilon;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text().slice(0, 400)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const go = async (id, mode = '3d') => {
    await page.goto(`${base}/?figure=${id}&${mode}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && (d.twoD || d.render.modelState === 'live'); }, id, { timeout: 45000 });
    await frames();
  };
  const setPhase = async value => {
    const range = page.locator('#phase'); await range.focus(); await range.press(value < 500 ? 'Home' : 'End');
    const distance = value < 500 ? value : 1000 - value;
    for (let i = 0; i < Math.floor(distance / 100); i++) await range.press(value < 500 ? 'PageUp' : 'PageDown');
    for (let i = 0; i < distance % 100; i++) await range.press(value < 500 ? 'ArrowRight' : 'ArrowLeft');
    await frames();
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = !d.twoD ? b?.entry?.art?.geometry : null;
    const box = el => { const r = el?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
    const svg = document.querySelector('.flat-concept > svg'), center = g?.p(.49, .74, 5 * g.width / 100);
    return { id: d.active, phase: d.state.phase, selection: d.state.selection, playing: d.playing, twoD: d.twoD,
      model: d.render?.geometry, labels: d.twoD ? svg ? Array.from(svg.querySelectorAll('text'), el => {
        const r = el.getBoundingClientRect(), c = el.getScreenCTM();
        return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, fontPx: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(c.a, c.b) };
      }) : [] : d.render?.labels ?? [],
      planets: g ? g.meshes.filter(m => m.userData.body && m.userData.body !== 'sun').map(m => ({ name: m.userData.body, point: m.position.toArray().map((n, i) => (n - center[i]) / (g.width / 100)) })) : [],
      layerObjects: g ? g.meshes.filter(m => m.userData.layerPart === 'outer').map(m => ({ layer: m.userData.layer, visible: m.visible, offset: m.position.toArray().map(n => n / (g.width / 100)) })) : [],
      svg: svg ? { box: box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])), images: svg.querySelectorAll('image').length,
        planets: Array.from(svg.querySelectorAll('[data-planet]'), el => ({ name: el.getAttribute('data-planet'), point: [(Number(el.getAttribute('cx')) - 320) / 5.5, 0, (Number(el.getAttribute('cy')) - 175) / (5.5 * .72)] })) } : null,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      dock: box(document.querySelector('.capsule')), header: box(document.querySelector('#desk-header')) };
  });
  const layout = async name => {
    await page.waitForTimeout(950); const s = await read();
    const overlap = (a, b) => a && b && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const inside = r => r.left >= -1 && r.right <= s.viewport.width + 1 && r.top >= -1 && r.bottom <= s.viewport.height + 1;
    const bad = s.labels.filter(l => l.fontPx < (s.viewport.width < 680 ? 15 : 18) || !inside(l) || overlap(l, s.dock) || overlap(l, s.header));
    const collisions = s.labels.flatMap((a, i) => s.labels.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.text, b.text]));
    if (bad.length || collisions.length) labelIssues.push({ name, bad, collisions, labels: s.labels });
    check(s.labels.length > 0 && !bad.length && !collisions.length, `${name}: the actual diagram labels are readable and separate`);
    const issues = []; if (s.viewport.scrollWidth > s.viewport.width + 1 || (s.twoD && overlap(s.svg.box, s.dock))) issues.push('diagram/viewport/control overlap');
    if (issues.length) layoutIssues.push({ name, issues }); check(!issues.length, `${name}: diagram stays within its reading area`);
    const file = `output/playwright/continuous-${name}.png`; await page.screenshot({ path: file }); screenshots.push(file); states.push({ name, ...s });
  };
  let fatal = null;
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await go('solar'); await setPhase(371); const solar = await read();
    check(solar.planets.length === 8 && solar.model.bodies === 8 && !solar.model.source.periodsToScale, 'all eight actual 3D planet meshes use schematic units');
    await page.locator('#cContents').click(); await page.locator('#mode').click(); await page.waitForFunction(() => window.textbookDiagnostics.twoD && !window.textbookDiagnostics.figureBusy); await frames();
    const vector = await read(); check(vector.svg.images === 0 && near(vector.phase, solar.phase) && !vector.playing, 'changing renderer retains paused solar progress without a diagram crop');
    check(vector.svg.planets.every(p => p.point.every((n, i) => near(n, solar.planets.find(b => b.name === p.name).point[i]))), 'the native SVG planets occupy exactly the same normalized orbit positions as the actual meshes');
    await layout('desktop-solar-svg');
    await setPhase(0); const start = await read(); await setPhase(1000); const end = await read();
    check(end.svg.planets.every(p => p.point.every((n, i) => near(n, start.svg.planets.find(b => b.name === p.name).point[i]))), 'the native vector orbit closes at the continuous cycle boundary');
    for (const selection of [0, 1, 2, 3]) {
      await go('earth'); await page.locator(`#selections [data-selection="${selection}"]`).click(); await page.waitForTimeout(1000); await frames(); const model = await read();
      await page.locator('#cContents').click(); await page.locator('#mode').click(); await page.waitForFunction(() => window.textbookDiagnostics.twoD && !window.textbookDiagnostics.figureBusy); await frames();
      const flat = await read(), source = JSON.parse(flat.svg.attrs['data-earth-layers-state']);
      check(source.selection === model.selection && flat.svg.images === 0 && !flat.playing, `earth/${selection}: layer focus survives switching to native SVG`);
      check(source.layers.every(l => l.visible === model.layerObjects[l.index].visible && l.offset.every((n, i) => near(n, model.layerObjects[l.index].offset[i], .002))), `earth/${selection}: SVG extraction and actual shell groups share the same visibility and translation`);
      check(!model.model.source.radiiToScale && !model.model.source.depictsSeismicVelocity, `earth/${selection}: the source distinguishes this schematic shell from the full printed velocity graph`);
      await layout(`desktop-earth-${selection}-svg`);
    }
    await page.locator('.flat-concept [data-model-selection="3"]').first().focus(); await page.keyboard.press('Enter'); await frames();
    check((await read()).selection === 0, 'pressing the selected native shell with the keyboard restores the complete cutaway');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of ['solar', 'earth']) { await go(id, '2d'); await layout(`phone-${id}-svg`); }
  } catch (error) { fatal = String(error?.stack ?? error); failures.push(fatal); }
  return { base, checks, failures, errors, states, screenshots, labelIssues, layoutIssues, fatal,
    evidenceScope: 'Actual 3D planet and shell positions compared with native vectors, renderer switching and SVG keyboard selections; desktop and simulated phone screenshots. No physical device or whole-book aesthetic acceptance.' };
}
