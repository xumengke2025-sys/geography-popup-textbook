async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const browser = page.context().browser();
  const errors = [], failures = [], checks = [], scenarios = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const read = p => p.evaluate(() => {
    const d = window.textbookDiagnostics;
    const svg = document.querySelector('.flat-concept .flat-model-svg');
    const scene = document.querySelector('#scene');
    return {
      ready: d.ready, active: d.active, twoD: d.twoD, playing: d.playing,
      spread: d.spread, turning: d.turning, figureBusy: d.figureBusy,
      phase: d.state?.phase, modelState: d.render?.modelState ?? null,
      rendererPresent: !!d.render, flowPhase: d.render?.geometry?.flowPhase ?? null,
      sceneHidden: scene.hidden, svgPresent: !!svg,
      svgAria: svg?.getAttribute('aria-label') ?? null,
      svgTransforms: svg ? [...svg.querySelectorAll('[transform]')].map(el => el.getAttribute('transform')) : [],
      reducedCheckbox: document.querySelector('#reduced').checked,
      viewport: { width: innerWidth, height: innerHeight },
      media: {
        coarse: matchMedia('(pointer: coarse)').matches,
        noHover: matchMedia('(hover: none)').matches,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
      simulatedWebGLCalls: window.__simulatedWebGLCalls ?? 0,
      entryScripts: [...document.scripts].map(script => script.src).filter(Boolean),
      entryStyles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href),
      userAgent: navigator.userAgent,
    };
  });
  const ready = p => p.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'breeze' && !d.turning && !d.figureBusy &&
      (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const inspect = async options => {
    const { id, query, viewport, touch = false, reduced = false, blockWebGL = false, animate = false } = options;
    const scenario = { id, query, viewport, touch, reduced, simulatedWebGLFailure: blockWebGL,
      pageErrors: [], consoleErrors: [], requestFailures: [], initialStorageKeys: null,
      observedDocumentStorageKeys: null, states: [] };
    scenarios.push(scenario);
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
      hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    try {
      const initialStorage = await context.storageState();
      scenario.initialStorageKeys = initialStorage.origins.flatMap(origin => origin.localStorage.map(item => item.name));
      await context.addInitScript(() => {
        window.__entryStorageKeys = Object.keys(localStorage);
      });
      if (blockWebGL) await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        window.__simulatedWebGLCalls = 0;
        HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
          if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') {
            window.__simulatedWebGLCalls++;
            return null;
          }
          return original.call(this, kind, ...args);
        };
      });
      const p = await context.newPage();
      p.setDefaultTimeout(20000);
      p.on('pageerror', e => { scenario.pageErrors.push(e.message); errors.push(`${id}: ${e.message}`); });
      p.on('console', message => {
        if (message.type() === 'error') scenario.consoleErrors.push(message.text());
      });
      p.on('requestfailed', request => scenario.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
      await p.goto(`${base}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await ready(p);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(200);
      const first = await read(p);
      scenario.states.push({ at: 'initial', ...first });
      scenario.observedDocumentStorageKeys = await p.evaluate(() => window.__entryStorageKeys);
      if (process.env.REVIEW_EXPECTED_BUNDLE) check(first.entryScripts.some(src => src.endsWith(`/assets/${process.env.REVIEW_EXPECTED_BUNDLE}`)),
        `${id}: loads the expected stable JavaScript bundle ${process.env.REVIEW_EXPECTED_BUNDLE}`);
      if (process.env.REVIEW_EXPECTED_STYLE) check(first.entryStyles.some(src => src.endsWith(`/assets/${process.env.REVIEW_EXPECTED_STYLE}`)),
        `${id}: loads the expected stable stylesheet ${process.env.REVIEW_EXPECTED_STYLE}`);
      check(scenario.initialStorageKeys.length === 0, `${id}: starts with a fresh isolated storage context`);
      check(first.active === 'breeze' && first.ready && !first.turning && !first.figureBusy,
        `${id}: direct figure entry finishes without busy transaction residue`);
      check(first.twoD === options.expect2D, `${id}: selects the requested/default ${options.expect2D ? '2-D' : '3-D'} mode`);
      check(first.playing === !!options.expectPlaying, `${id}: initial playback state is ${options.expectPlaying ? 'playing' : 'paused'}`);
      check(first.media.coarse === touch && first.media.noHover === touch,
        `${id}: actual pointer and hover media match the emulated input device`);
      check(first.media.reduced === reduced && first.reducedCheckbox === reduced,
        `${id}: respects the isolated reduced-motion preference`);
      if (options.expect2D) {
        check(first.sceneHidden && first.svgPresent && !first.rendererPresent,
          `${id}: uses the interactive SVG reading representation without a renderer`);
        check(await p.locator('.flat-concept .flat-model-svg').isVisible(), `${id}: the SVG demonstration is visibly rendered`);
      } else {
        check(!first.sceneHidden && first.rendererPresent && first.modelState === 'live',
          `${id}: initializes the live Three.js scene`);
      }
      if (blockWebGL) {
        check(first.simulatedWebGLCalls > 0, `${id}: startup WebGL failure was actually injected`);
        check(scenario.consoleErrors.some(text => /WebGL|context/i.test(text)),
          `${id}: records the expected caught WebGL initialization failure`);
        check(scenario.consoleErrors.every(text => /WebGL|context/i.test(text)),
          `${id}: simulated fallback emits only the expected WebGL failure logs`);
      }
      if (animate) {
        if (!first.playing) await p.locator('#cPause').click();
        const start = await read(p);
        await p.waitForTimeout(900);
        const next = await read(p);
        scenario.states.push({ at: 'playback-start', ...start }, { at: 'after-900ms', ...next });
        check(next.playing && next.phase !== start.phase, `${id}: playback advances the model phase`);
        if (options.expect2D) check(JSON.stringify(start.svgTransforms) !== JSON.stringify(next.svgTransforms),
          `${id}: SVG circulation transforms visibly advance during playback`);
        else check(next.flowPhase !== start.flowPhase, `${id}: Three.js circulation advances during playback`);
      } else {
        await p.waitForTimeout(350);
        const next = await read(p);
        scenario.states.push({ at: 'paused-after-350ms', ...next });
        check(next.phase === first.phase && next.flowPhase === first.flowPhase && !next.playing,
          `${id}: the paused entry remains paused without advancing its phase`);
      }
      const screenshot = `output/playwright/mode-entry-${id}.png`;
      await p.screenshot({ path: screenshot });
      scenario.screenshot = screenshot;
      console.log(`Mode entry checked: ${id}`);
      check(scenario.pageErrors.length === 0, `${id}: no unhandled browser exception`);
      check(scenario.requestFailures.length === 0, `${id}: no failed resource request`);
      if (!blockWebGL) check(scenario.consoleErrors.length === 0, `${id}: no browser console errors`);
    } catch (e) {
      scenario.failure = String(e);
      failures.push(`${id}: ${String(e)}`);
    } finally {
      await context.close();
    }
  };
  const desktop = { width: 698, height: 900 };
  const phone = { width: 390, height: 844 };
  for (const scenario of [
    { id: 'desktop-default', query: 'figure=breeze', viewport: desktop, expect2D: false },
    { id: 'phone-default', query: 'figure=breeze', viewport: phone, touch: true, expect2D: true, animate: true },
    { id: 'desktop-explicit-2d', query: 'figure=breeze&2d', viewport: desktop, expect2D: true },
    { id: 'phone-explicit-3d', query: 'figure=breeze&3d', viewport: phone, touch: true, expect2D: false },
    { id: 'desktop-explicit-3d', query: 'figure=breeze&3d', viewport: desktop, expect2D: false },
    { id: 'desktop-play', query: 'figure=breeze&3d&play', viewport: desktop, expect2D: false, expectPlaying: true, animate: true },
    { id: 'reduced-motion', query: 'figure=breeze&3d&play', viewport: desktop, reduced: true, expect2D: false },
    { id: 'webgl-unavailable', query: 'figure=breeze', viewport: desktop, blockWebGL: true, expect2D: true },
  ]) await inspect(scenario);
  check(errors.length === 0, 'all isolated entry checks finish without an unhandled browser exception');
  return {
    base, browser: browser.version(), errors, failures, checks, scenarios,
    expectedConsoleErrors: scenarios.filter(s => s.simulatedWebGLFailure)
      .flatMap(s => s.consoleErrors.map(message => ({ scenario: s.id, message }))),
    scope: 'Isolated entry-mode checks only; no full-book or 17-item coastal-motion rerun.',
    environment: { runner: 'scripts/run-visual-review.mjs', channel: process.env.REVIEW_BROWSER ?? 'chrome', headless: true,
      target: process.env.REVIEW_TARGET ?? 'development source',
      expectedBundle: process.env.REVIEW_EXPECTED_BUNDLE ?? null,
      expectedStylesheet: process.env.REVIEW_EXPECTED_STYLE ?? null,
      allContextsFresh: true, realUserStorageAccessed: false, productionFilesChanged: false },
    boundaries: [
      'Phone pointer/hover/touch behavior is Chromium device emulation, not a physical touchscreen test.',
      'Reduced-motion preference is emulated inside one fresh browser context; no OS preference or real user bookmark is changed.',
      'WebGL startup failure is simulated by returning null from canvas getContext for WebGL modes; canvas 2-D remains available.',
      `This checks only ${process.env.REVIEW_TARGET ?? 'the development source'} at ${base}; a subsequent rebuilt or portable artifact is outside this run.`,
    ],
  };
}
