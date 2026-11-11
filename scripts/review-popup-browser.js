async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.bringToFront();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning, null, { timeout: 60000 });
  if (!await page.evaluate(() => window.textbookDiagnostics.active)) {
    await page.locator('#cWatch').click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'output/playwright/popup-rise.png' });
  }
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 60000 });
  await page.getByRole('button', { name: '白天', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'output/playwright/popup-book-day.png' });
  const day = await page.evaluate(() => window.textbookDiagnostics.render);
  await page.getByRole('button', { name: '近看立体场景', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'output/playwright/popup-close-day.png' });
  await page.getByRole('button', { name: '夜晚', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'output/playwright/popup-close-night.png' });
  const night = await page.evaluate(() => window.textbookDiagnostics.render);
  return { errors, day, night };
}
