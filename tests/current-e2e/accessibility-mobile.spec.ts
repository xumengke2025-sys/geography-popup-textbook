import { BOOK_TITLE, expect, gotoBook, openFigure, pauseIfPlaying, setProgressByKeyboard, test, waitForIdle } from './helpers';

test.describe('减少动态效果与键盘', () => {
  test.use({ reducedMotion: 'reduce' });
  test('键盘可进入目录和演示，减少动态时节点直接定位且条件保持暂停', async ({ page }) => {
    await gotoBook(page);
    await expect(page.locator('body')).toHaveClass(/\bworkbench-reduced\b/);
    await page.locator('#cContents').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('searchbox', { name: '查找章节或演示' })).toBeFocused();
    await page.getByRole('tab', { name: '教材目录', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /^立体演示/ })).toBeFocused();
    await expect(page.getByRole('tab', { name: /^立体演示/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('searchbox', { name: '查找章节或演示' }).fill('海陆');
    await page.locator('#model-contents [data-figure="breeze"]').focus();
    await page.keyboard.press('Enter');
    await waitForIdle(page);
    await expect(page.locator('#figure-controls')).toBeVisible();
    await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
    const night = page.locator('#figure-controls').getByRole('button', { name: '夜晚', exact: true });
    await night.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#phase')).toHaveValue('0');
    await expect(page.locator('#process-title')).toHaveText('陆风吹向海洋');
    await setProgressByKeyboard(page, 500);
    await expect(page.locator('#folio-location')).toHaveText('38—39');
    await expect(page.locator('#process-title')).toHaveText('海风吹向陆地');
    await page.locator('#figure-note').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#figure-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#figure-dialog')).toBeHidden();
    await expect(page.locator('#figure-controls')).toBeVisible();
    await page.locator('#fold').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#figure-controls')).toBeHidden();
  });
});

test.describe('手机原页与原生 SVG', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('手机默认二维原页，SVG 实体节点可触摸并可向前和向后定位', async ({ page }) => {
    await gotoBook(page);
    await expect(page.locator('body')).toHaveClass(/\btwo-d\b/);
    await expect(page.locator('#flat-reader').getByRole('heading', { name: BOOK_TITLE, exact: true })).toBeVisible();
    await page.locator('#flat-open').tap();
    await waitForIdle(page);
    await expect(page.locator('#flat-reader .original-page img')).toHaveCount(1);
    await openFigure(page, 'remote');
    await pauseIfPlaying(page);
    const vector = page.locator('.flat-concept svg');
    await expect(vector).toBeVisible();
    await expect(page.locator('.flat-concept image,.flat-concept foreignObject,.flat-concept canvas')).toHaveCount(0);
    await expect(page.locator('.flat-concept [role="button"]')).toHaveCount(4);
    await expect(page.locator('.original-page img')).toHaveCount(2);
    await expect(page.locator('.original-page img').first()).toHaveAttribute('src', /textbook\/page-119\.webp$/);

    // A node groups several separated solids, so its bounding-box centre
    // can be empty air. Tap its visible paper caption, never force an event
    // onto the group's unpainted gap.
    await page.locator('.flat-concept').getByRole('button', { name: '查看输出成果', exact: true }).locator('text').tap();
    await expect(page.locator('#phase')).toHaveValue('1000');
    await expect(page.locator('#process-title')).toHaveText('影像已形成');
    const complete = await vector.innerHTML();
    await page.locator('.flat-concept').getByRole('button', { name: '查看获取信息', exact: true }).locator('text').tap();
    await expect(page.locator('#phase')).toHaveValue('220');
    await expect(page.locator('#process-title')).toHaveText('地物反射的光进入传感器');
    expect(await vector.innerHTML()).not.toBe(complete);
    await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
