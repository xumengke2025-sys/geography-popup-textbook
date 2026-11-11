import { test, expect, chromium } from "@playwright/test";
import {openReader,closeReader,openMenu,closeMenu,paperClick} from './helpers';
test("desktop WebGL failure falls back to functional SVG", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.includes("webgl")) return null;
      return (original as any).call(this, type, ...args);
    } as any;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.getByRole("button", { name: "先观察，再判断" }).click();
  await page.locator('[data-step="2"]').click();
  await expect(page.locator("#diagram-stage")).toBeVisible();
  await page.locator('[data-contrast="0"]').click();
  await expect(page.locator("#live-summary")).toContainText("局地环流很弱");
});
test("quick turns coalesce, return paused, GPU resources stay bounded", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  // Compare one fixed render pipeline; adaptive quality changes also allocate
  // post-processing geometry and must not be mistaken for a page-turn leak.
  await openMenu(page);
  await page.locator('#settings').click();
  await page.locator('#quality').selectOption('低');
  await page.locator('#settings').click();
  await closeMenu(page);
  await paperClick(page,'#start');
  await paperClick(page,'[data-step="2"]');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.lift===1);
  async function turnAndReturn(){
    await page.locator('#cNext').click();
    await page.locator('#cNext').click();
    await page.waitForFunction(()=>{const r=(window as any).fieldbookDiagnostics.render;return !r.busy&&r.spread===3});
    await page.locator('#cPrev').click();
    await page.locator('#cPrev').click();
    await page.waitForFunction(()=>{const r=(window as any).fieldbookDiagnostics.render;return !r.busy&&r.spread===1&&r.lift===1});
  }
  // Warm a fully raised model's first print/return and the page cache. A partial
  // first unfold does not visit all of the original engine's print geometries.
  await turnAndReturn();
  const before: any = await page.evaluate(
    () => (window as any).fieldbookDiagnostics,
  );
  await turnAndReturn();
  await expect(page.locator("#page-count")).toHaveText("跨页 1 / 5", {
    timeout: 10000,
  });
  await expect(page.locator("#play")).toHaveText("▷ 播放");
  await page.waitForTimeout(1800);
  await turnAndReturn();
  await turnAndReturn();
  const after: any = await page.evaluate(
    () => (window as any).fieldbookDiagnostics,
  );
  console.log('Repeated-turn resources',JSON.stringify({before:before.render,after:after.render}));
  expect(after.render.geometries).toBeLessThanOrEqual(
    before.render.geometries + 1,
  );
  expect(after.render.textures).toBeLessThanOrEqual(before.render.textures + 1);
  await paperClick(page,'[data-phase="0"]');
  await expect(page.locator("#live-summary")).toContainText("陆地 → 海洋");
});
test("slider pauses, reset keeps records, reduced motion remains usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?2d");
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.locator('[data-step="2"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.locator("#play").click();
  await page.locator("#phase").fill("0");
  await expect(page.locator("#play")).toHaveText("▷ 播放");
  await expect(page.locator("#live-summary")).toContainText("陆地 → 海洋");
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(page.locator(".record-chips")).toContainText("✓ 午后");
  await page.locator("#phase").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#page-count")).toHaveText("跨页 1 / 5");
});
test("Edge and required desktop/tablet viewport layouts", async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  console.log("Edge version", browser.version());
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [1024, 768],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto("http://127.0.0.1:5173");
    await openMenu(page);
    await page.getByRole("button", { name: "教师演示", exact: true }).click();
    await page.waitForFunction(()=>{const r=(window as any).fieldbookDiagnostics?.render;return r&&!r.busy&&r.lift===1});
    await openReader(page);
    await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
    await expect(page.locator("#live-summary")).toContainText("陆地 → 海洋");
    await closeReader(page);
    await page.waitForTimeout(350);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/edge-${width}x${height}.png`,
      fullPage: true,
    });
    console.log(
      "Edge viewport",
      width,
      height,
      await page.evaluate(() => (window as any).fieldbookDiagnostics.render),
    );
    await page.close();
  }
  await browser.close();
});
test("print report has printable content and single A4 PDF", async ({
  page,
}) => {
  await page.goto("/?2d");
  await page.getByRole("button", { name: "翻开这本书" }).click();
  await page.locator('[data-step="2"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.locator('[data-contrast="0"]').click();
  await page.getByRole("button", { name: "保存当前观察" }).click();
  await page.locator('[data-step="4"]').click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: "打印观察报告 / 保存 PDF" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#report")).toBeVisible();
  await page.pdf({
    path: "output/playwright/observation-report.pdf",
    format: "A4",
    printBackground: true,
  });
});
