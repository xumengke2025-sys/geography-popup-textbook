async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4175',checks=[],failures=[],errors=[],states=[];
  const check=(ok,name)=>(ok?checks:failures).push(name);
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1366,height:900});
  const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&!d.turning&&!d.figureBusy&&(!id||d.active===id)&&(d.twoD||!d.active||d.render?.modelState==='live')},id,{timeout:60000});
  const d=()=>page.evaluate(()=>window.textbookDiagnostics);
  const seek=async value=>{await page.locator('#phase').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value);await page.waitForTimeout(100)};
  const open=async id=>{await page.locator('#cContents').click();await page.locator('#contents-models').click();await page.locator(`#model-contents [data-figure="${id}"]`).click();await ready(id);console.log(`Checked entry ${id}`)};
  await page.goto(`${base}/?3d&inspect`);await ready();
  await page.evaluate(()=>localStorage.clear());await page.reload();await ready();
  await page.locator('#cContents').click();await page.locator('#contents-models').click();
  await page.locator('#model-contents [data-figure="water"]').click();
  await page.waitForFunction(()=>window.textbookDiagnostics.active==='water'&&window.textbookDiagnostics.render?.modelState==='peel');
  check((await d()).state.phase===0,'First scientific phase stays at origin while the model rises');
  await ready('water');await page.waitForTimeout(350);check((await d()).state.phase>0,'First playback starts after the model becomes live');
  check((await d()).playbackSpeed===2,'Fresh sessions default to 2×');
  await seek(420);
  const bookmark=(await d()).spread;
  await page.goto(`${base}/?3d&inspect`);await ready();
  const cover=await page.evaluate(()=>{const b=window.textbookDebug;for(let y=200;y<700;y+=40)for(let x=300;x<1000;x+=40)if(b.pick(x,y)?.cover)return{x,y};return null});
  check(!!cover,'The physical cover has a real raycast target');
  if(cover){await page.mouse.click(cover.x,cover.y);await page.waitForFunction(n=>window.textbookDiagnostics.spread===n&&!window.textbookDiagnostics.turning,bookmark);check((await d()).spread===bookmark,'Physical cover resumes the saved bookmark');}
  await open('pressure-wind');await seek(200);
  const cloth=()=>page.evaluate(()=>{const e=window.textbookDebug.entry;const a=e.art.geometry.meshes.find(m=>m.geometry.type==='PlaneGeometry'&&m.userData.kind!=='text-label').geometry.attributes.position.array;return Array.from(a)});
  const first=await cloth();await seek(800);const other=await cloth();await seek(200);const returned=await cloth();
  check(JSON.stringify(first)!==JSON.stringify(other),'Wind cloth responds to the unified phase');
  check(JSON.stringify(first)===JSON.stringify(returned),'Reverse seek returns the exact same wind geometry');
  await page.locator('#selections [data-selection="1"]').click();check(await page.locator('#cPause').isHidden(),'Equal-pressure static comparison hides ineffective playback');
  await page.locator('#selections [data-selection="0"]').click();await page.locator('#restart').focus();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.textbookDiagnostics.active===null);check(true,'Escape folds the model while a control owns focus');
  for(const id of ['earth','soil-composition','density','geo-time','habitable','air-composition']){await open(id);check(await page.locator('#phase').isHidden()&&await page.locator('#cPause').isHidden(),`${id}: structural content has no meaningless progress/play control`)}
  for(const id of ['water-renewal','desalination','karst-cave','soil-factors','karst-livelihood','flood','drought','disaster-chain']){
    await open(id);await seek(1000);await page.locator('#selections [data-selection="1"]').click();const state=await d();
    check(state.state.phase<.15&&state.playing,`${id}: changing an independent condition starts its process`);states.push({id,phase:state.state.phase});
  }
  await open('earthquake');check(await page.locator('#cPause').isHidden(),'Quake structure is directly observable without fake progress');
  await seek(1000);await page.locator('#selections [data-selection="1"]').click();check((await d()).state.phase<.1,'Entering the warning starts at detection, not the final result');
  await seek(550);await page.locator('#selections [data-selection="2"]').click();check(Math.abs((await d()).state.phase-.55)<.001,'Near/far warning comparison preserves the observation instant');
  await page.goto(`${base}/?2d&figure=gnss`);await ready('gnss');
  const actions=page.locator('.flat-concept [data-model-selection],.flat-concept [data-model-replay]');
  const labels=await actions.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),monitor=labels.findIndex(s=>s?.includes('地面监控部分'));
  await actions.nth(monitor).focus();await page.keyboard.press('Enter');await page.waitForTimeout(1200);
  check((await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')))?.includes('地面监控部分'),'2D keyboard selection keeps focus on the same physical ground station');
  check(!errors.length,'No runtime exceptions during the targeted interaction review');
  return{base,checks,failures,errors,states,scope:'Real desktop interactions plus targeted 2D focus; physical touch hardware not exercised'};
}
