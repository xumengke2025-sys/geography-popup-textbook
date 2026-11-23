import { expect, gotoBook, test } from './helpers';
test.use({ channel: 'msedge' });

test('土柱二维标签键盘选择和复原后保持同一实体标签焦点', async ({ page }) => {
  await gotoBook(page, '/?2d&figure=soil');
  const label = page.locator('.flat-concept [data-soil-profile-part="label"][data-model-selection="2"]');
  await expect(label).toBeVisible();
  await label.focus();
  for (const key of ['Enter', 'Enter', 'Space', 'Space']) {
    const pressed = await label.getAttribute('aria-pressed');
    await page.keyboard.press(key);
    await expect(label).toBeFocused();
    await expect(label).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
    await expect(page.locator('.flat-concept [data-soil-profile-part="rear-half"][data-model-selection="2"]')).not.toBeFocused();
  }
});

test('土柱二维后半层键盘选择仍保持后半层语义而不跳到标签', async ({ page }) => {
  await gotoBook(page, '/?2d&figure=soil');
  const rear = page.locator('.flat-concept [data-soil-profile-part="rear-half"][data-model-selection="4"]');
  await expect(rear).toBeVisible();
  await rear.focus();
  for (const key of ['Enter', 'Space']) {
    await page.keyboard.press(key);
    await expect(rear).toBeFocused();
  }
});

