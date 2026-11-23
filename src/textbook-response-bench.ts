import {createInstrumentParts} from './textbook-instrument-parts';
import type {TextbookGeometry,Vec3} from './textbook-geometry';
import type {IntegratedPoint} from './textbook-integrated-model';

// Tabletop positions of the symbolic satellite heads are schematic. The
// instrument moves signal beads between these actual heads and the receiver.
export const observerHeads:IntegratedPoint[]=[[33,23.9,6.3],[53,26.15,4.2],[73,26.15,4.2],[94,23.9,6.3]];
export const opticalHead:IntegratedPoint=[10.1,23.6,8.3];

export function mountResponseBench(b:TextbookGeometry,s:number,p:(q:IntegratedPoint)=>Vec3){
  const parts=createInstrumentParts(b),v=(x:number,y:number,z:number)=>p([x,y,z]);
  parts.plate(v(.5,-5.4,.3),v(109.4,-3.85,74.8),'wood',.55*s);
  parts.plate(v(.95,-3.86,.75),v(109.0,-3.48,74.4),'brass',.13*s);
  parts.plate(v(1.7,-3.5,1.3),v(108.3,-2.78,73.8),'wood',.27*s);
  for(const x of [5,105])for(const z of [4.0,69.7]){
    parts.column(v(x,-6.5,z),v(x,-5.3,z),1.26*s,'brass');
  }
  for(const x of [3.6,105.8]){
    parts.plate(v(x-1.45,-2.9,1.2),v(x+1.45,-1.95,4.0),'steel',.16*s);
    parts.column(v(x,-1.96,2.6),v(x,16.9,2.6),.63*s,'brass');
    parts.bearing(v(x,16.57,2.6),[1,0,0],1.12*s,1.42*s);
  }
  // Rigid survey bridge: short individual arms keep the five small models
  // clear of the landscape and show where each signal originates.
  parts.shaft(v(3.3,16.57,2.6),v(106.1,16.57,2.6),.58*s,'brass');
  for(const [x,y,z] of [opticalHead,...observerHeads]){
    parts.bearing(v(x,16.57,2.6),[1,0,0],.83*s,1.4*s);
    parts.shaft(v(x,16.57,2.6),v(x,y,2.6),.34*s,'steel');
    parts.shaft(v(x,y,2.6),v(x,y,z),.29*s,'brass');
  }
  // A stable working shelf seats the phase rail in the same plinth.
  parts.plate(v(8.6,-2.82,69),v(98,-2.15,73.6),'wood',.24*s);
}