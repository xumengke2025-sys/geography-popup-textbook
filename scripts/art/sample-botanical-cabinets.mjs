/** Snapshot the exact, independently editable geometry of both textbook
 * instruments. Re-run against a local build of this edition before Blender. */
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.REVIEW_BASE_URL||'http://127.0.0.1:4399';
const out='work/botanical-blender-transfer';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{for(const id of ['forest','vegetation']){
  const page=await browser.newPage({reducedMotion:'reduce'});
  await page.goto(base+'/?3d&inspect&figure='+id);
  await page.waitForFunction(id=>window.textbookDiagnostics?.active===id&&!window.textbookDiagnostics.figureBusy&&window.textbookDebug.entry?.art?.motion,id);
  const modes=id==='forest'?[0,.5,1]:[0,1,2,3,4,5,6];
  for(const n of modes){
    const snapshot=await page.evaluate(({id,n})=>{
      const art=window.textbookDebug.entry.art,g=art.geometry,m=art.motion;
      m.update(id==='forest'?n:n===2?.48:n===4?.17:n===5?.62:0,id==='forest'?0:n,0,true);
      g.root.updateWorldMatrix(true,true);const inverse=g.root.matrixWorld.clone().invert(),scale=g.width/100;
      const known=window.botanicalNativeMeshes??=new Set(),parts=[],shapes={};
      const encode=(a)=>{
        const view=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),blocks=[];
        for(let i=0;i<view.length;i+=24000)blocks.push(String.fromCharCode.apply(null,view.subarray(i,i+24000)));
        return btoa(blocks.join(''));
      };
      for(const mesh of g.meshes){
        if(!mesh.visible)continue;
        const a=mesh.geometry,mat=mesh.material,pos=a.attributes.position;
        const label=mesh.userData.text;
        if(!label&&!known.has(a.uuid)){
          known.add(a.uuid);const idx=a.index?.array;
          shapes[a.uuid]={p:encode(Float32Array.from(pos.array)),i:idx?encode(Uint32Array.from(idx)):null,
            c:a.attributes.color?encode(Float32Array.from(a.attributes.color.array)):null};
        }
        parts.push({id:mesh.uuid,g:a.uuid,text:label,width:a.parameters?.width,height:a.parameters?.height,
          name:label||mesh.name||mesh.userData.forestRole||mesh.userData.vegetationPart||'固定件',
          kind:mat.userData.materialRole,scan:mat.userData.earthScan,bark:!!mat.userData.botanicalBark,
          color:mat.color?.toArray()||[.54,.48,.35],rough:mat.roughness??.69,metal:mat.metalness??0,
          opacity:mesh.userData.forestRole==='observation-plane'?.035:1,
          ma:inverse.clone().multiply(mesh.matrixWorld).elements});
      }
      return {scale,shapes,parts};
    },{id,n});
    const file=out+'/'+id+'-'+n+'.json';await writeFile(file,JSON.stringify(snapshot));console.log(file,Object.keys(snapshot.shapes).length,snapshot.parts.length);
  }
  await page.close();
}}finally{await browser.close();}
