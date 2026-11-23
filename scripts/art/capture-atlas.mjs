import { build } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:4197';
const out='work/blender-atlas';
await fs.mkdir(out+'/models',{recursive:true});
await build({configFile:false,logLevel:'error',build:{outDir:out+'/transfer',emptyOutDir:true,
  lib:{entry:'scripts/art/capture-authoring-model.js',name:'AtlasTransfer',formats:['iife'],fileName:()=> 'exporter.js'}}});
const catalog=JSON.parse(await fs.readFile('docs/handoff/catalog-branch-inventory.json','utf8'));
const ids=process.argv.slice(2);
// Stage the catalog plates at the point where their subject is visible.
// These choices apply only to the authoring snapshot, never to playback defaults.
const plateViews = {
  'mars-base': { condition: '水的再生', phase: .68 },
  typhoon: { phase: .44 },
  'quake-response-system': { phase: .854, evidence: ['send', 'verify'] },
  sun: { phase: .72 },
  'seismic-waves': { condition: '固体与液体', phase: .39, inspection: 'particle-6' },
  'air-composition': { condition: '水汽与杂质' },
  atmosphere: { phase: .52 },
  'pressure-wind': { condition: '存在气压差', phase: .63 },
  haze: { condition: '通风扩散', phase: .45 },
  'soil-composition': { condition: '适中' },
  drought: { condition: '持续少雨', phase: .82 },
  'soil-factors': { condition: '成土母质', phase: .52 },
  flood: { condition: '连续强降水', phase: .72 },
  mitigation: { condition: '玉树搜救', phase: .50 },
  warehouse: { condition: '路网节点' },
  gis: { phase: .22 },
  'cold-wave': { phase: .61 },
  'habitable': { phase: .62 },
  'solar-distribution': { phase: .54 },
  slide: { phase: .67 },
  'disaster-chain': { condition: '地震关联', phase: .72 },
  'solar-activity': { condition: '活动增强', phase: .78 },
  greenhouse: { condition: '有大气', phase: .92 },
  thermal: { phase: 1 },
  'wind-forces': { condition: '北半球近地面' },
  river: { phase: .62 },
  delta: { condition: '三角洲推进', phase: .91 },
  earthquake: { condition: '震后预警', phase: .42 },
  karst: { condition: '峰丛', phase: .8 },
  waves: { condition: '追踪水质点', phase: .36, inspection: 'depth-pair' },
  tides: { condition: '落潮', phase: .79 },
  currents: { condition: '前移', phase: .5 },
  density: { condition: '只降低温度' },
  salinity: { condition: '降水增多', phase: .44 },
  desalination: { condition: '破碎离心', phase: .53 },
  'coastal-landform': { condition: '海蚀拱桥', phase: .65 },
};
if(ids.some(id=>!catalog.some(f=>f.id===id)))throw Error('Unknown catalog entry');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const figure of catalog.filter(f=>!ids.length||ids.includes(f.id))){
  const file=path.join(out,'models',figure.id+'.glb');
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  try{
   await page.goto(base+'/?3d&inspect&figure='+figure.id);
   await page.waitForFunction(id=>window.textbookDiagnostics?.active===id&&!window.textbookDiagnostics.figureBusy
     &&window.textbookDiagnostics.render?.modelState==='live',figure.id);
   if(await page.evaluate(()=>window.textbookDiagnostics.playing))await page.locator('#cPause').click();
   const view = plateViews[figure.id];
   if (view?.condition) {
     const selection = figure.controls.indexOf(view.condition);
     if (selection < 0) throw Error('Unknown plate condition: '+view.condition);
     const compact = page.locator('#condition-choice');
     if (await compact.isVisible()) await compact.selectOption(String(selection));
     else await page.locator('#selections [data-selection="'+selection+'"]:visible').click();
     await page.waitForFunction(i=>window.textbookDiagnostics.state.selection===i,selection);
     if (await page.evaluate(()=>window.textbookDiagnostics.playing)) await page.locator('#cPause').click();
   }
   if(await page.locator('#phase').isEnabled()&&await page.locator('#phase').isVisible())
     await page.locator('#phase').evaluate((e,phase)=>{e.value=String(Math.round(phase*1000));e.dispatchEvent(new Event('input',{bubbles:true}))},view?.phase??.55);
   for (const action of view?.evidence ?? []) {
     const control = page.locator(`#selections [data-evidence-action="${action}"]`);
     await control.click();
     if (await control.getAttribute('aria-pressed') !== 'true') throw Error('Evidence was not selected: '+action);
   }
   if (view?.inspection) await page.evaluate(target=>window.textbookDebug.inspect(target),view.inspection);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.addScriptTag({path:out+'/transfer/exporter.js'});
   const data=await page.evaluate(()=>window.AtlasTransfer.captureModel());
   await fs.writeFile(file,Buffer.from(data.base64,'base64'));
   await fs.writeFile(path.join(out,'models',figure.id+'.json'),JSON.stringify({ink:data.ink,phase:data.phase,selection:data.selection}));
   console.log(figure.id,data.count);
  }finally{await page.close()}
 }
}finally{await browser.close()}
