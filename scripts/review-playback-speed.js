async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4175',key='pep-geography-first-original-v2';
  const checks=[],failures=[],errors=[],samples=[],layouts=[],screenshots=[];
  const check=(ok,label)=>(ok?checks:failures).push(label);
  // Apply a legacy fixture after the departing page saves its bookmark.
  await page.addInitScript(key=>{const pending=sessionStorage.getItem('speed-review-seed');if(pending){localStorage.setItem(key,pending);sessionStorage.removeItem('speed-review-seed')}},key);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300))});
  const read=()=>page.evaluate(()=>{const d=window.textbookDiagnostics;return {phase:d.state?.phase,playing:d.playing,speed:d.playbackSpeed,teacher:d.teacher,twoD:d.twoD}});
  const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.figureBusy&&!d.turning&&(d.twoD||d.render?.modelState==='live')},id,{timeout:45000});
  const open=async(id,mode='2d')=>{await page.goto(`${base}/?figure=${id}&${mode}`,{waitUntil:'domcontentloaded'});await ready(id)};
  const phase=async value=>{await page.locator('#phase').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value)};
  const speed=async value=>{for(let i=0;i<4&&(await read()).speed!==value;i++)await page.locator('#cSpeed').click();check((await read()).speed===value,`Speed ${value}× is selectable`)};
  await page.setViewportSize({width:1366,height:900});await open('breeze');
  check((await read()).speed===2&&await page.locator('#cSpeed').innerText()==='2×','Fresh book defaults to 2×');
  await phase(420);const before=await read();await page.locator('#cSpeed').click();const after=await read();
  check(after.speed===4&&!after.playing&&after.phase===before.phase,'Changing speed while paused preserves pause and exact phase');
  await page.locator('#cSpeed').focus();await page.keyboard.press('Enter');check((await read()).speed===.5,'Enter changes speed');
  await page.keyboard.press('Space');check((await read()).speed===1,'Space changes speed');
  await speed(2);check((await page.locator('#cSpeed').getAttribute('aria-label')).includes('2 倍'),'Accessible label reports the current speed');
  for(const rate of [2,4,.5,1]){
    await speed(rate);await phase(200);await page.locator('#cPause').click();
    const sample=await page.evaluate(()=>new Promise(resolve=>{
      let start=null,last=0,elapsed=0,initial=0;
      const frame=now=>{const d=window.textbookDiagnostics;if(start===null){start=now;last=now;initial=d.state.phase}else{elapsed+=Math.min(.05,Math.max(0,(now-last)/1000));last=now}
        if(now-start>=1000)resolve({initial,final:d.state.phase,elapsed,wallSeconds:(now-start)/1000,speed:d.playbackSpeed,playing:d.playing});else requestAnimationFrame(frame)};
      requestAnimationFrame(frame);
    }));
    samples.push(sample);const measured=(sample.final-sample.initial)*120/sample.elapsed;
    check(sample.playing&&Math.abs(measured-rate)<.0001,`Real animation loop advances at ${rate}× (measured ${measured.toFixed(4)}×)`);
    await page.locator('#cPause').click();
  }
  await speed(2);await page.locator('#cPause').click();
  const liveChange=await page.locator('#cSpeed').evaluate(el=>{const a=window.textbookDiagnostics;const before={phase:a.state.phase,playing:a.playing};el.click();const b=window.textbookDiagnostics;return {before,after:{phase:b.state.phase,playing:b.playing,speed:b.playbackSpeed}}});
  check(liveChange.before.playing&&liveChange.after.playing&&liveChange.before.phase===liveChange.after.phase&&liveChange.after.speed===4,'Changing speed during playback keeps playing without a phase jump');
  await page.locator('#cPause').click();await phase(420);await page.reload();await ready('breeze');
  check((await read()).speed===4&&!(await read()).playing&&Math.abs((await read()).phase-.42)<1e-9,'Refresh restores chosen speed and observation paused');
  await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));delete p.playbackSpeed;p.notes={'20':'保留原有笔记'};sessionStorage.setItem('speed-review-seed',JSON.stringify(p))},key);
  await page.reload();await ready('breeze');
  check((await read()).speed===2&&Math.abs((await read()).phase-.42)<1e-9,'Older bookmark without a speed migrates to 2× without losing phase');
  check(await page.evaluate(()=>window.textbookDiagnostics.notes['20']==='保留原有笔记'),'Migration preserves existing notes');
  await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));p.playbackSpeed=3;sessionStorage.setItem('speed-review-seed',JSON.stringify(p))},key);await page.reload();await ready('breeze');
  check((await read()).speed===2,'Unsupported stored speed falls back to 2×');
  await page.locator('#cTeach').click();await page.waitForFunction(()=>window.textbookDiagnostics.teacher);await speed(4);
  check(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).playbackSpeed!==4,key),'Teacher speed does not overwrite personal preference');
  await page.locator('#cTeach').click();await ready('breeze');
  check(!(await read()).teacher&&(await read()).speed===2,'Leaving teacher mode restores personal speed');
  await open('thermal');await speed(4);await phase(990);await page.locator('#cPause').click();
  await page.waitForFunction(()=>!window.textbookDiagnostics.playing&&window.textbookDiagnostics.state.phase===1);
  check((await read()).phase===1&&!(await read()).playing,'One-shot animation still stops exactly at the end at 4×');
  await open('breeze');await speed(4);await phase(999);await page.locator('#cPause').click();
  await page.waitForFunction(()=>window.textbookDiagnostics.state.phase<.1);
  check((await read()).playing,'Cyclic animation wraps and keeps playing at 4×');await page.locator('#cPause').click();
  await speed(2);await open('breeze','3d');
  check((await read()).speed===2,'Three-dimensional book uses the same speed preference');
  await phase(580);await page.locator('#cPause').click();const threeStart=await read();await page.waitForTimeout(650);const threeEnd=await read();await page.locator('#cPause').click();
  check(threeEnd.phase>threeStart.phase&&threeEnd.speed===2,'Three-dimensional geometry advances with 2× playback');await phase(580);
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:320,height:740}]){
    if(size.width<600&&!(await read()).twoD)await open('breeze','2d');await page.setViewportSize(size);await page.waitForTimeout(450);
    const layout=await page.evaluate(()=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
      const speed=rect(document.querySelector('#cSpeed')),dock=rect(document.querySelector('.capsule'));
      const controls=[...document.querySelectorAll('#figure-controls button,#phase,#cPause,#cPrev,#cNext,#folio-toggle')].filter(el=>el.checkVisibility()).map(el=>({id:el.id||el.textContent.trim(),...rect(el)}));
      const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([a.id,b.id])}
      return {width:innerWidth,height:innerHeight,speed,dock,overlaps,controls,documentWidth:document.documentElement.scrollWidth};
    });layouts.push(layout);
    check(layout.speed.w>=44&&layout.speed.h>=44,`${size.width}: speed button has 44-pixel touch area`);
    check(layout.speed.x>=0&&layout.speed.right<=size.width&&layout.speed.bottom<=size.height,`${size.width}: speed control remains on screen`);
    check(layout.overlaps.length===0,`${size.width}: playback and page controls do not overlap`);
    check(layout.documentWidth<=size.width,`${size.width}: page has no horizontal overflow`);
    if([1366,390,320].includes(size.width)){const path=`output/playwright/playback-speed-${size.width}.png`;await page.screenshot({path});screenshots.push(path)}
  }
  return {base,checks,failures,errors,samples,layouts,screenshots,scope:'Playback speed control only: real Chrome production build, all four rates, pause/phase continuity, keyboard, old bookmarks, preference persistence, teacher isolation, once/cyclic playback, Three.js and native SVG, and five viewport layouts. Elapsed animation time accounts for the existing per-frame 50 ms cap; this is not an FPS benchmark.'};
}
