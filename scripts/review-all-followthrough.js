async page=>{
 const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);page.on('pageerror',e=>errors.push(e.message));
 const settle=async()=>{let previous,stable=0;for(let i=0;i<70;i++){const p=await page.evaluate(()=>window.textbookDebug?.camera.position.toArray()??[0]);stable=previous&&Math.max(...p.map((v,i)=>Math.abs(v-previous[i])))<.0001?stable+1:0;if(stable>=4)return;previous=p;await page.waitForTimeout(90)}};
 const cases=[...Array.from({length:7},(_,i)=>['vegetation',i,.85]),['river-valley',0,.7],['river-valley',1,.7],['terrain-observation',0,.7],['remote',0,.45],['remote',0,1],['typhoon',0,.85],['urban-waterlogging',0,1],['urban-waterlogging',2,1],['karst',0,.1],['karst',0,.9],['aeolian',2,.6],['coastal-landform',0,1]];
 for(const [id,selection,phase] of cases){
  await page.setViewportSize({width:1366,height:900});await page.goto(`${base}/?figure=${id}&3d&inspect`);
  await page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&(d.twoD||d.render?.modelState==='live')},id,{timeout:90000});
  const choice=page.locator(`#selections [data-selection="${selection}"]`);if(await choice.count())await choice.click();
  if(await page.locator('#phase').isVisible())await page.locator('#phase').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))},phase*1000);
  await page.evaluate(()=>document.fonts.ready);await settle();
  const d=await page.evaluate(()=>window.textbookDiagnostics),name=`${id}-${selection}-${phase}`;
  check(!d.twoD,`${name}: actual Three.js render available`);check(!d.playing,`${name}: paused inspection`);
  states.push({id,name,state:d.state,render:d.render});await page.screenshot({path:`output/playwright/all-craft-${name}.png`});
  await page.__writeReviewCheckpoint?.({checks,failures,errors,states});
 }
 return{checks,failures,errors,states,scope:'New vegetation, river/terrain, remote, typhoon and drain craftsmanship with adjacent relief consumers, actual 1366x900 rendered samples. Visual judgment is separate from technical assertions.'};
}
