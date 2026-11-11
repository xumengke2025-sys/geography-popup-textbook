import {test,expect} from '@playwright/test';
import {paperClick} from './helpers';
import {chapterCopy} from '../../src/chapters';

async function goto(page:any,n:number){
  if(!await page.locator(`[data-goto="${n}"]`).isVisible())await page.locator('#cContents').click();
  await page.locator(`[data-goto="${n}"]`).click();
  await page.waitForFunction((n:number)=>{const d=(window as any).fieldbookDiagnostics;return !d.render.busy&&d.render.spread===n},n);
}
test('new chapters use the original paper controls, stay isolated, save and resume',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await goto(page,3);await paperClick(page,'chapter-predict',0);
  await page.waitForTimeout(300);await page.screenshot({path:'output/playwright/v4-water-printed.png'});
  await paperClick(page,'chapter','reveal');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.lift===1);
  await paperClick(page,'water-process','groundwater');
  await expect(page.locator('#chapter-live')).toContainText('地下路径');
  await page.waitForTimeout(350);await page.screenshot({path:'output/playwright/v4-water-raised.png'});
  await paperClick(page,'water-mode',1);await expect(page.locator('#chapter-live')).toContainText('陆地内循环');
  await paperClick(page,'water-mode',2);await expect(page.locator('#chapter-live')).toContainText('海上内循环');
  await paperClick(page,'chapter','answer');await page.locator('#answer-options').getByRole('button',{name:chapterCopy.water.answers[0],exact:true}).click();
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  await page.locator('#cNext').click();
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.spread===4&&!(window as any).fieldbookDiagnostics.render.busy);
  await paperClick(page,'chapter','reveal');await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.lift===1);
  await page.waitForTimeout(350);await page.screenshot({path:'output/playwright/v4-river-start.png'});
  await paperClick(page,'river-stage',.52);await expect(page.locator('#chapter-live')).toContainText('洪水冲断');
  await paperClick(page,'river-stage',1);await expect(page.locator('#chapter-live')).toContainText('牛轭湖');
  await page.waitForTimeout(350);await page.screenshot({path:'output/playwright/v4-river-end.png'});
  await paperClick(page,'chapter','answer');await page.locator('#answer-options').getByRole('button',{name:chapterCopy.river.answers[1],exact:true}).click();
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  const saved=await page.evaluate(()=>localStorage.getItem('earth-fieldbook:sea-breeze:v1'));
  expect(JSON.parse(saved!).chapters.water.prediction).toBe(0);
  await page.locator('#cContents').click();await page.locator('#teacher').click();
  await page.waitForFunction(() => !(window as any).fieldbookDiagnostics.render.busy);
  await paperClick(page,'river-stage',.52);
  expect(await page.evaluate(()=>localStorage.getItem('earth-fieldbook:sea-breeze:v1'))).toBe(saved);
  await page.locator('#teacher').click();await page.waitForFunction(()=>!(window as any).fieldbookDiagnostics.render.busy);
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  await page.reload();await page.evaluate(()=>document.fonts.ready);await paperClick(page,'#start');
  await expect(page.locator('#chapter-live')).toContainText('牛轭湖');await expect(page.locator('.stamp')).toHaveClass(/earned/);
  expect((await page.evaluate(()=>(window as any).fieldbookDiagnostics.render)).activeModels).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('phone SVG chapters allow keyboard scrubbing and keep explanatory limits',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?2d');
  await page.locator('[data-goto="3"]').click();
  await page.locator('[data-chapter-kind="chapter"][data-chapter-value="reveal"]').click();
  await expect(page.locator('#chapter-diagram svg')).toHaveAttribute('aria-label',/海陆间/);
  await page.locator('[data-chapter-kind="water-mode"][data-chapter-value="2"]').click();
  await expect(page.locator('#chapter-diagram svg')).toHaveAttribute('aria-label',/海上内/);
  await page.locator('[data-goto="4"]').click();await page.locator('[data-chapter-kind="river-stage"][data-chapter-value="1"]').click();
  await expect(page.locator('#chapter-diagram svg')).toHaveAttribute('aria-label',/牛轭湖/);
  await page.locator('#chapter-phase').focus();await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#page-count')).toHaveText('跨页 4 / 5');
  await expect(page.locator('#chapter-note')).toContainText('并非每个河曲');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'output/playwright/v4-phone-chapter.png',fullPage:true});
});
