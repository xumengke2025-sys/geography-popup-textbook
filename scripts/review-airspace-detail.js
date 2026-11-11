async page => {
  const errors = [], states = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/?page=38');
  await page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning);
  await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
  await page.getByRole('button',{name:'白天',exact:true}).click();
  await page.waitForTimeout(1400);
  await page.screenshot({path:'output/playwright/airspace-day.png'});
  states.push(await page.evaluate(() => window.textbookDiagnostics.render));
  await page.getByRole('button',{name:'夜晚',exact:true}).click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'output/playwright/airspace-night.png'});
  await page.getByRole('button',{name:'回到立体书全景',exact:true}).click();
  await page.waitForTimeout(1300);
  await page.screenshot({path:'output/playwright/airspace-book.png'});
  await page.getByRole('button',{name:'收回',exact:true}).click();
  await page.waitForFunction(() => !window.textbookDiagnostics.active);
  await page.getByRole('button',{name:'展开大气的水平运动——风',exact:true}).click();
  await page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live');
  await page.waitForTimeout(1300);
  await page.screenshot({path:'output/playwright/airspace-pressure.png'});
  states.push(await page.evaluate(() => window.textbookDiagnostics.render));
  return {errors,states};
}
