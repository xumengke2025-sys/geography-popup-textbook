import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry } from './textbook-instrument-parts';

/** A cutaway soil cassette, not an imaginary machine driving the rainfall.
 * Its rim, corner clamps and drain supports explain how the specimen is held.
 * All added parts stay clear of the finite water-marker paths at z >= 57. */
export function buildUrbanSpecimen(g:TextbookGeometry,p:(at:Vec3)=>Vec3,s:number) {
  const steel:any[]=[],brass:any[]=[],stone:any[]=[];
  const box=(list:any[],a:Vec3,b:Vec3,edge=.06)=>list.push(chamferedPlateGeometry(p(a),p(b),edge*s));
  const add=(items:any[],color:string,role:'steel'|'brass'|'ivory'|'wood',name:string)=>{
    const mesh=g.mesh(mergeInstrumentGeometry(items),color,false,true,role);
    mesh.userData.urbanRole=name;mesh.userData.instrumentPart=name;return mesh;
  };
  box(steel,[5.3,-.7,13.3],[92.7,0,64.4],.18);
  // Deep-green recessed tray; brass is confined to its machined datum edge.
  for(const x of [5.3,92.2]){
    box(steel,[x,0,13.3],[x+.5,20.9,51.4],.12);
    box(brass,[x-.03,20.9,13.25],[x+.55,21.12,51.5],.05);
  }
  for(const z of [13.3,51.1])box(brass,[5.3,20.86,z],[92.7,21.1,z+.35],.06);
  for(const x of [5.5,91.25])for(const z of [13.5,49.9]){
    box(steel,[x,20.75,z],[x+1.25,21.4,z+1.7],.1);
    box(brass,[x+.25,21.4,z+.25],[x+1,21.58,z+1.45],.04);
  }
  // Rear footpaths and street edge stay behind the observation cross-section.
  for(const x of [8,67])box(stone,[x,20.8,15.2],[x+23,20.94,35],.03);
  for(const z of [15.25,35.1])box(stone,[7,20.84,z],[91,21.1,z+.38],.025);
  // Small bolted straps and saddles frame the open hydraulic channel.
  for(const x of [62,77,92]){
    box(steel,[x-.8,0,56.3],[x+.8,4.45,60.25],.12);
    box(brass,[x-1.1,0,56.1],[x+1.1,.4,60.45],.08);
  }
  add(steel,'#394b48','steel','specimen-frame');add(brass,'#a88b50','brass','specimen-rim-and-clamps');
  add(stone,'#e3ddc9','ivory','miniature-footpaths');
  const parts=createInstrumentParts(g);
  // Comparative scale only: no invented hydrological units or measurements.
  parts.etchedScale(p([93.1,1.4,51.45]),p([93.1,20.1,51.45]),{width:1.25*s,ticks:21,majorEvery:5,thickness:.1*s});
  parts.fasteners([p([6.1,21.6,14.3]),p([92,21.6,14.3]),p([6.1,21.6,50.6]),p([92,21.6,50.6])],[0,1,0],.22*s);
}
