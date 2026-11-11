async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], labelIssues = [], layoutIssues = [], states = [], screenshots = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const settle = async () => {
    let last, stable = 0;
    for (let i = 0; i < 100; i++) {
      const camera = await page.evaluate(() => {
        const b = window.textbookDebug;
        return [...b.camera.position.toArray(), ...b.camera.quaternion.toArray()];
      });
      stable = last && camera.every((n, j) => Math.abs(n - last[j]) < 1e-4) ? stable + 1 : 0;
      if (stable >= 3) return;
      last = camera; await page.waitForTimeout(50);
    }
    throw Error('The label-clearance camera did not settle');
  };
  const read = () => page.evaluate(() => {
    const b = window.textbookDebug, d = window.textbookDiagnostics;
    const visible = mesh => { for (let node = mesh; node; node = node.parent) if (!node.visible) return false; return true; };
    const meshes = b.entry.art.geometry.meshes.filter(visible), solids = meshes.filter(mesh => mesh.userData.kind !== 'text-label');
    const origin = b.camera.getWorldPosition(b.camera.position.clone()), ray = new b.ray.constructor();
    const clearance = meshes.filter(mesh => mesh.userData.kind === 'text-label').map(label => {
      const { width, height } = label.geometry.parameters;
      const occluded = [];
      for (const x of [-.45, -.225, 0, .225, .45]) for (const y of [-.4, 0, .4]) {
        const point = origin.clone().set(x * width, y * height, 0).applyMatrix4(label.matrixWorld);
        const direction = point.clone().sub(origin), distance = direction.length();
        ray.set(origin, direction.normalize()); ray.near = .001; ray.far = Math.max(.001, distance - .03);
        const hit = ray.intersectObjects(solids, false)[0];
        if (hit) occluded.push({ x, y, distanceBeforeLabel: distance - hit.distance });
      }
      return { text: label.userData.text, samples: 15, occluded };
    });
    const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; };
    return { id:d.active, phase:d.state.phase, selection:d.state.selection, playing:d.playing, view:d.render.view,
      width:innerWidth, height:innerHeight, orbit:b.orbit, elevation:b.elevation,
      clearance, labels:d.render.labels, geometry:d.render.geometry,
      header:box(document.querySelector('#desk-header')), dock:box(document.querySelector('.capsule')),
      overflow:document.documentElement.scrollWidth > innerWidth + 1 };
  });
  const inspect = async name => {
    const s = await read(); states.push({ name, ...s });
    check(!s.playing && s.geometry.originalPagePreserved && s.geometry.imageMappedMeshes === 0,
      `${name}: paused solid geometry stands above the original page`);
    const expectedLabels = s.id === 'karst-cave' && s.selection === 0 ? 1 : 3;
    check(s.clearance.length === expectedLabels && s.clearance.every(label => !label.occluded.length),
      `${name}: all ${expectedLabels * 15} label-surface rays reach the paper tags without crossing model solids`);
    const clipped = s.clearance.filter(label => label.occluded.length);
    const small = s.labels.filter(label => label.fontPx < 17.9);
    const outside = s.labels.filter(label => label.left < -1 || label.right > s.width + 1
      || label.top < s.header.bottom - 1 || label.bottom > s.dock.top - 3);
    const overlap = s.labels.flatMap((a, i) => s.labels.slice(i + 1).filter(b =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2).map(b => [a.text, b.text]));
    if (clipped.length || small.length || outside.length || overlap.length) labelIssues.push({ name, clipped, small, outside, overlap });
    if (s.overflow) layoutIssues.push({ name, issue:'horizontal overflow' });
    return s;
  };
  const seek = async value => {
    await page.locator('#phase').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles:true })); el.dispatchEvent(new Event('change', { bubbles:true }));
    }, value); await frames();
  };
  for (const [width, height] of [[1366, 900], [1366, 768], [1024, 768], [713, 818]]) {
    await page.setViewportSize({ width, height });
    for (const id of ['karst-cave', 'desalination']) {
      await page.goto(`${base}/?figure=${id}&3d&inspect`, { waitUntil:'domcontentloaded' });
      await page.waitForFunction(id => {
        const d = window.textbookDiagnostics;
        return d?.ready && d.active === id && !d.turning && !d.figureBusy && d.render?.modelState === 'live';
      }, id, { timeout:45000 });
      if (await page.evaluate(() => window.textbookDiagnostics.playing)) await page.locator('#cPause').click();
      for (const selection of [0, 1]) {
        await page.locator(`#selections [data-selection="${selection}"]`).click(); await settle();
        for (const value of [0, 500, 1000, 500, 0]) { await seek(value); await inspect(`${width}x${height}/${id}/${selection}/${value}`); }
      }
      await seek(600); await settle();
      const path = `output/playwright/label-clearance-${id}-${width}x${height}.png`;
      await page.screenshot({ path }); screenshots.push(path);
      if (width === 1366 && height === 900) {
        // These deterministic camera samples inspect composition; pointer
        // mechanics are covered by the existing current-book E2E flows.
        for (const orbit of [-.2, .4]) {
          await page.evaluate(orbit => { window.textbookDebug.orbit = orbit; }, orbit);
          await settle(); await inspect(`camera/${id}/${orbit}`);
        }
      }
      console.log(`Checked ${width}x${height} ${id} labels`);
    }
  }
  check(!errors.length, 'No browser exceptions or console errors while checking label clearance');
  return { base, checks, failures, errors, labelIssues, layoutIssues, states, screenshots,
    evidenceScope:'Only the two adjusted 3D label layouts: four simulated desktop/tablet viewports, both independent conditions, forward/backward progress, and two nearby camera angles. Each paper tag is sampled by 15 real geometry rays. Existing full-book, phone and user-flow reports retain their pre-layout build fingerprints.' };
}
