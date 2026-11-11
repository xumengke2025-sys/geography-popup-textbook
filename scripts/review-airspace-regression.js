async page => {
  const errors = [], checks = [], states = [], measurements = [];
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  const check = (test, label) => { if (!test) throw Error(label); checks.push(label); };
  const ready = () => page.waitForFunction(() => window.textbookDiagnostics?.ready && !window.textbookDiagnostics.turning, null, {polling:100});
  const live = () => page.waitForFunction(() => window.textbookDiagnostics.render?.modelState === 'live', null, {polling:100});
  const diag = () => page.evaluate(() => window.textbookDiagnostics);
  const fold = async () => { await page.getByRole('button',{name:'收回',exact:true}).click(); await page.waitForFunction(() => !window.textbookDiagnostics.active,null,{polling:100}); };
  const phase = async value => {
    await page.locator('#phase').evaluate((el, value) => { el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); }, value);
    await page.waitForTimeout(100); return (await diag()).render.geometry;
  };
  const fromMenu = async id => {
    await page.locator('#cContents').click();
    await page.locator('.figure-index').evaluate(e => {e.open=true;});
    await page.locator(`#contents [data-figure="${id}"]`).click();await live();
  };
  const checkLabels = async label => {
    const {labels} = (await diag()).render;
    const dock = await page.locator('.capsule').boundingBox();
    const viewport=page.viewportSize();
    check(labels.length>0 && labels.every(l=>l.fontPx>=18),`${label}: model text is at least 18 CSS pixels`);
    check(labels.every(l=>l.left>=0&&l.right<=viewport.width&&l.top>=0&&l.bottom<dock.y-5),`${label}: labels fit and clear the controls`);
    const overlaps=labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+2&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+2));
    check(!overlaps.length,`${label}: labels do not overlap`);
    measurements.push({label,labels});
  };
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${base}/?page=38`,{waitUntil:'domcontentloaded'});await ready();
  await page.screenshot({path:'output/playwright/airspace-original.png'});
  await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();
  await page.waitForFunction(() => {const p=window.textbookDiagnostics.render?.geometry?.unfoldProgress;return p>.10&&p<.9;},null,{polling:30});
  const unfold=(await diag()).render.geometry;
  check(unfold.imageMappedMeshes===0&&unfold.sceneElevation>50,'the actual geometry rises above the original page');
  await page.screenshot({path:'output/playwright/airspace-unfolding.png'});
  await live();
  for(const [label,expected] of [['白天',-1],['夜晚',1]]){
    await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(1300);
    const d=await diag();
    check(d.render.geometry.groundX===expected&&d.render.geometry.upperX===-expected,`${label}: opposite surface and upper flow`);
    check(d.render.view==='detail',`${label}: the camera focuses on the lifted explanation`);
    const saved=d.render.geometry.phase;await page.waitForTimeout(180);
    check((await diag()).render.geometry.phase===saved,`${label}: selected state stays paused`);
    await checkLabels(label);
    await page.screenshot({path:`output/playwright/airspace-${label==='白天'?'day':'night'}.png`});
  }
  const zero=await phase(302);
  check(zero.strength===0&&zero.groundX===0,'wind reversal passes through a calm state');
  await page.screenshot({path:'output/playwright/airspace-calm.png'});
  const forward=await phase(500);await phase(0);const reverse=await phase(500);
  check(forward.groundX===reverse.groundX&&forward.strength===reverse.strength,'scrubbing in either direction gives the same scientific state');
  await page.mouse.move(720,450);await page.mouse.down();await page.mouse.move(790,420,{steps:10});await page.mouse.up();await page.waitForTimeout(1000);
  check((await diag()).render.geometry.layout==='land-left-sea-right','rotation preserves geographic identity');
  await page.screenshot({path:'output/playwright/airspace-rotated.png'});
  await page.getByRole('button',{name:'回到立体书全景',exact:true}).click();await page.waitForTimeout(1300);
  await page.screenshot({path:'output/playwright/airspace-book.png'});
  await page.locator('#cRead').click();await page.locator('#reader-image').evaluate(i=>i.decode());
  check(await page.locator('#reader-title').innerText()==='第 38 页','full-size reading shows the textbook page');
  await page.screenshot({path:'output/playwright/airspace-reading.png'});
  await page.getByRole('button',{name:'返回立体书',exact:true}).click();await fold();await page.waitForTimeout(1200);
  check((await diag()).render.models===0,'folding removes the entire lifted scene');
  await page.screenshot({path:'output/playwright/airspace-restored.png'});

  await page.getByRole('button',{name:'展开大气的水平运动——风',exact:true}).click();await live();await page.waitForTimeout(1300);
  const pressure=(await diag()).render.geometry;
  check(pressure.origin==='textbook-paragraph'&&pressure.sameHeight&&pressure.sceneElevation>45,'a paragraph opens into a same-height pressure field above the page');
  const arrowGeometry=await page.evaluate(()=>{
    const flow=window.textbookDebug?.entry?.art.geometry.flow;
    return flow?.filter(l=>l.points.length===3).map(l=>l.points[1].x-(l.points[0].x+l.points[2].x)/2)??null;
  });
  if(arrowGeometry)check(arrowGeometry.every(dx=>dx>0),'all rendered pressure-gradient arrowheads point from high to low');
  await checkLabels('pressure field');await page.screenshot({path:'output/playwright/airspace-pressure.png'});
  await page.getByRole('button',{name:'气压相同',exact:true}).click();await page.waitForTimeout(200);
  check(!(await diag()).render.geometry.pressureDifference,'equal pressure removes the idealized wind component');
  await page.screenshot({path:'output/playwright/airspace-pressure-equal.png'});await fold();

  await fromMenu('breeze');await page.getByRole('button',{name:'白天',exact:true}).click();
  const studentBefore=await page.evaluate(()=>localStorage.getItem('pep-geography-first-original-v2'));
  await page.locator('#cTeach').click();await page.waitForFunction(()=>window.textbookDiagnostics.teacher);
  await page.getByRole('button',{name:'夜晚',exact:true}).click();await fromMenu('water');
  check(await page.evaluate(()=>localStorage.getItem('pep-geography-first-original-v2'))===studentBefore,'teacher experiments leave the student bookmark untouched');
  await page.locator('#cTeach').click();await page.waitForFunction(()=>!window.textbookDiagnostics.teacher&&window.textbookDiagnostics.active==='breeze');await live();
  check((await diag()).render.geometry.phase===.5&&!(await diag()).playing,'leaving teacher mode restores the student scene and keeps it paused');await fold();

  await page.getByRole('button',{name:'减少动态效果',exact:true}).click();
  const ids=await page.locator('.figure-index [data-figure]').evaluateAll(nodes=>nodes.map(n=>n.dataset.figure));
  for(const id of ids){
    await fromMenu(id);await page.waitForTimeout(60);
    const d=(await diag()).render;
    check(d.geometry.imageMappedMeshes===0&&d.geometry.solids>0&&d.geometry.sceneElevation>=34,`${id}: real elevated geometry, with no illustration bitmap on its surfaces`);
    states.push({id,geometry:d.geometry,labels:d.labels,triangles:d.triangles,calls:d.calls});
    if(['solar','earth','water','river','soil','gis'].includes(id))await page.screenshot({path:`output/playwright/airspace-${id}.png`});
    await fold();
  }
  for(const size of [{width:1366,height:768},{width:1024,height:768}]){
    await page.setViewportSize(size);await fromMenu('breeze');await page.getByRole('button',{name:'白天',exact:true}).click();await page.waitForTimeout(180);
    await checkLabels(String(size.width));
    const fits=await page.locator('.capsule').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight;});
    check(fits,`${size.width}: controls fit the viewport`);
    await page.screenshot({path:`output/playwright/airspace-${size.width}.png`});await fold();
  }
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/?2d&page=38`,{waitUntil:'domcontentloaded'});await ready();
  await page.getByRole('button',{name:'展开海陆间的大气热力环流',exact:true}).click();await page.getByRole('button',{name:'夜晚',exact:true}).click();
  check((await diag()).twoD,'phone uses the two-dimensional fallback');
  check(await page.locator('.flat-demonstration').count()===1&&await page.locator('.original-page .flat-concept,.original-page .flat-effect').count()===0,'the fallback explanation is separate from the original textbook pages');
  check(await page.locator('.flat-model-svg').getAttribute('aria-label')==='夜间，近地面陆地 → 海洋，高空海洋 → 陆地','the fallback uses the same sea-breeze state');
  const phoneFont = await page.locator('.flat-model-svg text').evaluateAll(nodes => nodes.map(el => {
    const svg = el.ownerSVGElement;
    return parseFloat(getComputedStyle(el).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  }));
  check(phoneFont.every(size => size >= 18), 'phone model text is at least 18 actual CSS pixels');
  const clipped=await page.locator('.capsule button:visible,.capsule input:visible').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.bottom>innerHeight||r.top<0;}).map(el=>el.id));
  check(clipped.length===0,'all phone controls remain inside the viewport');
  await page.screenshot({path:'output/playwright/airspace-phone.png'});
  await page.locator('#cRead').click();await page.locator('#reader-image').evaluate(i=>i.decode());
  check(await page.locator('#reader-image').evaluate(i=>i.getBoundingClientRect().width)>=700,'phone reading can enlarge the original text');
  await page.screenshot({path:'output/playwright/airspace-phone-reading.png'});
  await page.getByRole('button',{name:'返回立体书',exact:true}).click();await fold();
  check(errors.length===0,'no browser exceptions');
  return {errors,checks,states,measurements,browser:page.context().browser().version(),base};
}
