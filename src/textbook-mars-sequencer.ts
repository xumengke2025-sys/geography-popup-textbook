import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry,Vec3 } from './textbook-geometry';
import { castBodyGeometry,createInstrumentParts,mergeInstrumentGeometry,turnedShaftGeometry } from './textbook-instrument-parts';
import type { PhaseInput } from './textbook-model-input';
import { mountSpecimenKeys } from './textbook-specimen-slides';
import { MARS_CIRCUITS, MARS_ARRIVALS } from './textbook-mars-reading';

type Point=(u:number,v:number,height?:number)=>Vec3;
/** A full turn of the driving capstan moves the reporting cursor exactly
 * one circumference. The engraved pins refer to arrivals, never flow rates. */
export function mountMarsSequencer(b:TextbookGeometry,s:number,p:Point){
  const origin=p(0,1.45,0),q=(x:number,h:number,z:number):Vec3=>[origin[0]+s*x,s*h,origin[2]+s*z];
  const hw=createInstrumentParts(b);
  const apronEnd=q(99,-2.05,13),bedCorner=p(.004,.365,-4.9);
  hw.casting(bedCorner,apronEnd,'wood',.62*s);
  hw.plate([bedCorner[0]+.2*s,-2.25*s,bedCorner[2]+.2*s],q(98.8,-2.03,12.8),'brass',.085*s);
  b.mesh(castBodyGeometry([bedCorner[0]+.52*s,-2.03*s,bedCorner[2]+.52*s],q(98.48,-1.90,12.48),.14*s),'#344a41',false,true,'enamel');
  hw.casting(q(2,-1.91,-4.2),q(97,.03,12.1),'wood',.21*s);
  const x0=58.9,r=5.55,travel=2*Math.PI*r,ax=67.0,y=6.45,z=2.15,cordZ=z-.71;
  const start=q(x0,y+r,cordZ),end=q(x0-travel,y+r,cordZ),track={start,end};
  const handCenter=q(ax,y,z+1.04);
  const wheelInput:PhaseInput={kind:'phase-dial',dial:{center:handCenter,radiusX:(r+.67)*s,radiusY:(r+.67)*s,turns:1},label:'转动示踪手轮，回看物资到达'};
  const sliderInput:PhaseInput={kind:'phase-track',track,label:'推移索道游标查看前后次序'};
  hw.casting(q(4,.01,-2.85),q(76,1.56,4.69),'wood',.4*s);
  hw.plate(q(4.36,1.56,-2.53),q(75.59,1.82,4.37),'brass',.12*s);
  for(const x of [12.6,ax]){
    hw.column(q(x,1.83,-1.52),q(x,y,-1.52),1.31*s);
    hw.bearing(q(x,y,-1.35),[0,0,1],1.37*s,3*s);
  }
  const makeWheel=(x:number,hand:boolean)=>{
    const g=new T.Group();b.root.add(g);g.position.set(...q(x,y,z));
    const body=createInstrumentParts(b,g),rr=r;
    const face=turnedShaftGeometry([0,0,-2.6*s],[0,0,.43*s],[[rr*s,0],[(rr+.34)*s,.11],[rr*s,.17],[rr*s,.74],[(rr+.36)*s,.83],[(rr+.36)*s,1]]);
    const wheel=b.mesh(face,hand?'#977648':'#675a42',false,true,'brass');g.add(wheel);
    const spokes=[];
    for(let i=0;i<(hand?4:6);i++){
      const a=i*2*Math.PI/(hand?4:6);
      spokes.push(turnedShaftGeometry([0,0,.62*s],[(rr-.44)*s*Math.cos(a),(rr-.44)*s*Math.sin(a),.62*s],[[.35*s,0],[.18*s,.8],[.23*s,1]]));
    }
    const backing=b.mesh(new T.CylinderGeometry((r-.72)*s,(r-.72)*s,.10*s,48).rotateX(Math.PI/2).translate(0,0,.50*s),'#405249',false,true,'enamel');g.add(backing);
    const ribs=b.mesh(mergeInstrumentGeometry(spokes),'#b2935b',false,true,'brass');g.add(ribs);
    body.shaft([0,0,.56*s],[0,0,1.1*s],.83*s,'steel');
    if(hand){const grip=turnedShaftGeometry([0,-rr*s,.59*s],[0,-rr*s,3.14*s],[[.37*s,0],[.60*s,.08],[.79*s,.35],[.82*s,.70],[.55*s,.95],[.30*s,1]]);
      g.add(b.mesh(grip,'#654530',false,true,'wood'));}
    g.traverse((m:any)=>{if(m.isMesh){m.userData.marsDrive=hand?'crank':'return-pulley';if(hand)m.userData.smallPointTarget=true;}});
    return g;
  };
  const drive=makeWheel(ax,true),idle=makeWheel(12.6,false);
  for(const yy of [y+r,y-r])hw.shaft(q(12.6,yy,cordZ),q(ax,yy,cordZ),.13*s,'steel');
  // Upper cord carries the carriage. The reading plate has its own rigid
  // guide independently seated on both uprights and a fine moving hairline.
  hw.shaft(q(17,9.9,z),q(62,9.9,z),.23*s,'steel');
  hw.casting(q(19,3.4,z+.11),q(62.3,9.38,z+.65),'brass',.2*s);
  hw.casting(q(19.35,3.73,z+.66),q(61.95,9.08,z+.87),'ivory',.13*s);
  const cursor=new T.Group();b.root.add(cursor);
  const carriage=createInstrumentParts(b,cursor);
  carriage.plate([-1.28*s,-.60*s,-.55*s],[1.28*s,.59*s,.73*s],'brass',.12*s);
  carriage.shaft([0,-5.68*s,1.63*s],[0,0,.20*s],.21*s,'steel');
  carriage.knob([0,0,.49*s],[0,0,1],.83*s,1.25*s);
  cursor.traverse((m:any)=>{if(m.isMesh){m.userData.marsDrive='reading-carriage';m.userData.smallPointTarget=true;}});
  const eventFaces=MARS_ARRIVALS.map(entries=>entries.flatMap(([phase,label])=>{
    const xx=x0-travel*phase,mark=hw.shaft(q(xx,7.95,z+1.02),q(xx,9.03,z+1.02),.10*s,'steel');
    const nameplate=b.label(label,q(xx,5.92,z+1.02),7.0*s,3.42*s,{appearance:'engraved'});
    nameplate.userData.labelMount='surface';nameplate.userData.marsArrival=phase;
    return [mark,nameplate];
  }));
  const instruction=b.label('选择回路',q(40,6.15,z+1.02),19*s,4.25*s,{appearance:'engraved'});
  instruction.userData.labelMount='surface';eventFaces[0].push(instruction);
  const keys=mountSpecimenKeys(b,q,s,[15,37,60,83],[...MARS_CIRCUITS],1.9,11.35,18);
  const handles: any[]=[];drive.traverse((m:any)=>{if(m.isMesh)handles.push(m)});
  const sliders: any[]=[];cursor.traverse((m:any)=>{if(m.isMesh)sliders.push(m)});
  return {update(phase:number,mode:number){
    const active=mode>0,reading=active?phase:0;
    drive.rotation.z=idle.rotation.z=2*Math.PI*reading;
    // Viewed from the front, the upper run travels left when the crank turns counterclockwise.
    cursor.position.set(...q(x0-travel*reading,y+r,cordZ));
    keys(mode);eventFaces.forEach((group,i)=>group.forEach(m=>m.visible=i===mode));
    for(const m of handles)m.userData.modelInput=active?wheelInput:undefined;
    for(const m of sliders)m.userData.modelInput=active?sliderInput:undefined;
  },travel,driveRadius:r,handle:drive,slider:cursor};
}
