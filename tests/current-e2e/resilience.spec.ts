import { expect, gotoBook, jumpToPrintedPage, openFigure, pauseIfPlaying, seekNode, setProgressByKeyboard, test } from './helpers';

test('WebGL 不可用时仍能翻阅、放大原页并操作二维环流', async ({ page }) => {
  // This fixture denies the browser capability before application startup.
  // It does not patch the lesson state or call application diagnostics.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return (original as any).call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await gotoBook(page);
  await expect(page.locator('body')).toHaveClass(/\btwo-d\b/);
  await expect(page.locator('#flat-open')).toBeVisible();
  await openFigure(page, 'breeze');
  await pauseIfPlaying(page);
  await seekNode(page, '夜晚', 0);
  await expect(page.locator('.flat-concept svg')).toBeVisible();
  await expect(page.locator('.flat-concept svg')).toHaveAttribute('aria-label', /近地面陆地 → 海洋/);
  await seekNode(page, '白天', 500);
  await expect(page.locator('.flat-concept svg')).toHaveAttribute('aria-label', /近地面海洋 → 陆地/);
  await page.getByRole('button', { name: '收回', exact: true }).click();
  await jumpToPrintedPage(page, 38);
  await expect(page.locator('#flat-reader .original-page img')).toHaveCount(2);
  await page.getByRole('button', { name: '放大阅读原页', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '原页放大阅读' })).toBeVisible();
  await expect(page.locator('#reader-image')).toHaveAttribute('src', /textbook\/page-043\.webp$/);
  await expect.poll(() => page.locator('#reader-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
});

test('实际丢失 WebGL 上下文后保留条件并继续二维阅读', async ({ page }) => {
  await gotoBook(page);
  await expect(page.locator('body')).not.toHaveClass(/\btwo-d\b/);
  await openFigure(page, 'breeze');
  await pauseIfPlaying(page);
  await setProgressByKeyboard(page, 700);
  // Use the real renderer's canvas and the browser's standard failure API.
  const lost = await page.locator('#scene canvas').first().evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  expect(lost, 'Chrome must expose WEBGL_lose_context for this failure fixture').toBe(true);
  await expect(page.locator('body')).toHaveClass(/\btwo-d\b/);
  await expect(page.locator('.flat-concept svg')).toBeVisible();
  await expect(page.locator('#phase')).toHaveValue('700');
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
  await expect(page.locator('.original-page img')).toHaveCount(2);
  await seekNode(page, '夜晚', 0);
  await expect(page.locator('#process-title')).toHaveText('陆风吹向海洋');
  await expect(page.locator('.flat-concept svg')).toHaveAttribute('aria-label', /近地面陆地 → 海洋/);
  await page.getByRole('button', { name: '收回', exact: true }).click();
  await jumpToPrintedPage(page, 46);
  await expect(page.locator('#folio-location')).toHaveText('46—47');
  await expect(page.locator('#flat-reader .original-page img').first()).toHaveAttribute('src', /textbook\/page-051\.webp$/);
});
