async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const errors = [], failures = [], checks = [], states = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  const inspect = () => page.evaluate(() => {
    const box = element => {
      const r = element.getBoundingClientRect();
      return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    };
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const dock = document.querySelector('#book-ui .capsule'), bounds = box(dock);
    const controls = [...dock.querySelectorAll('button,a,input')].filter(visible).map(e => ({ id:e.id, text:e.textContent.trim(), ...box(e) }));
    const outsideDock = controls.filter(r => r.left < bounds.left-.5 || r.top < bounds.top-.5 || r.right > bounds.right+.5 || r.bottom > bounds.bottom+.5);
    const outsideViewport = controls.filter(r => r.left < -.5 || r.top < -.5 || r.right > innerWidth+.5 || r.bottom > innerHeight+.5);
    const overlaps = [];
    for (let i=0;i<controls.length;i++) for(let j=i+1;j<controls.length;j++) {
      const a=controls[i],b=controls[j];
      if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5) overlaps.push([a.id,b.id]);
    }
    const title = document.querySelector('#cCap'), style=getComputedStyle(title);
    const debug = window.textbookDebug, pixelRatio=debug?.renderer?.getPixelRatio()??1;
    const uniforms=debug?.glass?.uniforms, count=uniforms?.get('uCount')?.value??0;
    const glass = uniforms ? uniforms.get('uRects').value.slice(0,count).map(r => ({ left:r.x/pixelRatio,top:r.y/pixelRatio,width:r.z/pixelRatio,height:r.w/pixelRatio })) : [];
    const labels=window.textbookDiagnostics.render?.labels??[];
    const modelLabelsUnderDock=labels.filter(r=>Math.min(r.right,bounds.right)>Math.max(r.left,bounds.left)&&Math.min(r.bottom,bounds.bottom)>Math.max(r.top,bounds.top));
    return { dock:bounds, controls, outsideDock, outsideViewport, overlaps, touchTargetsBelow44:controls.filter(r=>r.width<43.5||r.height<43.5), title:{text:title.textContent,box:box(title),fontPx:parseFloat(style.fontSize),lineHeight:style.lineHeight,scrollWidth:title.scrollWidth,clientWidth:title.clientWidth,scrollHeight:title.scrollHeight,clientHeight:title.clientHeight},glass,modelLabelsUnderDock,labels,diagnostics:window.textbookDiagnostics,documentOverflow:document.documentElement.scrollWidth>innerWidth };
  });
  for (const viewport of [{width:698,height:900},{width:390,height:844},{width:1366,height:768}]) {
    await page.setViewportSize(viewport);
    for (const figure of ['breeze','wind-forces']) {
      console.log(`Dock ${viewport.width} ${figure}`);
      await page.goto(`${base}/?3d&figure=${figure}`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(id=>window.textbookDiagnostics?.ready&&!window.textbookDiagnostics.turning&&!window.textbookDiagnostics.figureBusy&&window.textbookDiagnostics.active===id&&window.textbookDiagnostics.render?.modelState==='live',figure,{timeout:60000});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(1000);
      const metrics=await inspect();
      const name=`${viewport.width}-${figure}`;
      await page.screenshot({path:`output/playwright/dock-${name}.png`});
      const issues=[];
      if(metrics.outsideDock.length)issues.push('controls outside capsule');
      if(metrics.outsideViewport.length||metrics.documentOverflow)issues.push('viewport overflow');
      if(metrics.overlaps.length)issues.push('overlapping controls');
      if(viewport.width<760&&metrics.touchTargetsBelow44.length)issues.push('narrow touch targets below 44px');
      if(viewport.width<760&&metrics.title.fontPx<18)issues.push('narrow title below 18px');
      if(metrics.title.scrollHeight>metrics.title.clientHeight+1||metrics.title.scrollWidth>metrics.title.clientWidth+1)issues.push('title clipped');
      if(metrics.glass.length){const r=metrics.glass[0],b=metrics.dock;if(Math.abs(r.left-b.left)>1||Math.abs(r.top-b.top)>1||Math.abs(r.width-b.width)>1||Math.abs(r.height-b.height)>1)issues.push('shader glass does not match capsule');}
      if(issues.length)failures.push({name,issues});else checks.push(name);
      states.push({name,viewport,...metrics});
      if(viewport.width===698&&figure==='breeze'){
        const presets=()=>page.locator('#selections [data-selection]').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-pressed')));
        const setPhase=async value=>{await page.locator('#phase').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);};
        await setPhase(800);
        const transition=await presets();
        if(transition.every(p=>p==='false'))checks.push('phase 800 highlights neither day nor night');else failures.push({name:'phase-800',values:transition});
        await page.getByRole('button',{name:'白天',exact:true}).click();
        const day=await presets();
        if(day.join(',')==='true,false')checks.push('day shortcut highlights its exact phase');else failures.push({name:'day-preset',values:day});
        await page.getByRole('button',{name:'夜晚',exact:true}).click();
        const night=await presets();
        if(night.join(',')==='false,true')checks.push('night shortcut highlights its exact phase');else failures.push({name:'night-preset',values:night});
        await setPhase(999);
        const wrapped=await presets();
        if(wrapped.join(',')==='false,true')checks.push('night shortcut uses circular phase distance');else failures.push({name:'wrapped-night-preset',values:wrapped});
        await page.getByRole('button',{name:'白天',exact:true}).click();
        await page.locator('#cPause').click();await page.waitForTimeout(800);
        const playing=await presets();
        if(playing.every(p=>p==='false'))checks.push('automatic playback clears exact presets away from the shortcuts');else failures.push({name:'playing-presets',values:playing});
        await page.locator('#cPause').click();
        await setPhase(800);await page.locator('#phase').dispatchEvent('change');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.textbookDiagnostics?.active==='breeze'&&!window.textbookDiagnostics.figureBusy&&window.textbookDiagnostics.render?.modelState==='live',null,{timeout:60000});
        const restored=await presets();
        if(restored.every(p=>p==='false'))checks.push('restored phase 800 starts with neither preset highlighted');else failures.push({name:'restored-presets',values:restored});
        await page.getByRole('button',{name:'白天',exact:true}).click();
      }
    }
  }
  // The reported defect occurs during a resize without navigation: the old
  // shader resolution scales a stale rectangle even though DOM controls reflow.
  for(const viewport of [{width:698,height:900},{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(700);
    const metrics=await inspect(),name=`resize-${viewport.width}-wind-forces`;
    await page.screenshot({path:`output/playwright/dock-${name}.png`});
    const r=metrics.glass[0],b=metrics.dock;
    const exact=!r||Math.abs(r.left-b.left)<1&&Math.abs(r.top-b.top)<1&&Math.abs(r.width-b.width)<1&&Math.abs(r.height-b.height)<1;
    if(exact&&!metrics.outsideDock.length&&!metrics.outsideViewport.length&&!metrics.overlaps.length)checks.push(name);else failures.push({name,glass:r,dock:b,outsideDock:metrics.outsideDock,overlaps:metrics.overlaps});
    states.push({name,viewport,...metrics});
  }
  return {base,browser:page.context().browser().version(),errors,failures,checks,states,limits:['Desktop Edge viewport emulation; physical touchscreen not tested.','Model-label checks detect bounds intersection, not every geometry occlusion.','Shader rectangle inspection is available only on the development build.','390px captures deliberately force 3D to exercise the dock; a touch phone normally starts in 2D.']};
}
