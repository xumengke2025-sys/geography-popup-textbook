import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const out='output/playwright/habitable-diagnosis';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4181/?figure=habitable&3d&inspect');
 await page.waitForFunction(()=>window.textbookDiagnostics.render?.modelState==='live'&&!window.textbookDiagnostics.figureBusy);
 const state=await page.evaluate(()=>{
  const b=window.textbookDebug,g=b.entry.art.geometry;
  return g.meshes.filter(m=>m.userData.habitablePart).map(m=>({name:m.userData.habitablePart,visible:m.visible,position:m.position.toArray(),scale:m.scale.toArray(),
   material:{color:m.material.color?.getHexString(),opacity:m.material.opacity,transparent:m.material.transparent,depthWrite:m.material.depthWrite,side:m.material.side},
   normal:m.geometry.attributes.normal?.array.slice(0,3),count:m.geometry.attributes.position.count}));
 });console.log(JSON.stringify(state.filter(m=>/ocean|continent|atmosphere/.test(m.name))));
 for(const variant of ['baseline','no-air','no-ocean','land-only']){
  await page.evaluate(variant=>{const g=window.textbookDebug.entry.art.geometry;
   for(const m of g.meshes){const part=m.userData.habitablePart;
    if(part==='single-atmosphere-envelope')m.visible=variant==='baseline';
    if(part==='continuous-ocean-surface')m.visible=variant==='baseline'||variant==='no-air';
    if(variant==='land-only'&&part&&part!=='organic-curved-continents')m.visible=false;
   }},variant);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:`${out}/${variant}.png`});
 }
 await fs.writeFile(`${out}/materials.json`,JSON.stringify(state,null,2));
}finally{await browser.close();}
