import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { evaluateFloodSequence } from './textbook-ground-process-model';

type Datum = (x:number,z:number,h?:number)=>Vec3;
const trialNames = { flood: ['常水','强降水'], drought: ['足水','少雨'] };

function recorderBed(b:TextbookGeometry,p:Datum,s:number){
  const hw=createInstrumentParts(b);
  hw.plate(p(3,8,-3.4),p(97,76,-1.45),'wood',.45*s);
  hw.plate(p(3.6,8.6,-1.5),p(96.4,75.4,-1.19),'brass',.10*s);
  hw.casting(p(4,9,-1.19),p(96,75,-.01),'wood',.35*s);
  for(const x of [10,90])for(const z of [15,69])hw.column(p(x,z,-4.7),p(x,z,-3.4),1.65*s);
}

/** Two exchangeable trial keys on the front lip of the specimen bed. */
function trialKeys(b:TextbookGeometry,p:Datum,scale:number,trial:'flood'|'drought',centres:number[]) {
  const hardware=createInstrumentParts(b);
  const keys=centres.map((x,i)=>{
    const name=trialNames[trial][i],input={kind:'select',selection:i,keepPhase:true,label:'对照同一进度的'+name+'条件'};
    hardware.casting(p(x-8.1,66,-1.5),p(x+8.1,75,2.7),'wood',.5*scale);
    const cap=hardware.plate(p(x-7.8,65.9,2.7),p(x+7.8,74.6,3.5),'ivory',.3*scale);
    const ink=b.label(name,p(x,70.1,3.57),15*scale,7.3*scale,{appearance:'engraved'});
    ink.rotation.x=-Math.PI/2;ink.userData.labelMount='surface';
    for(const mesh of [ink,cap]){
      mesh.userData.modelInput=input;mesh.userData.smallPointTarget=true;mesh.userData.hydrologyControl='key'+i;
    }
    return {ink,cap,y:ink.position.y};
  });
  return (selection:number)=>keys.forEach(({ink,cap,y},i)=>{
    cap.position.y=i===selection?-.52*scale:0;ink.position.y=y+cap.position.y;
  });
}

export function mountFloodRecorder(b:TextbookGeometry,p:Datum,s:number){
  const hw=createInstrumentParts(b);
  recorderBed(b,p,s);
  hw.casting(p(6,66,-1.5),p(55,70,10.1),'brass',.52*s);
  hw.plate(p(7,70,.35),p(54,70.25,9.65),'ivory',.18*s);
  const curvePoint=(phase:number,condition:number):Vec3=>{
    const level=evaluateFloodSequence(phase,condition).waterLevel;
    return p(9+43*phase,70.42,2+(level-2.9)*1.45);
  };
  const records=[0,1].map(condition=>{
    const points=Array.from({length:41},(_,i)=>curvePoint(i/40,condition));
    return b.tube(points,.19*s,condition?'#396b79':'#577169');
  });
  const track={start:p(9,72,0),end:p(52,72,0)};
  hw.shaft(p(7,72,0),p(54,72,0),.45*s,'steel');
  const sled=hw.casting(p(7.7,70.7,-1.4),p(10.3,73.5,1.6),'brass',.35*s);
  const index=hw.shaft(p(9,70.78,1.4),p(9,70.78,9.64),.24*s,'brass');
  const nib=b.sphere(p(9,70.95,2),.67*s,'#983f30',false);
  const input={kind:'phase-track',track,label:'推拉读数游标，沿水位曲线回看降雨和汇流'};
  for(const mesh of [sled,index,nib]){mesh.userData.modelInput=input;mesh.userData.hydrologyControl='water-chart';}
  const setKeys=trialKeys(b,p,s,'flood',[67,86]);
  return (phase:number,condition:number)=>{
    setKeys(condition);records.forEach((m,i)=>{m.visible=condition===i});
    for(const m of [sled,index,nib])m.position.x=43*s*phase;
    nib.position.y=(evaluateFloodSequence(phase,condition).waterLevel-2.9)*1.45*s;
  };
}

export function mountDroughtRecorder(b:TextbookGeometry,p:Datum,s:number){
  const hw=createInstrumentParts(b);
  recorderBed(b,p,s);
  const keys=trialKeys(b,p,s,'drought',[16,35]);
  const [x,y,z]=p(80,71,8.8);
  hw.casting(p(72,63,-1.5),p(88,67,10.3),'wood',.64*s);
  hw.bearing(p(80,67.9,8.8),[0,0,1],2.1*s,3*s);
  const wheel=new T.Group();wheel.position.set(x,y,z);b.root.add(wheel);
  const radius=7.8*s,dial={center:[x,y,z] as Vec3,radiusX:radius,radiusY:radius,turns:1};
  const input={kind:'phase-dial',dial,label:'转动记录轮，前后比较土壤、水源和作物'};
  const wheelMesh=(geometry:any,color:string,material:'brass'|'wood'|'steel')=>{
    const mesh=b.mesh(geometry,color,false,true,material);wheel.add(mesh);
    mesh.userData.modelInput=input;mesh.userData.hydrologyControl='drought-wheel';return mesh;
  };
  wheelMesh(new T.TorusGeometry(radius,.54*s,10,64),'#967343','brass');
  const axle=turnedShaftGeometry([0,0,-2.1*s],[0,0,.77*s],[[1.32*s,0],[1.75*s,.57],[1.48*s,1]]);
  wheelMesh(axle,'#b3925a','brass');
  for(let i=0;i<3;i++){
    const a=(i/3-.25)*Math.PI*2,ex=radius*Math.cos(a),ey=radius*Math.sin(a);
    wheelMesh(turnedShaftGeometry([0,0,0],[ex,ey,0],[[.48*s,0],[.33*s,.36],[.45*s,1]]),'#a88b50','brass');
  }
  const grip=wheelMesh(turnedShaftGeometry([0,-radius,.1*s],[0,-radius,3.5*s],[[.60*s,0],[1.13*s,.26],[1.09*s,.78],[.63*s,1]]),'#5d3f2b','wood');
  grip.userData.smallPointTarget=true;
  return (phase:number,condition:number)=>{keys(condition);wheel.rotation.z=phase*Math.PI*2;};
}
