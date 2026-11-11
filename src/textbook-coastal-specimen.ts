import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { createInstrumentParts, mergeInstrumentGeometry } from './textbook-instrument-parts';

/** One fitted coastal specimen, not a landscape placed on an unrelated stand.
 * All elevations, contours, cliff faces and house foundations share this field. */
export function buildCoastalSpecimen(b: TextbookGeometry, s: number, back: number) {
  const at = (x:number,z:number,y=0):Vec3 => [x*s,y*s,back+z*s];
  const parts=createInstrumentParts(b);
  const coast=(z:number)=>49+3.4*Math.sin(z/63*Math.PI*1.3)+1.4*Math.sin(z/63*Math.PI*2.7);
  const ground=(x:number,z:number)=>{
    const inland=Math.max(0,1-x/coast(z));
    const ridge=18*Math.exp(-((x-12-z*.16)**2/125+(z-14)**2/300));
    const shoulder=9*Math.exp(-((x-28)**2/90+(z-25)**2/185));
    return 3.2+inland*(1.4+ridge+shoulder);
  };
  // Walnut edge, a fine brass rebate, and one fitted enamel specimen tray.
  // All three share the same bounds; there are no stacked unrelated plinths.
  parts.plate(at(-1.8,-1.8,-5.7),at(101.8,73,-2.1),'wood',.55*s);
  parts.plate(at(-1.35,-1.35,-2.1),at(101.35,72.55,-1.72),'brass',.12*s);
  const tray=parts.plate(at(-.9,-.9,-1.72),at(100.9,72.1,-.7),'steel',.25*s);
  tray.material=b.materialFor('enamel','#293c37');tray.userData.materialRole='enamel';
  for(const x of [1,99])for(const z of [1,70])
    parts.bearing(at(x,z,-6.3),[0,1,0],1.5*s,1.2*s);
  parts.fasteners([at(1,70.4,-.64),at(99,70.4,-.64),at(1,.1,-.64),at(99,.1,-.64)],[0,1,0],.5*s);
  const shore=Array.from({length:65},(_,i):[number,number]=>[coast(i/64*63)*s,back+i/64*63*s]);
  const land:[number,number][]=[[0,back+63*s],[0,back],...shore];
  b.prism(land,-.65*s,.6*s,'#766854',false);
  b.prism(land,.6*s,1.3*s,'#ab9472',false);
  b.prism(land,1.3*s,2.9*s,'#c8b591',false);
  const sea=b.prism([...shore,[100*s,back+63*s],[100*s,back]],-.65*s,1.8*s,'#426e75',false);
  sea.name='coastal-inlaid-sea';
  sea.material=b.materialFor('water','#426e75');
  // Surface and cut face use separate vertices, preserving a clean machined
  // specimen edge instead of rounding their normals into a pillow.
  const nx=64,nz=48,vs:number[]=[],colors:number[]=[],ix:number[]=[];
  const low=new T.Color('#9eaf94'),high=new T.Color('#b6b39a');
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const z=j/nz*63,x=i/nx*coast(z),y=ground(x,z);vs.push(...at(x,z,y));
    const c=low.clone().lerp(high,Math.min(1,(y-3.2)/20));
    colors.push(c.r,c.g,c.b);
    if(i<nx&&j<nz){const k=j*(nx+1)+i;ix.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2)}
  }
  const surface=new T.BufferGeometry();surface.setAttribute('position',new T.Float32BufferAttribute(vs,3));
  surface.setAttribute('color',new T.Float32BufferAttribute(colors,3));surface.setIndex(ix);surface.computeVertexNormals();
  const terrain=b.mesh(surface,'#ffffff',false,true,'land');
  terrain.material=b.materialFor('land','#feffff');terrain.material.vertexColors=true;
  terrain.name='coastal-sculpted-relief';
  const edge:Vec3[]=[];
  for(let i=0;i<=nx;i++){const x=i/nx*coast(0);edge.push(at(x,0,ground(x,0)))}
  for(let j=1;j<=nz;j++){const z=j/nz*63;edge.push(at(coast(z),z,3.2))}
  for(let i=nx-1;i>=0;i--){const x=i/nx*coast(63);edge.push(at(x,63,ground(x,63)))}
  for(let j=nz-1;j>0;j--){const z=j/nz*63;edge.push(at(0,z,ground(0,z)))}
  const sideV:number[]=[],sideI:number[]=[];
  for(let i=0;i<edge.length;i++){
    const a=edge[i],c=edge[(i+1)%edge.length],k=sideV.length/3;
    sideV.push(...a,...c,c[0],2.9*s,c[2],a[0],2.9*s,a[2]);sideI.push(k,k+1,k+2,k,k+2,k+3);
  }
  const sides=new T.BufferGeometry();sides.setAttribute('position',new T.Float32BufferAttribute(sideV,3));
  sides.setIndex(sideI);sides.computeVertexNormals();b.mesh(sides,'#c4b494',false,true,'rock');
  // Actual equal-height intersections, rather than arbitrary strokes draped
  // over hills. They read as fine relief-map engraving, with no false units.
  const contourSegments:any[]=[];
  const crossing=(a:Vec3,c:Vec3,y:number):Vec3|null=>{
    if((a[1]<y)===(c[1]<y)||a[1]===c[1])return null;
    const t=(y-a[1])/(c[1]-a[1]);return[a[0]+(c[0]-a[0])*t,y+.035*s,a[2]+(c[2]-a[2])*t];
  };
  for(const height of [6,10,14,18])for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const ids=[j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i];
    const points=ids.map(k=>[vs[k*3],vs[k*3+1],vs[k*3+2]] as Vec3),hits:Vec3[]=[];
    for(let k=0;k<4;k++){const p=crossing(points[k],points[(k+1)%4],height*s);if(p)hits.push(p)}
    if(hits.length===2){
      const from=new T.Vector3(...hits[0]),to=new T.Vector3(...hits[1]),axis=to.clone().sub(from);
      if(axis.length()>1e-5){const g=new T.CylinderGeometry(.035*s,.035*s,axis.length(),4);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));
        g.translate(...from.add(to).multiplyScalar(.5).toArray());contourSegments.push(g)}
    }
  }
  if(contourSegments.length)b.mesh(mergeInstrumentGeometry(contourSegments),'#78846f',false,false,'land');
  const sandV:number[]=[],sandI:number[]=[];
  for(let j=0;j<=64;j++){
    const z=j/64*63,x=coast(z);sandV.push(...at(x-.35,z,3.23),...at(x+2,z,1.84));
    if(j<64){const k=j*2;sandI.push(k,k+1,k+2,k+1,k+3,k+2)}
  }
  const sand=new T.BufferGeometry();sand.setAttribute('position',new T.Float32BufferAttribute(sandV,3));
  sand.setIndex(sandI);sand.computeVertexNormals();b.mesh(sand,'#d9caaa',false,false,'land');
  // A few shallow water lines preserve the cartographic reading. Avoid the
  // old regular grid of decorative waves across the whole water surface.
  for(const offset of [4,10,19])b.stroke(Array.from({length:49},(_,i)=>{
    const z=2+i/48*59;return at(coast(z)+offset,z,1.85);
  }),.15);
  return {at,coast,ground,terrain,sea};
}
