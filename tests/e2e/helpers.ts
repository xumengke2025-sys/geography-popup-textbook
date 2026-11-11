import {expect, type Page} from '@playwright/test';

export async function openMenu(page:Page) {
  if (!(await page.locator('#teacher').isVisible())) await page.locator('#cContents').click();
}

export async function closeMenu(page:Page) {
  if (await page.locator('body').evaluate(el=>el.classList.contains('controls-open'))) await page.locator('#cContents').click();
}

export async function goToSpread(page:Page, spread:number) {
  if (!(await page.locator(`[data-goto="${spread}"]`).isVisible())) await openMenu(page);
  await page.locator(`[data-goto="${spread}"]`).click();
  await expect(page.locator('#page-count')).toHaveText(spread===6?'书末':`跨页 ${spread} / 5`);
  if (await page.evaluate(()=>(window as any).fieldbookDiagnostics.mode==='3d')) {
    await page.waitForFunction(spread=>{const r=(window as any).fieldbookDiagnostics.render;return !r.busy&&r.spread===spread},spread);
  }
}

export async function openReader(page:Page) {
  const button=page.locator('#reading-toggle');
  if(await button.getAttribute('aria-expanded')==='true')return;
  if(!(await button.isVisible()) && await page.locator('#cContents').isVisible()) await page.locator('#cContents').click();
  if(await button.isVisible() && await button.getAttribute('aria-expanded')!=='true') await button.click();
}

export async function closeReader(page:Page) {
  if(await page.locator('#reading-toggle').getAttribute('aria-expanded')!=='true')return;
  await openMenu(page);
  await page.locator('#reading-toggle').click();
}

export async function paperClick(page:Page, selector:string, value?:number|string) {
  await page.waitForFunction(({selector,value}) => {
    const d=(window as any).fieldbookDiagnostics;
    return !d?.render?.busy && d?.paperRegions?.some((r:any)=>(r.selector===selector || r.kind===selector) && (value===undefined || r.value===value));
  },{selector,value});
  const region=await page.evaluate(({selector,value})=>(window as any).fieldbookDiagnostics.paperRegions.find((r:any)=>(r.selector===selector || r.kind===selector) && (value===undefined || r.value===value)),{selector,value});
  await page.mouse.click(region.screenX,region.screenY);
}

export async function expectOpenBook(page:Page) {
  await expect.poll(()=>page.evaluate(()=>(window as any).fieldbookDiagnostics.render?.open)).toBe(1);
}
