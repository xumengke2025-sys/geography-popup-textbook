import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry,mergeInstrumentGeometry,turnedShaftGeometry } from './textbook-instrument-parts';
import { civilMiniatures,reliefRandom as rand } from './textbook-civil-miniatures';
import { WAREHOUSE_SITES,WAREHOUSE_TOWNS,warehouseRiverX,warehouseHeight as height } from './textbook-warehouse-relief';

export function warehouseDistricts(b:TextbookGeometry,s:number,origin:Vec3){
  const k=civilMiniatures(b,s,origin);
  // Each service destination is a cluster opening directly onto its own lane.
  WAREHOUSE_TOWNS.forEach(([x,z],i)=>{
    for(const [dx,dz,w,h,d,angle] of [[-3,-2,4.3,3.1,3.1,-.08],[2.4,-2.8,4,3.7,3.3,.09],[-3.4,2.2,3.3,2.85,2.5,-.07],[3.3,1.7,3.3,2.9,2.65,.07]]){
      const xx=x+dx,zz=z+dz;k.house(xx,height(xx,zz)-.11,zz,w,h,d,angle,i===2?'slate':'tile');
    }
    for(let j=0;j<3;j++){const xx=x-5.5+j*.65,zz=z-5.5+j*3.7;k.tree(xx,height(xx,zz),zz,2.9+rand(i,j)*1.2,i*3+j);}
  });
  // A broken riparian belt follows the exposed bank; the road and the
  // warehouse footprint remain clear even in the low-water trough.
  for(let i=0;i<115;i++){
    const z=7+rand(i,20)*59,side=i%2?1:-1,x=warehouseRiverX(z)+side*(6.6+rand(i,21)*1.9);
    if(WAREHOUSE_SITES.some(([a,c])=>Math.abs(x-a)<6.4&&Math.abs(z-c)<6.4)
      ||WAREHOUSE_TOWNS.some(([a,c])=>Math.abs(x-a)<7&&Math.abs(z-c)<6)||z>32&&z<39)continue;
    const y=height(x,z),r=.16+rand(i,22)*.51;
    k.stone(i%3?'bank':'fieldstone',[x,y+.07,z],[r,r*.52,r*.76],i);
    if(i%6===0)k.tree(x,y,z,2.5+rand(i,23)*1.4,i);
  }
  // Cultivated strips and hedgerows give the settlement lanes a readable
  // scale without changing the roads, elevations or the fixed flood surface.
  for(const [x0,z0,w,d] of [[35,52,7,5],[42.5,53.1,5.9,4.4],[58.4,53.3,7.3,5.2],[64.7,61.6,8,3.6],[33.5,12,7.5,5.4],[42,10.6,6.1,4.9]]){
    const a:number[]=[],indices:number[]=[],cols=18,rows=8;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const x=x0+w*i/cols,z=z0+d*j/rows;
      a.push(x,height(x,z)+.075+(i%2)*.11,z);
      const n=j*(cols+1)+i;if(i<cols&&j<rows)indices.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.setIndex(indices);g.computeVertexNormals();k.put(x0<42?'loam':'lightLeaf',g);
  }
  // Rocky shoulder on the side of the mountain away from the switchback.
  for(let i=0;i<82;i++){
    const x=71+rand(i,8)*24,z=6.5+rand(i,9)*12;
    if(Math.hypot(x-82,z-13)<7.5)continue;
    const r=.3+rand(i,11)*.74;k.stone(i%5?'fieldstone':'bank',[x,height(x,z)-.04,z],[r,r*.58,r*.8],i+66);
  }
  for(const [a,z] of [[8,19],[36,10],[56,13],[65,50],[42,58],[92,43]]){
    for(let j=0;j<4;j++){
      const x=a+rand(j,a)*4,zz=z+rand(j,z)*4;k.tree(x,height(x,zz),zz,2.6+rand(j,a+z)*2.1,j+Math.floor(a));
    }
  }
  for(const [x,z] of WAREHOUSE_SITES){
    const y=height(x,z);
    for(const side of [-1,1]){
      const xx=x+side*3.28,zz=z+3.88;
      for(const j of [-1,1])k.block('wood',[xx+j*.49,y+.93,zz],[.82,.67,.78]);
      k.block('brass',[xx+.48,y+.94,zz],[.075,.72,.82]);
      const y0=y+.55;
      k.block('sill',[xx,y0+.14,z+3.91],[2,.24,1.24]);
      for(let j=0;j<2;j++){const mx=x+side*(2.3+j*1.47);
        k.block('glass',[mx,y+3.6,z+3.67],[.83,1.18,.12]);
        k.block('sill',[mx,y+3,z+3.76],[1,.12,.22]);}
    }
    k.block('wood',[x,y+.94,z+2.66],[1.65,.64,1.07]);
    k.rod('linen',[x-.48,y+1.44,z+2.65],[x+.48,y+1.44,z+2.65],.29,.27,14);
    k.block('wood',[x+1.32,y+.96,z+2.35],[.72,.72,.78]);
  }
  return k.flush('warehouse-terrain-details');
}

