async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], screenshots = [], layoutIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const close = (a, b, epsilon = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && d.active === id && !d.turning && !d.figureBusy && (d.twoD || d.render?.modelState === 'live');
  }, id, { timeout: 45000 });
  const open = async (id, flat = false) => {
    await page.goto(`${base}/?figure=${id}&${flat ? '2d' : '3d'}&inspect`, { waitUntil: 'domcontentloaded' });
    await ready(id); await frames();
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics, book = window.textbookDebug, g = d.render?.geometry;
    const physical = book?.entry?.art?.geometry, svg = document.querySelector('.flat-concept > svg');
    const box = element => {
      if (!element) return null; const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height,
        hidden:element.hidden || style.display === 'none' || style.visibility === 'hidden' };
    };
    const note = document.querySelector('#process-note');
    return { id:d.active, phase:d.state?.phase, selection:d.state?.selection, playing:d.playing, twoD:d.twoD,
      process:d.process, caption:d.state?.caption, spread:d.spread,
      render:d.render ? { calls:d.render.calls, triangles:d.render.triangles, geometries:d.render.geometries, textures:d.render.textures } : null,
      meshIds:physical?.meshes.map(mesh => mesh.uuid), bufferReuse:g?.geometryBuffersReused,
      model:g ? { kind:g.kind, phase:g.phase, selection:g.selection, stage:g.stage, stageIndex:g.stageIndex, caption:g.caption,
        inventory:g.inventory, packetWorld:g.packetWorld, packets:g.packets?.map(p => ({id:p.id, point:p.point, compartment:p.compartment})),
        allPacketsVisible:g.allPacketsVisible, inputCount:g.inputCount, preventsAllFlooding:g.preventsAllFlooding,
        observation:g.observation, flag:g.flag ? {extension:g.flag.extension, droop:g.flag.droop} : null,
        frontX:g.frontX, arrivalPhase:g.arrivalPhase, flagTipWorld:g.flagTipWorld, gaugeTopWorld:g.gaugeTopWorld,
        linkWorld:g.linkWorld, vehicleWorld:g.vehicleWorld, positionReady:g.state?.positionReady,
        communicationDelivered:g.state?.communicationDelivered, receiverWorld:g.receiverWorld,
        handleWorld:g.handleWorld, phaseTrackWorld:g.phaseTrackWorld, grainCount:g.grains?.length } : null,
      range:{ value:Number(document.querySelector('#phase').value), text:document.querySelector('#phase').getAttribute('aria-valuetext') },
      nodes:[...document.querySelectorAll('#figure-controls [data-process-node]')].map(b => ({ index:Number(b.dataset.processNode),
        label:b.textContent.trim(), pressed:b.getAttribute('aria-pressed') === 'true' })),
      choices:[...document.querySelectorAll('#selections [data-selection]:not([data-process-node])')].map(b => b.textContent.trim()),
      note:{ ...box(note), position:note.dataset.position, title:document.querySelector('#process-title').textContent,
        text:document.querySelector('#process-text').textContent, textFont:parseFloat(getComputedStyle(document.querySelector('#process-text')).fontSize) },
      bounds:book?.processBounds, dock:box(document.querySelector('.capsule')), labels:d.render?.labels,
      viewport:{width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth},
      svg:svg ? { images:svg.querySelectorAll('image').length, invalid:/NaN|Infinity|undefined/.test(svg.outerHTML),
        packetCount:svg.querySelectorAll('[data-urban-packet]').length, urban:svg.getAttribute('data-urban-state'),
        phase:svg.getAttribute('data-phase') ?? svg.getAttribute('data-urban-phase') ?? svg.querySelector('[data-gnss-phase]')?.getAttribute('data-gnss-phase') } : null,
    };
  });
  const phase = async value => {
    if ((await read()).playing) { await page.locator('#cPause').click(); await frames(); }
    const slider = page.locator('#phase'); await slider.focus(); await slider.press('Home');
    for (let i = 0; i < Math.floor(value / 100); i++) await slider.press('PageUp');
    for (let i = 0; i < value % 100; i++) await slider.press('ArrowRight');
    await page.waitForFunction(v => Math.abs(window.textbookDiagnostics.state.phase - v / 1000) < 1e-8 && !window.textbookDiagnostics.playing, value);
    await frames(); return read();
  };
  const node = async (index, destination) => {
    const before = (await read()).phase;
    await page.locator(`#figure-controls [data-process-node="${index}"]`).click();
    const intermediate = await page.evaluate(() => new Promise(resolve => {
      const values = [], start = performance.now();
      const sample = () => { const d = window.textbookDiagnostics; values.push(d.state.phase);
        if (!d.process?.seeking || performance.now() - start > 2500) resolve(values); else requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
    }));
    await page.waitForFunction(() => !window.textbookDiagnostics.process?.seeking);
    await frames(); const s = await read();
    check(close(s.phase, destination) && !s.playing, `${s.id}/node/${index}: smooth shortcut ends paused at its playhead`);
    if (!close(before, destination)) check(intermediate.some(v => v > Math.min(before, destination) + 1e-5 && v < Math.max(before, destination) - 1e-5),
      `${s.id}/node/${index}: real intermediate frames appear instead of a state replacement`);
    return s;
  };
  const inspect = (s, name) => {
    check(close(s.range.value, Math.round(s.phase * 1000)), `${name}: slider follows lesson phase`);
    check(s.note.title === s.caption && s.note.title === s.process?.title && s.note.text.length > 0 && s.note.title !== s.note.text,
      `${name}: a single current explanation appears without repeating its heading`);
    check(eq(s.nodes.filter(n => n.pressed).map(n => n.index), [s.process.activeStop]), `${name}: selected node follows progress`);
    if (!s.twoD) check(close(s.model.phase, s.phase) && s.bufferReuse, `${name}: real 3-D geometry shares phase and reuses buffers`);
    else check(s.svg && s.svg.images === 0 && !s.svg.invalid && close(Number(s.svg.phase), s.phase), `${name}: native SVG uses the same playhead`);
  };
  const layout = (s, name) => {
    const overlap = (a, b) => a && b && a.left < b.right - 4 && a.right > b.left + 4 && a.top < b.bottom - 4 && a.bottom > b.top + 4;
    const issues = [];
    if (s.note.hidden) issues.push('note hidden');
    if (s.note.left < 0 || s.note.right > s.viewport.width + 1 || s.note.top < 65 || s.note.bottom > s.dock.top) issues.push('note outside reading space');
    if (!s.twoD && overlap(s.note, s.bounds)) issues.push('note overlaps fixed scene bounds');
    if (s.viewport.scrollWidth > s.viewport.width + 1) issues.push('horizontal overflow');
    if (s.note.textFont < (s.viewport.width < 760 ? 15 : 17)) issues.push('small explanation');
    for (const issue of issues) layoutIssues.push({ name, issue, note:s.note, bounds:s.bounds });
    check(!issues.length, `${name}: caption has readable, separate reserved space`);
  };
  const capture = async name => { const file = `output/playwright/continuous-systems-${name}.png`; await page.screenshot({ path:file }); screenshots.push(file); };
  const dragFront = async () => {
    const target = await page.evaluate(() => {
      const b = window.textbookDebug, g = window.textbookDiagnostics.render.geometry, r = b.renderer.domElement.getBoundingClientRect();
      const project = point => { const v = b.camera.position.clone().fromArray(point).project(b.camera); return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}; };
      const handle = project(g.handleWorld), a = g.phaseTrackWorld.start, z = g.phaseTrackWorld.end;
      const end = project(a.map((v, i) => v + (z[i] - v) * .78));
      const hit = b.pickModel(handle.x, handle.y); return {handle,end,kind:hit?.input?.kind ?? hit?.object?.userData.modelInput?.kind};
    });
    check(target.kind === 'phase-track', `${(await read()).id}: physical process handle has an unobstructed hit target`);
    if (target.kind !== 'phase-track') return;
    const before = (await read()).phase;
    await page.mouse.move(target.handle.x, target.handle.y); await page.mouse.down();
    await page.mouse.move(target.end.x, target.end.y, {steps:12}); await page.mouse.up(); await frames();
    const after = await read();
    check(after.phase > before + .15 && !after.playing, `${after.id}: dragging the paper handle changes this playhead and pauses`);
  };
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1366,height:900});
  for (const [id, stops] of [['cold-wave',[0,.35,.62,1]], ['gnss',[0,.34,.68]], ['urban-waterlogging',[0,.3,.5,.7,1]]]) {
    await open(id); const initial = await phase(0), modes = id === 'urban-waterlogging' ? [0,1,2] : [0];
    for (const selection of modes) {
      if (id === 'urban-waterlogging') { await page.locator(`#selections [data-selection="${selection}"]`).click(); await phase(0); }
      const baseline = await read(), sampled = [];
      for (const value of [0,200,500,900,1000,500]) {
        const s = await phase(value); sampled.push(s); inspect(s,`${id}/${selection}/${value}`);
        check(eq(s.meshIds,baseline.meshIds),`${id}/${selection}/${value}: scene objects keep their identity`);
        if (id === 'urban-waterlogging') {
          check(s.model.allPacketsVisible && s.model.packets.length === 12 && Object.values(s.model.inventory).reduce((a,b)=>a+b,0)===12,
            `${id}/${selection}/${value}: every water marker stays visible and accounted for`);
          check(eq(s.model.packets.map(p=>p.id),baseline.model.packets.map(p=>p.id)),`${id}/${selection}/${value}: same rainfall identities`);
        }
      }
      check(eq(sampled[2].model,sampled[5].model),`${id}/${selection}: scrubbing backwards reproduces the identical intermediate result`);
      if (id === 'cold-wave') {
        check(sampled[1].model.observation.coldFraction === 0 && sampled[1].model.observation.wind === 0,`${id}: observer reacts only after the front arrives`);
        check(sampled[4].model.observation.coldFraction > .9 && sampled[4].model.flag.extension > sampled[0].model.flag.extension,`${id}: front arrival drives cooling and the same flag`);
      }
      if (id === 'gnss') check(!sampled[2].model.communicationDelivered && sampled[2].model.vehicleWorld.progress===0 && sampled[4].model.communicationDelivered && sampled[4].model.vehicleWorld.progress===1,
        `${id}: independent communication arrives before the same rescue vehicle moves`);
      await phase(0); await dragFront();
      for (let i=0;i<stops.length;i++) inspect(await node(i,stops[i]),`${id}/${selection}/node/${i}`);
      const last=await read(); await page.waitForTimeout(900); const settled=await read(); layout(settled,`${id}/${selection}/desktop`);
      states.push({id,selection,samples:sampled,final:settled}); await capture(`${id}-${selection}`);
      if (page.__writeReviewCheckpoint) await page.__writeReviewCheckpoint({base,checks,failures,errors,layoutIssues,states,screenshots});
      const savedPhase=last.phase;
      await page.reload({waitUntil:'domcontentloaded'}); await ready(id);
      check(close((await read()).phase,savedPhase)&&!(await read()).playing,`${id}/${selection}: refresh restores phase and stays paused`);
    }
    check(initial.choices.length===(id==='urban-waterlogging'?3:0),`${id}: independent conditions remain choices; process states become nodes`);
  }
  await page.setViewportSize({width:1024,height:768}); await open('cold-wave'); await phase(600);
  await page.waitForTimeout(1100); const tablet=await read(); layout(tablet,'cold-wave/tablet'); states.push({tablet}); await capture('cold-tablet');
  await page.setViewportSize({width:390,height:844});
  for (const id of ['urban-waterlogging','cold-wave','gnss']) {
    await open(id,true); const s=await phase(500); inspect(s,`${id}/phone`); await page.waitForTimeout(150); layout(await read(),`${id}/phone`);
    if (id==='urban-waterlogging') check(s.svg.packetCount===12,`${id}/phone: every rainfall tracer is native vector geometry`);
    states.push({id,phone:await read()}); await capture(`${id}-phone`);
  }
  return {base,checks,failures,errors,layoutIssues,states,screenshots,
    scope:'Current desktop Chrome 1366×900, tablet-sized viewport 1024×768, phone native SVG 390×844; new continuous GNSS, city rainfall and cold-front scenes, real keyboard and physical model inputs. This is not physical touchscreen, scientific-review or school-hardware FPS acceptance.'};
}
