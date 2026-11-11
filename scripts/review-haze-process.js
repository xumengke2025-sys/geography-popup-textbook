async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], targets = [];
  const check = (value, label) => (value ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 600)); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/?figure=haze&3d&inspect`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.textbookDiagnostics?.active === 'haze' && window.textbookDiagnostics?.render?.modelState === 'live' && !window.textbookDiagnostics?.figureBusy, null, { timeout: 45000 });
  } catch (error) {
    failures.push(error.message); states.push(await page.evaluate(() => window.textbookDiagnostics ?? { body: document.body.textContent.slice(0, 500) }));
    await page.screenshot({ path: 'output/playwright/haze-process-load-error.png' });
    return { checks, failures, errors, states };
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'output/playwright/haze-process-initial.png' });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, b = window.textbookDebug, mesh = b?.entry.art.geometry.meshes.find(m => m.userData.pollutionParcels);
    return { phase:d.state.phase, selection:d.state.selection, playing:d.playing, render:d.render,
      vertices:mesh ? Array.from(mesh.geometry.attributes.position.array).slice(0, 96) : null,
      saved:JSON.parse(localStorage.getItem('pep-geography-first-original-v2') ?? 'null')?.figures?.haze };
  });
  const phase = async value => {
    const slider = page.locator('#phase'); await slider.focus();
    if (value === 0 || value === 1) await slider.press(value ? 'End' : 'Home');
    else { const box = await slider.boundingBox(); await slider.click({ position:{x:box.width * value,y:box.height/2} }); }
    await page.waitForTimeout(100); return read();
  };
  const geometry = state => state.render.geometry;
  const initial = await phase(0); states.push({ name:'initial', ...initial });
  check(geometry(initial).architecture === 'three-dimensional-geometry' && geometry(initial).imageMappedMeshes === 0, 'Haze is real Three.js geometry, without illustration surfaces');
  check(geometry(initial).stock === 36 && geometry(initial).emittedNew === 0, 'Initial city contains the shared existing stock');
  const middle = await phase(.55); states.push({ name:'accumulating', ...middle });
  check(geometry(middle).stock > geometry(initial).stock, 'New emissions visibly add to the initial stock');
  check(middle.vertices.some((v,i) => v !== initial.vertices[i]), 'Actual Three.js parcel vertex coordinates move');
  await page.screenshot({ path:'output/playwright/haze-process-accumulating.png' });
  await page.waitForTimeout(400); const held = await read();
  check(!held.playing && held.phase === middle.phase && JSON.stringify(held.vertices) === JSON.stringify(middle.vertices), 'Pausing freezes actual geometry as well as timeline');
  await phase(.85); const returnToMiddle = await phase(.55);
  check(returnToMiddle.phase === middle.phase && JSON.stringify(returnToMiddle.vertices) === JSON.stringify(middle.vertices), 'Forward/backward drag gives the same real vertex positions');
  const pick = async key => {
    const point = await page.evaluate(key => {
      const b = window.textbookDebug; b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
      const root = b.entry.art.geometry, candidates = root.meshes.filter(m => m.userData[key]);
      for (const mesh of candidates) {
        mesh.geometry.computeBoundingBox(); const q = mesh.geometry.boundingBox.getCenter(b.camera.position.clone().set(0,0,0));
        q.applyMatrix4(mesh.matrixWorld).project(b.camera);
        const r = b.renderer.domElement.getBoundingClientRect(), x=r.left+(q.x+1)*r.width/2, y=r.top+(1-q.y)*r.height/2;
        const hit=b.pickModel(x,y);
        if(hit?.input?.kind==='select' && hit.input.selection===mesh.userData.modelInput.selection && document.elementFromPoint(x,y)===b.renderer.domElement) return {x,y,label:hit.input.label};
      }
      return null;
    }, key);
    if(!point) throw Error(`No unoccluded physical input target ${key}`);
    targets.push(point); await page.mouse.click(point.x,point.y); await page.waitForTimeout(120); return read();
  };
  const intervention = await pick('emissionValve'); states.push({name:'source-click',...intervention});
  check(intervention.selection===2 && intervention.phase<.04 && intervention.playing, 'Clicking the actual chimney valve starts the reduced-emission trial');
  check(geometry(intervention).existingRemaining===36, 'Changing the source does not erase the existing pollution');
  const reduced = await phase(1); states.push({name:'reduced-end',...reduced});
  check(geometry(reduced).sourceRate<.2 && geometry(reduced).existingRemaining>0, 'Reduced source and remaining legacy pollution coexist at the end');
  await page.screenshot({path:'output/playwright/haze-process-reduced-end.png'});
  await page.locator('#restart').click(); await page.waitForTimeout(100); const repeatedSource=await read();
  check(repeatedSource.selection===2&&repeatedSource.phase<.04&&repeatedSource.playing,'Replay retains the chosen reduced-emission condition');
  await phase(.6);
  const wind = await pick('windFlag'); states.push({name:'wind-click',...wind});
  check(wind.selection===1 && wind.phase<.04 && wind.playing, 'Clicking the actual wind flag starts the ventilation trial');
  const blowing = await phase(.65); states.push({name:'ventilating',...blowing});
  check(geometry(blowing).windStrength>0.99 && geometry(blowing).removed>0, 'Wind develops, then existing parcels leave the observation volume');
  await page.screenshot({path:'output/playwright/haze-process-ventilating.png'});
  const turnOff=await pick('windFlag');
  check(turnOff.selection===0,'The expanded moving flag can be clicked again to return to the weak-wind trial');
  await pick('windFlag'); await phase(.65);
  const memory = [blowing.render.geometries,blowing.render.textures];
  for (const value of [.2,.8,.4,.9,.3,.7]) await phase(value);
  const after = await read();
  check(after.render.geometries===memory[0] && after.render.textures===memory[1], 'Scrubbing updates buffers without allocating meshes or textures');
  await phase(.995); await page.locator('#cPause').click(); await page.waitForFunction(()=>window.textbookDiagnostics.state.phase===1 && !window.textbookDiagnostics.playing);
  const ended=await read(); await page.waitForTimeout(250);
  check((await read()).phase===1 && !ended.playing, 'Pollution trial stops at its end without a timeline wrap');
  await page.locator('#cPause').click(); await page.waitForTimeout(100); const replay = await read();
  check(replay.phase<.04 && replay.playing, 'Play at the end deliberately replays the same trial');
  const persist=await phase(.62); await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.textbookDiagnostics?.render?.modelState==='live' && !window.textbookDiagnostics.figureBusy,null,{timeout:45000});
  const restored=await read();
  check(!restored.playing && restored.phase===persist.phase && restored.selection===persist.selection,'Refresh restores conditions and stays paused');
  await page.setViewportSize({width:1024,height:768}); await page.waitForTimeout(700);
  const tablet=await read(); states.push({name:'tablet',...tablet});
  const labels=tablet.render.labels, overlap=labels.some((a,i)=>labels.some((b,j)=>j>i&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)));
  check(!overlap,'1024px short model labels do not overlap');
  await page.screenshot({path:'output/playwright/haze-process-tablet.png'});
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${base}/?figure=haze&2d`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.textbookDiagnostics?.active==='haze'&&!window.textbookDiagnostics.figureBusy);
  const twoD=await phase(.62), svg=await page.locator('.flat-concept svg').innerHTML();
  check(svg.includes('data-particle=')&&!svg.includes('<image'),'2D alternative uses parcels from the shared model, without a pasted illustration');
  const target=page.locator('[data-model-selection="2"]');
  await target.click(); await page.waitForTimeout(80);
  check((await read()).selection===2,'2D chimney is directly operable');
  await phase(.4); await page.locator('[data-model-selection="1"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  check((await read()).selection===1,'2D wind flag supports the keyboard');
  await phase(.6); await page.screenshot({path:'output/playwright/haze-process-phone-2d.png',fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Phone reader does not overflow horizontally');
  return { base, checks, failures, errors, states, targets };
}
