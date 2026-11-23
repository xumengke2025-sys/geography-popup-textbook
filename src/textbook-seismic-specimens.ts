import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry,mergeInstrumentGeometry,turnedShaftGeometry } from './textbook-instrument-parts';

/** Reference specimens in matching sockets under each medium. The sealed
 * fluid keeps a concave meniscus and stays still as the wave train moves. */
export function seismicSpecimens(b:TextbookGeometry,s:number,p:(x:number,y:number,z?:number)=>Vec3,input:object){
  const at=(m:any,x:number,y:number,z:number,name:string)=>{m.position.set(...p(x,y,z));m.name=name;return m;};
  const bases=[];const feet=[];
  for(const x of [30,68]){
    bases.push(chamferedPlateGeometry(p(x-5,.15,-5.9),p(x+5,1.22,8.5),.38*s));
    feet.push(turnedShaftGeometry(p(x,1.18,2.1),p(x,1.92,2.1),[[3.74*s,0],[4.05*s,.18],[3.9*s,.61],[3.54*s,1]]));
  }
  b.mesh(mergeInstrumentGeometry(bases),'#6d4a32',false,true,'wood').name='specimen-supports';
  b.mesh(mergeInstrumentGeometry(feet),'#a18451',false,true,'brass').name='turned-specimen-sockets';
  const material=applyEarthScan(b.materialFor('rock','#857b69'),'outcrop',4.5*s);
  const rocks=[30,68].map(x=>{
    // A chisel-fractured plug, with independent top and lower fracture rims.
    const shape=new T.CylinderGeometry(1,1,1,13,2, false);
    const pos=shape.attributes.position;
    for(let i=0;i<pos.count;i++){
      const vx=pos.getX(i),vy=pos.getY(i),vz=pos.getZ(i),a=Math.atan2(vz,vx),rim=Math.hypot(vx,vz);
      const r=1+.14*Math.sin(3*a+.4)+.09*Math.sin(5*a-.6)+.05*Math.cos(2*a+vy*2);
      pos.setXYZ(i,(vx*3.05*r+vy*.55)*s,((vy+.5)*(4.65+rim*(.94*vx-.65*vz+.32*Math.sin(a*4))))*s,vz*2.58*r*s);
    }
    const raw=shape.toNonIndexed();raw.computeVertexNormals();shape.dispose();
    const m=at(b.mesh(raw,'#857b69',false,true,'rock'),x,1.92,2.1,'fractured-rock-specimen');m.material=material;return m;
  });
  const rev=(path:number[][])=>new T.LatheGeometry(path.map(([r,y])=>new T.Vector2(r*s,y*s)),48);
  const glass=at(b.mesh(rev([[0,0],[2.66,0],[2.84,.32],[2.86,4.78],[2.79,5.18],[2.48,5.56],[1.12,6.0],[.94,6.26],[.94,7.14],[1.16,7.22],[1.18,7.48],[.85,7.51],[.75,7.28],[.76,6.28],[1.02,6.10],[2.36,5.45],[2.62,5.06],[2.64,.52],[2.50,.33],[0,.33]]),'#c1d9d1',false,true,'water'),68,1.92,2.1,'blown-liquid-specimen-flask');
  glass.material=b.materialFor('water','#e0efdf');glass.material.transparent=true;glass.material.opacity=.18;glass.material.depthWrite=false;glass.material.roughness=.12;glass.renderOrder=3;
  const liquid=at(b.mesh(rev([[0,.35],[2.48,.35],[2.62,.54],[2.63,4.20],[2.56,4.08],[2.40,4.02],[0,4.02]]),'#739d93',false,true,'water'),68,1.92,2.1,'specimen-water-meniscus');
  liquid.material.opacity=.77;liquid.material.transparent=true;liquid.material.depthWrite=false;liquid.material.roughness=.16;liquid.renderOrder=2;
  const stopper=at(b.mesh(rev([[0,6.9],[.75,6.9],[.91,7.49],[1.04,7.56],[1.06,8.12],[.92,8.21],[0,8.21]]),'#856547',false,true,'wood'),68,1.92,2.1,'turned-flask-stopper');
  const right=[glass,liquid,stopper];for(const m of [...right,rocks[1]])m.userData.modelInput=input;
  return (inLiquid:boolean)=>{rocks[1].visible=!inLiquid;right.forEach(m=>m.visible=inLiquid);};
}
