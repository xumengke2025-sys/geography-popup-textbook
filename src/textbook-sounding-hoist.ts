import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { createInstrumentParts, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { PhaseTrack, PhaseInput } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';

type Point=(x:number,y:number,z:number)=>Vec3;
/** A model balloon and its instrument basket are a height cursor. A separate
 * graduated curve supplies the relative temperature of the same observation. */
export function mountSoundingHoist(b:TextbookGeometry,p:Point,s:number,track:PhaseTrack){
  const parts=createInstrumentParts(b),survey=new T.Group(),drum=new T.Group();b.root.add(survey,drum);
  const center=p(96,10.4,47.3),radius=5.1*s;
  drum.position.set(...center);
  const lift:PhaseInput={kind:'phase-dial',dial:{center,radiusX:radius,radiusY:radius,turns:1},label:'手摇探空绞盘，升降观测浮标'};
  const slide:PhaseInput={kind:'phase-track',track,label:'沿高度导轨升降探空吊篮'};
  const part=(geometry:any,color:string,role:SolidMaterialRole,name:string,parent:any,control?:PhaseInput)=>{
    const m=b.mesh(geometry,color,false,true,role);m.name=name;m.userData.soundingPart=name;parent.add(m);
    if(control){m.userData.modelInput=control;m.userData.smallPointTarget=true;}return m;
  };
  const loc=(v:Vec3):Vec3=>[v[0]*s,v[1]*s,v[2]*s];
  const shaft=(a:Vec3,z:Vec3,rad:number)=>turnedShaftGeometry(loc(a),loc(z),[[rad*s,0],[rad*s,1]]);
  const pipe=(vs:Vec3[],r:number)=>new T.TubeGeometry(new T.CatmullRomCurve3(vs.map(v=>new T.Vector3(...loc(v)))),Math.max(7,vs.length*2),r*s,7,false);
  const silk=['#436878','#c5ac72'],rows=[[0,.31],[.08,2.19],[.27,4.84],[.51,5.49],[.70,4.97],[.88,3.37],[.98,1.13],[1,.12]];
  const panels=[[],[]] as any[][],net:any[]=[];
  const panelPoint=(height:number,r:number,a:number):Vec3=>[1.15*r*Math.cos(a),(4.43+height*10.0),1.15*r*Math.sin(a)];
  for(let j=0;j<12;j++){
    const a=j*Math.PI/6,positions:number[]=[],indices:number[]=[];
    for(const [h,r] of rows)for(let c=0;c<=5;c++)positions.push(...loc(panelPoint(h,r*(1+.028*Math.sin(Math.PI*c/5)),a+c*Math.PI/30)));
    for(let row=0;row<rows.length-1;row++)for(let c=0;c<5;c++){const k=row*6+c;indices.push(k,k+6,k+1,k+1,k+6,k+7);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    panels[j%2].push(g);net.push(pipe(rows.map(([h,r])=>panelPoint(h,r+.045,a)),.065));
    if(j%2===0)net.push(pipe([[1.49*Math.cos(a),1.48,1.49*Math.sin(a)],[1.74*Math.cos(a),3.0,1.74*Math.sin(a)],[2.13*Math.cos(a),5.20,2.13*Math.sin(a)]],.083));
  }
  for(const [i,geos] of panels.entries())part(mergeInstrumentGeometry(geos),silk[i],'enamel','缝片探空模型',survey,slide);
  part(mergeInstrumentGeometry(net),'#96845c','brass','球囊经向缝绳与悬索',survey,slide);
  const wicker=turnedShaftGeometry(loc([0,-.42,0]),loc([0,1.61,0]),[[1.22*s,0],[1.39*s,.14],[1.55*s,.67],[1.69*s,.82],[1.67*s,1]]);
  part(wicker,'#876b4a','wood','探空仪器吊篮',survey,slide);
  const bands=[.10,.69,1.44].map((h,i)=>{const g=new T.TorusGeometry((1.33+i*.16)*s,.074*s,7,36);g.rotateX(Math.PI/2);g.translate(0,h*s,0);return g;});
  part(mergeInstrumentGeometry(bands),'#9e8253','brass','吊篮周箍',survey,slide);
  // Pulley block at the crown and two fixed fairleads bring the cable back
  // to a turned winding drum. The straight free length changes with height.
  for(const z of [39.6,42.55])parts.shaft(p(19,95,z),p(30,105.2,z),.38*s,'brass');
  for(const z of [31.0,33.0])parts.shaft(p(16,94.8,47),p(14.1,102.9,z),.43*s,'brass');
  for(const [x,y,z]of [[30,105.1,41.1],[14.1,102.9,32],[14.1,8.2,32]]){
    parts.bearing(p(x,y,z),[0,0,1],1.13*s,1.65*s);
    const sheave=new T.TorusGeometry(1.34*s,.25*s,8,32);sheave.translate(...p(x,y,z));
    part(sheave,'#977d50','brass','滑轮铜口',b.root);
  }
  const route:[[number,number,number],[number,number,number]][]=[
    [[30,106.35,41.1],[14.1,104.15,32]],[[12.8,102.9,32],[12.8,8.2,32]],[[14.1,6.85,32],[96,6.85,42]]];
  for(const [a,c]of route)parts.shaft(p(...a),p(...c),.115*s,'steel');
  const rope=new T.CylinderGeometry(.11*s,.11*s,s,8);rope.translate(0,.5*s,0);
  const moving=part(rope,'#829087','steel','升降钢索',b.root);
  parts.casting(p(89.9,4.76,39.8),p(102.2,5.5,49.84),'wood',.29*s);
  for(const z of [40.7,46.3])parts.shaft(p(96,5.37,z),p(96,10.4,z),.76*s,'brass');
  const bobbin=turnedShaftGeometry(p(96,10.4,39.9),p(96,10.4,46.5),[[2.74*s,0],[2.93*s,.12],[2.0*s,.19],[2.0*s,.80],[2.93*s,.86],[2.79*s,1]]);
  part(bobbin,'#886b45','brass','收缆卷筒',b.root,lift);
  const rim=new T.TorusGeometry(radius,.37*s,10,56);part(rim,'#a28a58','brass','探空绞盘手轮',drum,lift);
  const spokes=[0,1,2].map(j=>{const a=j*2*Math.PI/3;return shaft([0,0,0],[5.1*Math.cos(a),5.1*Math.sin(a),0],.20)});
  part(mergeInstrumentGeometry(spokes),'#96794b','brass','绞盘辐条',drum,lift);
  part(turnedShaftGeometry(loc([0,-5.1,.12]),loc([0,-5.1,2.89]),[[.49*s,0],[.72*s,.19],[.75*s,.71],[.47*s,1]]),'#6d4b31','wood','绞盘木摇柄',drum,lift);
  part(turnedShaftGeometry(loc([0,0,-1.3]),loc([0,0,.67]),[[.66*s,0],[1.06*s,.31],[.92*s,1]]),'#9e8b66','brass','绞盘轴心',drum,lift);
  return (phase:number,height:number)=>{
    survey.position.set(...p(30,height,41.1));moving.position.set(...p(30,height+14.39,41.1));moving.scale.y=105.12-height-14.39;
    // The tiny remaining length seats inside the terminal sheave at full lift.
    moving.scale.y=Math.max(.03,moving.scale.y);drum.rotation.z=2*Math.PI*phase;
  };
}
