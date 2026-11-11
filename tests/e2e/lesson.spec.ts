import { test, expect } from "@playwright/test";
import { lesson, transfer } from "../../src/content";
import {openReader,paperClick} from './helpers';
test("cover and raised model visual evidence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "output/playwright/cover.png",
    fullPage: true,
  });
  await paperClick(page,'#start');
  await openReader(page);
  await page.getByRole("button", { name: "B 从陆地吹向海洋" }).click();
  await page.getByRole("button", { name: "展开海岸，开始观察" }).click();
  await page.getByRole("button", { name: "下一步 →", exact: true }).click();
  await page.getByRole("button", { name: "下一步 →", exact: true }).click();
  await page.getByRole("button", { name: "下一步 →", exact: true }).click();
  await page.getByRole("button", { name: "下一步 →", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: "output/playwright/raised.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  console.log(
    "Render diagnostics",
    await page.evaluate(() => (window as any).fieldbookDiagnostics.render),
  );
});
test("complete lesson, preserve first prediction, teacher isolation, reload", async ({
  page,
}) => {
  await page.goto("/?2d");
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.getByRole("button", { name: "B 从陆地吹向海洋" }).click();
  await page.locator('[data-step="2"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.locator('[data-contrast="0"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("earth-fieldbook:sea-breeze:v1"),
  );
  await page.getByRole("button", { name: "教师演示", exact: true }).click();
  await page.getByRole("button", { name: "☀ 午后", exact: true }).click();
  await page.getByRole("button", { name: "查看当前条件" }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("earth-fieldbook:sea-breeze:v1"),
    ),
  ).toBe(before);
  await page.getByRole("button", { name: "退出教师演示" }).click();
  await page.locator('[data-step="4"]').click();
  for (let i = 0; i < 10; i++)
    await page
      .locator(`[data-answer="${i}"]`)
      .selectOption(lesson.challenge[i].answer);
  await page.getByRole("button", { name: "检查环流图", exact: true }).click();
  for (let i = 0; i < 3; i++)
    await page
      .locator(`[data-transfer="${i}"][value="${transfer[i].answer}"]`)
      .check();
  await page.getByRole("button", { name: "检查迁移判断", exact: true }).click();
  await expect(page.locator(".stamp")).toHaveClass(/earned/);
  await page.locator("#conclusion").selectOption({ index: 1 });
  await page.screenshot({
    path: "output/playwright/completed.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "继续学习" }).click();
  await expect(page.locator(".stamp")).toHaveClass(/earned/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("earth-fieldbook:sea-breeze:v1")!)
          .prediction,
    ),
  ).toBe(1);
});
test("phone, unavailable storage and WebGL fallback remain functional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage disabled");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.getByRole("button", { name: "先观察，再判断" }).click();
  await page.locator('[data-step="2"]').click();
  await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
  await expect(page.locator("#live-summary")).toContainText("陆地 → 海洋");
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await expect(page.locator("#save-status")).toContainText("临时会话");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/phone.png",
    fullPage: true,
  });
});
