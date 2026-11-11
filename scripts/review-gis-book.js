async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const browser = page.context().browser().version();
  const errors = [], states = [], checks = [], failures = [], interactions = {};
  const check = (ok, label) => (ok ? checks : failures).push(label);
  const recordError = p => {
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  };
  recordError(page);
  const frames = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const sample = p => p.evaluate(() => {
    const d = window.textbookDiagnostics, g = window.textbookDebug?.entry?.art.geometry;
    return {
      phase: d.state?.phase, selection: d.state?.selection, playing: d.playing, geometry: d.render?.geometry,
      actualStationMeshes: g?.meshes.filter(m => m.userData.gisRole === 'rain-station').length,
      stations: g?.meshes.filter(m => m.userData.gisRole === 'rain-station').map(m => ({ id: m.userData.stationId, region: m.userData.region, position: m.position.toArray() })),
    };
  });
  const seek = async (p, value, name) => {
    await p.locator('#phase').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await frames(p);
    const state = await sample(p);
    if (p === page) states.push(state);
    if (name) await p.screenshot({ path: `output/playwright/gis-book-${name}.png` });
    return state;
  };
  let narrow, flat;
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${base}/?figure=gis&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => {
      const d = window.textbookDiagnostics;
      return d?.ready && d.active === 'gis' && !d.figureBusy && !d.turning && d.render?.modelState === 'live';
    }, null, { timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    for (const [phase, name] of [[0, 'separated'], [520, 'aligned'], [730, 'counting'], [1000, 'result']]) await seek(page, phase, name);
    const a = await seek(page, 735); await seek(page, 0); await seek(page, 1000); const b = await seek(page, 735);
    check(states.every(s => s.actualStationMeshes === 33), '3D 中始终只有一组 33 个站点');
    check(JSON.stringify(states[3].geometry?.counts?.map(c => c.count)) === '[5,15,13]', '3D 终点统计为原图的 5／15／13');
    check(JSON.stringify(a.stations) === JSON.stringify(b.stations) && JSON.stringify(a.geometry?.counts) === JSON.stringify(b.geometry?.counts), '正向与反向拖动得到相同位置及计数');
    check(states.every(s => s.playing === false), '拖动进度后保持暂停');

    // Enter normal motion through the real user control after the initial
    // reduced-motion unfolding used for deterministic frame comparisons.
    if (await page.evaluate(() => window.textbookDebug.reduced)) await page.locator('#cStill').click();
    check(await page.evaluate(() => !window.textbookDebug.reduced), '播放操作在正常动态设置下检查');
    await seek(page, 300);
    await page.locator('#cPause').click();
    await page.waitForFunction(() => window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase > .303);
    await page.locator('#selections [data-selection="1"]').click();
    interactions.dockEnd = await sample(page);
    check(interactions.dockEnd.phase === 1 && !interactions.dockEnd.playing, '叠合停靠按钮准确跳到 phase 1 并暂停');
    check(await page.locator('#selections [data-selection="1"]').getAttribute('aria-pressed') === 'true', 'phase 1 对应按钮正确标记为当前状态');
    await page.locator('#cPause').click();
    await page.waitForFunction(() => window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase > .002 && window.textbookDiagnostics.state.phase < .1);
    await page.locator('#selections [data-selection="0"]').click();
    interactions.dockStart = await sample(page);
    check(interactions.dockStart.phase === 0 && !interactions.dockStart.playing, '分离停靠按钮准确跳到 phase 0 并暂停');
    check(await page.locator('#selections [data-selection="0"]').getAttribute('aria-pressed') === 'true', 'phase 0 对应按钮正确标记为当前状态');

    await seek(page, 300);
    await page.locator('#cPause').click();
    await page.waitForFunction(() => window.textbookDiagnostics.playing && window.textbookDiagnostics.state.phase > .303);
    interactions.play = await sample(page);
    await page.locator('#cPause').click();
    interactions.pause = await sample(page);
    await page.waitForTimeout(280);
    interactions.pauseHeld = await sample(page);
    check(interactions.play.playing && interactions.play.phase > .3, '播放按钮推进真实课程时间');
    check(!interactions.pauseHeld.playing && interactions.pauseHeld.phase === interactions.pause.phase, '暂停后时间及模型保持不动');

    await seek(page, 1000);
    await page.locator('#restart').click();
    interactions.replay = await sample(page);
    check(interactions.replay.playing && interactions.replay.phase >= 0 && interactions.replay.phase < .04 && interactions.replay.selection === 0, '重放从分离起点重新播放');
    await page.locator('#cPause').click();
    // Let the unmodified application timer cross the end without waiting all
    // eighteen seconds. The endpoint and subsequent hold are real playback.
    await seek(page, 980);
    await page.locator('#cPause').click();
    await page.waitForFunction(() => window.textbookDiagnostics.state.phase === 1 && !window.textbookDiagnostics.playing, null, { timeout: 8000 });
    interactions.end = await sample(page);
    await page.waitForTimeout(320);
    interactions.endHeld = await sample(page);
    check(interactions.endHeld.phase === 1 && !interactions.endHeld.playing && JSON.stringify(interactions.end.stations) === JSON.stringify(interactions.endHeld.stations), 'once 播放到终点后停止并保持结果');
    check(JSON.stringify(interactions.endHeld.geometry?.counts?.map(c => c.count)) === '[5,15,13]', '自动播放终点仍为 5／15／13');

    // Reduced motion reaches the same final camera framing immediately.
    // Bounds below are projections of the actual 3-D text-plane vertices.
    if (!(await page.evaluate(() => window.textbookDebug.reduced))) await page.locator('#cStill').click();
    await page.setViewportSize({ width: 1024, height: 768 });
    await frames(page); await frames(page);
    narrow = await page.evaluate(() => {
      const book = window.textbookDebug, g = book.entry.art.geometry;
      book.scene.updateMatrixWorld(true); book.camera.updateMatrixWorld(true);
      const canvas = book.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
      const labels = g.meshes.filter(m => m.visible && m.userData.gisRole === 'derived-count').map(mesh => {
        const positions = mesh.geometry.attributes.position, corners = [];
        for (let i = 0; i < positions.count; i++) {
          const p = g.v([positions.getX(i), positions.getY(i), positions.getZ(i)]).applyMatrix4(mesh.matrixWorld).project(book.camera);
          corners.push({ x: canvas.left + (p.x + 1) * canvas.width / 2, y: canvas.top + (1 - p.y) * canvas.height / 2 });
        }
        return { text: mesh.userData.text, left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
          top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
      });
      return { viewport: { width: innerWidth, height: innerHeight }, reduced: book.reduced, dock: { left: dock.left, right: dock.right, top: dock.top, bottom: dock.bottom }, labels };
    });
    check(narrow.labels.length === 3, '1024×768 结果态有三个实际统计标签');
    check(narrow.labels.every(label => label.bottom <= narrow.dock.top - 8 && label.left >= 0 && label.right <= 1024), '1024×768 统计标签在视口内且避开底栏至少 8px');
    const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    check(narrow.labels.every((label, i) => narrow.labels.slice(i + 1).every(other => !overlap(label, other))), '1024×768 三个统计标签互不重叠');
    await page.screenshot({ path: 'output/playwright/gis-book-1024-result.png' });

    // Use the actual mode switch on the same page. This also preserves the
    // runner's offline route and fixed-entry fingerprinting context.
    const twoD = page;
      await twoD.setViewportSize({ width: 1366, height: 900 });
      await twoD.locator('#cContents').click();
      await twoD.locator('#mode').click();
      await twoD.waitForFunction(() => window.textbookDiagnostics?.ready && window.textbookDiagnostics.twoD && window.textbookDiagnostics.active === 'gis' && !window.textbookDiagnostics.figureBusy, null, { timeout: 45000 });
      await seek(twoD, 1000);
      flat = await twoD.locator('.flat-concept svg').evaluate(svg => ({
        stage: svg.dataset.gisStage,
        stations: [...svg.querySelectorAll('[data-station]')].map(node => ({ id: node.dataset.station, region: Number(node.dataset.region), counted: node.dataset.counted === 'true' })),
        counts: [...svg.querySelectorAll('[data-region-count]')].map(node => node.textContent.trim()),
        bitmapImages: svg.querySelectorAll('image').length,
      }));
      check(flat.stations.length === 33 && new Set(flat.stations.map(s => s.id)).size === 33, '2D SVG 仅有同源的 33 个站点');
      const assignment = items => items.map(s => `${s.id}:${s.region}`).sort();
      check(JSON.stringify(assignment(flat.stations)) === JSON.stringify(assignment(states[3].stations)), '2D 与 3D 的站点 ID 和空间归属逐点一致');
      check(flat.stage === 'result' && flat.stations.every(s => s.counted) && JSON.stringify(flat.counts) === '["1区 5","2区 15","3区 13"]', '2D 结果态显示相同的 5／15／13');
      check(flat.bitmapImages === 0, '2D 模型没有贴教材裁图');
      await twoD.screenshot({ path: 'output/playwright/gis-book-2d-result.png' });
  } catch (error) {
    failures.push(`GIS 专项流程中断：${error.message}`);
  }
  return {
    scope: 'GIS only: desktop Chrome, 1366×900 and 1024×768, 3D/2D and playback; not full-book or real-touch acceptance',
    base, browser, errors, checks, failures, states, interactions, narrow, flat,
  };
}
