import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { InstrumentMaterialRole } from './textbook-instrument-profiles';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const INSTRUMENT_PART_COLORS: Record<InstrumentMaterialRole,string> = {
  brass:'#a88b50', steel:'#929b98', wood:'#544534', ivory:'#e3ddc9',
};
const vec=(p:Vec3)=>new T.Vector3(...p);
const center=(a:Vec3,b:Vec3)=>vec(a).add(vec(b)).multiplyScalar(.5);

/** Foundry body and machined plate have different silhouettes. A casting has
 * continuous shoulders, while the existing plate retains its cut chamfer.
 * Both stay inside their given envelope, so fitted joints keep their datum. */
export function castBodyGeometry(a:Vec3,b:Vec3,radius?:number) {
  const size=a.map((n,i)=>Math.abs(b[i]-n));
  const r=Math.max(0,Math.min(radius??Math.min(...size)*.18,Math.min(...size)*.24));
  const geometry=r>1e-5?new RoundedBoxGeometry(size[0],size[1],size[2],2,r):new T.BoxGeometry(...size);
  geometry.translate(...center(a,b).toArray());return geometry;
}

/** A bearing is a closed annular wall, not a brass cylinder intersected by a
 * steel one. Its bore and rebated shoulders remain real at oblique views. */
export function turnedSleeveGeometry(a:Vec3,b:Vec3,profile:readonly (readonly [number,number])[],bore:number) {
  const from=vec(a),delta=vec(b).sub(from),length=delta.length();
  const inner=Math.max(0,Math.min(bore,...profile.map(([r])=>r*.94)));
  const points=[new T.Vector2(inner,0),...profile.map(([r,t])=>new T.Vector2(r,t*length)),
    new T.Vector2(inner,length),new T.Vector2(inner,0)];
  const geometry=new T.LatheGeometry(points,32);
  geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),length?delta.normalize():new T.Vector3(0,1,0)));
  geometry.translate(...from.toArray());return geometry;
}

/** The column's base, taper and capital are ONE turned member. Broad foot,
 * quiet slender shaft, then a shoulder where a rail can actually seat. */
export function pedestalColumnGeometry(a:Vec3,b:Vec3,radius:number) {
  return turnedShaftGeometry(a,b,[[1,0],[1,.018],[.98,.032],[.88,.045],[.87,.07],[.74,.09],
    [.63,.115],[.58,.15],[.57,.82],[.61,.86],[.73,.885],[.8,.9],[.8,.93],[.7,.945],[.69,1]]
    .map(([r,t])=>[r*radius,t] as const));
}

/** A machined edge, bounded by the original box. Four octagonal rings create
 * a true cut edge: it catches the light without a dark cartoon outline. */
export function chamferedPlateGeometry(a:Vec3,b:Vec3,bevel?:number) {
  const lo=a.map((x,i)=>Math.min(x,b[i])) as Vec3,hi=a.map((x,i)=>Math.max(x,b[i])) as Vec3;
  const w=hi[0]-lo[0],h=hi[1]-lo[1],d=hi[2]-lo[2];
  const e=Math.max(0,Math.min(bevel??Math.min(w,h,d)*.12,Math.min(w,h,d)*.24));
  if(e<1e-5)return new T.BoxGeometry(w,h,d).translate(...center(lo,hi).toArray());
  const ring=(inset:number,y:number)=>{
    const x0=lo[0]+inset,x1=hi[0]-inset,z0=lo[2]+inset,z1=hi[2]-inset;
    const c=e*.65;
    return [[x0+c,y,z0],[x1-c,y,z0],[x1,y,z0+c],[x1,y,z1-c],
      [x1-c,y,z1],[x0+c,y,z1],[x0,y,z1-c],[x0,y,z0+c]];
  };
  const rings=[ring(e,lo[1]),ring(0,lo[1]+e),ring(0,hi[1]-e),ring(e,hi[1])];
  const positions:number[]=[];
  const tri=(a:number[],b:number[],c:number[])=>positions.push(...a,...b,...c);
  for(let level=0;level<3;level++)for(let i=0;i<8;i++){
    const j=(i+1)%8;tri(rings[level][i],rings[level+1][i],rings[level][j]);
    tri(rings[level][j],rings[level+1][i],rings[level+1][j]);
  }
  for(let i=0;i<8;i++){
    const j=(i+1)%8;
    tri([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2],rings[0][i],rings[0][j]);
    tri([(lo[0]+hi[0])/2,hi[1],(lo[2]+hi[2])/2],rings[3][j],rings[3][i]);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();return geometry;
}

/** Turned profile entries are [radius, normalized axial position]. Both end
 * caps belong to this one geometry; collars do not cost a draw per ring. */
export function turnedShaftGeometry(a:Vec3,b:Vec3,profile:readonly (readonly [number,number])[]) {
  const from=vec(a),to=vec(b),delta=to.clone().sub(from),length=delta.length();
  const points=[new T.Vector2(0,0),...profile.map(([r,t])=>new T.Vector2(Math.max(0,r),t*length)),new T.Vector2(0,length)];
  const geometry=new T.LatheGeometry(points,24);
  geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),length?delta.normalize():new T.Vector3(0,1,0)));
  geometry.translate(...from.toArray());return geometry;
}

/** Small repeated details share one mesh per material. This intentionally
 * avoids introducing a scene graph / draw call for every tick or screw. */
export function mergeInstrumentGeometry(geometries:any[]) {
  const positions:number[]=[],normals:number[]=[];
  for(const source of geometries){
    const geometry=source.index?source.toNonIndexed():source;
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    positions.push(...geometry.attributes.position.array);normals.push(...geometry.attributes.normal.array);
    if(geometry!==source)geometry.dispose();source.dispose();
  }
  const result=new T.BufferGeometry();
  result.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return result;
}

