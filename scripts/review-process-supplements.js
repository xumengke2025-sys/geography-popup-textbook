async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], layoutIssues = [], screenshots = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const key = 'pep-geography-first-original-v2';
  let fatal = null;
  const specs = {
    salinity: { choices: [0, 1, 2], labels: ['初始海水', '水量交换', '比较结果'], phases: [0, .45, 1], stages: ['ready', 'transferring', 'complete'] },
    soil: { choices: [0, 2, 5], labels: ['初始剖面', '水分下渗', '淋溶迁移', '淀积留存'], phases: [0, .2, .6, 1], stages: ['ready', 'infiltration', 'leaching', 'retained'] },
    slide: { choices: [0, 1], labels: ['初始物料', '沿坡下移', '坡脚留存'], phases: [0, .45, 1], stages: ['initial', 'moving', 'deposited'] },
    earthquake: { choices: [1, 2], labels: ['地震发生', '监测到达', '信号发出', '到达对照'] },
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === id && !d.turning && !d.figureBusy && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const read = () => page.evaluate(storageKey => {
    const d = window.textbookDiagnostics, range = document.querySelector('#phase'), note = document.querySelector('#process-note');
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        hidden: el.hidden || style.display === 'none' || style.visibility === 'hidden' || !r.width || !r.height };
    };
    const svg = document.querySelector('.flat-concept > svg'), markup = svg?.outerHTML ?? ''; let hash = 2166136261;
    for (let i = 0; i < markup.length; i++) hash = Math.imul(hash ^ markup.charCodeAt(i), 16777619);
    let saved = null; try { saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.figures?.[d.active]; } catch {}
    return { id: d.active, phase: d.state.phase, selection: d.state.selection, caption: d.state.caption,
      twoD: d.twoD, playing: d.playing, process: d.process, model: d.render?.geometry, saved,
      range: { value: Number(range.value), progress: range.style.getPropertyValue('--process-progress'), text: range.getAttribute('aria-valuetext') },
      choices: Array.from(document.querySelectorAll('#selections [data-selection]'), el => ({ index: Number(el.dataset.selection), pressed: el.getAttribute('aria-pressed'), text: el.textContent.trim() })),
      nodes: Array.from(document.querySelectorAll('#figure-controls [data-process-node]'), el => ({ index: Number(el.dataset.processNode), pressed: el.getAttribute('aria-pressed'), text: el.textContent.trim(), box: box(el) })),
      note: { ...box(note), title: document.querySelector('#process-title').textContent, stage: document.querySelector('#process-stage').textContent,
        text: document.querySelector('#process-text').textContent, position: note.dataset.position },
      header: box(document.querySelector('#desk-header')), dock: box(document.querySelector('.capsule')),
      modelBounds: window.textbookDebug?.processBounds ?? null,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      svg: svg ? { ...box(svg), attrs: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])), images: svg.querySelectorAll('image').length,
        hash: hash >>> 0, bytes: markup.length } : null,
    };
  }, key);
  const pause = async () => { if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); } };
  const go = async (id, mode = '3d') => {
    await page.goto(`${base}/?figure=${id}&${mode}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ready(id); await pause(); await frames();
    if (await page.locator('#reduced').isChecked()) {
      await page.locator('#desk-settings').click(); await page.locator('#reduced').uncheck();
      await page.locator('#settings-dialog [data-close]').click(); await frames();
    }
  };
  const phase = async value => {
    await pause(); const range = page.locator('#phase'); await range.focus();
    if (value <= 500) {
      await range.press('Home'); for (let i = 0; i < Math.floor(value / 100); i++) await range.press('PageUp');
      for (let i = 0; i < value % 100; i++) await range.press('ArrowRight');
    } else {
      await range.press('End'); const remainder = 1000 - value;
      for (let i = 0; i < Math.floor(remainder / 100); i++) await range.press('PageDown');
      for (let i = 0; i < remainder % 100; i++) await range.press('ArrowLeft');
    }
    await frames(); await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
    return read();
  };
  const choose = async index => {
    const before = await read();
    if (before.selection !== index) { await page.locator(`#selections [data-selection="${index}"]`).click(); await frames(); await pause(); }
    return read();
  };
  const phases = s => {
    if (s.id !== 'earthquake') return specs[s.id].phases;
    const m = s.twoD ? solids[`earthquake/${s.selection}`].model : s.model, e = m.events;
    return [e.earthquake + .01, e.stationP + .001, e.dispatch + .001, Math.min(1, Math.max(e.targetS + .15, e.warningArrival + .02))];
  };
  const inspect = (s, name, expectedStop) => {
    check(!!s.process && s.nodes.length === specs[s.id].labels.length && equal(s.nodes.map(n => n.text), specs[s.id].labels),
      `${name}: the lesson exposes its own causal process bookmarks`);
    check(close(s.range.value, Math.round(s.phase * 1000), 1e-7) && close(parseFloat(s.range.progress), s.phase * 100, 1e-7),
      `${name}: native thumb and fill follow the exact model phase`);
    if (!s.twoD) check(close(s.model.phase, s.phase), `${name}: actual Three.js model reads the exact same phase`);
    check(s.note.title === s.process.title && s.note.stage === s.process.stage && s.note.text.length > 0 && s.range.text.includes(s.process.title),
      `${name}: side note and accessible progress explain the same process state`);
    check(equal(s.nodes.filter(n => n.pressed === 'true').map(n => n.index), [s.process.activeStop]), `${name}: precisely the active stage is highlighted`);
    check(s.choices.length === (s.id === 'salinity' ? 3 : s.id === 'soil' ? 6 : s.id === 'slide' ? 2 : 3),
      `${name}: independent experiments or selectable structures keep their separate choice controls`);
    if (expectedStop !== undefined) {
      check(s.process.activeStop === expectedStop, `${name}: the clicked bookmark reaches the expected physical stage`);
      if (!s.twoD && s.id !== 'earthquake') check(s.model.stage === specs[s.id].stages[expectedStop], `${name}: actual model reaches the expected named process stage`);
    }
  };
  const inspectSvg = (s, solid, name) => {
    inspect(s, name);
    check(s.twoD && s.phase === solid.phase && s.selection === solid.selection && s.process.key === solid.process.key,
      `${name}: native SVG restores identical paused input and explanation`);
    check(s.svg?.images === 0 && s.svg.bytes > 300, `${name}: an actual native vector demonstration is present`);
    const a = s.svg.attrs, m = solid.model;
    if (s.id === 'salinity') check(close(Number(a['data-phase']), m.phase) && close(Number(a['data-water']), m.waterAmount)
      && close(Number(a['data-salt']), m.saltMass) && close(Number(a['data-concentration']), m.concentration), `${name}: vector water, salt and concentration match the three-dimensional balance`);
    if (s.id === 'soil') check(a['data-soil-profile'] === m.stage && close(Number(a['data-phase']), m.phase, .0006)
      && ['source', 'moving', 'deposited'].every(k => Number(a[`data-${k}`]) === m.inventory[k]), `${name}: vector soil material inventory matches the physical soil column`);
    if (s.id === 'slide') check(a['data-landslide-mode'] === m.mode && a['data-landslide-stage'] === m.stage
      && close(Number(a['data-landslide-phase']), m.phase) && close(Number(a['data-landslide-stock']), m.stockVolume), `${name}: vector motion preserves the physical mode, phase and finite stock`);
    if (s.id === 'earthquake') check(a['data-quake-view'] === m.view && a['data-quake-stage'] === m.stage
      && close(Number(a['data-quake-phase']), m.phase) && a['data-quake-detected'] === String(m.detected)
      && a['data-quake-alerted'] === String(m.alerted) && a['data-quake-s-arrived'] === String(m.sArrived), `${name}: vector warning and S-wave arrival use the actual spatial comparison`);
  };
  const startTrace = () => page.evaluate(() => {
    const trace = { active: true, start: performance.now(), samples: [] }; window.__supplementTimelineReview = trace;
    const sample = () => {
      if (!trace.active) return; const d = window.textbookDiagnostics, range = document.querySelector('#phase');
      trace.samples.push({ phase: d.state.phase, modelPhase: d.render?.geometry?.phase, stop: d.process?.activeStop, seeking: d.process?.seeking,
        range: Number(range.value), playing: d.playing,
        pressed: Array.from(document.querySelectorAll('#figure-controls [data-process-node][aria-pressed="true"]'), el => Number(el.dataset.processNode)) });
      if (trace.samples.length < 1000) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  const finishTrace = () => page.evaluate(() => {
    const trace = window.__supplementTimelineReview; trace.active = false;
    return { elapsedMs: performance.now() - trace.start, samples: trace.samples };
  });
  const seek = async index => {
    const before = await read(), target = phases(before)[index], name = `${before.id}/${before.selection}/node-${index}`;
    await startTrace(); await page.locator(`#figure-controls [data-process-node="${index}"]`).click();
    await page.waitForFunction(target => {
      const d = window.textbookDiagnostics; return !d.process.seeking && Math.abs(d.state.phase - target) < 1e-8;
    }, target, { timeout: 15000 });
    await frames(); const after = await read(), trace = await finishTrace(); inspect(after, name, index);
    check(!after.playing && close(after.phase, target) && after.selection === before.selection, `${name}: the process bookmark seeks within the chosen independent experiment`);
    check(trace.samples.every(s => close(s.range, Math.round(s.phase * 1000)) && equal(s.pressed, [s.stop])
      && (after.twoD || close(s.modelPhase, s.phase))), `${name}: passive animation frames keep physical model, thumb and active node synchronized`);
    if (!close(before.phase, target)) check(trace.samples.filter(s => s.seeking && !close(s.phase, target) && !close(s.phase, before.phase)).length >= 3,
      `${name}: the destination is reached through visible intermediate process states`);
    check(close(after.saved.phase, after.phase) && after.saved.selection === after.selection, `${name}: the exact paused condition is saved`);
    states.push({ name, before, after, trace }); return after;
  };
  const layout = async name => {
    await page.waitForTimeout(950); await frames(); const s = await read(), vp = s.viewport;
    const overlap = (a, b) => !!a && !!b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 2
      && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 2;
    const inside = b => b && b.left >= -1 && b.right <= vp.width + 1 && b.top >= -1 && b.bottom <= vp.height + 1;
    const issues = [];
    if (s.note.hidden || !inside(s.note)) issues.push('process explanation outside viewport');
    if (overlap(s.note, s.header) || overlap(s.note, s.dock)) issues.push('process explanation overlaps header or dock');
    if (vp.scrollWidth > vp.width + 1 || !inside(s.dock) || s.nodes.some(n => !inside(n.box))) issues.push('controls overflow');
    if (s.twoD && (overlap(s.svg, s.note) || overlap(s.svg, s.header) || overlap(s.svg, s.dock))) issues.push('SVG overlaps explanation, header or dock');
    if (!s.twoD && s.note.position === 'side' && overlap(s.note, s.modelBounds)) issues.push('side explanation overlaps the physical model');
    check(!issues.length, `${name}: process explanation and controls remain separate from the demonstration`);
    if (issues.length) layoutIssues.push({ name, ...s, issues });
    const path = `output/playwright/process-supplement-${name.replaceAll('/', '-')}.png`; await page.screenshot({ path }); screenshots.push(path);
    return s;
  };

  const solids = {};
  try {
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const [id, spec] of Object.entries(specs)) {
    await go(id);
    for (const choice of spec.choices) {
      await choose(choice); await phase(0); const first = await read(); inspect(first, `${id}/${choice}/initial`);
      for (let i = 0; i < spec.labels.length; i++) await seek(i);
      const final = await phase(1000); inspect(final, `${id}/${choice}/completed`);
      await page.waitForTimeout(180); const held = await read();
      check(held.phase === 1 && !held.playing && held.model.stage === final.model.stage,
        `${id}/${choice}: completed causal result remains in place while paused`);
      solids[`${id}/${choice}`] = final; await layout(`desktop/${id}-${choice}`);
    }
    if (id === 'earthquake') {
      await choose(0); const structure = await read();
      check(structure.process === null && structure.nodes.length === 0 && structure.note.hidden,
        'earthquake: source/epicentre structure does not inherit an unrelated warning-process timeline');
      states.push({ name: 'earthquake/independent-structure', ...structure });
    }
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const [id, spec] of Object.entries(specs)) {
    await go(id, '2d');
    for (const choice of spec.choices) {
      await choose(choice); const final = await phase(1000); inspectSvg(final, solids[`${id}/${choice}`], `tablet/${id}-${choice}`);
      const start = await seek(0), end = await seek(spec.labels.length - 1);
      check(start.svg.hash !== end.svg.hash, `${id}/${choice}: native SVG changes through the same real process-node controls`);
    }
    await layout(`tablet/${id}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [id, choice] of [['salinity', 2], ['soil', 2], ['slide', 1], ['earthquake', 2]]) {
    await go(id, '2d'); await choose(choice); const final = await phase(1000);
    inspectSvg(final, solids[`${id}/${choice}`], `phone/${id}`); await layout(`phone/${id}`);
  }
  } catch (error) {
    fatal = { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2500) };
    failures.push(`Fatal browser workflow: ${fatal.message}`);
    try { states.push({ name: 'fatal-workflow', snapshot: await read() });
      const path = 'output/playwright/process-supplement-fatal-workflow.png'; await page.screenshot({ path }); screenshots.push(path); } catch {}
  }
  check(errors.length === 0, 'supplementary causal-process workflows have no browser runtime or console errors');
  return { base, checks, failures, errors, fatal, layoutIssues, states, screenshots,
    evidenceScope: 'Actual independent-choice clicks, native range keyboard input and process-bookmark transitions with passive frame sampling. Exercises all three salinity experiments, selected soil layers, both slope processes and near/far warning comparisons. Native SVG parity and simulated desktop/tablet/phone layouts are checked; real touch hardware is not certified.' };
}
