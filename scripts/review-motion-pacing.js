async page=>{
 const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[],sequences=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1024,height:768});
 const cases=[['river',0],['coastal-landform',0],['remote',0],['mars-base',1],['greenhouse',1],['soil-factors',0],['soil-factors',1],['soil-factors',2],['urban-waterlogging',2],['water',0],['solar-activity',1]];
 for(const [id,selection] of cases.slice(page.__reviewStart??0)){
  await page.goto(`${base}/?figure=${id}&3d&inspect`);await page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&d.render?.modelState==='live'},id,{timeout:90000});
  const choice=page.locator(`#selections [data-selection="${selection}"]`);if(await choice.count())await choice.click();
  await page.locator('#phase').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(1500);
  check(await page.locator('#cSpeed').textContent()==='2×',`${id}: continuous preview uses default 2×`);
  await page.locator('#cPause').click();const samples=[];
  for(let i=0;i<48;i++){
   await page.waitForTimeout(350);
   const sample=await page.evaluate(()=>{const d=window.textbookDiagnostics;return{phase:d.state.phase,playing:d.playing,geometry:d.render.geometry,caption:d.process?.title}});samples.push(sample);
   if(i%3===0||!sample.playing){const name=`${id}-${selection}-${String(i).padStart(2,'0')}`;await page.screenshot({path:`output/playwright/motion-${name}.png`});states.push({name,phase:sample.phase,caption:sample.caption});}
   if(!sample.playing)break;
  }
  check(samples.every((s,i)=>!i||s.phase>=samples[i-1].phase),`${id}: real playback advances without reversing or resetting`);
  check(samples.at(-1)?.phase===1&&!samples.at(-1)?.playing,`${id}: complete real playback retains its final state`);
  const final=samples.at(-1);await page.waitForTimeout(500);const held=await page.evaluate(()=>window.textbookDiagnostics.state.phase);
  check(held===final?.phase,`${id}: result remains available after playback`);
  sequences.push({id,selection,samples});
  await page.__writeReviewCheckpoint?.({checks,failures,errors,states,sequences});
 }
 return{checks,failures,errors,states,sequences,scope:'Complete 2× actual Three.js playbacks with dense state samples and periodic rendered frames. Camera/geometry must be visually reviewed; no hardware FPS or physical-device claim.'};
}
