import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4173';
const output = process.env.REVIEW_OUTPUT ?? 'output/playwright/explicit-branches';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({channel:process.env.REVIEW_BROWSER ?? 'msedge'});
const states=[],errors=[];
async function open(id) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?figure=${id}&2d&inspect`);
  await page.waitForFunction(id=>window.textbookDiagnostics?.active===id && !window.textbookDiagnostics.figureBusy,id);
  return page;
}
async function verify(page,id,selection) {
  await page.waitForFunction(s=>window.textbookDiagnostics.state.selection===s,selection);
  states.push({id,selection,phase:await page.evaluate(()=>window.textbookDiagnostics.state.phase)});
}
try {
  for (const [id, selections] of [['solar',[1,2,3,4,5,6,7,8]],['history',[2,3,4,5,6,7]],['soil',[1,-1]]]) {
    const page=await open(id);
    try {
      for (const index of selections) {
        const part=page.locator(`.flat-concept [data-model-selection="${index<0?1:index}"]`).first();
        await part.focus(); await part.press('Enter');
        await verify(page,id,index);
      }
    } finally {await page.close();}
  }
  // Start each evidence combination from an independent local bookmark.
  for (let selection=0;selection<16;selection++) {
    const id='quake-response-system', page=await open(id);
    try {
      const action=key=>page.locator(`#selections [data-evidence-action="${key}"]`).press('Enter');
      if(selection & 4) await action('warehouse-b');
      await page.locator('#phase').press('End');
      if(selection & 1) await action('send');
      if(selection & 2) await action('verify');
      if(selection & 8) await action('layers');
      await verify(page,id,selection);
    } finally {await page.close();}
  }
} finally {
  await browser.close();
  await writeFile(`${output}/review.json`,JSON.stringify({base,states,errors},null,2));
}
if(errors.length) throw Error(errors.join('\n'));
console.log(`Checked ${states.length} native SVG selections and evidence combinations.`);
