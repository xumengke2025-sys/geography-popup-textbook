import { test as base, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

/** Each test gets Playwright's fresh, unpersisted browser context. Actions
 * below go through the same DOM controls used by a reader; diagnostics are
 * never modified or used as a substitute for clicking the current UI. */
export const test = base.extend<{ browserErrorGuard: void }>({
  browserErrorGuard: [async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    const capture = (error: Error) => errors.push(error.message);
    page.on('pageerror', capture);
    await use();
    page.off('pageerror', capture);
    expect(errors, 'uncaught browser exceptions').toEqual([]);
    const entry = await page.locator('script[type="module"][src]').last().getAttribute('src');
    if (entry) {
      const fingerprint = async (href: string) => {
        const url = new URL(href, page.url()), response = await page.request.get(url.href);
        expect(response.ok(), `reviewed resource ${url.pathname}`).toBe(true);
        return { path:url.pathname, sha256:createHash('sha256').update(await response.body()).digest('hex') };
      };
      const styles = await page.locator('link[rel="stylesheet"][href]').evaluateAll(nodes => nodes.map(node => (node as HTMLLinkElement).href));
      await testInfo.attach('reviewed-resources', { contentType:'application/json', body:JSON.stringify({
        base:new URL(page.url()).origin, reviewedEntry:await fingerprint(entry), reviewedStyles:await Promise.all(styles.map(fingerprint)),
      }) });
    }
  }, { auto: true }],
});
export { expect };
export const BOOK_TITLE = '人教版地理必修一';
const BOOKMARK_KEY = 'pep-geography-first-original-v2';

export async function waitForBook(page: Page) {
  await expect(page.locator('body')).toHaveClass(/\bready\b/);
  await waitForIdle(page);
}
export async function waitForIdle(page: Page) {
  await expect(page.locator('body')).not.toHaveClass(/\bworkbench-busy\b/);
}
export async function gotoBook(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForBook(page);
}
export async function openContents(page: Page) {
  if (await page.locator('#contents').isHidden()) await page.getByRole('button', { name: '目录', exact: true }).click();
  await expect(page.getByRole('complementary', { name: '教材目录' })).toBeVisible();
}
export async function openFigure(page: Page, id: string) {
  await openContents(page);
  await page.getByRole('tab', { name: /^立体演示/ }).click();
  await page.getByRole('searchbox', { name: '查找章节或演示' }).fill('');
  await page.locator(`#model-contents [data-figure="${id}"]`).click();
  await expect(page.getByRole('region', { name: '插图控制', exact: true })).toBeVisible();
  await waitForIdle(page);
  await expect(page.locator('#contents')).toBeHidden();
}
export async function pauseIfPlaying(page: Page) {
  const pause = page.locator('#cPause');
  if (await pause.getAttribute('aria-label') === '暂停演示') await pause.click();
  await expect(pause).toHaveAttribute('aria-label', '继续演示');
}
export async function jumpToPrintedPage(page: Page, number: number) {
  await page.locator('#folio-toggle').click();
  await expect(page.getByRole('region', { name: '快速翻页', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: '正文页码' }).fill(String(number));
  await page.locator('#folio-jump').getByRole('button', { name: /^前往/ }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio')).toBeHidden();
}
export async function seekNode(page: Page, name: string, expectedValue: number) {
  await page.locator('#figure-controls').getByRole('button', { name, exact: true }).click();
  await expect(page.locator('#phase')).toHaveValue(String(expectedValue));
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
}
/** Chromium's native range PageUp is ten percent of this 0–1000 range.
 * Use real keyboard input so the production input/change/save handlers run. */
export async function setProgressByKeyboard(page: Page, value: number) {
  if (value < 0 || value > 1000 || value % 100) throw new Error('Use a 0–1000 multiple of 100');
  const slider = page.getByRole('slider', { name: '拖动演示进度，暂停并回看', exact: true });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < value / 100; i++) await slider.press('PageUp');
  await expect(slider).toHaveValue(String(value));
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
}
export async function dragProgress(page: Page, fraction: number) {
  const slider = page.locator('#phase');
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (!box) throw new Error('The progress slider is not visible');
  const current = Number(await slider.inputValue()) / 1000;
  const inset = Math.min(8, box.width / 10), usable = box.width - 2 * inset;
  const x = (phase: number) => box.x + inset + usable * phase;
  await page.mouse.move(x(current), box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x(fraction), box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await slider.inputValue()) - fraction * 1000)).toBeLessThan(25);
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
}
export async function writeNote(page: Page, text: string) {
  await page.locator('#desk-notes').click();
  await expect(page.locator('#notes-dialog')).toBeVisible();
  await page.getByRole('textbox', { name: '本页笔记' }).fill(text);
  await page.getByRole('button', { name: '关闭笔记', exact: true }).click();
}
/** Read storage as evidence only. No test seeds, patches, or resets progress. */
export async function readBookmark(page: Page): Promise<Record<string, any> | null> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), BOOKMARK_KEY);
}
