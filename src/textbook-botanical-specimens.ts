import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { createSpecimenMaterial, type SolidMaterialRole } from './textbook-solid-materials';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';

type Surface = { positions:number[]; indices:number[]; colors:number[] };
const empty=():Surface=>({positions:[],indices:[],colors:[]});
function surfaceGeometry(data:Surface) {
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));
  g.setIndex(data.indices);g.computeVertexNormals();return g;
}
function pigment(data:Surface,point:Vec3,r:number,g:number,b:number) {
  data.positions.push(...point);data.colors.push(r,g,b);return data.colors.length/3-1;
}

/** Longitudinal fissures vary along individual trunks. Filter the fine
 * cambial ridges before projection so distant branches do not shimmer. */
export function botanicalBark(b:TextbookGeometry,span:number,color:string) {
  const material=createSpecimenMaterial(b.pop,{color,role:'land'}), previous=material.onBeforeCompile;
  const originalKey=material.customProgramCacheKey();material.userData.botanicalBark=true;
  material.onBeforeCompile=(shader:any,renderer:any)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBarkPos;').replace('#include <begin_vertex>',`#include <begin_vertex>\nvBarkPos=position/${span.toFixed(7)};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBarkPos;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 barkP=vBarkPos;
        float flute=dot(barkP.xz,vec2(3.7,4.1))+1.57*sin(dot(barkP,vec3(.36,.12,-.41)))+.49*cos(barkP.y*.49+barkP.z*.7);
        float fissure=pow(.5+.5*cos(flute),7.)*(1.-smoothstep(.52,2.45,fwidth(flute)));
        float grainPhase=flute*2.87+.91*cos(barkP.y*.38+barkP.x*.13);
        float grain=.5+.5*sin(grainPhase)*(1.-smoothstep(.55,2.4,fwidth(grainPhase)));
        diffuseColor.rgb*=(1.07-.32*fissure)*mix(vec3(.92,.91,.82),vec3(1.09,1.06,1.03),grain);`);
  };
  material.customProgramCacheKey=()=>originalKey+'-living-bark-'+span;return material;
}

/** A continuous humus/mineral section with litter blades folded along their
 * midrib. The top stays at the planted datum even while observations change. */
export function botanicalFloor(b:TextbookGeometry,min:Vec3,max:Vec3,s:number) {
  const [x0,top,z0]=min,[x1,,z1]=max,nx=67,nz=34;
  const data=empty(),cut=empty(),litter=empty();
  const co=(u:number,v:number):Vec3=>[x0+(x1-x0)*u,top+s*(.115*Math.sin(23*u+4*v)*Math.cos(17*v)+.064*Math.sin(49*v-11*u)),z0+(z1-z0)*v];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++) {
    const u=i/nx,v=j/nz,t=.5+.20*Math.sin(17*u+4*v)*Math.cos(13*v-7*u)+.13*Math.sin(42*v-35*u)+.10*Math.cos(71*u+68*v);
    pigment(data,co(u,v),.67+t*.31,.67+t*.29,.58+t*.28);
    if(i<nx&&j<nz){const k=j*(nx+1)+i;data.indices.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
  }
  for(let side=0;side<4;side++)for(let i=0;i<=72;i++) {
    const k=cut.positions.length/3,t=i/72;
    const [x,y,z]=co(side===0?t:side===1?1:side===2?1-t:0,side===0?0:side===1?t:side===2?1:1-t);
    const humus=.57+.16*Math.sin(t*19+side)+.11*Math.sin(t*53);
    for(const [h,r,g,blue] of [[0,.48,.39,.23],[humus,.35,.24,.15],[humus+.12,.62,.42,.25],[1.08,.52,.35,.23],[1.85,.69,.51,.32]])pigment(cut,[x,y-s*h,z],r,g,blue);
    if(i<72)for(let j=0;j<4;j++)cut.indices.push(k+j,k+j+1,k+j+5,k+j+1,k+j+6,k+j+5);
  }
  const frac=(n:number)=>n-Math.floor(n);
  for(let j=0;j<247;j++) {
    const u=.015+.97*frac(j*.618034+.32*Math.sin(4.13*j)),v=.015+.97*frac(j*.414214+.19*Math.cos(1.73*j));
    const [x,y,z]=co(u,v),angle=j*2.39996,length=(.42+.71*frac(j*.382))*s,width=length*(.19+.18*frac(j*.781)),dx=Math.cos(angle),dz=Math.sin(angle);
    const color=frac(j*.317),k=litter.positions.length/3;
    for(const [a,across,h] of [[0,0,.03],[.46,-1,.09],[.43,0,.18],[.49,1,.08],[1,0,.05]]) {
      pigment(litter,[x+a*dx*length-dz*width*across,y+s*h,z+a*dz*length+dx*width*across],.39+.37*color,.27+.32*color,.13+.18*color);
    }
    litter.indices.push(k,k+2,k+1,k+1,k+2,k+4,k,k+3,k+2,k+2,k+3,k+4);
  }
  const mount=(d:Surface,name:string,scan:'turf'|'loam'|null)=>{
    const m=b.mesh(surfaceGeometry(d),'#ffffff',false,false,'land');
    m.material=createSpecimenMaterial(b.pop,{color:scan==='turf'?'#998b66':scan==='loam'?'#ab9169':'#ad9c71',role:'land'});m.material.vertexColors=true;
    if(scan)applyEarthScan(m.material,scan,(scan==='turf'?9.2:7.3)*s);m.name=name;return m;
  };
  return {ground:mount(data,'腐殖表土','turf'),cut:mount(cut,'腐殖层与矿质层剖面','loam'),litter:mount(litter,'枯枝落叶层',null)};
}

export function botanicalCabinet(b:TextbookGeometry,p:(u:number,v:number,h?:number)=>Vec3,s:number) {
  const all:any[]=[],cards:any[][]=[];
  const mount=(g:any,color:string,role:SolidMaterialRole,name:string)=>{
    const m=b.mesh(g,color,false,true,role);m.name=name;all.push(m);return m;
  };
  const block=(a:Vec3,c:Vec3,r:number,color:string,role:SolidMaterialRole,name:string)=>mount(chamferedPlateGeometry(a,c,r*s),color,role,name);
  const within=(u:number,v:number,h:number,du:number,dv:number,dh:number,r:number,color:string,role:SolidMaterialRole,name:string)=>
    block(p(u,v,h),p(u+du,v+dv,h+dh),r,color,role,name);
  within(0,.065,-4.9,1.23,1.22,3.55,.66,'#634831','wood','植物标本柜');
  within(-.005,.06,-1.64,1.24,1.23,.67,.21,'#a48a58','brass','镶铜压边');
  within(0,.067,-1.13,1.23,1.216,1.07,.24,'#3b4e40','enamel','标本抽屉毡衬');
  for(const [u,v]of [[.03,.11],[1.16,.11],[.03,1.15],[1.16,1.15]])within(u,v,-5.65,.043,.055,.76,.14,'#473a2e','wood','抽屉足');
  const tilt=-Math.PI*.31;
  for(const x of [.20,.50,.80]) {
    const w=(x===.50?29.5:26.3)*s, c=p(x,1.214,1.65);
    for(const [back,front,height,width,color,role,name] of [
      [-.44,.38,6.1,w/s,'#b59c69','brass','展签铜座'],[.38,.66,5.64,w/s-.57,'#eee1c2','ivory','展签瓷面']] as const){
      const g=chamferedPlateGeometry([-width*s/2,-height*s/2,back*s],[width*s/2,height*s/2,front*s],.15*s);
      g.rotateX(tilt);g.translate(...c);mount(g,color,role,name);
    }
  }
  // The replaceable mounted specimen stands next to the landscape. All
  // seven attachments share the herbarium clip and the same scale of card.
  const center=p(1.106,.76,18),[cx,cy,cz]=center;
  const at=(x:number,y:number,z:number):Vec3=>[cx+x*s,cy+y*s,cz+z*s];
  block(at(-10,-14,-1.0),at(10,13,.0),.31,'#684933','wood','植物标本夹板');
  block(at(-9.31,-13.29,.02),at(9.31,12.27,.25),.14,'#d7c9a7','ivory','标本托纸');
  block(at(-3.3,11.2,.26),at(3.3,12.66,.63),.13,'#9c7d4b','brass','簧片标本夹');
  for(const x of [-5.8,5.8])mount(turnedShaftGeometry(at(x,-18,-.84),at(x,-13.2,-.84),[[.36*s,0],[.42*s,.06],[.32*s,1]]),'#796747','brass','夹板承柱');
  const blade=(x:number,y:number,angle:number,len:number,w:number,serrate:boolean,green:number,out:Surface)=>{
    const k=out.positions.length/3,dx=Math.cos(angle),dy=Math.sin(angle);
    for(let j=0;j<=10;j++) {
      const u=j/10,width=Math.sin(Math.PI*u)**.74*w*(serrate&&j%2===0?.79:1),sag=Math.sin(Math.PI*u)*.23;
      for(const side of [-1,0,1])pigment(out,at(x+dx*len*u-dy*width*side,y+dy*len*u+dx*width*side,.51+sag+(side===0?.21:0)),green*.86,green,green*.61);
      if(j){const q=k+3*j;out.indices.push(q-3,q-2,q,q-2,q+1,q,q-2,q-1,q+1,q-1,q+2,q+1);}
    }
  };
  for(let i=0;i<7;i++) {
    const start=all.length,sprays=empty(),stems:any[]=[];
    const stem=(x:number,y:number,x1:number,y1:number,width:number)=>{
      stems.push(turnedShaftGeometry(at(x,y,.43),at(x1,y1,.50),[[width*s,0],[width*s*.53,1]]));
    };
    stem(-.91,-10.8,1.2,9.8,.26);
    if(i===0||i===1||i===2||i===6){
      for(let j=0;j<7;j++) {
        const x=-.8+j*.25,y=-7.2+j*2.25,sign=j%2?1:-1;
        const dx=sign*(i===6?2.3:1.07),dir=sign>0?.53:Math.PI-.57;
        stem(x,y,x+dx,y+1,.14);
        blade(x+dx,y+1,dir,i===6?1.5:4.25+.5*Math.cos(j),i===2?1.7:i===6?.35:i===0?1.34:1.11,i===2,.33+.033*j,sprays);
        if(i===6)blade(x+dx*.71,y+.81,dir+.83,1.5,.26,false,.49,sprays);
      }
    }else if(i===3){
      for(let j=0;j<42;j++){
        const x=-.66+j*.041,y=-6.8+j*.375,sign=j%2?1:-1;
        blade(x,y,sign>0?.50:Math.PI-.54,1.78+1.78*Math.sin(j/42*Math.PI),.097,false,.29+.09*(j%4),sprays);
      }
    }else{
      for(let j=0;j<7;j++){const y=-8+j*2.1,sign=j%2?1:-1;
        blade(-.5+j*.14,y,sign>0?.85:Math.PI-.89,6.2-j*.32,i===4?.47:.33,false,.49+.04*(j%4),sprays);}
      for(let j=0;j<9;j++){const y=4.3+j*.61,sign=j%2?1:-1;stem(.67+j*.045,y,sign*1.3+.7,y+1.8,.11);
        blade(sign*1.3+.7,y+1.2,sign>0?1.18:1.92,1.8,.28,false,.66,sprays);}
    }
    mount(mergeInstrumentGeometry(stems),'#786748','land','腊叶标本枝');
    const sample=mount(surfaceGeometry(sprays),'#ffffff','plant','腊叶标本叶片');sample.material=createSpecimenMaterial(b.pop,{color:'#ffffff',role:'plant'});sample.material.vertexColors=true;
    const parts=all.slice(start);for(const m of parts)m.userData.herbariumSample=i;cards.push(parts);
  }
  return { all,update(selected:number,close:boolean){for(const m of all)m.visible=!close;
    cards.forEach((group,i)=>group.forEach(m=>m.visible=!close&&i===selected));} };
}
