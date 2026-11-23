import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

type Outline = readonly (readonly [number,number])[];
const iron='#304b40',brass='#ad8b52',edge='#bfa16c',steel='#88928e',stock='#6a4832';

/** Two parallel arbors share the same rotation through two quartered coupling
 * rods. The slider apertures face at right angles. Each pin therefore resolves
 * one component of its circular path into the corresponding first particle. */
export function seismicEccentrics(b:TextbookGeometry,s:number,p:(x:number,y:number,z?:number)=>Vec3,drivers:any[]){
  const part=(geo:any,color:string,material:SolidMaterialRole,name:string,parent=b.root)=>{
    const m=b.mesh(geo,color,false,true,material);parent.add(m);m.name=name;m.userData.seismicInstrumentPart=name;return m;
  };
  const local=(v:Vec3):Vec3=>[v[0]*s,v[1]*s,v[2]*s];
  const lathe=(a:Vec3,c:Vec3,profile:Outline)=>turnedShaftGeometry(local(a),local(c),profile.map(([r,u])=>[r*s,u]));
  const pin=(a:Vec3,c:Vec3,r:number)=>lathe(a,c,[[r,0],[r,1]]);
  const block=(a:Vec3,c:Vec3,r=.15)=>chamferedPlateGeometry(local(a),local(c),r*s);
  const place=(m:any,x:number,y:number,z:number)=>{m.position.set(...p(x,y,z));return m};
  const casting=(shape:any,w:number)=>new T.ExtrudeGeometry(shape,{depth:w,curveSegments:16,bevelEnabled:true,bevelSize:.17,bevelThickness:.13,bevelSegments:2}).scale(s,s,s);
  const cx=-2.5,heights=[14,29],rotors:any[]=[],bars:{mesh:any;angle:number;z:number}[]=[];
  const foot=mergeInstrumentGeometry([block([-8.5,-1.8,-8],[5.5,-.2,8.9],.38),block([-8,-.2,-7.5],[5.1,.68,8.4],.26)]);
  place(part(foot,stock,'wood','drive-walnut-plinth'),0,0,0);
  const cheek=new T.Shape();cheek.moveTo(-4.7,.68);cheek.lineTo(6.9,.68);cheek.lineTo(6.9,2.45);
  cheek.bezierCurveTo(3.1,4.4,2.4,7.2,2.64,13.6);cheek.lineTo(2.5,29.3);
  cheek.bezierCurveTo(2.5,32.8,-2.45,32.8,-2.53,29.2);cheek.lineTo(-2.7,12.6);
  cheek.bezierCurveTo(-2.6,7.8,-3.0,4.85,-4.7,2.55);cheek.closePath();
  const opening=new T.Path();opening.moveTo(-.84,17.4);opening.quadraticCurveTo(0,15.8,.84,17.4);
  opening.lineTo(.84,25.5);opening.quadraticCurveTo(0,27,-.84,25.5);opening.closePath();cheek.holes.push(opening);
  for(const z of [-8.1,-1.9])place(part(casting(cheek,1.36),iron,'enamel','pierced-drive-cheek'),cx,0,z);
  for(const y of heights){
    const collar=turnedSleeveGeometry(local([0,0,-8.32]),local([0,0,-6.55]),[[2.0*s,0],[2.16*s,.17],[1.75*s,.37],[1.72*s,.85],[1.89*s,1]],.72*s);
    place(part(collar,edge,'brass','rear-journal-bearing'),cx,y,0);
    place(part(lathe([0,0,-9],[0,0,3.8],[[.57,0],[.69,.08],[.69,.94],[.85,1]]),steel,'steel','driver-arbor'),cx,y,0);
    const backRims=[lathe([0,0,-5.5],[0,0,-4.9],[[2.8,0],[3.05,.22],[3.02,.78],[2.8,1]]),
      lathe([0,0,-3.65],[0,0,-3.12],[[2.81,0],[3,.2],[3,.75],[2.84,1]])];
    rotors.push(place(part(mergeInstrumentGeometry(backRims),brass,'brass','quartered-crank-webs'),cx,y,0));
  }
  for(const [a,z] of [[0,-4.8],[Math.PI/2,-3.02]]){
    const r=.76;
    const ends:import('three').BufferGeometry[]=heights.map(y=>turnedSleeveGeometry(local([0,y,z]),local([0,y,z+.57]),[[r*s,0],[.84*s,.18],[.84*s,.82],[r*s,1]],.33*s));
    ends.push(block([-.3,14.62,z+.10],[.3,28.38,z+.47],.09));
    const rod=part(mergeInstrumentGeometry(ends),steel,'steel','coupling-rod');
    bars.push({mesh:rod,angle:a,z});
    for(const y of heights){
      const px=2.22*Math.cos(a),py=2.22*Math.sin(a);
      const journal=lathe([px,py,z-.30],[px,py,z+.79],[[.34,0],[.34,.71],[.51,.74],[.49,.93],[.35,1]]);
      rotors.push(place(part(journal,edge,'brass','coupling-pin'),cx,y,0));
    }
  }

  // Pin travel is +/-1.65 across the P yoke and +/-3.0 vertically in the S
  // yoke. Their slots stay open at both extremes of their perpendicular travel.
  for(const [i,y] of heights.entries()){
    const rad=i?3:1.65,ax=i?-rad:0,ay=i?0:rad;
    const web=lathe([0,0,-.24],[0,0,.46],[[rad+.69,0],[rad+.86,.18],[rad+.86,.78],[rad+.72,1]]);
    const stud=lathe([ax,ay,.38],[ax,ay,1.93],[[.39,0],[.39,.75],[.51,.82],[.51,.95],[.39,1]]);
    rotors.push(place(part(mergeInstrumentGeometry([web,stud]),brass,'brass',i?'shear-eccentric':'pressure-eccentric'),cx,y,0));
    const major=rad+.54,minor=.50,wall=.44,halfX=i?major:minor,halfY=i?minor:major;
    const x=cx,xb=x+halfX+wall;
    const pieces=[
      block([x-halfX-wall,y-halfY-wall,.59],[xb,y-halfY,1.57],.1),
      block([x-halfX-wall,y+halfY,.59],[xb,y+halfY+wall,1.57],.1),
      block([x-halfX-wall,y-halfY,.59],[x-halfX,y+halfY,1.57],.1),
      block([x+halfX,y-halfY,.59],[xb,y+halfY,1.57],.1),
      pin([xb,y,1.07],[7.3,y,1.07],.30)
    ];
    place(part(mergeInstrumentGeometry(pieces),steel,'steel',i?'horizontal-yoke-slot':'vertical-yoke-slot',drivers[i]),0,0,0);
  }
  const radius=6.55,wz=4.8;
  const wheel=[new T.TorusGeometry(radius*s,.58*s,12,60),
    lathe([0,0,-.9],[0,0,1.04],[[1.10,0],[1.42,.18],[1.42,.60],[1.12,.77],[.88,1]])];
  const arms=Array.from({length:5},(_,i)=>{
    const a=i*2*Math.PI/5;
    const v=(r:number,t:number)=>new T.Vector3(Math.cos(a+t)*r*s,Math.sin(a+t)*r*s,0);
    return new T.TubeGeometry(new T.QuadraticBezierCurve3(v(.87,0),v(3.65,.23),v(radius,0)),12,.34*s,9,false);
  });
  const flywheel=place(part(mergeInstrumentGeometry([...wheel,...arms]),edge,'brass','seismic-handwheel'),cx,14,wz);
  const grip=place(part(lathe([0,-radius,0],[0,-radius,3.05],[[.57,0],[.7,.09],[.46,.23],[.50,.49],[.77,.75],[.64,.94],[.40,1]]),stock,'wood','seismic-handgrip'),cx,14,wz);
  rotors.push(flywheel,grip);
  const control={kind:'phase-dial',dial:{center:p(cx,14,wz+2.7),radiusX:radius*s,radiusY:radius*s,turns:3},label:'转动木柄，比较纵波和横波的质点振动'};
  for(const m of [flywheel,grip])m.userData.modelInput=control;
  grip.userData.smallPointTarget=true;
  return (phase:number)=>{
    const theta=phase*6*Math.PI;
    for(const rotor of rotors)rotor.rotation.z=theta;
    for(const bar of bars)bar.mesh.position.set(...p(cx+2.22*Math.cos(theta+bar.angle),2.22*Math.sin(theta+bar.angle),0));
  };
}
