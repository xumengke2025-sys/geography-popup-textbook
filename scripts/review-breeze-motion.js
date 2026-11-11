async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4173';
  const errors = [], failures = [], checks = [], states = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', e => errors.push(e.message));
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy && window.textbookDiagnostics.render?.modelState === 'live');
  const read = () => page.evaluate(() => ({ playing: window.textbookDiagnostics.playing, ...window.textbookDiagnostics.render.geometry }));
  const phase = async value => {
    await page.locator('#phase').evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await page.waitForTimeout(80); return read();
  };
  const displacement = (a, b) => ((b - a + 1.5) % 1) - .5;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?figure=breeze&3d`, { waitUntil: 'domcontentloaded' }); await ready();
  check(!(await read()).playing, 'the direct scene is initially paused for inspection');
  const day = await phase(500);
  await page.screenshot({ path: 'output/playwright/breeze-motion-day-before.png' });
  await page.locator('#cPause').click(); await page.waitForTimeout(1200);
  const movingDay = await read();
  check(displacement(day.flowPhase, movingDay.flowPhase) > .02, 'the main ribbon phase advances continuously in daytime circulation');
  check(movingDay.groundX === -1 && movingDay.upperX === 1, 'moving daytime arrows retain opposite lower and upper directions');
  await page.screenshot({ path: 'output/playwright/breeze-motion-day-after.png' });
  await page.locator('#cPause').click(); const paused = await read(); await page.waitForTimeout(500); const still = await read();
  check(paused.flowPhase === still.flowPhase && paused.phase === still.phase, 'pausing freezes both circulation travel and the day-night condition');
  const night = await phase(0);
  await page.locator('#cPause').click(); await page.waitForTimeout(900); const movingNight = await read();
  check(displacement(night.flowPhase, movingNight.flowPhase) < -.02, 'the same ribbons move in the opposite direction at night');
  check(movingNight.groundX === 1 && movingNight.upperX === -1, 'moving nighttime arrows retain opposite lower and upper directions');
  await page.locator('#cPause').click();
  const transition = [];
  for (const value of [780, 790, 800, 810, 820]) {
    const s = await phase(value); transition.push({ phase: value / 1000, ...s });
    check(s.flagArea > day.flagArea * .75, `${value}: flag cloth retains a real visible surface while drooping and turning`);
    if ([780, 800, 820].includes(value)) await page.screenshot({ path: `output/playwright/breeze-motion-transition-${value}.png` });
  }
  check(transition[0].flowRate > transition[1].flowRate && transition[1].flowRate > 0, 'daytime circulation slows before the calm interval');
  check(transition[2].flowRate === 0 && transition[2].strength === 0 && transition[2].groundX === 0, 'the calm interval has no local circulation or imposed direction');
  check(transition[3].flowRate < 0 && transition[4].flowRate < transition[3].flowRate, 'reverse circulation grows gradually after the calm interval');
  const calm = await phase(800); await page.locator('#cPause').click(); await page.waitForTimeout(100);
  const heldCalm = await read();
  check(heldCalm.strength === 0 && heldCalm.flowPhase === calm.flowPhase, 'ribbon travel stops while the thermal driving force is zero');
  await page.locator('#cPause').click(); await phase(500);
  await page.setViewportSize({ width: 698, height: 900 }); await page.waitForTimeout(600);
  const labels = await page.evaluate(() => window.textbookDiagnostics.render.labels);
  const dock = await page.locator('.capsule').boundingBox();
  check(labels.every(l => l.fontPx >= 18 && l.left >= 0 && l.right <= 698 && l.top >= 0 && l.bottom < dock.y), 'the inspected narrow desktop state keeps readable labels clear of controls');
  await page.screenshot({ path: 'output/playwright/breeze-motion-narrow.png' });
  states.push({ day, movingDay, paused, still, night, movingNight, calm, heldCalm, transition, narrowLabels: labels });
  check(!errors.length, 'no browser exceptions');
  return { base, browser: page.context().browser().version(), errors, failures, checks, states };
}
