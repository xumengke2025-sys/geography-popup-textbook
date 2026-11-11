async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], labelIssues = [], layoutIssues = [], states = [], screenshots = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === 'solar-distribution' && !d.turning && !d.figureBusy && (d.twoD || d.render?.modelState === 'live');
  }, null, { timeout: 45000 });
  const open = async flat => {
    await page.goto(`${base}/?figure=solar-distribution&${flat ? '2d' : '3d'}&inspect`, { waitUntil: 'domcontentloaded' });
    await ready(); await frames();
    if (await page.evaluate(() => window.textbookDiagnostics.playing)) await page.locator('#cPause').click();
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, g = d.render?.geometry;
    const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; };
    const svg = document.querySelector('.flat-concept > svg'), note = document.querySelector('#process-note');
    let visibleBounds = null;
    if (!d.twoD && b?.entry) {
      const points = [], r = b.renderer.domElement.getBoundingClientRect();
      for (const mesh of b.entry.art.geometry.meshes.filter(mesh => mesh.visible)) {
        const positions=mesh.geometry.attributes.position;
        for (let i=0;i<positions.count;i++) {
          const p=b.camera.position.clone().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(b.camera);
          points.push([r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]);
        }
      }
      if(points.length)visibleBounds={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
        top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
    }
    return { phase:d.state.phase, selection:d.state.selection, playing:d.playing, twoD:d.twoD, process:d.process,
      range:Number(document.querySelector('#phase').value), rangeLabel:document.querySelector('label[for="phase"]').textContent,
      caption:document.querySelector('#process-title').textContent, note:{...box(note), hidden:note.hidden},
      dock:box(document.querySelector('.capsule')), header:box(document.querySelector('#desk-header')), bounds:b?.processBounds, visibleBounds,
      width:innerWidth, height:innerHeight, overflow:document.documentElement.scrollWidth > innerWidth + 1,
      nodes:[...document.querySelectorAll('[data-process-node]')].map(el => ({ index:Number(el.dataset.processNode), pressed:el.getAttribute('aria-pressed') === 'true' })),
      meshes:b?.entry?.art?.geometry?.meshes.map(mesh => mesh.uuid), labels:d.render?.labels,
      model:g ? { kind:g.kind, phase:g.phase, latitude:g.latitudeDegrees, selection:g.selection,
        beamWidth:g.fixedBeamWidth, beamHeight:g.fixedBeamHeight, beamClamped:g.beamClampedAtHighLatitude,
        area:g.footprintArea, bufferReuse:g.geometryBuffersReused, rayWorld:g.rayWorld, handle:g.handleWorld,
        phaseTrack:g.phaseTrackWorld, nodes:g.nodeWorld, reference:g.reference, elevated:g.sceneElevation,
        imageMapped:g.imageMappedMeshes, original:g.originalPagePreserved } : null,
      svg:svg ? { phase:Number(svg.getAttribute('data-insolation-phase')), selection:Number(svg.getAttribute('data-insolation-selection')),
        latitude:Number(svg.getAttribute('data-insolation-latitude')), rayCount:svg.querySelectorAll('[data-insolation-ray]').length,
        nodeCount:svg.querySelectorAll('[data-insolation-node]').length, footprint:svg.querySelector('[data-insolation-footprint]')?.getAttribute('d'),
        images:svg.querySelectorAll('image').length, invalid:/NaN|Infinity|undefined/.test(svg.outerHTML), box:box(svg),
        labels:[...svg.querySelectorAll('text')].map(el => {
          const m = el.getScreenCTM(); return {text:el.textContent,...box(el),fontPx:parseFloat(getComputedStyle(el).fontSize)*Math.hypot(m.a,m.b)};
        }) } : null };
  });
  const seek = async value => {
    if (await page.evaluate(() => window.textbookDiagnostics.playing)) await page.locator('#cPause').click();
    await page.locator('#phase').evaluate((el, value) => {
      el.value=String(value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
    }, value);
    await frames(); return read();
  };
  const inspect = (s, name) => {
    check(!s.playing && s.range === Math.round(s.phase*1000), `${name}: paused input and progress agree`);
    const latitude = Math.asin(s.phase * Math.sin(65*Math.PI/180))*180/Math.PI;
    const selection = latitude < 30 ? 0 : latitude < 60 ? 1 : 2;
    check(s.selection === selection && s.process.activeStop === selection && s.nodes.filter(n=>n.pressed).length === 1
      && s.nodes.find(n=>n.pressed)?.index === selection, `${name}: one phase drives selected latitude and side note`);
    check(s.rangeLabel === '观察纬度' && !s.note.hidden && s.caption === s.process.title, `${name}: spatial observation has a current short explanation`);
    check(!s.overflow, `${name}: workspace has no horizontal overflow`);
    const labels=s.twoD?s.svg?.labels:s.labels;
    if (labels) {
      const small=labels.filter(l=>l.fontPx<(s.twoD?14.9:17.9));
      const overlaps=labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2
        &&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2).map(b=>[a.text,b.text]));
      const outside=labels.filter(l=>l.left< -1||l.right>s.width+1||(s.twoD
        ? l.left<s.svg.box.left-1||l.right>s.svg.box.right+1||l.top<s.svg.box.top-1||l.bottom>s.svg.box.bottom+1
        : l.top<s.header.bottom-1||l.bottom>s.dock.top-3));
      if(small.length||overlaps.length||outside.length)labelIssues.push({name,small,overlaps,outside});
    }
    if(s.twoD)check(s.svg&&!s.svg.invalid&&!s.svg.images&&s.svg.rayCount===5&&s.svg.nodeCount===3
      &&Math.abs(s.svg.latitude-latitude)<1e-7,`${name}: native SVG reads the same beam geometry`);
    else check(s.model?.kind==='solar-distribution'&&Math.abs(s.model.latitude-latitude)<1e-7
      &&s.model.beamWidth===3.2&&s.model.beamHeight===3.2&&!s.model.beamClamped&&s.model.bufferReuse
      &&s.model.original&&s.model.imageMapped===0&&s.model.elevated>0,`${name}: fixed-width light and reused solid geometry above the original page`);
    if(!s.twoD&&s.visibleBounds&&s.note.left<s.visibleBounds.right-3&&s.note.right>s.visibleBounds.left+3
      &&s.note.top<s.visibleBounds.bottom-3&&s.note.bottom>s.visibleBounds.top+3)
      layoutIssues.push({name,issue:'side note overlaps projected visible geometry',note:s.note,bounds:s.visibleBounds});
    states.push(s);
  };
  const capture=async name=>{const path=`output/playwright/insolation-${name}.png`;await page.screenshot({path});screenshots.push(path);};
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1366,height:900});await open(false);
  const initial=await seek(0);await page.waitForTimeout(1000);inspect(await read(),'desktop-low');await capture('desktop-low');
  let previousArea=0;
  for(let value=0;value<=1000;value+=50){const s=await seek(value);inspect(s,`desktop/${value}`);
    check(s.model.area>=previousArea-1e-7,`desktop/${value}: equal light covers no less area toward higher latitude`);previousArea=s.model.area;}
  await capture('desktop-high');
  for(const [index,destination] of [[0,0],[1,Math.sin(40*Math.PI/180)/Math.sin(65*Math.PI/180)],[2,1]]){
    const before=(await read()).phase;
    await page.locator(`[data-process-node="${index}"]`).click();
    const sampled=await page.evaluate(()=>new Promise(resolve=>{
      const values=[],start=performance.now();const step=()=>{const d=window.textbookDiagnostics;values.push(d.state.phase);
        if(!d.process.seeking||performance.now()-start>2500)resolve(values);else requestAnimationFrame(step);};requestAnimationFrame(step);
    }));await page.waitForFunction(()=>!window.textbookDiagnostics.process.seeking);await frames();
    const s=await read();inspect(s,`desktop/node-${index}`);
    check(Math.abs(s.phase-destination)<1e-7,`node-${index}: shortcut reaches its latitude`);
    check(sampled.some(v=>v>Math.min(before,destination)+1e-5&&v<Math.max(before,destination)-1e-5),`node-${index}: shortcut shows real intermediate positions`);
    check(JSON.stringify(s.meshes)===JSON.stringify(initial.meshes),`node-${index}: one retained globe and light apparatus`);
  }
  await seek(100);
  const targets=await page.evaluate(()=>{
    const b=window.textbookDebug,g=window.textbookDiagnostics.render.geometry,r=b.renderer.domElement.getBoundingClientRect();
    const project=p=>{const v=b.camera.position.clone().fromArray(p).project(b.camera);return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
    const handle=project(g.handleWorld),point=g.phaseTrackWorld.start.map((v,i)=>v+(g.phaseTrackWorld.end[i]-v)*.8),end=project(point);
    const hit=b.pickModel(handle.x,handle.y);return{handle,end,kind:hit?.input?.kind};
  });
  check(targets.kind==='phase-track','physical beam handle can be hit without penetrating the globe');
  if(targets.kind==='phase-track'){
    await page.mouse.move(targets.handle.x,targets.handle.y);await page.mouse.down();
    await page.mouse.move(targets.end.x,targets.end.y,{steps:14});await page.mouse.up();await frames();
    const s=await read();inspect(s,'desktop/real-handle-drag');check(s.phase>.6&&s.phase<.95,'actual pointer drag moves the beam to high latitude and pauses');
  }
  await seek(200);await page.locator('#cPause').click();const start=(await read()).phase;
  await page.waitForFunction(p=>window.textbookDiagnostics.state.phase>p+.001,start);
  await page.locator('#cPause').click();const paused=(await read()).phase;await page.waitForTimeout(250);
  check((await read()).phase===paused,'play advances the same phase; pause freezes its light geometry');
  const forward=await seek(750);await seek(200);const backward=await seek(750);
  check(JSON.stringify(forward.model.rayWorld)===JSON.stringify(backward.model.rayWorld),'forward and backward scrubbing return the identical actual ray endpoints');
  await page.reload({waitUntil:'domcontentloaded'});await ready();const restored=await read();
  check(restored.phase===.75&&!restored.playing,'reloading restores observation latitude but remains paused');
  for(const viewport of [{width:1366,height:768},{width:1024,height:768}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(600);
    for(const value of [0,500,1000]){inspect(await seek(value),`${viewport.width}x${viewport.height}/${value}`);}
    await capture(`${viewport.width}x${viewport.height}-high`);
  }
  await page.setViewportSize({width:390,height:844});await open(true);
  for(const value of [0,250,500,750,1000,500])inspect(await seek(value),`phone/${value}`);
  await capture('phone-mid');
  const svgNode=page.locator('[data-insolation-node="2"]');await svgNode.focus();await svgNode.press('Enter');
  await page.waitForFunction(()=>!window.textbookDiagnostics.process.seeking);await frames();const svgHigh=await read();
  inspect(svgHigh,'phone/keyboard-node');check(svgHigh.phase===1,'native SVG latitude pin supports keyboard selection');await capture('phone-high');
  check(!errors.length,'no browser exceptions or console errors');
  return{base,checks,failures,errors,labelIssues,layoutIssues,states,screenshots,
    evidenceScope:'One continuous observation-latitude apparatus; actual desktop pointer dragging, smooth bookmarks, backwards scrubbing, playback, restore, four viewports and native SVG. Viewport simulations are not physical devices.'};
}
