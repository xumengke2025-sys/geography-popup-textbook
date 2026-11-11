async page => {
  const errors = [], checks = [], failures = [], states = [];
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const key = 'pep-geography-first-original-v2';
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  const d = () => page.evaluate(() => window.textbookDiagnostics);
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning && !window.textbookDiagnostics.figureBusy, null, {timeout:45000,polling:100});
  const fresh = async () => {await page.goto(`${base}/?page=38`, {waitUntil:'domcontentloaded'});await ready();};
  const live = () => page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, {timeout:30000,polling:100});
  const check = (ok, label) => {if (!ok) throw Error(label);checks.push(label);};
  const caseRun = async (name, fn) => {
    console.log(`Starting ${name}`);
    try {await fresh();await fn();}
    catch(e) {failures.push({name,error:e.message,state:await d().catch(()=>null)});await page.screenshot({path:`output/playwright/transaction-${name}-failure.png`}).catch(()=>{});}
    states.push({name,diag:await d().catch(()=>null)});
    console.log(`Finished ${name}`);
  };
  await page.setViewportSize({width:1366,height:900});
  await caseRun('rapid-fold', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();
    await page.waitForFunction(()=>window.textbookDiagnostics.render?.modelState==='peel',null,{polling:30});
    await page.getByRole('button',{name:'收回',exact:true}).dblclick({delay:40});
    await page.waitForFunction(()=>!window.textbookDiagnostics.active && !window.textbookDiagnostics.figureBusy,null,{timeout:15000,polling:100});
    const x=await d();check(x.render.models===0 && x.spread===22,'double fold during unfolding leaves no scene or busy flag');
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    check((await d()).active==='breeze','model can reopen after interrupted unfolding');
  });
  await caseRun('rapid-navigation', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();
    await page.waitForFunction(()=>window.textbookDiagnostics.render?.modelState==='peel',null,{polling:30});
    await page.locator('#cNext').click();await page.locator('#cNext').click();await page.locator('#cPrev').click();
    await ready();const x=await d();check(x.spread===23 && x.render.spread===23 && !x.active && !x.render.models,'rapid next/next/previous reaches the final target after folding');
  });
  await caseRun('fold-navigation', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    await page.getByRole('button',{name:'收回',exact:true}).click();await page.locator('#cNext').click();
    await ready();const x=await d();check(x.spread===23 && x.render.spread===23 && !x.active,'fold immediately followed by next completes the transaction');
  });
  await caseRun('navigation-fold', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    await page.locator('#cNext').click();await page.getByRole('button',{name:'收回',exact:true}).click();
    await page.waitForFunction(()=>!window.textbookDiagnostics.turning,null,{timeout:15000,polling:100});
    const x=await d();check(x.spread===23 && x.render.spread===23 && !x.active,'next immediately followed by fold does not strand the navigation promise');
  });
  await caseRun('reader-return', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    await page.locator('#cRead').click();await page.locator('#reader-image').evaluate(i=>i.decode());
    await page.locator('#reader-next').click();await page.locator('#reader-next').click();await page.locator('#reader-image').evaluate(i=>i.decode());
    check(await page.locator('#reader-title').innerText()==='第 40 页','reader advances to the intended original page');
    await page.getByRole('button',{name:'返回立体书',exact:true}).click();await ready();
    const x=await d();check(x.spread===23 && x.render.spread===23 && !x.active && !x.playing,'returning from a different reader page moves the book and removes the old model');
  });
  await caseRun('reader-escape', async()=>{
    await page.locator('#cRead').click();await page.locator('#reader-image').evaluate(i=>i.decode());
    await page.locator('#reader-next').click();await page.locator('#reader-next').click();await page.locator('#reader-image').evaluate(i=>i.decode());
    await page.keyboard.press('Escape');await ready();
    const x=await d();check(x.spread===23 && x.render.spread===23,'Escape from original-page reading follows the same destination as Return');
  });
  await caseRun('interrupt-menu-model', async()=>{
    await page.locator('#cContents').click();await page.locator('#contents-models').click();
    await page.locator('#contents [data-figure="remote"]').click();
    await page.locator('#cNext').click();await ready();
    const x=await d();check(x.spread===61 && x.render.spread===61 && !x.active && !x.render.models,'navigation supersedes an in-flight model request instead of attaching it to the wrong spread');
  });
  await caseRun('slider-keyboard', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    await page.getByRole('button',{name:'白天',exact:true}).click();
    await page.waitForFunction(()=>window.textbookDiagnostics.state.phase===.5&&window.textbookDiagnostics.render.geometry.phase===.5&&!window.textbookDiagnostics.playing);
    await page.locator('#phase').focus();const before=await d();
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);const after=await d();
    check(after.spread===before.spread && after.render.geometry.phase>before.render.geometry.phase && !after.playing,'range arrow changes phase and pauses without turning pages');
    await page.locator('#phase').blur();await page.locator('#scene-view').click();await page.waitForTimeout(400);
    check((await d()).render.view==='book','scene toggles to book view');
    await page.locator('#scene-view').click();await page.waitForTimeout(400);
    check((await d()).render.view==='detail','scene returns to detail view');
    await page.locator('#cContents').click();await page.locator('#read-whole').click();
    check((await d()).render.view==='book','the menu Whole Book action returns an active detail scene to book view');
  });
  await caseRun('teacher-isolation', async()=>{
    await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await live();
    await page.getByRole('button',{name:'白天',exact:true}).click();
    // A bookmark is committed after the smooth seek, not on button-down.
    // Take the student snapshot only after the visible input has settled.
    await page.waitForFunction(()=>!window.textbookDiagnostics.process?.seeking&&window.textbookDiagnostics.state.phase===.5&&window.textbookDiagnostics.render.geometry.phase===.5);
    const saved=await page.evaluate(key=>localStorage.getItem(key),key);
    await page.locator('#cTeach').click();await page.waitForFunction(()=>window.textbookDiagnostics.teacher);
    await page.getByRole('button',{name:'夜晚',exact:true}).click();await page.locator('#cNext').click();await ready();
    check(await page.evaluate(key=>localStorage.getItem(key),key)===saved,'teacher navigation does not change the student bookmark');
    await page.locator('#cTeach').click();await ready();await live();
    const x=await d();check(x.spread===22 && x.active==='breeze' && x.render.geometry.phase===.5 && !x.playing,'leaving teacher mode restores the student model and phase paused');
  });
  check(errors.length===0,'no browser exceptions');
  return {base,browser:page.context().browser().version(),checks,failures,errors,states};
}
