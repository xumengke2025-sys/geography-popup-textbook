import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const base=process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4173';
const output=process.env.REVIEW_OUTPUT ?? 'output/playwright/frame-time.json';
const browser=await chromium.launch({channel:process.env.REVIEW_BROWSER ?? 'msedge'});
const samples=[];
try {
  for(const id of ['vegetation','soil','mars-base','basin-system']){
    const page=await browser.newPage({viewport:{width:1440,height:960}});
    try {
      await page.goto(`${base}/?figure=${id}&3d&inspect`);
      await page.waitForFunction(()=>window.textbookDiagnostics?.render?.modelState==='live');
      for(const quality of ['中','低']){
        await page.locator('#desk-settings').click();
        await page.locator('#quality').selectOption(quality);
        await page.keyboard.press('Escape');
        const sample=await page.evaluate(async()=>{
          const book=window.textbookDebug, gl=book.renderer.getContext();
          const debug=gl.getExtension('WEBGL_debug_renderer_info');
          const times=[];
          let previousFrame=-1, presented=0;
          for(let frame=0;frame<106;frame++){
            const stamp=await new Promise(resolve=>requestAnimationFrame(resolve));
            if(frame>=15){
              times.push(stamp);
              const rendered=book.renderer.info.render.frame;
              if(times.length>1 && previousFrame!==rendered)presented++;
              previousFrame=rendered;
            }
          }
          const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
          return {renderFps:1000*presented/(times.at(-1)-times[0]),rafFps:1000*intervals.length/(times.at(-1)-times[0]),
            p95Ms:intervals[Math.floor(intervals.length*.95)],frames:intervals.length,
            render:book.renderer.info.render.calls,triangles:book.renderer.info.render.triangles,
            device:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',
            viewport:[innerWidth,innerHeight],pixelRatio:book.renderer.getPixelRatio()};
        });
        samples.push({id,quality,...sample});
      }
    }finally{await page.close();}
  }
}finally{
  await writeFile(output,JSON.stringify({base,browser:browser.version(),scope:'Headless Edge, live lesson, 90 frame intervals after warm-up; CSS viewport simulation.',samples},null,2));
  await browser.close();
}
