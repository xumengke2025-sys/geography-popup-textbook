/** Export all five comparison settings from the authored instrument page. */
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function sampleBenchInstruments(base,out,views){
await mkdir(out,{recursive:true});
await build({configFile:false,logLevel:'error',build:{outDir:out+'/exporter',emptyOutDir:true,
  lib:{entry:'scripts/art/capture-authoring-model.js',name:'AtlasTransfer',formats:['iife'],fileName:()=>'exporter.js'}}});
const browser=await chromium.launch({channel:'msedge'});
try{
  for(const [id,poses] of views){
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.goto(base+'/?3d&inspect&figure='+id);
    await page.waitForFunction(id=>window.textbookDiagnostics?.active===id&&!window.textbookDiagnostics.figureBusy&&window.textbookDebug.entry?.art,id);
    await page.addScriptTag({path:out+'/exporter/exporter.js'});
    for(const [index,[phase,mode]] of poses.entries()){
      const data=await page.evaluate(async({id,mode,phase})=>{
        const art=window.textbookDebug.entry.art,g=art.geometry;
        g.beginFrame();art.motion.update(phase,mode,0,true);g.root.updateWorldMatrix(true,true);
        const flow=id==='pressure-wind'&&mode===0?g.flow.map(line=>({width:line.width,xyz:line.points.map(p=>p.toArray())})):[];
        const captured=await window.AtlasTransfer.captureModel();
        return {base64:captured.base64,flow,count:captured.count};
      },{id,mode,phase});
      await writeFile(out+'/'+id+'-'+index+'.glb',Buffer.from(data.base64,'base64'));
      await writeFile(out+'/'+id+'-'+index+'.json',JSON.stringify(data.flow));
      console.log(id,mode,data.count);
    }
    await page.close();
  }
}finally{await browser.close();}

}
if(pathToFileURL(process.argv[1]).href===import.meta.url){
  await sampleBenchInstruments(process.env.REVIEW_BASE_URL||'http://127.0.0.1:4402','work/pneumatic-blender-transfer',[
    ['pressure-wind',[[.89,0],[.89,1]]],['haze',[[.89,0],[.89,1],[.89,2]]]
  ]);
}
