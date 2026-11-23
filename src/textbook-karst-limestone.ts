import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { karstJointU, karstJointV, karstTransverseRange } from './textbook-karst-model';

/** Fissure distances are stored at the same map coordinates as the dissolution
 * mesh. Cut faces expose bedding; rainfall darkens the weathered joint lips. */
export function mountLimestoneFinish(pop:any, geom:any, nx:number, nz:number, scale:number) {
  const width=nx+1, data=new Float32Array(geom.attributes.position.count*2);
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/nz,k=(j*width+i)*2;
    let d=Math.min(...[0,1,2].map(lane=>Math.abs(u-karstJointU(lane,v))));
    for(let lane=0;lane<2;lane++){
      const [from,to]=karstTransverseRange(lane);
      if(u>from&&u<to)d=Math.min(d,Math.abs(v-karstJointV(lane,u))*.95);
    }
    data[k]=1;data[k+1]=d;
  }
  geom.setAttribute('karstFace',new T.BufferAttribute(data,2));
  const limestone=createSpecimenMaterial(pop,{role:'rock',color:'#adafa1'});
  const reveal=limestone.onBeforeCompile, baseKey=limestone.customProgramCacheKey(), dampness={value:0};
  limestone.onBeforeCompile=(shader:any,renderer:any)=>{
    reveal.call(limestone,shader,renderer); shader.uniforms.karstDampness=dampness;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec2 karstFace; varying vec2 vKarstFace; varying vec3 vLime;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vLime=position/${scale.toFixed(8)}; vKarstFace=karstFace;`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float karstDampness; varying vec2 vKarstFace; varying vec3 vLime;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float bed=vLime.y+.068*vLime.x+.87*sin(vLime.x*.084+vLime.z*.067)+.27*sin(vLime.z*.28);
        float seam=abs(fract(bed/5.7+.19*sin(bed*.24)+.5)-.5);
        float parting=1.-smoothstep(.016,.078+fwidth(bed)*.085,seam);
        float joint=1.-smoothstep(.004,.027+karstDampness*.008,vKarstFace.y);
        float foot=1.-smoothstep(5.0,9.5,vLime.y);
        float warm=.5+.5*sin(vLime.x*.154+.6*sin(vLime.z*.39))*cos(vLime.z*.219);
        vec3 exposed=mix(vec3(1.06,1.08,1.07),vec3(1.11,1.025,.90),warm*.59);
        vec3 clay=mix(vec3(.69,.55,.43),vec3(.39,.43,.35),karstDampness*.64+foot*.21);
        float stained=clamp(joint*(.45+.23*karstDampness)+foot*.25*warm,0.,.88);
        vec3 top=mix(exposed,clay,stained)*(1.-parting*.12);
        vec3 cut=vec3(1.11,1.03,.91)*(.98+.09*sin(bed*.52)-.38*parting);
        diffuseColor.rgb*=mix(cut,top,vKarstFace.x);`);
  };
  limestone.customProgramCacheKey=()=>baseKey+':limestone-face-v1:'+scale.toFixed(8);
  applyEarthScan(limestone,'outcrop',9.4*scale);
  limestone.userData.landformFinish='石灰岩层面与溶隙渗色';
  return {material:limestone,setDampness:(n:number)=>{dampness.value=n;}};
}
