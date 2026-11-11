import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';

/** One consistent scale-model vocabulary for buildings throughout the book.
 * Windows, roof thickness, eaves and the rainwater downpipe are actual geometry;
 * their small details are batched by substance, rather than outlined boxes. */
export function buildMiniatureHouse(g: TextbookGeometry, at: Vec3, w: number, h: number, color: string) {
  const [x,y,z]=at,d=w*.75,cut=w*.012;
  const limestone:any[]=[],joinery:any[]=[],glazing:any[]=[],roof:any[]=[],metal:any[]=[];
  const box=(list:any[],a:Vec3,b:Vec3,bevel=0)=>list.push(chamferedPlateGeometry(a,b,bevel));
  box(limestone,[x-w*.51,y,z-d*.51],[x+w*.51,y+h*.055,z+d*.51],cut);
  box(limestone,[x-w/2,y+h*.055,z-d/2],[x+w/2,y+h,z+d/2],cut);
  // The two pitched slabs have a closed soffit and a restrained overhang.
  const x0=x-w*.56,x1=x+w*.56,z0=z-d*.58,z1=z+d*.58,ridge=y+h+w*.3;
  const slab=(a:Vec3,b:Vec3,c:Vec3,e:Vec3)=>{
    const points=[a,b,c,e,...[a,b,c,e].map(p=>[p[0],p[1]-w*.026,p[2]] as Vec3)];
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
    geometry.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);
    geometry.computeVertexNormals();roof.push(geometry);
  };
  slab([x0,y+h,z0],[x,ridge,z0],[x,ridge,z1],[x0,y+h,z1]);
  slab([x,ridge,z0],[x1,y+h,z0],[x1,y+h,z1],[x,ridge,z1]);
  // End gables close the triangular space below the roof.
  for(const zz of [z-d*.5,z+d*.5]){
    const triangle=new T.BufferGeometry();triangle.setAttribute('position',new T.Float32BufferAttribute([
      x-w*.5,y+h,zz,x+w*.5,y+h,zz,x,ridge-w*.025,zz],3));triangle.computeVertexNormals();limestone.push(triangle);
  }
  for(let i=0;i<=4;i++){
    const zz=z0+(z1-z0)*i/4;
    for(const xx of [x0,x1])roof.push(turnedShaftGeometry([xx,y+h+w*.018,zz],[x,ridge+w*.018,zz],[[w*.009,0],[w*.009,1]]));
  }
  roof.push(turnedShaftGeometry([x,ridge,z0],[x,ridge,z1],[[w*.022,0],[w*.022,1]]));
  // A central door and two clearly framed panes; no illegible tiny signage.
  const front=z+d/2;
  box(joinery,[x-w*.085,y+h*.055,front],[x+w*.085,y+h*.51,front+cut*1.7],cut*.2);
  box(limestone,[x-w*.115,y,front],[x+w*.115,y+h*.045,front+w*.065],cut*.3);
  for(const wx of [x-w*.31,x+w*.31]){
    box(glazing,[wx-w*.075,y+h*.38,front+cut*.3],[wx+w*.075,y+h*.7,front+cut*.5]);
    for(const sx of [-1,1])box(limestone,[wx+sx*w*.075-cut*.5,y+h*.36,front],[wx+sx*w*.075+cut*.5,y+h*.72,front+cut]);
    for(const yy of [.36,.54,.72])box(limestone,[wx-w*.085,y+h*yy,front],[wx+w*.085,y+h*yy+cut*.65,front+cut]);
    box(limestone,[wx-w*.095,y+h*.35,front],[wx+w*.095,y+h*.37,front+w*.032],cut*.2);
  }
  const drainX=x+w*.49,drainZ=z+d*.55;
  metal.push(turnedShaftGeometry([drainX,y+h*.1,drainZ],[drainX,y+h*.99,drainZ],[[w*.012,0],[w*.012,1]]));
  metal.push(turnedShaftGeometry([x1,y+h,z0],[x1,y+h,z1],[[w*.017,0],[w*.017,1]]));
  for(const yy of [.2,.7])box(metal,[drainX-w*.025,y+h*yy,drainZ-w*.018],[drainX+w*.025,y+h*yy+w*.012,drainZ+w*.018]);
  for(const [parts,tint,role] of [[limestone,color,'ivory'],[joinery,'#675a43','wood'],[glazing,'#415b60','steel'],[roof,'#596e69','rock'],[metal,'#6e7770','steel']] as const){
    const mesh=g.mesh(mergeInstrumentGeometry(parts as any[]),tint,false,true,role);
    mesh.userData.miniatureArchitecture=role;
  }
}
