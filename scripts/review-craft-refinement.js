async page=>{
 const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);
 page.on('pageerror',e=>errors.push(e.message));
 const settle=async()=>{let previous,stable=0;for(let i=0;i<80;i++){const p=await page.evaluate(()=>window.textbookDebug?.camera.position.toArray()??[0]);stable=previous&&Math.max(...p.map((v,i)=>Math.abs(v-previous[i])))<.0001?stable+1:0;if(stable>=4)return;previous=p;await page.waitForTimeout(90)}};
 const open=async id=>{await page.goto(`${base}/?figure=${id}&3d&inspect`);await page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&d.render?.modelState==='live'},id,{timeout:90000});await page.evaluate(()=>document.fonts.ready);await settle()};
 const capture=async name=>{states.push({name,state:await page.evaluate(()=>window.textbookDiagnostics)});await page.screenshot({path:`output/playwright/craft-${name}.png`});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: no document overflow`)};
 const choose=async i=>{const b=page.locator(`#selections [data-selection="${i}"]`);if(await b.count())await b.click()};
 const phase=async n=>{if(await page.locator('#phase').isVisible())await page.locator('#phase').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}))},n);await settle()};
 await page.setViewportSize({width:1366,height:900});
 for(const id of ['vegetation','river-valley','terrain-observation','typhoon','remote','urban-waterlogging']){
  await open(id);
  const selections=id==='vegetation'?[0,1,3,4,6]:id==='urban-waterlogging'?[0,1,2]:[0];
  for(const s of selections){await choose(s);const phases=id==='remote'?[450,690,1000]:id==='typhoon'?[500,1000]:id==='urban-waterlogging'?[550,1000]:[620];
   for(const p of phases){await phase(p);await capture(`${id}-${s}-${p}`)}
  }
  if(id==='vegetation'){
   await choose(0);
   for(const t of ['vine','buttress','layers']){await page.locator('#model-inspect').click();await page.locator(`[data-inspection="${t}"]`).click();await page.keyboard.press('Escape');await settle();await capture(`vegetation-${t}`)}
  }
 }
 await page.setViewportSize({width:1024,height:768});
 for(const id of ['vegetation','typhoon','remote','urban-waterlogging']){await open(id);await phase(850);await capture(`${id}-1024`)}
 return{checks,failures,errors,states,scope:'Actual rendered geometry across six refined scenes and a second viewport. Craft judgment requires inspecting saved images, not just these checks.'};
}
