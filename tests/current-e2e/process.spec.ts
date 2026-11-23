import { expect, gotoBook, openFigure, pauseIfPlaying, readBookmark, seekNode, setProgressByKeyboard,
  dragProgress, test, waitForBook, waitForIdle, writeNote } from './helpers';

test('海陆风连续播放、暂停、昼夜节点与回拖同步改变旁注', async ({ page }) => {
  await gotoBook(page);
  await openFigure(page, 'breeze');
  await pauseIfPlaying(page);
  await expect(page.locator('#process-note')).toBeVisible();
  await expect(page.locator('#figure-controls [data-process-node]')).toHaveCount(4);
  await seekNode(page, '白天', 500);
  await expect(page.locator('#process-title')).toHaveText('海风吹向陆地');
  await expect(page.locator('#process-text')).toContainText('近地面空气由海洋流向陆地');

  const still = await page.locator('#phase').inputValue();
  await page.getByRole('button', { name: '继续演示', exact: true }).click();
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '暂停演示');
  await expect.poll(() => page.locator('#phase').inputValue()).not.toBe(still);
  await pauseIfPlaying(page);
  const paused = await page.locator('#phase').inputValue();
  await page.waitForTimeout(350);
  await expect(page.locator('#phase')).toHaveValue(paused);

  await seekNode(page, '夜晚', 0);
  await expect(page.locator('#process-title')).toHaveText('陆风吹向海洋');
  await expect(page.locator('#process-text')).toContainText('近地面空气由陆地流向海洋');
  await dragProgress(page, .8);
  const forward = await page.locator('#phase').inputValue(), note = await page.locator('#process-text').textContent();
  await dragProgress(page, .2);
  await expect(page.locator('#process-text')).not.toHaveText(note!);
  await dragProgress(page, .8);
  await expect(page.locator('#phase')).toHaveValue(forward);
  await expect(page.locator('#process-text')).toHaveText(note!);
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
});

test('刷新恢复个人书签、演示条件及笔记，并保持暂停', async ({ page }) => {
  await gotoBook(page);
  await openFigure(page, 'breeze');
  await pauseIfPlaying(page);
  await setProgressByKeyboard(page, 700);
  await writeNote(page, '同一海岸：日落后仍需比较海陆冷热。');
  const before = await readBookmark(page);
  expect(before?.figures.breeze.phase).toBe(.7);
  expect(Object.values(before?.notes ?? {})).toContain('同一海岸：日落后仍需比较海陆冷热。');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBook(page);
  await page.getByRole('button', { name: '下一跨页', exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toHaveText('38—39');
  await openFigure(page, 'breeze');
  await expect(page.locator('#phase')).toHaveValue('700');
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
  await page.locator('#desk-notes').click();
  await expect(page.getByRole('textbox', { name: '本页笔记' })).toHaveValue('同一海岸：日落后仍需比较海陆冷热。');
  await page.getByRole('button', { name: '关闭笔记', exact: true }).click();
  await page.waitForTimeout(350);
  await expect(page.locator('#phase')).toHaveValue('700');
});

test('教师演示的进度、翻页和临时笔记不覆盖个人状态', async ({ page }) => {
  await gotoBook(page);
  await openFigure(page, 'breeze');
  await pauseIfPlaying(page);
  await setProgressByKeyboard(page, 500);
  await writeNote(page, '学生自己的海陆风笔记。');
  const saved = await readBookmark(page);
  await page.getByRole('link', { name: '教师演示', exact: true }).click();
  await expect(page.locator('#cTeach')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#desk-header')).toHaveAttribute('aria-label', '教师工作台');
  await setProgressByKeyboard(page, 200);
  await writeNote(page, '教师临时讲解，不应覆盖学生。');
  await openFigure(page, 'remote');
  await pauseIfPlaying(page);
  await setProgressByKeyboard(page, 900);
  await writeNote(page, '另一页的授课临时笔记。');
  expect(await readBookmark(page)).toEqual(saved);

  await page.getByRole('link', { name: '教师演示', exact: true }).click();
  await expect(page.locator('#cTeach')).toHaveAttribute('aria-pressed', 'false');
  await waitForIdle(page);
  await expect(page.locator('#folio-location')).toHaveText('38—39');
  await expect(page.locator('#phase')).toHaveValue('500');
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
  await page.locator('#desk-notes').click();
  await expect(page.getByRole('textbox', { name: '本页笔记' })).toHaveValue('学生自己的海陆风笔记。');
  await page.getByRole('button', { name: '关闭笔记', exact: true }).click();
  expect(await readBookmark(page)).toEqual(saved);
});


test('手动切换水循环类型后从起点等待，播放中切换时继续演示', async ({ page }) => {
  await gotoBook(page, '/?2d&figure=water');
  const controls = page.locator('#figure-controls');
  const condition = async (index: number) => {
    const compact = controls.locator('#condition-choice');
    if (await compact.isVisible()) await compact.selectOption(String(index));
    else await controls.locator(`#selections [data-selection="${index}"]`).click();
  };
  await condition(1);
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '继续演示');
  await expect(page.locator('#phase')).toHaveValue('0');
  await page.getByRole('button', { name: '继续演示', exact: true }).click();
  await condition(2);
  await expect(page.locator('#cPause')).toHaveAttribute('aria-label', '暂停演示');
  await expect.poll(() => page.locator('#phase').inputValue()).not.toBe('0');
});
