import {test, expect} from '@playwright/test';
import {lesson,transfer} from '../../src/content';
import {paperClick,openMenu,goToSpread} from './helpers';

test('physical book UV controls, popup, flap and all learning tasks', async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({path:'output/playwright/v2-cover.png'});
  await paperClick(page,'#start');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.open>.999);
  await page.waitForTimeout(500);
  await page.screenshot({path:'output/playwright/v2-printed.png'});
  await paperClick(page,'[data-predict="1"]');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('earth-fieldbook:sea-breeze:v1')!).prediction)).toBe(1);
  await paperClick(page,'[data-step="1"]');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.lift>.99);
  for(let i=0;i<5;i++)await paperClick(page,'[data-action="watch-next"]');
  await expect(page.locator('[data-step="2"]')).toHaveAttribute('aria-current','step');
  await page.waitForTimeout(400);
  await page.screenshot({path:'output/playwright/v2-raised.png'});
  await paperClick(page,'[data-action="save-observation"]');
  await paperClick(page,'[data-phase="0"]');
  await expect(page.locator('#live-summary')).toContainText('陆地 → 海洋');
  await page.screenshot({path:'output/playwright/v2-night.png'});
  await paperClick(page,'[data-action="save-observation"]');
  await paperClick(page,'contrast');await paperClick(page,'contrast');
  await expect(page.locator('#live-summary')).toContainText('局地环流很弱');
  await paperClick(page,'[data-action="save-observation"]');
  await paperClick(page,'[data-step="3"]');
  await page.waitForTimeout(400);
  await page.screenshot({path:'output/playwright/v2-flap-closed.png'});
  await paperClick(page,'flap');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.flap>2.8);
  await page.screenshot({path:'output/playwright/v2-flap-open.png'});
  await paperClick(page,'[data-action="challenge"]');
  await expect(page.locator('#page-count')).toHaveText('跨页 2 / 5');
  await page.waitForTimeout(400);
  await page.screenshot({path:'output/playwright/v2-challenge.png'});
  for(let i=0;i<10;i++){
    await paperClick(page,'diagram',i);
    await expect(page.locator('#paper-answer')).toBeVisible();
    await page.locator('#answer-options').getByRole('button',{name:lesson.challenge[i].answer,exact:true}).click();
  }
  await paperClick(page,'[data-action="check-diagram"]');
  for(let i=0;i<3;i++){
    await paperClick(page,'transfer',i);
    await page.locator('#answer-options').getByRole('button',{name:transfer[i].options[transfer[i].answer],exact:true}).click();
  }
  await paperClick(page,'[data-action="check-transfer"]');
  await expect(page.locator('.stamp')).toHaveClass(/earned/);
  await paperClick(page,'conclusion');await page.locator('#answer-options button').first().click();
  await page.screenshot({path:'output/playwright/v2-completed.png'});
  await goToSpread(page,5);
  await page.screenshot({path:'output/playwright/v2-guide.png'});
  expect(errors).toEqual([]);
});

test('projection controls use shared conditions and preserve student progress',async({page})=>{
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await paperClick(page,'#start');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics?.render?.open===1);
  await paperClick(page,'[data-predict="0"]');
  const before=await page.evaluate(()=>localStorage.getItem('earth-fieldbook:sea-breeze:v1'));
  await openMenu(page);
  await page.locator('#teacher').click();
  await page.waitForFunction(()=>!(window as any).fieldbookDiagnostics.render.busy);
  await page.locator('#projector').click();
  await expect(page.locator('#projection-overlay')).toBeVisible();
  await page.locator('[data-projector-phase="0"]').click();
  await expect(page.locator('#projection-status')).toContainText('陆地 → 海洋');
  await page.locator('#projector-explain').click();
  await expect(page.locator('#projection-explanation')).toBeVisible();
  expect(await page.locator('#projection-status').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(28);
  await page.locator('#projector-reset').click();
  await expect(page.locator('#projection-status')).toContainText('海洋 → 陆地');
  await page.waitForTimeout(1600);
  await page.screenshot({path:'output/playwright/v2-projection.png'});
  expect(await page.evaluate(()=>localStorage.getItem('earth-fieldbook:sea-breeze:v1'))).toBe(before);
  await openMenu(page);
  await page.locator('#teacher').click();
  expect(await page.evaluate(()=>localStorage.getItem('earth-fieldbook:sea-breeze:v1'))).toBe(before);
});

test('emulated tablet touch and reduced motion retain paper controls',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173');await page.evaluate(()=>document.fonts.ready);
  async function tap(selector:string){
    await page.waitForFunction(selector=>(window as any).fieldbookDiagnostics.paperRegions.some((r:any)=>r.selector===selector||r.kind===selector),selector);
    const r=await page.evaluate(selector=>(window as any).fieldbookDiagnostics.paperRegions.find((r:any)=>r.selector===selector||r.kind===selector),selector);
    await page.touchscreen.tap(r.screenX,r.screenY);
  }
  await tap('#start');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.open===1);
  await tap('[data-step="2"]');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.lift===1);
  await tap('[data-phase="0"]');
  await expect(page.locator('#live-summary')).toContainText('陆地 → 海洋');
  await tap('phase');
  await expect(page.locator('#live-summary')).toContainText('海洋 → 陆地');
  await tap('[data-step="3"]');await tap('flap');
  await page.waitForFunction(()=>(window as any).fieldbookDiagnostics.render.flap>2.8);
  await tap('[data-action="challenge"]');
  await expect(page.locator('#page-count')).toHaveText('跨页 2 / 5');
  await page.screenshot({path:'output/playwright/v2-touch-emulation.png'});
  await context.close();
});
