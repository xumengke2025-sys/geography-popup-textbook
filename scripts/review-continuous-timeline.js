async page => {
  const base = (page.__reviewBase ?? 'http://127.0.0.1:4175').replace(/\/$/, '');
  const checks = [], failures = [], errors = [], states = [], layoutIssues = [], screenshots = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const key = 'pep-geography-first-original-v2';
  const specs = {
    breeze: { labels: ['夜晚', '日出', '白天', '日落'], phases: [0, .25, .5, .75], stages: ['夜间', '日出附近', '午后', '日落附近'] },
    'coastal-landform': { labels: ['凹蚀', '失撑', '崩塌', '平台'], phases: [.18, .44, .67, 1], stages: ['undercut', 'fracture', 'collapse', 'platform'] },
    tides: { labels: ['低潮', '涨潮', '高潮', '落潮'], phases: [0, .25, .5, .75], stages: ['low', 'rising', 'high', 'falling'] },
    river: { labels: ['河曲', '洪水冲颈', '牛轭湖'], phases: [0, .6, 1], stages: [0, 1, 2] },
    gis: { labels: ['图层分离', '叠合统计'], phases: [0, 1], stages: ['separated', 'result'] },
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
    const d = window.textbookDiagnostics, m = d.render?.geometry, range = document.querySelector('#phase');
    const box = element => {
      if (!element) return null;
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        hidden: element.hidden || style.display === 'none' || style.visibility === 'hidden' || r.width === 0 || r.height === 0 };
    };
    const note = document.querySelector('#process-note'), svg = document.querySelector('.flat-concept > svg');
    const markup = svg?.outerHTML ?? ''; let hash = 2166136261;
    for (let i = 0; i < markup.length; i++) hash = Math.imul(hash ^ markup.charCodeAt(i), 16777619);
    let bookmark = null; try { bookmark = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); } catch {}
    return {
      id: d.active, phase: d.state?.phase, selection: d.state?.selection, caption: d.state?.caption,
      playing: d.playing, twoD: d.twoD, process: d.process,
      model: m ? { kind: m.kind, phase: m.phase, selection: m.selection, stage: m.stage, caption: m.caption,
        selected: m.selected, groundX: m.groundX, upperX: m.upperX, strength: m.strength,
        flowRate: m.flowRate, flagArea: m.flagArea, continuousDayNight: m.continuousDayNight,
        waterLevel: m.waterLevel, closedOxbow: m.closedOxbow, resultReady: m.resultReady, counts: m.counts,
        undercut: m.undercut, exposedPlatform: m.exposedPlatform } : null,
      range: { value: Number(range.value), text: range.getAttribute('aria-valuetext'),
        progress: range.style.getPropertyValue('--process-progress'), focused: document.activeElement === range },
      nodes: Array.from(document.querySelectorAll('#figure-controls [data-process-node]'), button => ({
        index: Number(button.dataset.processNode), text: button.textContent.trim(), pressed: button.getAttribute('aria-pressed'),
        selection: button.dataset.selection, hidden: box(button).hidden })),
      choices: Array.from(document.querySelectorAll('#selections [data-selection]:not([data-process-node])'), button => ({
        selection: Number(button.dataset.selection), text: button.textContent.trim(), pressed: button.getAttribute('aria-pressed') })),
      note: { ...box(note), position: note.dataset.position, heading: document.querySelector('#process-stage').textContent,
        title: document.querySelector('#process-title').textContent, text: document.querySelector('#process-text').textContent,
        titleFont: parseFloat(getComputedStyle(document.querySelector('#process-title')).fontSize),
        textFont: parseFloat(getComputedStyle(document.querySelector('#process-text')).fontSize) },
      dock: box(document.querySelector('.capsule')), header: box(document.querySelector('#desk-header')),
      processBounds: window.textbookDebug?.processBounds ?? null,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      svg: svg ? { bounds: box(svg), attributes: Object.fromEntries(Array.from(svg.attributes, a => [a.name, a.value])),
        aria: svg.getAttribute('aria-label'), text: svg.textContent, hash: hash >>> 0, bytes: markup.length,
        airflowOpacity: Number(svg.querySelector('g[stroke="#356f78"]')?.getAttribute('opacity')),
        stations: svg.querySelectorAll('[data-station]').length, images: svg.querySelectorAll('image').length } : null,
      saved: bookmark?.figures?.[d.active] ?? null, reduced: document.querySelector('#reduced').checked,
    };
  }, key);
  const pause = async () => {
    if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); }
  };
  const setReduced = async value => {
    if (await page.locator('#reduced').isChecked() === value) return;
    await page.locator('#desk-settings').click();
    await page.locator('#reduced').setChecked(value);
    await page.locator('#settings-dialog [data-close]').click(); await frames();
  };
  const go = async (id, twoD = false) => {
    await page.goto(`${base}/?figure=${encodeURIComponent(id)}&${twoD ? '2d' : '3d'}&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ready(id); await pause(); await frames();
  };
  const phase = async value => {
    await pause(); const range = page.locator('#phase'); await range.focus();
    if (value <= 500) {
      await range.press('Home');
      for (let i = 0; i < Math.floor(value / 100); i++) await range.press('PageUp');
      for (let i = 0; i < value % 100; i++) await range.press('ArrowRight');
    } else {
      await range.press('End'); const remainder = 1000 - value;
      for (let i = 0; i < Math.floor(remainder / 100); i++) await range.press('PageDown');
      for (let i = 0; i < remainder % 100; i++) await range.press('ArrowLeft');
    }
    await frames();
    await page.waitForFunction(value => Math.abs(window.textbookDiagnostics.state.phase - value / 1000) < 1e-8, value);
    return read();
  };
  const inspect = (s, name, expected = {}) => {
    check(close(s.range.value, Math.round(s.phase * 1000), 1e-7), `${name}: range thumb reads the current lesson phase`);
    check(close(parseFloat(s.range.progress), s.phase * 100, 1e-7), `${name}: track fill reads the same continuous phase`);
    if (!s.twoD) check(close(s.model?.phase, s.phase), `${name}: actual Three.js geometry reads the same phase`);
    check(!!s.process && s.note.title === s.process.title && s.note.heading === s.process.stage && s.note.text.length > 0,
      `${name}: the visible explanation reads the current process state`);
    check(!!s.process && s.range.text?.includes(s.process.title) && s.range.text.includes(s.process.stage),
      `${name}: accessible range text announces the current explanation`);
    check(!!s.process && equal(s.nodes.filter(node => node.pressed === 'true').map(node => node.index), [s.process.activeStop]),
      `${name}: exactly the current stage node is highlighted`);
    if (expected.stop !== undefined) check(s.process?.activeStop === expected.stop, `${name}: the expected process stage is active`);
    if (expected.stage !== undefined) check((s.id === 'breeze' ? s.process?.stage : s.model?.stage) === expected.stage,
      `${name}: the physical process and explanation reach the expected stage`);
    if (s.id === 'breeze') check(s.process?.stage === s.caption, `${name}: daylight stage matches the scientific lesson state`);
    if (!s.twoD && s.id === 'coastal-landform') check(['undercut', 'fracture', 'collapse', 'platform'][s.process?.activeStop] === s.model?.stage,
      `${name}: cliff narrative follows the actual collapse stage`);
    if (!s.twoD && s.id === 'tides') check(['low', 'rising', 'high', 'falling'][s.process?.activeStop] === s.model?.stage,
      `${name}: tide narrative follows the actual water stage`);
    if (!s.twoD && s.id === 'river') check(s.process?.activeStop === s.model?.stage && s.process?.title === s.caption,
      `${name}: river narrative follows the actual cutoff stage`);
    if (!s.twoD && s.id === 'gis') check(s.process?.activeStop === (['separated', 'aligning'].includes(s.model?.stage) ? 0 : 1),
      `${name}: GIS narrative follows actual layer alignment and classification`);
  };
  const inspectLayout = async name => {
    await page.waitForFunction(() => !document.querySelector('#process-note').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(850);
    if (!(await read()).twoD) {
      let previous = null, stable = 0;
      for (let attempt = 0; attempt < 70; attempt++) {
        const current = await page.evaluate(() => [...window.textbookDebug.camera.position.toArray(), ...window.textbookDebug.camera.quaternion.toArray()]);
        stable = previous && current.every((value, i) => Math.abs(value - previous[i]) < .00001) ? stable + 1 : 0;
        if (stable >= 3) break;
        previous = current; await page.waitForTimeout(75);
      }
      check(stable >= 3, `${name}: camera settles before note geometry is measured`);
    }
    await frames(); const s = await read(), n = s.note, vp = s.viewport;
    const intersects = (a, b) => !!a && !!b && !a.hidden && !b.hidden && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
    const issues = [];
    if (n.hidden || n.left < -1 || n.right > vp.width + 1 || n.top < -1 || n.bottom > vp.height + 1) issues.push('process note outside viewport');
    if (intersects(n, s.dock)) issues.push('process note intersects dock');
    if (intersects(n, s.header)) issues.push('process note intersects header');
    if (s.twoD && intersects(n, s.svg?.bounds)) issues.push('process note intersects SVG demonstration');
    if (s.twoD && intersects(s.svg?.bounds, s.dock)) issues.push('SVG demonstration intersects dock');
    if (vp.scrollWidth > vp.width + 1) issues.push('horizontal document overflow');
    if (n.position === 'side' && intersects(n, s.processBounds)) issues.push('side note intersects model bounds');
    check(!issues.length, `${name}: note clears header, dock and horizontal viewport boundaries`);
    const layout = { name, viewport: vp, note: n, dock: s.dock, header: s.header, processBounds: s.processBounds, issues };
    if (issues.length) layoutIssues.push(layout);
    states.push({ name: `${name}/layout`, ...layout }); return s;
  };
  // Passive review-only sampling: no production handler, state setter or clock
  // is invoked. Every shortcut and range interaction below uses actual UI.
  const startTrace = () => page.evaluate(() => {
    if (window.__continuousTimelineReview) window.__continuousTimelineReview.active = false;
    const trace = { active: true, startedAt: performance.now(), samples: [] }; window.__continuousTimelineReview = trace;
    const sample = () => {
      if (!trace.active) return;
      const d = window.textbookDiagnostics, range = document.querySelector('#phase');
      trace.samples.push({ ms: performance.now() - trace.startedAt, phase: d.state?.phase, playing: d.playing,
        seeking: d.process?.seeking, stop: d.process?.activeStop, processStage: d.process?.stage,
        caption: d.state?.caption, modelPhase: d.render?.geometry?.phase, modelStage: d.render?.geometry?.stage,
        range: Number(range.value), focused: document.activeElement === range,
        pressed: Array.from(document.querySelectorAll('#figure-controls [data-process-node][aria-pressed="true"]'), b => Number(b.dataset.processNode)) });
      if (trace.samples.length < 2000) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  const finishTrace = () => page.evaluate(() => {
    const trace = window.__continuousTimelineReview; trace.active = false;
    return { elapsedMs: performance.now() - trace.startedAt, samples: trace.samples };
  });
  const inspectTrace = (trace, name, twoD) => {
    check(trace.samples.length >= 3 && trace.samples.every(s => close(s.range, Math.round(s.phase * 1000), 1e-7)),
      `${name}: native range follows every sampled animation frame`);
    if (!twoD) check(trace.samples.every(s => close(s.modelPhase, s.phase)), `${name}: Three.js phase follows every sampled animation frame`);
    check(trace.samples.every(s => equal(s.pressed, [s.stop])), `${name}: stage highlight follows every sampled animation frame`);
  };
  const node = index => page.locator(`#figure-controls [data-process-node="${index}"]`);
  const seek = async (id, index, { smooth = true, name = `${id}/node-${index}` } = {}) => {
    const before = await read(), target = specs[id].phases[index];
    await startTrace(); await node(index).click();
    await page.waitForFunction(target => {
      const d = window.textbookDiagnostics;
      return d.process && !d.process.seeking && Math.abs(d.state.phase - target) < 1e-8;
    }, target, { timeout: 15000 });
    await frames(); const after = await read(), trace = await finishTrace();
    check(close(after.phase, target) && !after.playing && !after.process.seeking, `${name}: shortcut finishes at its exact paused phase`);
    if (smooth && !close(before.phase, target)) {
      const moving = trace.samples.filter(s => s.seeking && !close(s.phase, before.phase, 1e-5) && !close(s.phase, target, 1e-5));
      check(moving.length >= 3 && new Set(moving.map(s => s.phase.toFixed(5))).size >= 3,
        `${name}: real intermediate phases appear before the destination`);
      check(trace.elapsedMs >= 650, `${name}: normal seek retains its approximately 0.72-second transition`);
      check(trace.samples.every(s => !s.playing), `${name}: seeking does not run a second playback clock`);
    }
    inspectTrace(trace, name, after.twoD);
    inspect(after, name, { stop: index, ...(!after.twoD ? { stage: specs[id].stages[index] } : {}) });
    check(close(after.saved?.phase, after.phase) && after.saved.selection === after.selection, `${name}: completed seek saves its exact phase and selection`);
    states.push({ name, before, after, trace }); return after;
  };
  const capture = async name => {
    const path = `output/playwright/continuous-${name}.png`; await page.screenshot({ path }); screenshots.push(path);
  };
  const inspectSvg = (s, solid, name) => {
    inspect(s, name);
    check(s.twoD && close(s.phase, solid.phase) && s.selection === solid.selection && !s.playing,
      `${name}: native SVG restores the identical paused process input`);
    check(s.process?.key === solid.process?.key && s.process?.title === solid.process?.title && s.process?.activeStop === solid.process?.activeStop,
      `${name}: SVG and Three.js use the identical explanation and stage`);
    check(!!s.svg && s.svg.bytes > 300 && s.svg.images === 0, `${name}: a native vector demonstration is present`);
    if (s.id === 'breeze') {
      check(s.svg?.aria.includes(s.caption), `${name}: vector diagram announces the same daylight stage`);
      check(close(s.svg?.airflowOpacity, solid.model.strength), `${name}: SVG airflow opacity uses the same strength as the physical flag and airflow`);
      const ground = solid.model.groundX > 0 ? '陆地 → 海洋' : solid.model.groundX < 0 ? '海洋 → 陆地' : '局地环流很弱';
      check(s.svg?.aria.includes(ground), `${name}: vector near-surface direction matches the physical scene`);
    } else if (s.id === 'coastal-landform') {
      check(s.svg?.attributes['data-coastal-process'] === solid.model.stage && close(Number(s.svg.attributes['data-phase']), solid.phase, .0001),
        `${name}: vector cliff stage and progress match the solid collapse`);
    } else if (s.id === 'tides') {
      check(s.svg?.attributes['data-tide-stage'] === solid.model.stage && close(Number(s.svg.attributes['data-tide-phase']), solid.phase)
        && close(Number(s.svg.attributes['data-tide-level']), solid.model.waterLevel), `${name}: vector tide uses the same water stage and level`);
    } else if (s.id === 'river') {
      check(s.svg?.aria.includes(solid.caption) && s.svg.text.includes(solid.caption), `${name}: vector river retains the physical cutoff stage`);
    } else if (s.id === 'gis') {
      check(s.svg?.attributes['data-gis-stage'] === solid.model.stage && s.svg.stations === 33,
        `${name}: vector overlay preserves the physical stage and the same 33 stations`);
    }
  };

  await page.setViewportSize({ width: 1366, height: 900 }); await go('breeze'); await setReduced(false);
  check(equal((await read()).nodes.map(n => n.text), specs.breeze.labels), 'breeze uses four process bookmarks instead of independent day/night buttons');
  await phase(500);
  for (const index of [0, 1, 2, 3]) await seek('breeze', index);
  for (const [value, direction, stop, title] of [[250, -1, 1, '陆风'], [750, 1, 3, '海风'], [800, 0, 3, '风很弱']]) {
    const s = await phase(value); inspect(s, `breeze/physical-${value}`, { stop });
    check(s.process.title.includes(title) && s.model.kind === 'sea-breeze' && s.model.continuousDayNight === true
      && s.model.groundX === -direction && s.model.upperX === direction,
    `breeze/${value}: narration and actual near-surface/upper airflow agree`);
    check(direction === 0 ? s.model.strength === 0 && s.model.flowRate === 0 && s.model.selected === 'transition'
      : s.model.strength > .08 && Math.sign(s.model.flowRate) === direction,
    `breeze/${value}: physical flag/airflow weakens or moves with the same scientific state`);
    states.push({ name: `breeze/physical-${value}`, ...s });
  }
  await phase(750); await inspectLayout('desktop-breeze'); await capture('desktop-breeze');

  // Cross a genuine daylight boundary with playback, while the slider itself
  // holds keyboard focus. Focusing the range must not freeze its native thumb.
  const focusedStart = await phase(145); await page.locator('#cPause').click(); await page.locator('#phase').focus();
  await startTrace();
  await page.waitForFunction(() => {
    const d = window.textbookDiagnostics; return d.playing && d.state.phase > .155 && d.process.activeStop === 1;
  }, null, { timeout: 6000 });
  await frames(); const focusedPlaying = await read(), playbackTrace = await finishTrace();
  check(focusedStart.process.activeStop === 0 && focusedPlaying.process.activeStop === 1 && focusedPlaying.process.stage === '日出附近',
    'breeze playback crosses a stage boundary and automatically highlights sunrise');
  check(focusedPlaying.range.focused && focusedPlaying.range.value > focusedStart.range.value
    && playbackTrace.samples.every(s => s.focused), 'focused range keeps updating during real playback');
  inspectTrace(playbackTrace, 'focused-breeze-playback', false); inspect(focusedPlaying, 'focused-breeze-playback');
  await page.locator('#phase').press('ArrowRight'); await frames(); const sliderPaused = await read();
  await page.waitForTimeout(180); const sliderHeld = await read();
  check(!sliderPaused.playing && !sliderPaused.process.seeking && sliderPaused.range.focused && sliderHeld.phase === sliderPaused.phase,
    'native slider input pauses playback and holds the inspected phase');
  states.push({ name: 'focused-playback-and-slider-pause', focusedStart, focusedPlaying, sliderPaused, sliderHeld, trace: playbackTrace });

  await phase(100); await startTrace();
  for (const index of [2, 0, 3, 1]) await node(index).click();
  await page.waitForFunction(() => !window.textbookDiagnostics.process.seeking && Math.abs(window.textbookDiagnostics.state.phase - .25) < 1e-8, null, { timeout: 15000 });
  await frames(); const lastWins = await read(), fastTrace = await finishTrace(); await page.waitForTimeout(250); const heldLast = await read();
  check(lastWins.phase === .25 && heldLast.phase === .25 && !heldLast.process.seeking && !heldLast.playing,
    'rapid shortcut clicks replace the current seek and retain only the last requested node');
  inspectTrace(fastTrace, 'rapid-last-node-wins', false); states.push({ name: 'rapid-last-node-wins', lastWins, heldLast, trace: fastTrace });
  await phase(0); await node(2).click(); await page.waitForTimeout(100); await page.locator('#phase').press('End'); await frames();
  const canceledSeek = await read(); await page.waitForTimeout(850); const heldCanceled = await read();
  check(canceledSeek.phase === 1 && !canceledSeek.process.seeking && !canceledSeek.playing && heldCanceled.phase === 1,
    'native slider cancels an unfinished shortcut transition without a queued jump');
  const beforeReload = await phase(800); await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await ready('breeze'); await frames();
  const restored = await read(); inspect(restored, 'refreshed-breeze');
  check(restored.phase === beforeReload.phase && restored.selection === beforeReload.selection && !restored.playing && !restored.process.seeking
    && restored.process.key === beforeReload.process.key, 'refresh restores the exact scientific phase and explanation, paused');
  states.push({ name: 'refresh-and-interrupt', canceledSeek, heldCanceled, beforeReload, restored });

  const solidSnapshots = { breeze: restored };
  for (const id of ['coastal-landform', 'tides', 'river', 'gis']) {
    await go(id); await setReduced(false);
    if (id === 'coastal-landform' && (await read()).selection !== 0) {
      await page.locator('#selections [data-selection="0"]').click(); await frames(); await pause();
    }
    check(equal((await read()).nodes.map(n => n.text), specs[id].labels), `${id}: process bookmark labels match its own mechanism`);
    await phase(id === 'coastal-landform' ? 0 : 500);
    for (let index = 0; index < specs[id].phases.length; index++) await seek(id, index);
    if (id === 'coastal-landform') {
      const independent = [];
      for (const selection of [1, 2, 3]) {
        await page.locator(`#selections [data-selection="${selection}"]`).click(); await frames(); await pause();
        const s = await read(); independent.push(s);
        check(s.selection === selection && s.process === null && s.nodes.length === 0 && s.note.hidden,
          `coast/${selection}: independent landform has no cliff-process timeline or stale narration`);
        check(s.choices.length === 4 && equal(s.choices.filter(c => c.pressed === 'true').map(c => c.selection), [selection]),
          `coast/${selection}: independent landform remains its own explicit observation`);
      }
      await page.locator('#selections [data-selection="0"]').click(); await frames(); await pause(); await phase(670);
      const returned = await read(); inspect(returned, 'coast/returned-collapse', { stop: 2, stage: 'collapse' });
      check(returned.nodes.length === 4 && returned.choices.length === 4 && returned.selection === 0,
        'returning to the cliff restores four process nodes inside its existing independent-landform choice');
      await inspectLayout('desktop-coast'); await capture('desktop-coast'); states.push({ name: 'independent-coastal-observations', independent, returned });
    }
    const s = await read(); solidSnapshots[id] = s;
    if (id === 'river') check(s.model.closedOxbow === true && s.model.stage === 2, 'river final node retains the physically isolated oxbow');
    if (id === 'gis') check(s.model.resultReady === true && equal(s.model.counts.map(row => row.count), [5, 15, 13]),
      'GIS final node retains the actual spatial-membership counts 5, 15 and 13');
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  for (const id of Object.keys(specs)) {
    await go(id, true); const s = await read(); inspectSvg(s, solidSnapshots[id], `tablet-2d/${id}`);
    await inspectLayout(`tablet-2d/${id}`);
    if (id === 'breeze' || id === 'coastal-landform') await capture(`tablet-2d-${id}`);
    const before = await seek(id, 0); const end = await seek(id, specs[id].phases.length - 1);
    check(before.svg.hash !== end.svg.hash, `${id}: native SVG geometry actually changes between process bookmarks`);
    states.push({ name: `tablet-2d/${id}`, restored: s, before, end });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['breeze', 'coastal-landform']) {
    await go(id, true); const s = await phase(id === 'breeze' ? 800 : 670);
    inspectSvg(s, solidSnapshots[id], `phone-2d/${id}`); await inspectLayout(`phone-2d/${id}`); await capture(`phone-2d-${id}`);
    states.push({ name: `phone-2d/${id}`, ...s });
  }
  await go('breeze', true); await phase(500); await setReduced(true);
  const reduced = await seek('breeze', 1, { smooth: false, name: 'reduced-motion-direct-seek' });
  const reducedTrace = states.find(s => s.name === 'reduced-motion-direct-seek').trace;
  check(reduced.reduced && reduced.phase === .25 && !reduced.process.seeking
    && reducedTrace.samples.every(s => !s.seeking && (s.phase === .5 || s.phase === .25)),
    'reduced motion locates the exact node directly with no intermediate simulation or seek animation');
  await setReduced(false);
  check(errors.length === 0, 'continuous-process workflow has no browser runtime or console errors');
  return { base, checks, failures, errors, layoutIssues, states, screenshots,
    evidenceScope: 'Actual UI shortcut clicks, native range keyboard input, passive frame sampling and production Three.js/SVG state. Screenshots still require visual review. Tablet and phone viewports do not certify real touch hardware.' };
}
