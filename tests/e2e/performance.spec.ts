import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {paperClick,expectOpenBook,openMenu,closeMenu} from './helpers';
test("measured RAF intervals and WebGL context recovery", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await openMenu(page);
  await page.getByRole("button", { name: "教师演示", exact: true }).click();
  await page.waitForTimeout(1800);
  await expectOpenBook(page);
  const results: any = {
    browser: browser.version(),
    viewport: page.viewportSize(),
    samples: [],
  };
  for (const quality of ["高", "低"]) {
    await openMenu(page);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.locator("#quality").selectOption(quality);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await closeMenu(page);
    await paperClick(page,'#play');
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const times: number[] = [];
          let last = performance.now();
          const tick = (now: number) => {
            times.push(now - last);
            last = now;
            if (times.length < 240) requestAnimationFrame(tick);
            else {
              times.shift();
              times.sort((a, b) => a - b);
              const canvas =
                document.querySelector<HTMLCanvasElement>("#scene canvas")!;
              const gl = canvas.getContext("webgl2")!;
              const ext = gl.getExtension("WEBGL_debug_renderer_info");
              resolve({
                frames: times.length,
                meanMs: times.reduce((a, b) => a + b) / times.length,
                p50Ms: times[Math.floor(times.length * 0.5)],
                p95Ms: times[Math.floor(times.length * 0.95)],
                renderer: ext
                  ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                  : "unavailable",
                quality:(window as any).fieldbookDiagnostics.quality,
                render:(window as any).fieldbookDiagnostics.render,
              });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    results.samples.push({ quality, result });
    await paperClick(page,'#play');
  }
  fs.writeFileSync(
    "output/playwright/performance.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
  await page.evaluate(() => {
    const gl = document
      .querySelector<HTMLCanvasElement>("#scene canvas")!
      .getContext("webgl2")!;
    const ext = gl.getExtension("WEBGL_lose_context");
    (window as any).__restore = () => ext?.restoreContext();
    ext?.loseContext();
  });
  await expect(page.locator("#diagram-stage")).toBeVisible();
  await page.getByRole("button", { name: "☾ 夜间", exact: true }).click();
  await expect(page.locator("#live-summary")).toContainText("陆地 → 海洋");
  await page.evaluate(() => (window as any).__restore());
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "立体书", exact: true }).click();
  await expect(page.locator("#scene")).toBeVisible();
});
