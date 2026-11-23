import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Read-only diagnostics locate real visible meshes. Only native mouse/keyboard
// events modify product state; no direct call to production input handlers.
const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4181';
const out = process.env.REVIEW_OUTPUT ?? 'output/playwright/recent-closure';
const requested = process.argv.slice(2);
const sceneIds = requested.length ? requested : ['forest', 'vegetation', 'mars-base'];
if (sceneIds.some(id => !['forest', 'vegetation', 'mars-base'].includes(id))) throw Error('Unsupported recent scene ID');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { base, browser: browser.version(), scope: 'recent native interactions; desktop simulated viewports; no aesthetic or real-touch acceptance', scenes: [] };
try {
  for (const id of sceneIds) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const item = { id, checks: [], failures: [], errors: [], targets: [], states: [] };
    report.scenes.push(item);
    page.on('pageerror', e => item.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') item.errors.push(m.text()); });
    const check = (ok, label) => (ok ? item.checks : item.failures).push(label);
    const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const read = () => page.evaluate(() => ({ phase: window.textbookDiagnostics.state.phase, selection: window.textbookDiagnostics.state.selection,
      playing: window.textbookDiagnostics.playing, geometry: window.textbookDiagnostics.render.geometry,
      camera: window.textbookDebug.camera.position.toArray(),
      receivers: window.textbookDebug.entry.art.geometry.meshes.filter(m => /receiv|power-switch/.test(m.userData.causalRole ?? '')).map(m => ({ role: m.userData.causalRole,
        position: m.position.toArray(), scale: m.scale.toArray(), rotation: m.rotation.toArray() })),
      shells: window.textbookDebug.entry.art.geometry.meshes.filter(m => m.userData.cabinPart === 'hinged-longitudinal-observation-shell').map(m => ({ module: m.userData.moduleIndex,
        pivotRotation: m.parent.rotation.toArray() })) }));
    const seek = async value => {
      await page.locator('#phase').focus(); await page.keyboard.press('Home');
      for (let n = 0; n < value / 100; n++) await page.keyboard.press('PageUp');
      await frames();
    };
    const target = async request => {
      const hit = await page.evaluate(request => {
        const b = window.textbookDebug, g = b.entry.art.geometry;
        b.scene.updateMatrixWorld(true); b.camera.updateMatrixWorld(true);
        const rect = b.renderer.domElement.getBoundingClientRect(), dock = document.querySelector('.capsule').getBoundingClientRect();
        const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
        const matches = mesh => Object.entries(request).every(([k, v]) => k.startsWith('input:') ? mesh.userData.modelInput?.[k.slice(6)] === v : mesh.userData[k] === v);
        const vector = () => b.camera.position.clone().set(0, 0, 0);
        for (const mesh of g.meshes.filter(m => visible(m) && matches(m))) {
          const a = mesh.geometry.attributes.position, index = mesh.geometry.index;
          mesh.geometry.computeBoundingBox(); const points = [mesh.geometry.boundingBox.getCenter(vector())];
          const count = (index?.count ?? a.count) / 3, step = Math.max(1, Math.floor(count / 360));
          for (let i = 0; i < count; i += step) {
            const center = vector();
            for (let k = 0; k < 3; k++) center.add(vector().fromBufferAttribute(a, index ? index.getX(i * 3 + k) : i * 3 + k));
            points.push(center.multiplyScalar(1 / 3));
          }
          for (const local of points) {
            const p = local.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
            const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
            if (x < 12 || x > innerWidth - 12 || y < 12 || y > dock.top - 10 || p.z < -1 || p.z > 1 || document.elementFromPoint(x, y) !== b.renderer.domElement) continue;
            const actual = b.pickModel(x, y);
            if (actual?.object === mesh && actual.input) return { x, y, input: actual.input, name: mesh.name, request };
          }
        }
        return null;
      }, request);
      if (!hit) throw Error(`No exposed real mesh for ${JSON.stringify(request)}`);
      item.targets.push(hit); return hit;
    };
    const click = async request => {
      const hit = await target(request); await page.mouse.click(hit.x, hit.y); await frames();
      return read();
    };
    try {
      await page.goto(`${base}/?figure=${id}&3d&inspect`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(id => { const d = window.textbookDiagnostics; return d?.ready && d.active === id && !d.figureBusy && !d.turning && d.render?.modelState === 'live'; }, id, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      if (await page.locator('#cPause').getAttribute('aria-label') === '暂停演示') await page.locator('#cPause').click();
      const src = await page.locator('script[type="module"][src]').getAttribute('src');
      const response = await page.request.get(new URL(src, base).href);
      item.entry = { path: src, sha256: crypto.createHash('sha256').update(await response.body()).digest('hex') };
      if (process.env.REVIEW_EXPECTED_SHA && item.entry.sha256 !== process.env.REVIEW_EXPECTED_SHA) throw Error(`Reviewed bundle ${item.entry.sha256} differs from expected frozen build`);
      if (id === 'forest') {
        for (const layer of [2, 0, 1]) {
          const s = await click({ forestRole: 'layer-label', forestLayer: layer }); item.states.push(s);
          check(s.geometry.selection === layer && !s.playing, `native layer ${layer} selects observation and pauses`);
          check(s.geometry.allPlantMeshesVisible && s.geometry.geometryBuffersReused && s.geometry.plantCount === 25, `native layer ${layer} retains all 25 plant structures and buffers`);
        }
        // The process note reserves camera space after it appears. Locate the
        // handle and its endpoint only once that reading layout is on screen.
        await page.locator('#process-note').waitFor({state:'visible'});
        await frames();
        const s = await read();
        const hit = await target({ forestRole: 'phase-handle' });
        const ends = await page.evaluate(() => {
          const b = window.textbookDebug, d = window.textbookDiagnostics.render.geometry, rect = b.renderer.domElement.getBoundingClientRect();
          return [d.phaseTrackWorld.start, d.phaseTrackWorld.end].map(q => { const p = b.camera.position.clone().fromArray(q).project(b.camera); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; });
        });
        await page.mouse.move(hit.x, hit.y); await page.mouse.down();
        await page.mouse.move(ends[1].x, ends[1].y, { steps: 12 }); await page.mouse.up(); await frames();
        const after = await read(); item.states.push(after);
        check(after.phase > .95 && !after.playing, 'native forest carriage reaches upper observation stop');
        check(JSON.stringify(s.camera) === JSON.stringify(after.camera), 'native carriage drag leaves camera still');
      } else if (id === 'vegetation') {
        const layers = await click({ vegetationPart: 'crown', 'input:target': 'layers' }); item.states.push(layers);
        check(layers.geometry.inspection === 'layers', 'native crown opens under-canopy observation');
        check(layers.geometry.allTreesRetainedDuringLayerInspection, 'under-canopy observation retains all trees');
        // The same crown is the public toggle back; the whole-specimen name
        // lies below the focused camera and is not an exposed mesh here.
        const overview = await click({ vegetationPart: 'crown', 'input:target': 'layers' }); item.states.push(overview);
        check(overview.geometry.inspection === 'overview', 'native overview part returns to whole specimen');
        for (const part of ['buttress','vine']) {
          const request={vegetationPart:part,vegetationTree:overview.geometry.featuredTree,'input:target':part};
          const detail=await click(request);
          check(detail.geometry.inspection===part,`native ${part} opens the featured tree`);
          await page.mouse.move(90,240); await frames();
          await page.screenshot({path:`${out}/rainforest-${part}-1440.png`});
          const restored=await click(request);
          check(restored.geometry.inspection==='overview',`native ${part} restores the whole stand`);
        }
        await page.locator('#condition-choice').isVisible().then(async visible => {
          if (visible) await page.locator('#condition-choice').selectOption('2');
          else await page.locator('#selections [data-selection="2"]').click();
        });
        await seek(1000);
        const count = await page.evaluate(() => window.textbookDebug.entry.art.geometry.meshes.filter(m => m.visible && m.userData.vegetationPart === 'retained-fallen-leaf').length);
        check(count === 12, 'deciduous endpoint retains all twelve fallen leaves');
      } else {
        for (let n = 0; n < 4; n++) {
          const before = await read();
          const after = await click({ 'input:kind': 'inspect', 'input:target': `mars-shell-${n}` }); item.states.push(after);
          check(Math.abs(after.geometry.shellOpening[n] - before.geometry.shellOpening[n]) > .1, `native cabin ${n} hatch pull changes its shell opening`);
          check(after.phase === before.phase && after.selection === before.selection, `native cabin ${n} hatch preserves circuit and progress`);
          await page.mouse.move(100, 250); await frames();
          await page.screenshot({ path: `${out}/mars-cabin-${n}-closed-1440.png` });
          const reopened = await click({ 'input:kind': 'inspect', 'input:target': `mars-shell-${n}` }); item.states.push(reopened);
          check(reopened.geometry.shellOpening[n] > .95, `native cabin ${n} hatch pull reopens the same shell`);
          if (reopened.geometry.construction === 'longitudinal-thick-shell-cutaway-cabins') {
            const leaves = reopened.shells.filter(shell => shell.module === n);
            check(leaves.length === 2 && leaves.every(shell => Math.abs(shell.pivotRotation[0]) < .0001 && Math.abs(shell.pivotRotation[1]) < .0001 && Math.abs(Math.abs(shell.pivotRotation[2]) - Math.PI * .30) < .0001), `cabin ${n} actual shell leaves rotate around longitudinal Z hinges`);
          }
          await page.mouse.move(100, 250); await frames();
          await page.screenshot({ path: `${out}/mars-cabin-${n}-open-1440.png` });
        }
        for (const selection of [1, 2, 3]) {
          if (await page.locator('#condition-choice').isVisible()) await page.locator('#condition-choice').selectOption(String(selection));
          else await page.locator(`#selections [data-selection="${selection}"]`).click();
          await seek(1000); const end = await read(); await seek(0); const start = await read(); await seek(1000); const repeated = await read();
          item.states.push({ selection, start, end, repeated });
          check(JSON.stringify(end.geometry.packets) === JSON.stringify(repeated.geometry.packets), `circuit ${selection} reverse drag reproduces final packets`);
          const responses = selection === 1 ? ['purifierResponse', 'reservoirResponse', 'crewWaterResponse'] : selection === 2 ? ['plantResponse', 'crewOxygenResponse', 'crewFoodResponse'] : ['powerResponse'];
          check(responses.every(k => start.geometry[k] === 0 && end.geometry[k] === 1), `circuit ${selection} actual receivers respond from zero to full arrival`);
          check(JSON.stringify(start.receivers) !== JSON.stringify(end.receivers) && JSON.stringify(end.receivers) === JSON.stringify(repeated.receivers), `circuit ${selection} receiver transforms change and repeat reversibly`);
        }
      }
      await page.screenshot({ path: `${out}/${id}-native-1440.png` });
      if (id === 'mars-base') {
        // Use the product's actual wheel zoom for an additional close view.
        await page.mouse.move(720, 360); await page.mouse.wheel(0, -600); await frames(); await frames();
        await page.mouse.move(100, 250); await frames();
        await page.screenshot({ path: `${out}/mars-native-zoomed-1440.png` });
        item.states.push({ name: 'native-wheel-close-view', ...(await read()) });
        await page.mouse.wheel(0, 600); await frames();
      }
      await page.setViewportSize({ width: 1024, height: 768 }); await frames();
      await page.screenshot({ path: `${out}/${id}-native-1024.png` });
    } catch (e) { item.failures.push(e.message); }
    await context.close();
    console.log(JSON.stringify({ id, checks: item.checks.length, failures: item.failures, errors: item.errors }));
    await fs.writeFile(`${out}/native-review.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); }
if (report.scenes.some(s => s.failures.length || s.errors.length)) process.exitCode = 1;
