async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(ok,name)=>(ok?checks:failures).push(name);
  await page.setViewportSize({width:1366,height:900});
  for(const [id,selections] of [['solar-activity',[1]],['mars-base',[1,2]],['greenhouse',[1,2]],['soil-factors',[0,1,2]]]){
    await page.goto(`${base}/?3d&inspect&figure=${id}`);
    await page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&d.render?.modelState==='live'},id,{timeout:45000});
    for(const selection of selections){
      await page.locator(`#selections [data-selection="${selection}"]`).click();
      for(const value of [80,520,920]){
        await page.locator('#phase').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value);
        await page.waitForTimeout(700);
        const d=await page.evaluate(()=>window.textbookDiagnostics);
        check(d.state.selection===selection&&Math.abs(d.state.phase-value/1000)<.001&&!d.playing,`${id}/${selection}/${value}: requested condition and paused phase`);
        states.push({id,selection,phase:d.state.phase,model:d.render.model});
        await page.screenshot({path:`output/playwright/experience-causality-${id}-${selection}-${value}.png`});
      }
    }
  }
  check(!errors.length,'No runtime exceptions');
  return{base,checks,failures,errors,states,scope:'Eight selected causal conditions, three paused samples each; screenshots require visual judgment, not continuous animation or classroom acceptance'};
}