/** A detented rotary switch couples the map's three roof inlays to the
 * route overlay. The model stays static between physical site changes. */
export function warehouseSelector(b:TextbookGeometry,s:number,p:(x:number,y:number,z:number)=>Vec3){
  const at=p(96,3.6,80.85),r=4.25,start=Math.PI*.82,step=-Math.PI*.32;
  const dial={center:[at[0],at[1],at[2]+.67*s] as Vec3,radiusX:r*s,radiusY:r*s};
  const input={kind:'indexed-dial',dial,start,step,stops:[{selection:0},{selection:1},{selection:2}],
    advanceAtHub:true,keepPhase:true,label:'拨动三档铜柄，比较库址到三个聚落的路网和洪水暴露'};
  const stand=b.mesh(chamferedPlateGeometry(p(90,-1.25,77.4),p(100.7,2.55,81.15),.38*s),'#384a40',false,true,'enamel');
  stand.name='warehouse-selector-plinth';
  const disk=new T.CylinderGeometry(5.1*s,5.45*s,.68*s,64);disk.rotateX(Math.PI/2);
  const sector=b.mesh(disk,'#a38853',false,true,'brass');sector.position.copy(new T.Vector3(...at));sector.userData.modelInput=input;
  const face=new T.CylinderGeometry(4.86*s,4.87*s,.22*s,56);face.rotateX(Math.PI/2);
  const enamel=b.mesh(face,'#395146',false,true,'enamel');enamel.position.set(at[0],at[1],at[2]+.39*s);enamel.userData.modelInput=input;
  const marks:any[]=[];
  for(let i=0;i<3;i++){
    const angle=start+i*step,co=Math.cos(angle),si=Math.sin(angle);
    for(let j=0;j<=i;j++){
      const dx=(j-i/2)*.37;
      marks.push(turnedShaftGeometry([(co*3.70-si*dx)*s,(si*3.70+co*dx)*s,.53*s],[(co*4.48-si*dx)*s,(si*4.48+co*dx)*s,.53*s],[[.09*s,0],[.09*s,1]]));
    }
  }
  const ticks=b.mesh(mergeInstrumentGeometry(marks),'#d3bb84',false,true,'brass');ticks.position.copy(sector.position);ticks.userData.modelInput=input;
  const shaft=turnedShaftGeometry([0,0,.52*s],[0,0,1.38*s],[[.92*s,0],[.91*s,.72],[.63*s,1]]);
  const arm=turnedShaftGeometry([0,0,.91*s],[3.92*s,0,.91*s],[[.57*s,0],[.43*s,.25],[.28*s,.66],[.46*s,.95],[.44*s,1]]);
  const lever=b.mesh(mergeInstrumentGeometry([shaft,arm]),'#b18d50',false,true,'brass');lever.position.copy(sector.position);lever.userData.modelInput=input;lever.name='warehouse-index-lever';
  const grip=b.mesh(turnedShaftGeometry([r*s,0,.68*s],[r*s,0,1.96*s],[[.43*s,0],[.45*s,.19],[.34*s,.36],[.57*s,.77],[.45*s,1]]),'#78563a',false,true,'wood');
  grip.position.copy(sector.position);grip.userData.modelInput=input;grip.userData.smallPointTarget=true;grip.name='warehouse-index-grip';
  return (i:number)=>{lever.rotation.z=grip.rotation.z=start+i*step;};
}