import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { InstrumentMaterialRole, InstrumentProfile } from './textbook-instrument-profiles';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';

export interface InstrumentAssembly {
  setReveal(progress: number): void;
  dispose(): void;
  readonly diagnostics: {
    family: string; strategy: string; parts: number; progress: number; rigid: true;
    touchesScientificTransforms: false; footprintCount: number; reason: string;
    /** Coordinates are local to the existing natural-model root. */
    attachmentBounds: { min: Vec3; max: Vec3 }[];
    extent: { min: Vec3; max: Vec3 } | null;
    materialRoles: string[];
  };
}
type Footprint = { min: Vec3; max: Vec3 };
type Part = { mesh: any; pivot: any; anchor: any; offset: any; axis: 'x'|'z'; angle: number; start: number };
const palette: Record<InstrumentMaterialRole,string> = {brass:'#a88b50',wood:'#544534',steel:'#424b4b',ivory:'#e3ddc9'};
const clamp = (x: number) => Number.isFinite(x) ? Math.max(0,Math.min(1,x)) : 0;
const ease = (x: number) => {const t=clamp(x);return t*t*t*(t*(t*6-15)+10)};
const area = (b: any) => Math.max(0,b.max.x-b.min.x)*Math.max(0,b.max.z-b.min.z);
const serialize = (b: any): Footprint => ({min:b.min.toArray() as Vec3,max:b.max.toArray() as Vec3});

/** Use the actual structural underside, not the camera bounds (which include
 * air, labels and future process paths). Nothing is added above this plane. */
function structuralFootprints(g: TextbookGeometry, profile: InstrumentProfile) {
  g.root.updateWorldMatrix(true,true);
  const inverse=g.root.matrixWorld.clone().invert(), candidates:any[]=[];
  for(const mesh of g.meshes){
    if(mesh.userData.kind==='text-label'||mesh.userData.instrumentAssembly||mesh.userData.instrumentPart||!mesh.geometry)continue;
    let visible=true;
    for(let node=mesh;node&&node!==g.root;node=node.parent)if(!node.visible){visible=false;break}
    if(!visible)continue;
    // Unfilled line meshes, transient droplets and narrow handles must not
    // become imaginary foundations for the rest of a scene.
    mesh.geometry.computeBoundingBox();const source=mesh.geometry.boundingBox;
    if(!source||source.isEmpty())continue;
    const box=source.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))continue;
    if(area(box)>Math.pow(g.width*.025,2))candidates.push(box);
  }
  if(!candidates.length)return [];
  const widest=Math.max(...candidates.map(area)), broad=candidates.filter(b=>area(b)>=widest*.18);
  const bottom=Math.min(...broad.map(b=>b.min.y)), s=g.width/100;
  const low=broad.filter(b=>b.min.y<=bottom+Math.max(.8*s,(b.max.y-b.min.y)*.025));
  if(!low.length)return [];
  const dominant=low.reduce((a,b)=>area(a)>=area(b)?a:b);
  if(profile.family!=='strata'&&profile.family!=='column')return [dominant];
  // Separate columns get separate tiny feet. Never bridge their pull-out
  // lanes with a fabricated common display platform.
  const groups:any[]=[];
  for(const box of [...low].sort((a,b)=>a.min.x-b.min.x)){
    const same=groups.find(b=>Math.min(b.max.x,box.max.x)-Math.max(b.min.x,box.min.x)>s*.5
      &&Math.min(b.max.z,box.max.z)-Math.max(b.min.z,box.min.z)>s*.5);
    if(same)same.union(box);else groups.push(box.clone());
  }
  return groups.sort((a,b)=>area(b)-area(a)).slice(0,4);
}

/** Shared construction vocabulary only. It does not replace the individual
 * chapter's art direction or touch its scientific mesh transformations.
 * Call after the natural model's initial update and before geometry.finish(). */
