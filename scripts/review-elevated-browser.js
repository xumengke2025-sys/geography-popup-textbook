async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/?page=38', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning, null, { timeout: 60000 });
  await page.screenshot({ path: 'output/playwright/elevated-page.png' });
  await page.getByRole('button', { name: '展开海陆间的大气热力环流', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'output/playwright/elevated-rise.png' });
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, { timeout: 60000 });
  await page.getByRole('button', { name: '白天', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'output/playwright/elevated-book-day.png' });
  const day = await page.evaluate(() => window.textbookDiagnostics);
  await page.getByRole('button', { name: '近看立体场景', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'output/playwright/elevated-close-day.png' });
  await page.getByRole('button', { name: '夜晚', exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'output/playwright/elevated-close-night.png' });
  const night = await page.evaluate(() => window.textbookDiagnostics);
  return { errors, day, night };
}
