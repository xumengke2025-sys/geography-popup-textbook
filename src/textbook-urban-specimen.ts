import { THREE as T } from './reference/engine.js';
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
  // The sloping keyboard shares a walnut cabinet with the hydraulic tray.
  const profile = [[13,-.86],[62.1,-.86],[66.3,-3.75],[68.25,-11.1],[73.7,-18.8],[74.1,-23.15],[13,-23.15]];
  const verts = [5.7,92.35].flatMap(x=>profile.flatMap(([z,y])=>p([x,y,z])));
  const triangles:number[] = [], n=profile.length;
  // End grain caps and the seven long boards have crisp mitred normals.
  const ends=T.ShapeUtils.triangulateShape(profile.map(([z,y])=>new T.Vector2(z,y)),[]);
  for(const [a,b,c] of ends) triangles.push(a,b,c,n+a,n+c,n+b);
  for(let i=0;i<n;i++){const j=(i+1)%n;triangles.push(i,j,n+i,j,n+j,n+i);}
  const cabinet=new T.BufferGeometry();cabinet.setAttribute('position',new T.Float32BufferAttribute(verts,3));cabinet.setIndex(triangles);
  const flat=cabinet.toNonIndexed();cabinet.dispose();flat.computeVertexNormals();
  const wood=g.mesh(flat,'#60442e',false,true,'wood');wood.userData.urbanRole='walnut-test-cabinet';
  box(brass,[5.5,-22.96,12.8],[92.6,-22.62,73.96],.09);
  box(steel,[5.18,-23.65,12.5],[92.93,-23.0,74.12],.17);
  // Two side cheeks carry the sloping keyboard below the open drain.
  box(steel,[7.7,-23.6,74.1],[92.3,-22.92,78.4],.18);
  for(const x of [7.5,91.9]){
    box(steel,[x,-23.5,74.2],[x+.76,-.37,75.2],.13);
    box(steel,[x,-.8,62.2],[x+.76,-.22,75.2],.06);
  }
  box(steel,[7.65,-8.87,66.35],[92.23,-7.87,70.58],.15);
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
  for(const [a,b] of [[7,34.5],[65,91]])for(const z of [15.25,35.1])
    box(stone,[a,20.84,z],[b,21.18,z+.64],.04);
  for(const [a,b] of [[7,34.5],[65,91]])for(let x=a;x<b;x+=3.12)
    box(stone,[x,20.82,35.78],[Math.min(x+3,b),21.14,36.65],.05);
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
