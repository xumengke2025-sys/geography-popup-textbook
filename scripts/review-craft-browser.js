async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/?page=38');
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning);
  await page.locator('#cWatch').click();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
  if (await page.evaluate(() => window.textbookDiagnostics.playing)) await page.locator('#cPause').click();
  await page.getByRole('button', { name: '白天', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/craft-breeze-day.png' });
  await page.getByRole('button', { name: '夜晚', exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'output/playwright/craft-breeze-night.png' });
  const night = await page.evaluate(() => window.textbookDiagnostics.render);
  await page.mouse.move(740, 440); await page.mouse.down();
  await page.mouse.move(810, 480, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'output/playwright/craft-breeze-orbit.png' });
  await page.locator('#fold').click();
  await page.waitForFunction(() => !window.textbookDiagnostics.active);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/craft-page-restored.png' });
  return { errors, night, restored: await page.evaluate(() => window.textbookDiagnostics.render) };
}