export interface EtchedScaleOptions {ticks?:number;majorEvery?:number;width?:number;thickness?:number}

/** A restrained vocabulary, not an enclosing apparatus. All positions are in
 * the requested parent's local coordinates. No label, number or unit is added. */
export function createInstrumentParts(g:TextbookGeometry,parent:any=g.root) {
  const mount=(geometry:any,role:InstrumentMaterialRole,name:string,target:any=parent)=>{
    const mesh=g.mesh(geometry,INSTRUMENT_PART_COLORS[role],false,true,role);target.add(mesh);
    mesh.name=name;mesh.userData.instrumentPart=name;return mesh;
  };
  const group=(name:string)=>{const node=new T.Group();node.name=name;parent.add(node);return node};
  const segment=(a:Vec3,b:Vec3,r:number)=>turnedShaftGeometry(a,b,[[r,0],[r,1]]);
  const frame=(position:Vec3,axis:Vec3)=>{
    const n=vec(axis).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n);
    return {n,q,point:(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyQuaternion(q).add(vec(position)).toArray() as Vec3};
  };
  return {
    plate(a:Vec3,b:Vec3,role:InstrumentMaterialRole='brass',bevel?:number){
      return mount(chamferedPlateGeometry(a,b,bevel),role,'machined-plate');
    },
    casting(a:Vec3,b:Vec3,role:InstrumentMaterialRole='steel',radius?:number){
      return mount(castBodyGeometry(a,b,radius),role,'cast-housing');
    },
    column(a:Vec3,b:Vec3,radius:number,role:InstrumentMaterialRole='brass'){
      return mount(pedestalColumnGeometry(a,b,radius),role,'turned-pedestal-column');
    },
    shaft(a:Vec3,b:Vec3,r:number,role:InstrumentMaterialRole='steel'){
      return mount(segment(a,b,r),role,'turned-shaft');
    },
    bearing(position:Vec3,axis:Vec3,radius:number,length:number){
      const node=group('shaft-and-bearing'),f=frame(position,axis),a=f.point(0,-length/2,0),b=f.point(0,length/2,0);
      mount(turnedSleeveGeometry(a,b,[[radius*.88,0],[radius*.96,.025],[radius,.065],[radius,.17],
        [radius*.96,.22],[radius*.8,.275],[radius*.74,.34],[radius*.74,.66],[radius*.8,.725],
        [radius*.96,.78],[radius,.83],[radius,.935],[radius*.96,.975],[radius*.88,1]],radius*.39),
        'brass','stepped-bearing',node);
      mount(segment(f.point(0,-length*.68,0),f.point(0,length*.68,0),radius*.37),'steel','bearing-axis',node);
      return node;
    },
    etchedScale(a:Vec3,b:Vec3,options:EtchedScaleOptions={}){
      const node=group('etched-scale'),delta=vec(b).sub(vec(a)),length=delta.length();
      const width=options.width??Math.min(1.6,length*.075),thickness=options.thickness??width*.11;
      const ticks=Math.max(2,Math.min(80,Math.round(options.ticks??11))),major=Math.max(1,Math.round(options.majorEvery??5));
      const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),length?delta.normalize():new T.Vector3(1,0,0));
      const transform=(geometry:any)=>{geometry.applyQuaternion(q);geometry.translate(...a);return geometry};
      mount(transform(chamferedPlateGeometry([0,-thickness,-width/2],[length,0,width/2],thickness*.2)),'ivory','scale-face',node);
      const marks:any[]=[];
      for(let i=0;i<ticks;i++){
        const x=length*i/(ticks-1),extent=width*(i%major===0?.74:.4);
        marks.push(transform(chamferedPlateGeometry([x-width*.018,.001,-width*.4],[x+width*.018,thickness*.11,-width*.4+extent],0)));
      }
      mount(mergeInstrumentGeometry(marks),'steel','engraved-ticks',node);return node;
    },
    knob(position:Vec3,axis:Vec3,radius:number,height:number){
      const node=group('low-control-knob'),f=frame(position,axis);
      mount(turnedShaftGeometry(f.point(0,-height/2,0),f.point(0,height/2,0),[[radius*.7,0],[radius*.72,.13],
        [radius,.23],[radius,.73],[radius*.92,.94],[radius*.85,1]]),'brass','knob-body',node);
      const marks:any[]=[];
      for(let i=0;i<16;i++){
        const angle=i*Math.PI/8,x=Math.cos(angle)*radius*.99,z=Math.sin(angle)*radius*.99;
        marks.push(segment(f.point(x,-height*.05,z),f.point(x,height*.18,z),Math.min(radius*.018,height*.035)));
      }
      mount(mergeInstrumentGeometry(marks),'steel','knob-grip-cuts',node);return node;
    },
    fasteners(points:Vec3[],normal:Vec3,radius:number){
      const node=group('flush-fasteners'),heads:any[]=[],slots:any[]=[];
      for(const point of points){
        const f=frame(point,normal);
        heads.push(turnedShaftGeometry(f.point(0,-radius*.14,0),f.point(0,radius*.13,0),[[radius*.85,0],[radius,.25],[radius,.75],[radius*.82,1]]));
        const slot=chamferedPlateGeometry([-radius*.58,radius*.131,-radius*.075],[radius*.58,radius*.145,radius*.075],0);
        slot.applyQuaternion(f.q);slot.translate(...point);slots.push(slot);
      }
      if(points.length){mount(mergeInstrumentGeometry(heads),'brass','screw-heads',node);mount(mergeInstrumentGeometry(slots),'steel','screw-slots',node)}
      return node;
    },
    seam(a:Vec3,b:Vec3,radius=.025){return mount(segment(a,b,radius),'steel','assembly-seam')},
  };
}