export function createInstrumentAssembly(g: TextbookGeometry, profile: InstrumentProfile): InstrumentAssembly {
  const group=new T.Group();group.name=`instrument-assembly:${profile.id}`;group.userData.instrumentAssembly=true;
  g.root.add(group);
  const parts:Part[]=[],owned:any[]=[],bounds=new T.Box3(),roles=new Set<string>();
  const boxes=profile.support.strategy==='none'?[]:structuralFootprints(g,profile);
  const s=Math.max(.15,g.width/100);let progress=1,disposed=false,datumPlaced=false;
  const add=(geometry:any,role:InstrumentMaterialRole,name:string,anchor:Vec3,axis:'x'|'z'='x',angle=.2,start=0)=>{
    const mesh=g.mesh(geometry,palette[role],false,true,role);
    mesh.name=name;mesh.userData.instrumentAssembly=true;mesh.userData.materialRole=role;
    mesh.userData.instrumentRole=name;mesh.userData.interactionFeedback=false;
    const pivot=new T.Group();pivot.name=`hinge:${name}`;pivot.add(mesh);group.add(pivot);
    geometry.computeBoundingBox();const extent=geometry.boundingBox;
    const lever=axis==='x'?Math.max(Math.abs(extent.min.z-anchor[2]),Math.abs(extent.max.z-anchor[2]))
      :Math.max(Math.abs(extent.min.x-anchor[0]),Math.abs(extent.max.x-anchor[0]));
    const height=Math.max(Math.abs(extent.min.y-anchor[1]),Math.abs(extent.max.y-anchor[1]));
    // Long skids need a longer opening offset than tiny clips. This analytic
    // upper bound keeps even their rotating tip below the attachment plane
    // throughout the reveal, instead of sweeping through the natural model.
    const drop=1.5*s+lever*Math.abs(angle)+height*angle*angle*.5;
    const part:Part={mesh,pivot,anchor:new T.Vector3(...anchor),offset:new T.Vector3(0,-drop,0),axis,angle,start};
    parts.push(part);owned.push(mesh);roles.add(role);bounds.union(extent);
    return mesh;
  };
  const box=(a:Vec3,b:Vec3,role:InstrumentMaterialRole,name:string,anchor:Vec3,axis:'x'|'z'='x',angle=.2,start=0)=>{
    return add(chamferedPlateGeometry(a,b,Math.min(.15*s,(b[1]-a[1])*.12)),role,name,anchor,axis,angle,start);
  };
  const rod=(a:Vec3,b:Vec3,r:number,role:InstrumentMaterialRole,name:string,start=0)=>{
    const geom=turnedShaftGeometry(a,b,[[r*.87,0],[r,.08],[r,.92],[r*.87,1]]);
    return add(geom,role,name,a,'z',.24,start);
  };
  const shoe=(x:number,z:number,y:number,w:number,d:number,name:string,clip=false)=>{
    const anchor:Vec3=[x,y-2*s,z];
    // A shoe is one assembled object during formation; the layers do not
    // shear apart while its screws purport to hold them together.
    box([x-w/2,y-3*s,z-d/2],[x+w/2,y-1.3*s,z+d/2],'wood',`${name}:foot`,anchor,'x',.22,.08);
    const seats=[chamferedPlateGeometry([x-w*.42,y-1.3*s,z-d*.42],[x+w*.42,y-.35*s,z+d*.42],.09*s)];
    const caps=[chamferedPlateGeometry([x-w*.38,y-.35*s,z-d*.38],[x+w*.38,y,z+d*.38],.04*s)];
    // Flush side fasteners at the cap/seat joint. Head and slot geometries
    // are batched into the existing brass and steel meshes: no extra draw.
    const r=Math.min(.2*s,w*.06,d*.06),front=z+d*.42;
    for(const sx of [x-w*.27,x+w*.27]){
      caps.push(turnedShaftGeometry([sx,y-.76*s,front-r*.05],[sx,y-.76*s,front+r*.12],[[r*.85,0],[r,.25],[r,.75],[r*.85,1]]));
      seats.push(chamferedPlateGeometry([sx-r*.58,y-.76*s-r*.075,front+r*.121],
        [sx+r*.58,y-.76*s+r*.075,front+r*.135],0));
    }
    add(mergeInstrumentGeometry(seats),'steel',`${name}:seat`,anchor,'x',.22,.08);
    add(mergeInstrumentGeometry(caps),'brass',`${name}:cap`,anchor,'x',.22,.08);
    if(clip)box([x-w*.24,y-.08*s,z-d*.28],[x+w*.24,y,z+d*.28],'ivory',`${name}:lining`,anchor,'x',.22,.08);
    if(profile.support.tickMarks&&!datumPlaced&&w>4*s){
      datumPlaced=true;const length=w*.45,baseline=y-1.13*s,face=front+.04*s;
      box([x-length/2,baseline,face-.04*s],[x+length/2,baseline+.54*s,face],'ivory',`${name}:datum`,anchor,'x',.22,.08);
      const marks:any[]=[];
      for(let tick=0;tick<7;tick++){
        const tx=x-length*.43+tick*length*.86/6;
        marks.push(chamferedPlateGeometry([tx-.022*s,baseline+.05*s,face+.001*s],
          [tx+.022*s,baseline+(tick%3===0?.43:.27)*s,face+.015*s],0));
      }
      add(mergeInstrumentGeometry(marks),'steel',`${name}:datum-marks`,anchor,'x',.22,.08);
    }
  };
  for(const [i,b] of boxes.entries()){
    const x0=b.min.x,x1=b.max.x,z0=b.min.z,z1=b.max.z,y=b.min.y;
    const w=x1-x0,d=z1-z0,cx=(x0+x1)/2,cz=(z0+z1)/2;
    switch(profile.support.strategy){
      case 'bearing':{
        // Only a lower pole/axis foot; no meridian cage around an extracting
        // sphere and no frame crossing the planet's orbital path.
        const rw=Math.min(w*.34,10*s),rd=Math.min(d*.34,8*s);
        shoe(cx,cz,y,rw,rd,`axis-${i}`);
        const r=Math.min(rw,rd)*.19;
        add(turnedShaftGeometry([cx,y-1.1*s,cz],[cx,y-.05*s,cz],[[r,0],[r,.12],[r*.7,.24],
          [r*.7,.72],[r,.84],[r,1]]),'brass',`axis-${i}:collar`,[cx,y-1.1*s,cz],'z',.24,.13);
        break;
      }
      case 'paired-skids':{
        const sw=Math.min(w*.13,4*s),sd=Math.min(d*.9,36*s);
        for(const [j,x] of [cx-w*.3,cx+w*.3].entries())shoe(x,cz,y,sw,sd,`skid-${i}-${j}`);
        break;
      }
      case 'section-feet':{
        const footW=Math.min(w*.19,10*s),footD=Math.min(d*.78,6*s);
        for(const [j,x] of [x0+w*.2,x1-w*.2].entries()){
          shoe(x,cz,y,footW,footD,`section-${i}-${j}`);
          rod([x-footW*.35,y-.7*s,cz],[x+footW*.35,y-.7*s,cz],.38*s,'brass',`section-${i}-${j}:hinge`,.1);
        }
        break;
      }
      case 'corner-shoes':{
        const sw=Math.min(w*.15,8*s),sd=Math.min(d*.16,7*s);
        for(const [j,[x,z]] of [[x0+sw*.55,z0+sd*.55],[x1-sw*.55,z0+sd*.55],[x0+sw*.55,z1-sd*.55],[x1-sw*.55,z1-sd*.55]].entries())
          shoe(x,z,y,sw,sd,`corner-${i}-${j}`);
        break;
      }
      case 'specimen-clips':{
        const sw=Math.min(w*.27,7*s),sd=Math.min(d*.8,6*s);
        for(const [j,x] of [x0+w*.24,x1-w*.24].entries())shoe(x,cz,y,sw,sd,`specimen-${i}-${j}`,true);
        break;
      }
      case 'map-pins':{
        for(const [j,x] of [x0+w*.13,x1-w*.13].entries()){
          const z=z0+d*.17,r=Math.max(.3*s,Math.min(w,d)*.023);
          // A locating shoulder terminates underneath the bottom sheet. It
          // never rises through an animated upper map or becomes a fake
          // vertical guide rod the existing science does not follow.
          box([x-2*r,y-2.1*s,z-2*r],[x+2*r,y-1*s,z+2*r],'wood',`map-${i}-${j}:block`,[x,y-1*s,z]);
          rod([x,y-1*s,z],[x,y-.2*s,z],r,'steel',`map-${i}-${j}:pin`,.08);
          rod([x,y-.2*s,z],[x,y,z],r*1.6,'brass',`map-${i}-${j}:shoulder`,.16);
        }
        break;
      }
    }
  }
  const setReveal=(value:number)=>{
    if(disposed)return;progress=clamp(value);group.visible=progress>0;
    for(const part of parts){
      const t=ease((progress-part.start)/(1-part.start));
      part.pivot.rotation.set(0,0,0);part.pivot.rotation[part.axis]=part.angle*(1-t);
      // Geometry remains in its final local coordinates at every stage. A
      // pivot rotation is compensated around its true mounting point; mesh
      // scale and all scientific children remain untouched.
      const rotated=part.anchor.clone().applyEuler(part.pivot.rotation);
      part.pivot.position.copy(part.anchor).sub(rotated).addScaledVector(part.offset,1-t);
      part.pivot.scale.set(1,1,1);part.mesh.scale.set(1,1,1);
    }
  };
  setReveal(1);
  return {
    setReveal,
    get diagnostics(){return {family:profile.family,strategy:profile.support.strategy,parts:parts.length,progress,rigid:true as const,
      touchesScientificTransforms:false as const,footprintCount:boxes.length,reason:profile.support.strategy==='none'?'no-safe-physical-support':boxes.length?'structural-underside':'no-reliable-structural-footprint',
      attachmentBounds:boxes.map(serialize),extent:bounds.isEmpty()?null:serialize(bounds),materialRoles:[...roles]}},
    dispose(){
      if(disposed)return;disposed=true;group.removeFromParent();
      for(const mesh of owned){
        mesh.geometry.dispose();const index=g.meshes.indexOf(mesh);if(index>=0){g.meshes.splice(index,1);g.volumeCount=Math.max(0,g.volumeCount-1)}
        const surfaces=g.pop.surfaces;if(Array.isArray(surfaces)){const at=surfaces.indexOf(mesh);if(at>=0)surfaces.splice(at,1)}
      }
      group.clear();parts.length=0;owned.length=0;
    },
  };
}
