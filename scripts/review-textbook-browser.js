async page => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/?page=38');
  await page.waitForFunction(()=>window.textbookDiagnostics?.ready&&!window.textbookDiagnostics.turning);
  const ids=['breeze','water','forest','soil','gis'];
  const results=[];
  for(const id of ids){
    await page.locator('#cContents').click();
    if(!await page.locator('.figure-index').evaluate(el=>el.open))await page.locator('.figure-index summary').click();
    await page.locator(`#contents [data-figure="${id}"]`).click();
    await page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d.active===id&&!d.turning&&!d.figureBusy&&d.render?.modelState==='live'},id);
    if(await page.evaluate(()=>window.textbookDiagnostics.playing))await page.locator('#cPause').click();
    await page.waitForTimeout(600);
    await page.screenshot({path:`output/playwright/review-${id}.png`});
    results.push(await page.evaluate(()=>({figure:window.textbookDiagnostics.active,render:window.textbookDiagnostics.render})));
  }
  return results;
}
