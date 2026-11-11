async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4173';
  const checks=[],failures=[],errors=[],states=[],screenshots=[];
  const check=(ok,label)=>(ok?checks:failures).push(label);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,350))});
  const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.figureBusy&&!d.turning&&(d.twoD||d.render?.modelState==='live')},id,{timeout:45000});
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const snapshot=()=>page.evaluate(()=>{
    const d=window.textbookDiagnostics,g=d.render?.geometry,svg=document.querySelector('.flat-concept>svg');
    return{id:d.active,phase:d.state.phase,selection:d.state.selection,playing:d.playing,twoD:d.twoD,process:d.process,
      model:g?{phase:g.phase,stage:g.stage,geometryBuffersReused:g.geometryBuffersReused,inventory:g.inventory,
        packetCount:g.packets?.length,communicationDelivered:g.state?.communicationDelivered,vehicleProgress:g.vehicleWorld?.progress,
        observerWarmth:g.observation?.warmth,flagExtension:g.flag?.extension,beamWidth:g.fixedBeamWidth,
        beamHeight:g.fixedBeamHeight,footprintArea:g.footprintArea,latitude:g.latitudeDegrees}:null,
      nodes:[...document.querySelectorAll('#figure-controls [data-process-node]')].map(b=>({index:Number(b.dataset.processNode),pressed:b.getAttribute('aria-pressed')==='true'})),
      svg:svg?{images:svg.querySelectorAll('image').length,packets:svg.querySelectorAll('[data-urban-packet]').length,
        phase:Number(svg.getAttribute('data-phase')??svg.getAttribute('data-urban-phase')??svg.getAttribute('data-insolation-phase')??svg.querySelector('[data-gnss-phase]')?.getAttribute('data-gnss-phase'))}:null};
  });
  const phase=async value=>{
    if((await snapshot()).playing)await page.locator('#cPause').click();
    const slider=page.locator('#phase');await slider.focus();await slider.press('Home');
    for(let i=0;i<value/100;i++)await slider.press('PageUp');
    await frame();return snapshot();
  };
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1366,height:768});
  for(const id of ['breeze','cold-wave','urban-waterlogging','gnss','solar-distribution']){
    await page.goto(`${base}/?figure=${id}&3d&inspect`,{waitUntil:'domcontentloaded'});await ready(id);
    if(id==='urban-waterlogging')await page.locator('#selections [data-selection="2"]').click();
    const first=await phase(0),middle=await phase(500),last=await phase(1000),reverse=await phase(500);
    check(!reverse.playing&&Math.abs(reverse.phase-.5)<1e-7,`${id}: local package accepts paused reverse scrubbing`);
    check(JSON.stringify(middle.model)===JSON.stringify(reverse.model),`${id}: reversed phase reproduces the same 3-D state`);
    check(reverse.process.title.length>0&&reverse.process.text.length>0,`${id}: local package includes synchronized Chinese explanations`);
    if(id!=='breeze')check(first.model.geometryBuffersReused&&last.model.geometryBuffersReused,`${id}: geometry survives beginning and endpoint`);
    if(id==='urban-waterlogging')check(last.model.packetCount===12&&Object.values(last.model.inventory).reduce((a,b)=>a+b,0)===12,`${id}: no rainfall marker is lost`);
    if(id==='cold-wave')check(last.model.observerWarmth<first.model.observerWarmth&&last.model.flagExtension>first.model.flagExtension,`${id}: local observer responds after arrival`);
    if(id==='gnss')check(last.model.communicationDelivered&&last.model.vehicleProgress===1,`${id}: complete communication and rescue are retained`);
    if(id==='solar-distribution')check(first.model.beamWidth===3.2&&last.model.beamHeight===3.2&&last.model.footprintArea>first.model.footprintArea
      &&Math.abs(last.model.latitude-65)<1e-7,`${id}: local package preserves equal light width and the actual high-latitude footprint`);
    const pressed=reverse.nodes.filter(n=>n.pressed);check(pressed.length===1&&pressed[0].index===reverse.process.activeStop,`${id}: options follow the continuous playhead`);
    await page.reload({waitUntil:'domcontentloaded'});await ready(id);const restored=await snapshot();
    check(!restored.playing&&Math.abs(restored.phase-.5)<1e-7,`${id}: same localhost origin restores the saved observation paused`);
    await page.locator('#fold').click();await page.waitForFunction(()=>!window.textbookDiagnostics.active&&!window.textbookDiagnostics.figureBusy);
    check((await page.locator('#process-note').isHidden()),`${id}: folding removes the current explanation`);
    states.push({id,first,middle,last,reverse,restored});
  }
  await page.setViewportSize({width:390,height:844});
  for(const id of ['cold-wave','urban-waterlogging','gnss','solar-distribution']){
    await page.goto(`${base}/?figure=${id}&2d&inspect`,{waitUntil:'domcontentloaded'});await ready(id);
    const s=await phase(500);check(s.svg&&s.svg.images===0&&Math.abs(s.svg.phase-.5)<1e-7,`${id}/phone: built-in SVG shares the playhead without image replacements`);
    states.push({phone:s});
  }
  const file='output/playwright/continuous-systems-portable-phone.png';await page.screenshot({path:file});screenshots.push(file);
  return{base,checks,failures,errors,states,screenshots,scope:'Portable localhost 4173, production assets with all nonlocal HTTP(S) blocked; same-origin persistence, sea-breeze, cold wave, urban drainage, GNSS, equal-width sunlight and native phone SVG. Not physical network disconnection or fresh Windows extraction.'};
}
