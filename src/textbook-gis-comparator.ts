import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { GisState } from './textbook-gis-model';
import { GIS_COUNTS, GIS_REGIONS } from './textbook-gis-model';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

type Profile = readonly (readonly [number, number])[];

/** Rear hoist follows the tracing frame. The separate front capstan drives
 * the process carriage through its full traverse, including the count. */
export function gisComparator(b:TextbookGeometry,s:number,p:(x:number,y:number,z:number)=>Vec3){
  const part=(geometry:any,color:string,material:SolidMaterialRole,role:string)=>{
    const mesh=b.mesh(geometry,color,false,true,material);
    mesh.name=role;mesh.userData.gisRole=role;return mesh;
  };
  const wood='#76553e',brass='#ad9059',dark='#30493d',steel='#727e7b';
  const box=(a:Vec3,c:Vec3,r=.16)=>chamferedPlateGeometry(p(...a),p(...c),r*s);
  const profile=(a:Vec3,c:Vec3,outline:Profile)=>turnedShaftGeometry(a,c,outline.map(([r,t])=>[s*r,t]));
  const shaft=(a:Vec3,c:Vec3,r:number)=>profile(p(...a),p(...c),[[r,0],[r,1]]);
  const turned=(a:Vec3,c:Vec3,outline:Profile)=>profile(p(...a),p(...c),outline);
  const make=(geos:any[],color:string,material:SolidMaterialRole,role:string)=>part(mergeInstrumentGeometry(geos),color,material,role);
  const frame:any[]=[],joinery:any[]=[],hardware:any[]=[];
  for(const x of [3,97]){
    joinery.push(box([x-2.7,-.8,-20],[x+2.7,2,93],.52));
    frame.push(box([x-2.52,1.72,-20.7],[x+2.52,3.03,93.8],.25));
    // A tapering cast side cheek with a pierced web and a flared foot.
    const face=new T.Shape();
    face.moveTo(-20.6,2.8);face.lineTo(1.2,2.8);face.lineTo(1.2,5.1);
    face.bezierCurveTo(-8,7.2,-12,25.5,-12.5,39.7);
    face.bezierCurveTo(-12.7,44,-19.9,44.4,-20.3,40.2);face.closePath();
    const window=new T.Path();window.moveTo(-17.9,30.1);
    window.bezierCurveTo(-17.1,21,-14.8,13.6,-11.2,8.1);
    window.quadraticCurveTo(-10.4,6.3,-12.4,6.2);window.lineTo(-17.7,6.2);
    window.quadraticCurveTo(-18.5,6.2,-18.4,8);window.lineTo(-18.4,30.1);window.closePath();face.holes.push(window);
    const cheek=new T.ExtrudeGeometry(face,{depth:2.45,bevelEnabled:true,bevelThickness:.22,bevelSize:.26,bevelSegments:2,curveSegments:12});
    // profile coordinates are (z,y); extrusion extends toward decreasing x.
    cheek.rotateY(-Math.PI/2);cheek.scale(s,s,s);cheek.translate(...p(x+1.22,0,0));frame.push(cheek);
    for(const z of [-19,4,88]){
      hardware.push(turned([x,2.91,z],[x,3.30,z],[[.52,0],[.67,.3],[.61,.84],[.45,1]]));
    }
  }
  joinery.push(box([1.4,33.2,-20.4],[98.6,36.5,-17.8],.45),box([1.2,.12,85.5],[98.8,2.5,93.2],.5));
  hardware.push(box([1.8,35.99,-20.57],[98.2,36.34,-20.3],.08));
  make(joinery,wood,'wood','walnut-joinery');
  make(frame,dark,'enamel','pierced-cast-standards');

  const travel=Math.hypot(32.2,12),dy=32.2/travel,dz=12/travel;
  const tangentY=37+4.6*dy,tangentZ=-12-4.6*dz,drumRadius=2.35;
  const cy=tangentY-drumRadius*dz,cz=tangentZ-drumRadius*dy;
  hardware.push(shaft([-.7,cy,cz],[100.7,cy,cz],.68));
  const cords:any[]=[],drums:any[]=[];
  const drumShape:Profile=[[2.7,0],[2.86,.06],[2.8,.12],[2.35,.17],[2.35,.83],[2.8,.88],[2.86,.94],[2.7,1]];
  for(const [x,dir] of [[5.15,1],[94.85,-1]]){
    const d=part(profile([-2.5*s,0,0],[2.5*s,0,0],drumShape),brass,'brass','reeled-lifting-drum');
    d.position.set(...p(x,cy,cz));drums.push(d);
    const helix=Array.from({length:121},(_,i)=>{
      const t=i/120,a=2*Math.PI*3*t;return new T.Vector3((t-.5)*3.7*s,(2.40*Math.sin(a))*s,2.40*Math.cos(a)*s);
    });
    const braid=part(new T.TubeGeometry(new T.CatmullRomCurve3(helix),120,.10*s,6,false),'#69563e','wood','wound-cord');
    braid.position.copy(d.position);drums.push(braid);
    const v=new T.Vector3(0,-dy,dz),line=part(new T.CylinderGeometry(.16*s,.16*s,s,10).translate(0,s*.5,0),'#6a5946','wood','taut-lifting-cord');
    line.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v);line.position.set(...p(x,tangentY,tangentZ));cords.push(line);
    hardware.push(turned([x-dir*5.2,cy,cz],[x-dir*1.74,cy,cz],[[1.68,0],[2.12,.12],[1.75,.28],[1.49,.75],[1.92,.86],[1.81,1]]));
  }

  const r=4.35, axleY=3.2+r,z=90,capstanX=96,turns=82/(2*Math.PI*r);
  const pulleys:any[]=[];
  for(const x of [4,capstanX]){
    hardware.push(shaft([x,axleY,86],[x,axleY,93.2],.78));
    hardware.push(box([x-1.65,2.2,85.9],[x+1.65,axleY+.38,88.2],.38));
    const rim=turnedSleeveGeometry([0,0,-s],[0,0,s],[[s*(r+.30),0],[s*(r+.30),.16],[s*r,.25],[s*r,.75],[s*(r+.30),.84],[s*(r+.30),1]],(r-.58)*s);
    const sheave=[rim];
    for(let j=0;j<3;j++){
      const a=j*Math.PI/3;
      sheave.push(profile([-r*s*Math.cos(a),-r*s*Math.sin(a),0],[r*s*Math.cos(a),r*s*Math.sin(a),0],[[.24,0],[.24,1]]));
    }
    const pulley=make(sheave,brass,'brass','cord-pulley');
    pulley.position.set(...p(x,axleY,z));pulleys.push(pulley);
  }
  make(hardware,brass,'brass','bearing-caps');
  const runs=[shaft([4,axleY+r,z],[capstanX,axleY+r,z],.14),shaft([4,3.2,z],[capstanX,3.2,z],.14)];
  make(runs,'#665943','wood','carriage-capstan-cord');
  const wr=5.5,wz=92.9;
  const wheelGeos:import('three').BufferGeometry[]=[new T.TorusGeometry(wr*s,.46*s,12,64)];
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5-Math.PI/2;
    const polar=(r:number,da:number)=>new T.Vector3(Math.cos(a+da)*r*s,Math.sin(a+da)*r*s,0);
    const arc=new T.QuadraticBezierCurve3(polar(.6,0),polar(3.1,.24),polar(wr,0));
    wheelGeos.push(new T.TubeGeometry(arc,12,.26*s,8,false));
  }
  wheelGeos.push(profile([0,0,-.66*s],[0,0,.94*s],[[1.2,0],[1.45,.23],[1.15,.72],[.8,1]]));
  const wheel=make(wheelGeos,brass,'brass','capstan-handwheel');
  const grip=part(profile([0,-wr*s,0],[0,-wr*s,3.1*s],[[.6,0],[.74,.09],[.5,.23],[.54,.44],[.81,.72],[.72,.92],[.45,1]]),wood,'wood','capstan-grip');
  const input={kind:'phase-dial',label:'转动绞轮套准地图，再逐区清点雨量站',dial:{center:p(capstanX,axleY,wz+2.6),radiusX:wr*s,radiusY:wr*s,turns}};
  for(const m of [wheel,grip]){m.position.set(...p(capstanX,axleY,wz));m.userData.modelInput=input;}
  grip.userData.smallPointTarget=true;
  const capstan=[...pulleys,wheel,grip];

  // Counting beads of adjacent stations stay in the order they were read.
  const banks=GIS_COUNTS.map(({count},i)=>{
    const x=21+29*i,left=x-11.5,z=68;
    const bed=make([box([x-12.1,-.1,63.6],[x-10.9,2.20,z+.64]),box([x+10.9,-.1,63.6],[x+12.1,2.20,z+.64]),shaft([left,1.8,z],[x+11.5,1.8,z],.17)],steel,'steel','counting-wire');
    const span=18.9,step=1.12,gap=span-step*(count-1),start=x-span/2;
    const beads=Array.from({length:count},(_,n)=>{
      const bead=part(turnedSleeveGeometry([-.49*s,0,0],[.49*s,0,0],[[.52*s,0],[.80*s,.2],[.87*s,.5],[.80*s,.8],[.52*s,1]],.19*s),GIS_REGIONS[i].stationColor,'enamel','station-tally-bead');
      bead.userData.modelInput={kind:'inspect',target:'region-'+i,toggleTo:'overview',label:'观察'+(i+1)+'区雨量站'};
      return {bead,rest:start+n*step+gap};
    });
    return {bed,beads,gap,z};
  });
  return (state:GisState)=>{
    for(const cord of cords)cord.scale.y=4.6+travel*state.overlay;
    for(const m of drums)m.rotation.x=(travel/drumRadius)*state.overlay;
    for(const m of capstan)m.rotation.z=2*Math.PI*turns*state.phase;
    const lower=state.layers.regions;
    banks.forEach(({bed,beads,gap,z},i)=>{
      bed.position.set(0,lower.y*s,lower.z*s);
      beads.forEach(({bead,rest},n)=>bead.position.set(...p(rest-(n<state.counts[i].count?gap:0),lower.y+1.8,z+lower.z)));
    });
  };
}
