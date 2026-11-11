async page => {
  const base=page.__reviewBase??'http://127.0.0.1:5173';
  const errors=[],checks=[],states=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>window.textbookDiagnostics?.ready&&!window.textbookDiagnostics.turning&&!window.textbookDiagnostics.figureBusy,null,{timeout:45000});
  for(const [name,width,height,query]of [
    ['cover',1366,900,''],['reading',1366,900,'?page=38'],['breeze',1366,900,'?figure=breeze'],['tablet',1024,768,'?figure=waves'],['preview',713,818,'?figure=tides'],['phone',390,844,'?2d&figure=tides']
  ]){
    await page.setViewportSize({width,height});await page.goto(base+'/'+query);await ready();
    if(query.includes('figure=')&&!query.includes('2d'))await page.waitForFunction(()=>window.textbookDiagnostics.render?.modelState==='live',null,{timeout:45000});
    await page.waitForTimeout(1200);
    await page.screenshot({path:`output/playwright/workbench-${name}.png`});
    if(name==='reading'&&await page.locator('#desk-header').count()){
      await page.locator('#cContents').click();await page.waitForTimeout(300);
      await page.screenshot({path:'output/playwright/workbench-directory.png'});
      await page.locator('#close-contents').click();
      await page.locator('#folio-toggle').click();await page.waitForTimeout(350);
      await page.locator('#folio-thumbs img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
      await page.screenshot({path:'output/playwright/workbench-folio.png'});
      await page.locator('#folio-close').click();
    }
    const d=await page.evaluate(()=>window.textbookDiagnostics);
    states.push({name,width,height,spread:d.spread,active:d.active,render:d.render});
    checks.push(`${name} rendered`);
  }
  return{base,errors,checks,states,limits:['Viewport emulation, not physical touchscreen acceptance.','Screenshots are visual evidence, not evidence of user approval.']};
}
