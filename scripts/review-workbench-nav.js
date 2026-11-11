async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:5173';
  const checks = [], failures = [], errors = [], states = [], layoutIssues = [];
  const check = (ok, label) => (ok ? checks : failures).push(label);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 700)); });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = active => page.waitForFunction(active => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && (active === undefined || d.active === active) && (!d.active || d.twoD || d.render?.modelState === 'live');
  }, active, { timeout: 60000 });
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics;
    return { spread: d.spread, active: d.active, playing: d.playing, teacher: d.teacher, twoD: d.twoD,
      state: d.state, pages: d.pages, notes: d.notes, geometry: d.render?.geometry,
      models: d.render?.models, view: d.render?.view, modelState: d.render?.modelState,
      saved: localStorage.getItem('pep-geography-first-original-v2'),
      focus: { id: document.activeElement?.id, text: document.activeElement?.textContent?.slice(0, 80),
        visible: !!document.activeElement?.getClientRects().length && !document.activeElement?.closest('[hidden]'),
        inDirectory: !!document.activeElement?.closest('#contents') },
      directory: { hidden: document.querySelector('#contents').hidden, expanded: document.querySelector('#cContents').getAttribute('aria-expanded') },
      folio: { hidden: document.querySelector('#folio').hidden, expanded: document.querySelector('#folio-toggle').getAttribute('aria-expanded') },
      busy: document.body.classList.contains('workbench-busy'),
      quality: document.querySelector('#quality').value, reduced: document.querySelector('#reduced').checked,
      renderQuality: window.textbookDebug?.quality, renderReduced: window.textbookDebug?.reduced,
    };
  });
  const caseOf = async (name, work) => { try { await work(); } catch (error) { failures.push(`${name}: ${error.message}`); } };
  const setPhase = async tenths => {
    await page.locator('#phase').focus(); await page.locator('#phase').press('Home');
    for (let i = 0; i < tenths; i++) await page.locator('#phase').press('PageUp');
    await frames();
  };
  const openDirectory = async () => {
    if (await page.locator('#contents').isHidden()) { await page.locator('#cContents').focus(); await page.locator('#cContents').press('Space'); }
    await page.waitForFunction(() => !document.querySelector('#contents').hidden); await frames();
  };
  const closeDirectory = async () => {
    if (await page.locator('#contents').isVisible()) await page.locator('#close-contents').click(); await frames();
  };
  const pickModel = async id => {
    await openDirectory(); await page.locator('#contents-models').click(); await page.locator('#contents-search').fill('');
    await page.locator(`#model-contents [data-figure="${id}"]`).click(); await ready(id); await frames();
  };
  const inspectFolioImages = async name => {
    const decoded = await page.locator('#folio-thumbs img').evaluateAll(async images => Promise.all(images.map(async img => {
      let decoded = true; try { await img.decode(); } catch { decoded = false; }
      return { decoded, complete: img.complete, width: img.naturalWidth, height: img.naturalHeight, source: new URL(img.currentSrc).pathname };
    })));
    check(decoded.length > 0 && decoded.every(img => img.decoded && img.complete && img.width > 0 && img.height > 0 && img.source.includes('/textbook/')), `${name}: every actual page thumbnail fully decodes from a local textbook asset`);
    states.push({ name, thumbnails: decoded });
  };
  const inspectLayout = async name => {
    const info = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      const ids = ['desk-header', 'cContents', 'cPrev', 'cNext', 'folio-toggle', 'cPause', 'phase', 'restart', 'fold', 'desk-notes', 'desk-settings', 'cTeach'];
      const items = ids.map(id => document.getElementById(id)).filter(el => el && el.getClientRects().length && !el.closest('[hidden]')).map(el => ({ id: el.id, ...rect(el), hiddenBy: getComputedStyle(el).visibility, text: el.textContent?.trim() }));
      return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1, items,
        title: rect(document.querySelector('.desk-title')), tools: rect(document.querySelector('.desk-tools')),
        pointerBlockers: items.filter(el => ['cContents', 'cPrev', 'cNext', 'folio-toggle'].includes(el.id)).map(el => ({ id: el.id, target: document.elementFromPoint((el.left + el.right) / 2, (el.top + el.bottom) / 2)?.closest('button,a')?.id })),
        dock: rect(document.querySelector('.capsule')), labels: window.textbookDiagnostics.twoD ? [] : window.textbookDiagnostics.render?.labels ?? [],
        flatLabels: window.textbookDiagnostics.twoD ? [...document.querySelectorAll('.flat-concept svg text')].map(text => ({ text: text.textContent, ...rect(text) })) : [] };
    });
    const outside = info.items.filter(r => r.left < -1 || r.right > info.width + 1 || r.top < -1 || r.bottom > info.height + 1);
    const small = info.width < 760 ? info.items.filter(r => r.id !== 'desk-header' && (r.width < 43.9 || r.height < 43.9)) : [];
    const blocked = info.pointerBlockers.filter(p => p.target !== p.id);
    const header = info.items.find(r => r.id === 'desk-header');
    const obscuredLabels = info.labels.filter(l => l.fontPx < 17.95 || l.left < 0 || l.right > info.width || l.top < header.bottom || l.bottom > info.dock.top - 3);
    if (outside.length || small.length || blocked.length || obscuredLabels.length || info.overflow) layoutIssues.push({ name, outside, small, blocked, obscuredLabels, ...info });
    check(!outside.length && !small.length && !blocked.length && !info.overflow, `${name}: visible workspace actions fit the viewport, remain exposed and meet touch dimensions`);
    check(info.title.right <= info.tools.left - 3, `${name}: the book title and top workspace tools do not overlap`);
    check(!obscuredLabels.length, `${name}: elevated labels remain legible between the workspace header and actual control bar`);
    const hiddenFlatLabels = info.flatLabels.filter(label => label.top < header.bottom - 1 || label.bottom > info.dock.top - 3);
    if (hiddenFlatLabels.length) layoutIssues.push({ name, hiddenFlatLabels });
    check(!hiddenFlatLabels.length, `${name}: vector labels remain clear of the fixed header and playback bar`);
    states.push({ name, layout: info, state: await read() }); return info;
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?figure=breeze&3d&inspect`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#desk-header').waitFor(); await ready('breeze'); await page.evaluate(() => document.fonts.ready); await frames();
  await caseOf('native keyboard directory and tabs', async () => {
    const initial = await read();
    const duplicates = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
    check(!duplicates.length, 'the workbench reuses source controls without duplicate DOM IDs');
    const unreadableTitles = await page.locator('[title]').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.getAttribute('title')?.trim() && !/\p{Script=Han}/u.test(el.getAttribute('title'))).map(el => ({ id: el.id, title: el.getAttribute('title') })));
    check(!unreadableTitles.length, 'visible DOM tooltips use readable Chinese rather than inherited English control titles');
    check((await page.locator('#cContents').innerText()).includes('目录'), 'the persistent directory entry has a visible Chinese action name');
    await openDirectory(); let opened = await read();
    check(opened.directory.expanded === 'true' && opened.active === initial.active && opened.playing === initial.playing, 'Space on the directory button opens navigation without toggling the experiment');
    check(opened.focus.inDirectory && opened.focus.visible, 'opening the directory focuses a visible control in its active panel');
    await page.locator('#contents-chapters').focus(); await page.keyboard.press('ArrowRight'); await frames();
    check(await page.locator('#contents-models').getAttribute('aria-selected') === 'true' && (await read()).spread === initial.spread, 'tab ArrowRight changes the directory type without turning the book');
    await page.keyboard.press('Home'); await frames();
    check(await page.locator('#contents-chapters').getAttribute('aria-selected') === 'true', 'tab Home returns to the chapter directory');
    await page.locator('#contents-models').focus(); await page.keyboard.press('Space'); await frames();
    check(await page.locator('#contents-models').getAttribute('aria-selected') === 'true' && !(await page.locator('#model-contents').isHidden()) && (await read()).playing === initial.playing, 'Space activates the model-directory tab without hijacking playback');
    await page.locator('#contents-search').fill('不存在的教材条目-workbench');
    check(await page.locator('#model-contents .contents-row:visible').count() === 0 && await page.locator('.directory-empty').isVisible() && (await page.locator('.directory-empty').innerText()).includes('没有找到'), 'an empty model search presents one clear empty state without stale results');
    await page.locator('#contents-search').fill('潮汐');
    const filtered = await page.locator('#model-contents .contents-row:visible').allTextContents();
    check(filtered.length === 1 && filtered[0].includes('潮汐'), 'directory search filters the actual model list');
    await page.locator('#contents-search').press('Escape'); await frames();
    check((await read()).directory.hidden && (await read()).directory.expanded === 'false', 'Escape from the search input closes the directory and synchronizes its expanded state');
    await openDirectory(); opened = await read();
    check(opened.focus.inDirectory && opened.focus.visible && await page.locator('#contents-models').getAttribute('aria-selected') === 'true', 'reopening the last model tab never focuses a hidden chapter row');
    await page.locator('#contents-search').fill('');
    await page.locator('#model-contents [data-figure="tides"]').focus(); await page.keyboard.press('Enter'); await ready('tides'); await frames();
    const tide = await read();
    check(tide.directory.hidden && tide.directory.expanded === 'false' && tide.models === 1 && tide.geometry.kind === 'tide', 'keyboard model selection follows the normal fold/turn/open transaction and closes navigation');
    await inspectLayout('desktop-live-tide');
    await page.screenshot({ path: 'output/playwright/workbench-nav-desktop-tide.png' });
  });
  await caseOf('folio native preview and keyboard activation', async () => {
    const initial = await read();
    await page.locator('#folio-toggle').focus(); await page.keyboard.press('Space'); await frames();
    check(!(await read()).folio.hidden && (await read()).folio.expanded === 'true' && (await read()).focus.id === 'folio-range', 'Space opens the fast page picker and focuses its native range');
    await page.locator('#folio-range').press('Home'); await page.locator('#folio-range').press('ArrowRight'); await page.locator('#folio-range').press('ArrowRight'); await frames();
    const preview = await page.locator('#folio-range').inputValue();
    check(preview === '2' && (await read()).spread === initial.spread && (await read()).active === initial.active, 'previewing another spread leaves the current page and raised model intact');
    await inspectFolioImages('desktop-near-cover-thumbnails');
    await page.locator('#folio-go').focus(); await page.keyboard.press('Space'); await ready(null); await frames(); const target = await read();
    check(target.spread === 2 && target.active === null && target.models === 0 && !target.playing && target.folio.hidden && target.folio.expanded === 'false', 'Space on the preview confirmation folds the model and commits the intended spread');
    check(!target.busy, 'workspace busy state clears after the page transaction finishes');
    await page.locator('#folio-toggle').click(); await page.locator('#folio-range').press('End'); await inspectFolioImages('desktop-final-page-thumbnails'); await page.locator('#folio-close').click(); await frames();
    check((await read()).spread === 2 && (await read()).focus.id === 'folio-toggle', 'closing an uncommitted last-page preview preserves the book and restores trigger focus');
    await page.locator('#folio-toggle').click(); await page.locator('#folio-page').fill('59'); await page.locator('#folio-page').press('Enter'); await ready(null);
    check((await read()).pages.includes(64), 'the fast page form maps textbook page 59 to PDF page 64');
    await page.locator('#folio-toggle').click(); await page.locator('#folio-go').focus(); await page.keyboard.press('Tab');
    await page.locator('#desk-notes').focus(); await page.keyboard.press('Enter'); await page.locator('#notes-dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await frames();
    check(!(await page.locator('#notes-dialog').evaluate(d => d.open)), 'Escape closes the top modal even when a page-preview panel was previously open');
  });
  await caseOf('rapid next/previous requests', async () => {
    await closeDirectory(); if (await page.locator('#folio').isVisible()) await page.locator('#folio-close').click();
    const before = await read(), next = await page.locator('#cNext').boundingBox(), prev = await page.locator('#cPrev').boundingBox();
    await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2);
    await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2);
    await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2);
    await page.mouse.click(prev.x + prev.width / 2, prev.y + prev.height / 2);
    await ready(null); await frames(); const after = await read();
    check(after.spread === before.spread + 2 && !after.busy && after.active === null && after.models === 0, 'rapid +1,+1,+1,-1 requests settle at the final intended spread without a suspended model');
    await openDirectory();
    const selected = await page.locator('#chapter-contents [aria-current="page"]').getAttribute('data-pdf');
    const latestExpected = await page.locator('#chapter-contents [data-pdf]').evaluateAll((els, current) => els.filter(el => Number(el.dataset.pdf) <= current).at(-1)?.dataset.pdf, Math.max(...after.pages.filter(p => p !== null)));
    check(selected === latestExpected, 'directory current-page highlighting follows same-chapter turns rather than the last chapter boundary');
    // The title deliberately lets pointer events through to the physical
    // desktop. Click that empty canvas space with the real mouse instead of
    // requiring a non-interactive title element to be the DOM event target.
    await page.mouse.click(page.viewportSize().width / 2, 100); await frames();
    check((await read()).directory.hidden && (await read()).directory.expanded === 'false', 'outside pointer dismissal also synchronizes directory state');
  });
  await caseOf('teacher isolation and restored student view', async () => {
    await pickModel('tides'); await setPhase(6);
    await page.locator('#cPause').focus(); await page.keyboard.press('Space'); await frames();
    check((await read()).playing, 'Space on the dedicated play key starts the experiment exactly once');
    await page.keyboard.press('Space'); await frames();
    check(!(await read()).playing, 'Space on the same play key pauses rather than double-toggling through the global shortcut');
    await setPhase(6);
    await page.locator('#desk-notes').click(); await page.locator('#notes-text').fill('学生书签：潮汐工作台导航验证。'); await page.locator('#notes-dialog [data-close]').click();
    const student = await read(); await page.locator('#cTeach').focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => window.textbookDiagnostics.teacher); await frames();
    await setPhase(2); await page.locator('#desk-notes').click(); await page.locator('#notes-text').fill('教师演示临时笔记。'); await page.locator('#notes-dialog [data-close]').click();
    await page.locator('#desk-settings').click();
    const clear = page.locator('#clear-bookmark');
    check(await clear.isHidden() || await clear.isDisabled(), 'teacher settings cannot clear the persisted student record');
    const temporaryQuality = student.quality === '低' ? '高' : '低'; await page.locator('#quality').selectOption(temporaryQuality);
    await page.locator('#reduced').setChecked(!student.reduced); await page.locator('#settings-dialog [data-close]').click();
    await page.locator('#chapter-tabs [data-chapter="1"]').click(); await ready(null); const teaching = await read();
    check(teaching.teacher && teaching.saved === student.saved, 'teacher phase, notes, quality and page changes leave the complete student storage unchanged');
    await page.locator('#cTeach').click(); await ready('tides'); await page.waitForFunction(() => !window.textbookDiagnostics.teacher); await frames(); const restored = await read();
    check(restored.saved === student.saved && restored.spread === student.spread && restored.active === student.active && Math.abs(restored.state.phase - student.state.phase) < 1e-9 && !restored.playing, 'leaving teaching restores the exact student page, raised model, conditions and paused state');
    check(JSON.stringify(restored.notes) === JSON.stringify(student.notes), 'teacher scratch notes never replace student notes');
    check(restored.quality === student.quality && restored.renderQuality === student.renderQuality && restored.reduced === student.reduced && restored.renderReduced === student.renderReduced, 'student quality and reduced-motion controls match the actual restored renderer');
    states.push({ name: 'teacher-isolation', student, teaching, restored });
  });
  await caseOf('responsive workspace controls', async () => {
    await page.waitForFunction(() => !document.querySelector('#status').textContent, null, { timeout: 7000 });
    await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(650); await inspectLayout('tablet-live-tide');
    await page.screenshot({ path: 'output/playwright/workbench-nav-tablet-tide.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await frames();
    await openDirectory(); await page.locator('#mode').click(); await ready('tides'); await frames();
    check((await read()).twoD, 'phone workspace can enter the accessible vector and original-page reader');
    await inspectLayout('phone-vector-tide'); await page.screenshot({ path: 'output/playwright/workbench-nav-phone-tide.png' });
    await openDirectory(); await page.locator('#contents-models').click(); await page.locator('#contents-search').fill('土壤'); await frames();
    const directory = await page.locator('#contents').boundingBox();
    check(directory.x >= 0 && directory.y >= 0 && directory.x + directory.width <= 391 && directory.y + directory.height <= 845, 'phone directory drawer remains completely inside the viewport');
    await page.screenshot({ path: 'output/playwright/workbench-nav-phone-directory.png' });
    await page.locator('#contents-search').press('Escape'); await page.locator('#folio-toggle').click(); await frames();
    const folio = await page.locator('#folio').boundingBox();
    check(folio.x >= 0 && folio.y >= 0 && folio.x + folio.width <= 391 && folio.y + folio.height <= 845, 'phone quick-page picker fits the viewport');
    await inspectFolioImages('phone-tide-thumbnails');
    await page.screenshot({ path: 'output/playwright/workbench-nav-phone-folio.png' });
    await page.locator('#folio-close').click(); await page.setViewportSize({ width: 360, height: 800 }); await frames();
    await inspectLayout('phone-360-vector-tide'); await page.screenshot({ path: 'output/playwright/workbench-nav-phone-360.png' });
  });
  check(!errors.length, 'workbench navigation produces no browser exceptions or console errors');
  return { base, browser: page.context().browser().version(), checks, failures, errors, states, layoutIssues,
    limitations: ['Touch-screen hardware and screen-reader software were not available; viewport checks use a real desktop browser with native mouse and keyboard input.'] };
}
