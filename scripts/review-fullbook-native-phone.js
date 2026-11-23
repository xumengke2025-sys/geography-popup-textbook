async page => {
  const base = page.__reviewBase ?? 'http://127.0.0.1:4175';
  const checks = [], failures = [], errors = [], states = [], labelIssues = [], layoutIssues = [], screenshots = [];
  const check = (ok, name) => (ok ? checks : failures).push(name);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text().slice(0, 400)); });
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = id => page.waitForFunction(id => {
    const d = window.textbookDiagnostics;
    return d?.ready && !d.turning && !d.figureBusy && (id === undefined || d.active === id);
  }, id, { timeout: 45000 });
  const open = async id => {
    await page.locator('#cContents').click(); await page.locator('#contents-models').click();
    await page.locator('#contents-search').fill('');
    await page.locator(`#model-contents [data-figure="${id}"]`).click(); await ready(id); await frame();
  };
  const phase = async value => {
    if (await page.evaluate(() => window.textbookDiagnostics.playing))
      await page.locator('#cPause').click();
    const slider = page.locator('#phase');
    if (!await slider.isVisible() || !await slider.isEnabled()) return;
    await slider.focus(); await slider.press(value === 0 ? 'Home' : 'End');
    if (value === 500) for (let i = 0; i < 5; i++) await slider.press('PageDown');
    await frame();
  };
  const read = () => page.evaluate(() => {
    const d = window.textbookDiagnostics;
    const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const svg = document.querySelector('.flat-concept > svg');
    return { id: d.active, phase: d.state.phase, selection: d.state.selection, playing: d.playing, process: d.process,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      width: innerWidth, height: innerHeight,
      controls: Array.from(document.querySelectorAll('.capsule button,.capsule input,#process-stops')).filter(el => {
        if (!el.getClientRects().length || el.closest('[hidden]')) return false;
        const rail = el.closest('#process-stops,#selections');
        // A scrollable bookmark rail intentionally clips offscreen items.
        // Each item is reached and clicked below, so check its viewport here.
        return !rail || rail === el || rail.scrollWidth <= rail.clientWidth + 1;
      }).map(el => ({ id: el.id, ...box(el) })),
      svg: svg ? { box: box(svg), images: svg.querySelectorAll('image').length,
        invalid: /NaN|Infinity|undefined/.test(svg.outerHTML),
        labels: Array.from(svg.querySelectorAll('text')).filter(el => {
          let opacity = 1;
          for (let node = el; node && node !== svg.parentElement; node = node.parentElement) {
            const style = getComputedStyle(node); opacity *= Number(style.opacity);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
          }
          return opacity > .01;
        }).map(el => {
          const c = el.getScreenCTM(); return { text: el.textContent, ...box(el), px: parseFloat(getComputedStyle(el).fontSize) * Math.hypot(c.a, c.b) };
        }) } : null };
  });
  const inspect = (s, name) => {
    check(!s.playing && Number.isFinite(s.phase), `${name}: paused playhead is available`);
    check(s.svg && !s.svg.images && !s.svg.invalid, `${name}: valid native SVG without textbook crop replacements`);
    const outsideControls = s.controls.filter(b => b.left < -1 || b.right > s.width + 1 || b.top < -1 || b.bottom > s.height + 1);
    check(!s.overflow && !outsideControls.length, `${name}: workspace controls fit the phone`);
    if (s.overflow || outsideControls.length) layoutIssues.push({ name, outsideControls, overflow: s.overflow });
    if (!s.svg) return;
    const small = s.svg.labels.filter(l => l.px < 14.9);
    const outside = s.svg.labels.filter(l => l.left < s.svg.box.left - 1 || l.right > s.svg.box.right + 1 || l.top < s.svg.box.top - 1 || l.bottom > s.svg.box.bottom + 1);
    const overlaps = s.svg.labels.flatMap((a, i) => s.svg.labels.slice(i + 1).filter(b =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2).map(b => [a.text, b.text]));
    check(!small.length && !outside.length && !overlaps.length, `${name}: SVG labels are readable, in bounds and separate`);
    if (small.length || outside.length || overlaps.length) labelIssues.push({ name, small, outside, overlaps, labels: s.svg.labels });
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?2d&inspect`, { waitUntil: 'domcontentloaded' }); await ready();
  check(await page.evaluate(() => window.textbookDiagnostics.twoD), 'explicit phone mode uses native two-dimensional demonstrations');
  await page.locator('#cContents').click(); await page.locator('#contents-models').click();
  const ids = await page.locator('#model-contents [data-figure]').evaluateAll(nodes => nodes.map(n => n.dataset.figure));
  await page.locator('#close-contents').click();
  check(ids.length === 63 && new Set(ids).size === 63, '60 lessons and three integrated demonstrations have unique directory entries');
  for (const [index, id] of ids.entries()) {
    await open(id);
    const compact = page.locator('#condition-choice');
    const useSelect = await compact.isVisible();
    const visibleChoices = page.locator('#selections [data-selection]:not([data-process-node]):visible');
    const values = useSelect
      ? await compact.locator('option').evaluateAll(items => items.map(item=>item.value))
      : await visibleChoices.evaluateAll(items => items.map(item=>item.dataset.selection));
    const cases = [], conditions = values.length;
    for (let c = 0; c < Math.max(conditions, 1); c++) {
      if (useSelect) await compact.selectOption(values[c]);
      else if (conditions) await visibleChoices.nth(c).click();
      for (const value of [0, 500, 1000]) {
        await phase(value); const s = await read(); inspect(s, `${id}/${c}/${value}`); cases.push(s);
      }
      const nodes = page.locator('#figure-controls [data-process-node]:visible');
      const count = await nodes.count();
      for (let node = 0; node < count; node++) {
        await nodes.nth(node).click();
        await ready(id); await frame(); const s = await read(); inspect(s, `${id}/${c}/node-${node}`); cases.push(s);
      }
    }
    if (['solar', 'breeze', 'urban-waterlogging', 'coastal-landform', 'cold-wave', 'warehouse'].includes(id)) {
      const path = `output/playwright/fullbook-native-phone-${id}.png`;
      await page.screenshot({ path }); screenshots.push(path);
    }
    await page.locator('#fold').click(); await ready(null);
    states.push({ id, conditions, cases });
    await page.__writeReviewCheckpoint?.({ base, checks, failures, errors, states, labelIssues, layoutIssues, screenshots });
    if ((index + 1) % 10 === 0) console.log(`Native phone reviewed ${index + 1}/${ids.length}`);
  }
  const originalPages = await page.evaluate(async () => {
    const pages = await (await fetch('textbook/pages.json')).json(), result = [];
    for (let offset = 0; offset < pages.length; offset += 6) {
      result.push(...await Promise.all(pages.slice(offset, offset + 6).map(async p => {
        const dimensions = [];
        for (const prefix of ['page', 'thumb']) {
          const image = new Image(); image.src = `textbook/${prefix}-${String(p.pdf).padStart(3, '0')}.webp`;
          await image.decode(); dimensions.push([image.naturalWidth, image.naturalHeight]); image.src = '';
        }
        return { pdf: p.pdf, number: p.number, dimensions };
      })));
    }
    return result;
  });
  check(originalPages.length === 132 && originalPages.every((p, i) => p.pdf === i + 2), 'every original interior page from PDF 2 to 133 decodes, with no gaps');
  check(originalPages.every(p => p.dimensions[0][0] === 1530 && p.dimensions[1][0] === 360), 'all original full-size pages and navigation thumbnails retain their intended resolution');
  check(originalPages.filter(p => p.number !== null).every(p => p.number === p.pdf - 5), 'printed page mapping includes the full 1–128 original content');
  check(!errors.length, 'complete native-phone traversal has no runtime or console errors');
  return { base, checks, failures, errors, states, labelIssues, layoutIssues, screenshots, originalPages,
    evidenceScope: '390×844 desktop browser viewport. Enumerates directory entries, visible independent conditions and process bookmarks. Uses keyboard range input for interactive timelines and decodes original pages and thumbnails.' };
}
