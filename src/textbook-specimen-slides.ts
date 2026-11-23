import { createInstrumentParts } from './textbook-instrument-parts';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';

export type SpecimenPoint=(x:number,y:number,z:number)=>Vec3;

/** A brass reader runs on two guide rods. The projections stay in the
 * specimen's own coordinates even when its book-page frame is tilted. */
export function mountReadingSlide(b:TextbookGeometry,p:SpecimenPoint,s:number,x0:number,x1:number,y:number,z:number,label:string){
  const hw=createInstrumentParts(b);
  hw.casting(p(x0-2.6,y-2.5,z-2.6),p(x1+2.6,y-1.45,z+2.6),'wood',s*.32);
  for(const x of [x0-1.7,x1+1.7]) hw.casting(p(x-.68,y-1.6,z-2.3),p(x+.68,y+.85,z+2.3),'brass',s*.22);
  for(const dz of [-1.15,1.15])hw.shaft(p(x0-1.7,y,z+dz),p(x1+1.7,y,z+dz),.29*s,'steel');
  const sled=hw.plate(p(x0-1.5,y-.35,z-1.86),p(x0+1.5,y+.7,z+1.86),'brass',s*.20);
  const knob=hw.knob(p(x0,y+1.35,z),[0,1,0],1.48*s,1.35*s);
  const track={start:p(x0,y+1.45,z),end:p(x1,y+1.45,z)}, input={kind:'phase-track',track,label};
  const parts=[sled,...knob.children];
  for(const mesh of parts){mesh.userData.modelInput=input;mesh.userData.observationKnob=true;mesh.userData.smallPointTarget=true;}
  return {track,move(phase:number){const travel=(x1-x0)*s*phase;sled.position.x=knob.position.x=travel;}};
}

/** A front-facing keyed specimen tray changes an independent trial without
 * resetting the reading on the comparison instrument. */
export function mountSpecimenKeys(b:TextbookGeometry,p:SpecimenPoint,s:number,centres:number[],names:string[],y:number,z:number,width:number){
  const hw=createInstrumentParts(b);
  const keys=centres.map((x,i)=>{
    const w=width/2;
    hw.plate(p(x-w-.25,y-1.5,z-2),p(x+w+.25,y+4.3,z),'brass',.24*s);
    const cap=hw.plate(p(x-w,y-1.2,z),p(x+w,y+4,z+.58),'ivory',.16*s);
    const ink=b.label(names[i],p(x,y+1.45,z+.62),width*.97*s,5.0*s,{appearance:'engraved'});
    ink.userData.labelMount='surface';
    const input={kind:'select',selection:i,keepPhase:true,label:'装入'+names[i]+'标本'};
    for(const m of [cap,ink]){m.userData.modelInput=input;m.userData.smallPointTarget=true;m.userData.specimenKey=i;}
    return {cap,ink,at:ink.position.z};
  });
  return (selected:number)=>keys.forEach(({cap,ink,at},i)=>{cap.position.z=i===selected?-.29*s:0;ink.position.z=at+cap.position.z;});
}
