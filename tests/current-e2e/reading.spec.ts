import { BOOK_TITLE, expect, gotoBook, jumpToPrintedPage, openContents, test, waitForIdle } from './helpers';

test('整册封面与目录保留六章、十七节、六研究和六十三个演示', async ({ page }) => {
  await gotoBook(page);
  await expect(page).toHaveTitle(BOOK_TITLE);
  await expect(page.locator('#book-stage')).toHaveAttribute('aria-label', BOOK_TITLE);
  await expect(page.locator('#desk-header').getByRole('heading', { name: BOOK_TITLE, exact: true })).toBeVisible();
  await expect(page.locator('#folio-location')).toHaveText('封面');
  await expect(page.locator('#chapter-tabs button')).toHaveCount(6);

  await openContents(page);
  await expect(page.locator('#chapter-contents .chapter-title').filter({ hasText: /^第[一二三四五六]章/ })).toHaveCount(6);
  await expect(page.locator('#chapter-contents .chapter .contents-row:not(.secondary)')).toHaveCount(17);
  await expect(page.locator('#chapter-contents .secondary').filter({ hasText: '问题研究' })).toHaveCount(6);
  await page.getByRole('tab', { name: /^立体演示 63$/ }).click();
  await expect(page.locator('#model-contents [data-figure]')).toHaveCount(63);
  const ids = await page.locator('#model-contents [data-figure]').evaluateAll(rows => rows.map(row => row.getAttribute('data-figure')));
  expect(new Set(ids).size).toBe(63);
  await page.getByRole('searchbox', { name: '查找章节或演示' }).fill('海陆');
  await expect(page.locator('#model-contents [data-figure]:visible')).toHaveCount(1);
  await expect(page.locator('#model-contents [data-figure="breeze"]')).toBeVisible();
  await page.getByRole('searchbox', { name: '查找章节或演示' }).fill('没有这幅演示');
  await expect(page.getByText('没有找到相关章节或演示', { exact: true })).toBeVisible();
});

test('翻页、正文跳转和放大原页使用同一教材页码', async ({ page }) => {
  await gotoBook(page);
  await expect(page.locator('#scene canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '下一跨页', exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toHaveText('扉页');
  await jumpToPrintedPage(page, 38);
  await expect(page.locator('#folio-location')).toHaveText('38—39');

  await page.getByRole('button', { name: '下一跨页', exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toHaveText('40—41');
  await page.getByRole('button', { name: '上一跨页', exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toHaveText('38—39');

  await page.getByRole('button', { name: '放大阅读原页', exact: true }).click();
  const reader = page.getByRole('dialog', { name: '原页放大阅读' });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('img', { name: '教材原页 38', exact: true })).toBeVisible();
  await expect(page.locator('#reader-image')).toHaveAttribute('src', /textbook\/page-043\.webp$/);
  await expect.poll(() => page.locator('#reader-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const scale = reader.locator('#reader-scale');
  const fittedPercent = Number.parseInt(await scale.innerText(), 10);
  await reader.getByRole('button', { name: '放大原页', exact: true }).click();
  await expect(scale).toHaveText(`${Math.min(300, fittedPercent + 15)}%`);
  await reader.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('#reader-title')).toHaveText('第 39 页');
  await page.keyboard.press('Escape');
  await expect(reader).toBeHidden();
  await expect(page.locator('#folio-location')).toHaveText('38—39');

  // Only body pages are accepted by the jump controls. The source PDF's
  // trailing non-body sheets must not be advertised as further body pages.
  await page.locator('#folio-toggle').click();
  await expect(page.getByRole('spinbutton', { name: '正文页码' })).toHaveAttribute('max', '124');
  await page.getByRole('spinbutton', { name: '正文页码' }).fill('124');
  await page.locator('#folio-jump').getByRole('button', { name: /^前往/ }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toContainText('124');
});
