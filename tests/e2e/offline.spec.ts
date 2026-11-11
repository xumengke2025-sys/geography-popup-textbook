import { test, expect } from "@playwright/test";
import { lesson, transfer } from "../../src/content";
import {openReader,goToSpread} from './helpers';
import {chapterCopy} from '../../src/chapters';
test("portable build completes with external network requests denied", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external: string[] = [];
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.route("**/*", (r) => {
    if (new URL(r.request().url()).hostname === "127.0.0.1")
      return r.continue();
    external.push(r.request().url());
    return r.abort();
  });
  await page.goto("http://127.0.0.1:4173");
  await openReader(page);
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.getByRole("button", { name: "先观察，再判断" }).click();
  await page.locator('[data-step="2"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.locator('[data-contrast="0"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
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
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: "打印观察报告 / 保存 PDF" }).click();
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "output/playwright/completed-report.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.reload();
  await openReader(page);
  await page.getByRole("button", { name: "继续学习" }).click();
  await expect(page.locator(".stamp")).toHaveClass(/earned/);

  // Exercise the newly packaged chapters, not just the earlier sea-breeze build.
  await goToSpread(page,3);
  await page.locator('[data-chapter-kind="chapter"][data-chapter-value="reveal"]').click();
  for(const mode of [1,2])await page.locator(`[data-chapter-kind="water-mode"][data-chapter-value="${mode}"]`).click();
  await page.locator('[data-chapter-kind="chapter"][data-chapter-value="answer"]').click();
  await page.locator('#answer-options').getByRole('button',{name:chapterCopy.water.answers[0],exact:true}).click();
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  await goToSpread(page,4);
  await page.locator('[data-chapter-kind="chapter"][data-chapter-value="reveal"]').click();
  await page.locator('[data-chapter-kind="river-stage"][data-chapter-value="1"]').click();
  await page.locator('[data-chapter-kind="chapter"][data-chapter-value="answer"]').click();
  await page.locator('#answer-options').getByRole('button',{name:chapterCopy.river.answers[1],exact:true}).click();
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  await page.reload();
  await openReader(page);
  await page.getByRole('button',{name:'继续学习'}).click();
  await expect(page.locator('#chapter-live')).toContainText('牛轭湖');
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  const chapters=await page.evaluate(()=>JSON.parse(localStorage.getItem('earth-fieldbook:sea-breeze:v1')!).chapters);
  expect(chapters.water.visited).toHaveLength(3);
  expect(chapters.water.checked).toBe(true);
  expect(chapters.river.checked).toBe(true);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  console.log(
    "Offline build: all three chapters, zero external requests, completion and reload passed",
  );
});
