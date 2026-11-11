async page => {
 const base=page.__reviewBase??'http://127.0.0.1:5173',checks=[],failures=[],errors=[],states=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);
 page.on('pageerror',e=>errors.push(e.message));
 const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.figureBusy&&!d.turning&&(d.twoD||d.render?.modelState==='live')},id,{timeout:90000});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  for(const id of ['vegetation','soil','soil-factors','urban-waterlogging','water','breeze','atmosphere']){
   await page.goto(`${base}/?figure=${id}&2d`);await ready(id);await page.waitForTimeout(400);
   const picker=page.locator('#condition-choice');
   if(await picker.isVisible()){
    check(await picker.evaluate(el=>el.selectedOptions.length===1&&el.selectedOptions[0].textContent.trim().length>0),`${width}/${id}: current condition has a readable selected label`);
    const lastValue=await picker.locator('option').last().getAttribute('value');
    await picker.selectOption(lastValue);await picker.focus();
    check(await picker.inputValue()===lastValue,`${width}/${id}: native condition choice works`);
    check(await picker.evaluate(el=>document.activeElement===el),`${width}/${id}: condition picker keeps focus`);
    await picker.selectOption(id==='soil'?'-1':'0');
   }
   const layout=await page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
    const controls=[...document.querySelectorAll('#figure-controls button,#phase,#condition-choice,#cPause,#cPrev,#cNext,#folio-toggle')].filter(el=>el.checkVisibility()).map(el=>({id:el.id||el.textContent.trim(),...rect(el)}));
    const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([a.id,b.id])}
    return {width:innerWidth,dock:rect(document.querySelector('.capsule')),controls,overlaps,overflow:document.documentElement.scrollWidth>innerWidth};
   });states.push({id,width,layout});
   check(layout.dock.h<=180,`${width}/${id}: dock is at most 180px, including page navigation`);
   check(!layout.overflow,`${width}/${id}: no horizontal page overflow`);
   check(!layout.overlaps.length,`${width}/${id}: visible controls do not overlap`);
   check(layout.controls.every(c=>c.h>=43&&c.w>=43),`${width}/${id}: touch targets remain at least 44px`);
   if(width===390&&['vegetation','urban-waterlogging','breeze'].includes(id))await page.screenshot({path:`output/playwright/compact-${id}.png`});
  }
 }
 await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/?figure=vegetation&3d&inspect`);await ready('vegetation');
 check(await page.locator('#selections [data-selection="6"]').isVisible()&&!await page.locator('#condition-choice').isVisible(),'Desktop retains direct condition buttons');
 check(await page.locator('#cSpeed').isHidden(),'Structural observation retains no pointless speed control');
  return {checks,failures,errors,states,scope:'Compact mobile control layout with real native condition selection, seven models at two widths, desktop preserved. Includes the complete soil column default. Not a physical touch-device review.'};
}
