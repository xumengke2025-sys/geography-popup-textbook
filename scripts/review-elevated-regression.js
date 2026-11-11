async page => {
  const errors = [], states = [], checks = [];
  const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message); };
  page.on('pageerror', error => errors.push(error.message));
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?page=38`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning);
  await page.getByRole('button', { name: '展开海陆间的大气热力环流', exact: true }).click();
  await page.waitForFunction(() => {
    const d = window.textbookDiagnostics.render?.geometry;
    return d?.unfoldProgress > .18 && d.unfoldProgress < .85;
  });
  states.push({ label: 'during-unfold', ...await page.evaluate(() => window.textbookDiagnostics.render.geometry) });
  await page.screenshot({ path: 'output/playwright/elevated-during-unfold.png' });
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
  for (const [label, expected] of [['白天', -1], ['夜晚', 1]]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(100);
    const d = await page.evaluate(() => window.textbookDiagnostics);
    check(d.render.geometry.groundX === expected && d.render.geometry.upperX === -expected, `${label}: upper and lower flows agree`);
    check(d.render.geometry.unfoldProgress === 1 && d.render.geometry.sceneElevation > 50, `${label}: scene is above the page`);
    const phase = d.render.geometry.phase;
    await page.waitForTimeout(200);
    check(await page.evaluate(() => window.textbookDiagnostics.render.geometry.phase) === phase, `${label}: manual selection remains paused`);
  }
  const setPhase = async value => {
    await page.locator('#phase').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await page.waitForTimeout(100);
    return page.evaluate(() => window.textbookDiagnostics.render.geometry);
  };
  const zero = await setPhase(302);
  check(zero.strength === 0 && zero.groundX === 0 && zero.upperX === 0, 'thermal reversal passes through a calm state');
  await page.getByRole('button', { name: '近看立体场景', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'output/playwright/elevated-calm.png' });
  const forward = await setPhase(500); await setPhase(0); const reverse = await setPhase(500);
  check(forward.groundX === reverse.groundX && forward.strength === reverse.strength, 'scrubbing is deterministic in both directions');
  await page.mouse.move(735, 490); await page.mouse.down(); await page.mouse.move(825, 445, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/elevated-rotated.png' });
  check(await page.evaluate(() => window.textbookDiagnostics.render.geometry.layout) === 'land-left-sea-right', 'rotation preserves geographic meaning');
  await page.locator('#cRead').click();
  await page.locator('#reader-image').evaluate(img => img.decode());
  check(await page.locator('#reader-title').innerText() === '第 38 页', 'enlarged reading uses the original page');
  await page.screenshot({ path: 'output/playwright/elevated-original-reading.png' });
  await page.getByRole('button', { name: '返回立体书', exact: true }).click();
  await page.getByRole('button', { name: '收回', exact: true }).click();
  await page.waitForFunction(() => !window.textbookDiagnostics.active);
  check(await page.evaluate(() => window.textbookDiagnostics.render.models) === 0, 'fold removes the active model');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'output/playwright/elevated-restored-page.png' });

  await page.getByRole('button', { name: '展开大气的水平运动——风', exact: true }).click();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
  const pressure = await page.evaluate(() => window.textbookDiagnostics.render.geometry);
  check(pressure.origin === 'textbook-paragraph' && pressure.sameHeight && pressure.sceneElevation > 45, 'a textbook paragraph opens into an elevated pressure field');
  await page.getByRole('button', { name: '气压相同', exact: true }).click();
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.textbookDiagnostics.render.geometry.pressureDifference) === false, 'equal pressure removes this idealized wind component');
  await page.getByRole('button', { name: '存在气压差', exact: true }).click();
  await page.getByRole('button', { name: '近看立体场景', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/elevated-pressure.png' });
  await page.getByRole('button', { name: '收回', exact: true }).click();
  await page.waitForFunction(() => !window.textbookDiagnostics.active);

  // Reduced motion makes the full catalog sweep a check of every actual
  // geometry builder, while the two scenes above verify animated unfolding.
  await page.getByRole('button', { name: '减少动态效果', exact: true }).click();
  const ids = await page.locator('.figure-index [data-figure]').evaluateAll(nodes => nodes.map(n => n.dataset.figure));
  for (const id of ids) {
    await page.locator('#cContents').click();
    await page.locator('.figure-index').evaluate(el => { el.open = true; });
    await page.locator(`#contents [data-figure="${id}"]`).click();
    await page.waitForFunction(id => window.textbookDiagnostics.active === id && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.modelState === 'live', id);
    const d = await page.evaluate(() => window.textbookDiagnostics.render);
    check(d.geometry.imageMappedMeshes === 0 && d.geometry.solids > 0 && d.geometry.sceneElevation >= 34, `${id}: real elevated geometry without image surfaces`);
    states.push({ id, geometry: d.geometry, triangles: d.triangles, calls: d.calls });
    if (['solar', 'earth', 'water', 'river', 'soil', 'gis'].includes(id)) {
      await page.waitForTimeout(100);
      await page.screenshot({ path: `output/playwright/elevated-${id}.png` });
    }
    await page.getByRole('button', { name: '收回', exact: true }).click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active);
  }

  for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await page.locator('#cContents').click();
    await page.locator('#contents [data-figure="breeze"]').click();
    await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
    await page.getByRole('button', { name: '白天', exact: true }).click();
    await page.screenshot({ path: `output/playwright/elevated-${size.width}.png` });
    const fits = await page.locator('.capsule').evaluate(el => {
      const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight;
    });
    check(fits, `${size.width}: controls fit the viewport`);
    await page.getByRole('button', { name: '收回', exact: true }).click();
    await page.waitForFunction(() => !window.textbookDiagnostics.active);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?2d&page=38`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning);
  check(await page.evaluate(() => window.textbookDiagnostics.twoD), 'phone uses two-dimensional reading');
  await page.getByRole('button', { name: '展开海陆间的大气热力环流', exact: true }).click();
  await page.getByRole('button', { name: '夜晚', exact: true }).click();
  check(await page.evaluate(() => window.textbookDiagnostics.active) === 'breeze', 'phone keeps the lesson controls usable');
  await page.screenshot({ path: 'output/playwright/elevated-phone.png' });
  check(errors.length === 0, 'no browser exceptions');
  return { errors, states, checks };
}
