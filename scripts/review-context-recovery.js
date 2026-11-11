async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5178';
  const checks = [], failures = [], states = [], errors = [];
  const artifacts = page.__reviewArtifacts ?? 'work/book-completion-20261106/context-recovery-after';
  page.setDefaultTimeout(15000);
  let currentCase = '';
  page.on('pageerror', error => errors.push({ name: currentCase, message: error.message, stack: error.stack }));
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = () => page.evaluate(() => {
    const d = window.textbookDiagnostics;
    return { twoD: d.twoD, spread: d.spread, turning: d.turning, figureBusy: d.figureBusy,
      active: d.active, playing: d.playing, phase: d.state?.phase,
      render: d.render ? { spread: d.render.spread, position: d.render.position, busy: d.render.busy,
        models: d.render.models, modelState: d.render.modelState,
        phase: d.render.geometry?.phase, selection: d.render.geometry?.selection } : null };
  });
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy;
  }, null, { timeout: 30000 });
  const fresh = async () => {
    await page.goto(`${base}/?figure=breeze&3d&inspect`, { waitUntil: 'domcontentloaded' });
    await ready();
    await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 30000 });
    await page.getByRole('button', { name: '白天', exact: true }).click();
    await page.waitForFunction(() => Math.abs(window.textbookDiagnostics.state.phase - .5) < 1e-6);
  };
  const lose = async () => {
    const available = await page.evaluate(() => {
      const extension = window.textbookDebug.renderer.getContext().getExtension('WEBGL_lose_context');
      window.__reviewContextExtension = extension;
      extension?.loseContext();
      return !!extension;
    });
    if (!available) throw Error('WEBGL_lose_context is unavailable; context-loss checks did not run');
    await page.waitForFunction(() => window.textbookDiagnostics.twoD);
    return state();
  };
  const restore = async () => {
    await page.evaluate(() => window.__reviewContextExtension.restoreContext());
    await page.waitForFunction(() => !window.textbookDebug.renderer.getContext().isContextLost());
  };
  const check = (ok, label) => {
    checks.push({ label, passed: !!ok });
    if (!ok) throw Error(label);
  };
  const caseOf = async (name, run) => {
    currentCase = name;
    console.log(`Starting ${name}`);
    try { await fresh(); await run(); }
    catch (error) {
      failures.push({ name, error: error.message, state: await state().catch(() => null) });
      await page.screenshot({ path: `${artifacts}/${name}-failure.png` }).catch(() => {});
    }
    states.push({ name, state: await state().catch(() => null) });
    console.log(`Finished ${name}`);
  };
  await caseOf('lost-context-fold', async () => {
    const before = await state(), fallback = await lose();
    check(fallback.active === 'breeze' && fallback.phase === before.phase && !fallback.playing,
      'automatic 2-D fallback preserves the active model and phase, paused');
    await page.screenshot({ path: `${artifacts}/lost-context-paused.png` });
    await page.getByRole('button', { name: '收回', exact: true }).click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active, null, { timeout: 3500 });
    const after = await state();
    check(after.twoD && after.render.models === 0 && !after.turning, 'fold completes after real context loss');
  });
  await caseOf('lost-context-navigation', async () => {
    await lose();
    await page.locator('#cNext').click();
    await page.waitForFunction(() => !window.textbookDiagnostics.turning, null, { timeout: 3500 });
    const after = await state();
    check(after.twoD && after.spread === 23 && !after.active && after.render.models === 0,
      'page navigation completes in fallback without a stranded model');
  });
  await caseOf('context-lost-during-fold', async () => {
    await page.getByRole('button', { name: '收回', exact: true }).click();
    await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'undraw', null, { polling: 10 });
    await lose();
    await page.waitForFunction(() => !window.textbookDiagnostics.active, null, { timeout: 3500 });
    const after = await state();
    check(after.twoD && after.render.models === 0 && !after.turning, 'an in-flight fold resolves when the context is lost');
  });
  await caseOf('context-lost-during-page-turn', async () => {
    await page.getByRole('button', { name: '收回', exact: true }).click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active);
    await page.locator('#cNext').click();
    await page.waitForFunction(() => {
      const d = window.textbookDiagnostics;
      return d.turning && d.render.position > 22 && d.render.position < 23;
    }, null, { polling: 10 });
    await lose();
    await page.waitForFunction(() => !window.textbookDiagnostics.turning, null, { timeout: 3500 });
    const after = await state();
    check(after.twoD && after.spread === 23 && !after.active, 'an in-flight page turn settles at its requested destination');
  });
  await caseOf('context-restore-return-3d', async () => {
    const before = await state();
    await lose(); await restore();
    check((await state()).twoD, 'context restoration leaves the reader paused in 2-D until requested');
    await page.locator('#cContents').click(); await page.locator('#mode').click();
    await page.waitForFunction(() => {
      const d = window.textbookDiagnostics;
      return !d.twoD && !d.figureBusy && d.render?.modelState === 'live';
    }, null, { timeout: 6000 });
    const after = await state();
    check(after.active === 'breeze' && after.phase === before.phase && !after.playing && after.render.models === 1,
      'explicit 3-D return rebuilds the same paused observation after restoration');
    await page.screenshot({ path: `${artifacts}/context-restored-3d.png` });
  });
  await caseOf('mode-switch-then-navigation', async () => {
    await page.locator('#cContents').click(); await page.locator('#mode').click();
    await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'undraw', null, { polling: 10 });
    await page.locator('#cNext').click();
    await ready();
    await page.waitForTimeout(400);
    const after = await state();
    check(after.spread === 23 && !after.active && !after.figureBusy && !after.turning,
      'navigation after a mode-switch request remains the final destination');
  });
  await caseOf('mode-switch-then-other-model', async () => {
    await page.locator('#cContents').click(); await page.locator('#mode').click();
    await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'undraw', null, { polling: 10 });
    if (await page.locator('#contents').isHidden()) await page.locator('#cContents').click();
    await page.locator('#contents-models').click();
    await page.locator('#contents [data-figure="remote"]').click();
    await ready();
    const after = await state();
    check(after.active === 'remote' && after.spread === 60,
      'a later model selection supersedes the old figure captured by mode switching');
  });
  checks.push({ label: 'no browser exceptions during context recovery and intent supersession', passed: errors.length === 0 });
  return { base, browser: page.context().browser().version(), artifacts, checks, failures, errors, states,
    scope: 'Real WEBGL_lose_context, original UI controls, one browser page; no engine monkey-patching.' };
}
