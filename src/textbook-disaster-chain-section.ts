import { THREE as T } from './reference/engine.js';
import { createInstrumentParts } from './textbook-instrument-parts';
import { createSpecimenMaterial } from './textbook-solid-materials';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chokeGround } from './textbook-disaster-chain-stock';
import { chainFreshHead, chainSalineInterface, type DisasterChainState } from './textbook-disaster-chain-model';

type Coordinate=(x:number,y:number,z:number)=>Vec3;
/** The valley record is an intersection through the actual transported
 * solids at one x coordinate. The coastal record uses the same fixed
 * groundwater datum as the main cutaway. Both can be inspected in reverse. */
export function mountDamSection(b:TextbookGeometry,p:Coordinate,s:number,z0:number,pieces:any[]) {
  const hw=createInstrumentParts(b),x0=59.5,x1=89.5,z=56.1,y0=4.65,samples=61,cutX=55.34;
  hw.casting(p(x0-1.4,.1,z-2.2),p(x1+1.4,15.6,z),'wood',.38*s);
  hw.plate(p(x0-.85,y0-1,z),p(x1+.85,15.25,z+.23),'brass',.14*s);
  hw.plate(p(x0-.5,y0-.64,z+.23),p(x1+.5,14.95,z+.39),'ivory',.09*s);
  const titles=['含水层剖面','堵河横断面'].map(text=>{
    const title=b.label(text,p((x0+x1)/2,13.25,z+.48),22*s,3.65*s,{appearance:'engraved'});
    title.userData.labelMount='surface';
    return title;
  });
  const bed=Array.from({length:samples},(_,i)=>chokeGround(cutX,26+18*i/(samples-1)));
  const tops=[...bed],indices:number[]=[];
  for(let i=0;i<samples-1;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  const ribbon=(color:string)=>{
    const g=new T.BufferGeometry(),a=new T.Float32BufferAttribute(new Float32Array(samples*6),3);
    g.setAttribute('position',a);g.setIndex(indices);g.computeVertexNormals();
    const mesh=b.mesh(g,color,false);
    mesh.material=createSpecimenMaterial(b.pop,{role:'enamel',color});
    mesh.userData.chainRole='section-reading';
    return {mesh,set(lower:(i:number)=>number,upper:(i:number)=>number){
      for(let i=0;i<samples;i++){
        const x=x0+(x1-x0)*i/(samples-1);
        a.setXYZ(i*2,...p(x,lower(i),z+.47));a.setXYZ(i*2+1,...p(x,upper(i),z+.47));
      }
      a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    }};
  };
  const ground=ribbon('#76614a'),stock=ribbon('#9b7148'),saline=ribbon('#4a8093');
  const worldBuffers=pieces.map(mesh=>new Float64Array(mesh.geometry.attributes.position.count*3));
  let previous='',mode='drought';
  function sectionThroughStock() {
    for(let i=0;i<samples;i++)tops[i]=bed[i];
    for(let piece=0;piece<pieces.length;piece++){
      const m=pieces[piece],pos=m.geometry.attributes.position,index=m.geometry.index.array,world=worldBuffers[piece];
      m.updateMatrix();const a=m.matrix.elements;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        world[3*i]=(a[0]*x+a[4]*y+a[8]*z+a[12])/s;
        world[3*i+1]=(a[1]*x+a[5]*y+a[9]*z+a[13])/s;
        world[3*i+2]=(a[2]*x+a[6]*y+a[10]*z+a[14]-z0)/s;
      }
      for(let f=0;f<index.length;f+=3){
        const hits:number[][]=[];
        for(let j=0;j<3;j++){
          const ia=3*index[f+j],ib=3*index[f+(j+1)%3],ax=world[ia],bx=world[ib];
          if ((ax<cutX)===(bx<cutX))continue;
          const t=(cutX-ax)/(bx-ax);
          hits.push([world[ia+2]+(world[ib+2]-world[ia+2])*t,world[ia+1]+(world[ib+1]-world[ia+1])*t]);
        }
        if(hits.length!==2||Math.abs(hits[1][0]-hits[0][0])<1e-8)continue;
        const [a,e]=hits,from=Math.max(0,Math.ceil((Math.min(a[0],e[0])-26)*(samples-1)/18)),to=Math.min(samples-1,Math.floor((Math.max(a[0],e[0])-26)*(samples-1)/18));
        for(let i=from;i<=to;i++){
          const z=26+i*18/(samples-1),v=(z-a[0])/(e[0]-a[0]);
          tops[i]=Math.max(tops[i],a[1]+v*(e[1]-a[1]));
        }
      }
    }
  }
  return {update(state:DisasterChainState){
    const key=state.branch+'/'+state.phase;if(key===previous)return;
    previous=key;const coastal=state.branch==='drought';
    mode=state.branch;titles[0].visible=coastal;titles[1].visible=!coastal;
    saline.mesh.visible=coastal;
    if(coastal){
      const head=(i:number)=>chainFreshHead(state,6+66*i/(samples-1)),water=(i:number)=>chainSalineInterface(state,6+66*i/(samples-1));
      const h=(value:number)=>y0+(value-4)*.29;
      ground.set(()=>y0-.38,()=>y0);stock.set(()=>y0,i=>h(head(i)));
      stock.mesh.material.color.set('#83a8a4');
      saline.set(()=>y0,i=>h(water(i)));saline.mesh.position.z=.055*s;
    }else{
      sectionThroughStock();
      const h=(height:number)=>y0+.32*(height-2);
      ground.set(()=>y0-.38,i=>h(bed[i]));stock.set(i=>h(bed[i]),i=>h(tops[i]));
      stock.mesh.material.color.set('#9b7148');
    }
  },describe:()=>({mode,cutX,channelZ:35,sampledFromMovingSolids:mode==='earthquake',spillCrest:mode==='earthquake'?Math.min(...tops):null,centerStockHeight:mode==='earthquake'?tops[(samples-1)/2]-bed[(samples-1)/2]:null})};
}
