import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { castBodyGeometry, chamferedPlateGeometry, createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { phaseTrackPoint } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';

const finishes = { brass:'#a7824b', ivory:'#e6d6af', steel:'#6c7775', enamel:'#263f39', wood:'#684531' } as const;
type Finish = keyof typeof finishes;

/** Machined parts for the two survey teaching instruments, in their own model coordinates. */
export function surveyBench(b: TextbookGeometry, s: number, p: (v:Vec3)=>Vec3) {
  const parts=createInstrumentParts(b);
  const mount=(geo:any,role:SolidMaterialRole,color:string,name:string)=>{
    const mesh=b.mesh(geo,color,false,true,role);mesh.name=name;return mesh;
  };
  const plate=(a:Vec3,c:Vec3,role:Finish,name:string,r=.22)=>
    mount(chamferedPlateGeometry(p(a),p(c),r*s),role,finishes[role],name);
  const casting=(a:Vec3,c:Vec3,role:Finish,name:string,r=.55)=>
    mount(castBodyGeometry(p(a),p(c),r*s),role,finishes[role],name);
  const turning=(a:Vec3,c:Vec3,profile:readonly (readonly [number,number])[],role:Finish,name:string)=>
    mount(turnedShaftGeometry(p(a),p(c),profile.map(([r,t])=>[r*s,t])),role,finishes[role],name);
  const column=(a:Vec3,c:Vec3,r:number)=>parts.column(p(a),p(c),r*s);
  const shaft=(a:Vec3,c:Vec3,r:number,role:Finish='brass')=>turning(a,c,[[r,0],[r,1]],role,'fitted cross shaft');
  const curve=(path:Vec3[],r:number,role:Finish,name:string)=>{
    const curve=new T.CatmullRomCurve3(path.map(q=>new T.Vector3(...p(q))),false,'centripetal');
    return mount(new T.TubeGeometry(curve,Math.max(20,(path.length-1)*8),r*s,10,false),role,finishes[role],name);
  };
  const bed=(x0:number,x1:number,z0:number,z1:number)=>{
    casting([x0,-4.2,z0],[x1,-1.25,z1],'wood','walnut instrument bed',1.15);
    plate([x0+.42,-1.33,z0+.42],[x1-.42,-.76,z1-.42],'brass','brass bed fillet');
    casting([x0+.8,-.82,z0+.8],[x1-.8,.12,z1-.8],'enamel','lacquered iron top');
    const mounts:Vec3[]=[];
    for(const x of [x0+3,x1-3])for(const z of [z0+3,z1-3]){
      turning([x,-5.75,z],[x,-3.8,z],[[1.65,0],[2,.11],[1.82,.30],[1.38,.52],[1.9,.92],[1.9,1]],'brass','adjustable levelling foot');
      mounts.push(p([x,.16,z]));
    }
    parts.fasteners(mounts,[0,1,0],.54*s);
  };
  const carriage=(start:Vec3,end:Vec3,label:string)=>{
    const [x,y,z]=start,x1=end[0], track={start:p(start),end:p(end)};
    for(const side of [-1,1]){
      shaft([x-3,y-1.55,z+side*1.45],[x1+3,y-1.55,z+side*1.45],.43,'steel');
      casting([side<0?x-3.7:x1+2.25,.1,z-2.55],[side<0?x-2.25:x1+3.7,y-1.04,z+2.55],'brass','rail end bearing');
    }
    parts.etchedScale(p([x,y-2.1,z+3.55]),p([x1,y-2.1,z+3.55]),{ticks:41,majorEvery:5,width:1.85*s,thickness:.26*s});
    const grip=b.mesh(turnedShaftGeometry([0,-.62*s,0],[0,1.76*s,0],[[.94*s,0],[1.26*s,.18],[1.37*s,.45],[1.34*s,.71],[1.13*s,.93],[.85*s,1]]),
      finishes.wood,false,true,'wood');
    const block=b.mesh(castBodyGeometry([-2.12*s,-1.95*s,-2.13*s],[2.12*s,-.55*s,2.13*s],.24*s),finishes.brass,false,true,'brass');
    const collar=b.mesh(turnedShaftGeometry([0,-.68*s,0],[0,-.30*s,0],[[1.02*s,0],[1.18*s,.22],[1.18*s,.80],[1.04*s,1]]),finishes.brass,false,true,'brass');
    // A closed cord runs on two equal capstans. The sliding saddle grips the
    // lower strand, so spindle rotation and carriage travel have a fixed ratio.
    const radius=2.58,cy=2.85,cz=z+1.85,winchX=x1+4.85;
    const revolutions=(x1-x)/(2*Math.PI*radius);
    for(const atX of [x-4.85,winchX]){
      casting([atX-.83,.1,cz-1.75],[atX+.83,cy+.35,cz-.75],'enamel','pulley bearing pedestal');
      turning([atX,cy,cz-1.28],[atX,cy,cz+.7],[[.64,0],[.67,.15],[2.82,.27],[2.86,.41],[radius,.49],[radius,.72],[2.86,.8],[2.82,.94],[1,.99]],'brass','grooved capstan');
    }
    for(const lane of [-1,1]){
      const cord=shaft([x-4.85,cy+lane*radius,cz],[winchX,cy+lane*radius,cz],.095,'wood');
      cord.raycast=()=>{};
    }
    const tie=b.mesh(castBodyGeometry([-.51*s,(cy-radius-y-.13)*s,1.55*s],[.51*s,-1.27*s,2.09*s],.11*s),finishes.brass,false,true,'brass');
    const wheelCenter=p([winchX,cy,cz+1.9]);
    shaft([winchX,cy,cz],[winchX,cy,cz+2.01],.48,'steel');
    const wheel=b.mesh(new T.TorusGeometry(2.92*s,.44*s,10,48),finishes.brass,false,true,'brass');
    const arm=b.mesh(turnedShaftGeometry([0,-2.93*s,0],[0,2.93*s,0],[[.32*s,0],[.42*s,.14],[.47*s,.46],[.67*s,.5],[.46*s,.54],[.31*s,1]]),finishes.brass,false,true,'brass');
    const gripOnWheel=b.mesh(turnedShaftGeometry([0,-2.92*s,0],[0,-2.92*s,1.88*s],[[.42*s,0],[.51*s,.17],[.46*s,.40],[.67*s,.73],[.57*s,.9],[.37*s,1]]),finishes.wood,false,true,'wood');
    const dial={center:p([winchX,cy,cz+3.7]),radiusX:2.92*s,radiusY:2.92*s,turns:revolutions};
    for(const rotor of [wheel,arm,gripOnWheel]){
      rotor.position.set(...wheelCenter);
      rotor.userData.modelInput={kind:'phase-dial',dial,label:'转动绞盘木把，沿铜轨推进或倒回'};
    }
    gripOnWheel.userData.smallPointTarget=true;
    const input={kind:'phase-track',track,label};
    for(const m of [grip,block,collar,tie]){m.userData.modelInput=input;m.userData.smallPointTarget=true;}
    const move=(phase:number)=>{const at=phaseTrackPoint(phase,track);for(const m of [grip,block,collar])m.position.set(...at);
      for(const rotor of [wheel,arm,gripOnWheel])rotor.rotation.z=phase*2*Math.PI*revolutions;
    };
    move(0);return {grip,track,move};
  };
  const key=(text:string,center:Vec3,w:number,h:number,selection:number,label:string)=>{
    const [x,y,z]=center;
    const socket=casting([x-w/2-.52,y-.87,z-h/2-.4],[x+w/2+.52,y-.15,z+h/2+.4],'brass','bezel for porcelain key');
    const face=casting([x-w/2,y-.2,z-h/2],[x+w/2,y+.15,z+h/2],'ivory','porcelain key');
    const ink=b.label(text,p([x,y+.19,z]),(w-.55)*s,h*s,{appearance:'engraved',ink:'#392e23'});
    ink.rotation.x=-Math.PI/2;ink.userData.labelMount='surface';
    for(const m of [socket,face,ink]) m.userData.modelInput={kind:'select',selection,label};
    return ink;
  };
  return {mount,plate,casting,column,shaft,turning,curve,bed,carriage,key,parts};
}