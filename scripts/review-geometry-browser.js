async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ids = ['breeze', 'solar', 'sun', 'history', 'earth', 'atmosphere', 'heating', 'thermal',
    'water', 'temperature', 'waves', 'tides', 'currents', 'karst', 'river', 'slope',
    'forest', 'soil', 'typhoon', 'earthquake', 'slide', 'mitigation', 'remote', 'gis'];
  const start = await page.evaluate(() => Number(sessionStorage.getItem('geometry-review-index') || 0));
  const results = [];
  for (const id of ids.slice(start, start + 6)) {
    try {
      if (!await page.locator('#contents').isVisible()) await page.locator('#cContents').click();
      if (!await page.locator('.figure-index').evaluate(el => el.open)) await page.locator('.figure-index summary').click();
      await page.locator(`#contents [data-figure="${id}"]`).click();
      if (await page.locator('#contents').isVisible()) await page.locator('#close-contents').click();
      await page.waitForFunction(id => {
        const d = window.textbookDiagnostics;
        return d.active === id && !d.turning && !d.figureBusy && d.render?.modelState === 'live';
      }, id);
      if (await page.evaluate(() => window.textbookDiagnostics.playing)) await page.getByRole('button', { name: '暂停演示', exact: true }).click();
      await page.waitForTimeout(850);
      await page.screenshot({ path: `output/playwright/geometry-${id}.png` });
      const render = await page.evaluate(() => window.textbookDiagnostics.render);
      results.push({ id, passed: render.geometry?.imageMappedMeshes === 0 && render.geometry?.solids > 0,
        geometry: render.geometry, triangles: render.triangles, calls: render.calls, textures: render.textures, geometries: render.geometries });
    } catch (error) { results.push({ id, passed: false, error: error.message }); }
  }
  await page.evaluate(index => sessionStorage.setItem('geometry-review-index', String(index)), Math.min(ids.length, start + 6));
  return { start, results, errors };
}
