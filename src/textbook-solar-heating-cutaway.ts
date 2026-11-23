import { THREE as T } from './reference/engine.js';
import type { Vec3 } from './textbook-geometry';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry,mergeInstrumentGeometry,turnedShaftGeometry } from './textbook-instrument-parts';
import type { SolarHeatingState } from './textbook-solar-heating-model';

type Mount=(geo:any,tint:string,name:string,own?:boolean,hatch?:number,material?:Exclude<SolidMaterialRole,'paper'>)=>any;

/** Section through the two occupied storeys, with exposed framing, a stair
 * opening and three qualitative thermometers on the actual heat receivers. */
export function solarHeatingCutaway(s:number,p:(v:Vec3)=>Vec3,solid:Mount){
  const boxes=(a:Vec3,c:Vec3,bevel=.11)=>chamferedPlateGeometry(a,c,bevel);
  const joined=(geos:any[],color:string,role:Exclude<SolidMaterialRole,'paper'>,name:string)=>{
    const geometry=mergeInstrumentGeometry(geos);geometry.scale(s,s,s);geometry.translate(...p([0,0,0]));
    return solid(geometry,color,name,true,.02,role);
  };
  const beam=(a:Vec3,c:Vec3,w:number,d:number)=>{
    const from=new T.Vector3(...a),to=new T.Vector3(...c),axis=to.clone().sub(from);
    const g=boxes([-w/2,0,-d/2],[w/2,axis.length(),d/2],.08);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));g.translate(...a);return g;
  };
  const timber:any[]=[],lining:any[]=[],floor:any[]=[],iron:any[]=[];
  // Keep a walkable landing at the top and leave headroom over the stair.
  for(const [x0,x1,z0,z1] of [[23,97,19,24.5],[23,97,34.5,49],[23,28,24.5,34.5],[46,97,24.5,34.5]]){
    floor.push(boxes([x0,25.1,z0],[x1,26.9,z1]));
  }
  const n=13,run=25/n,rise=22.9/n;
  for(let i=0;i<n;i++){
    const x=53-(i+1)*run,y=4+(i+1)*rise;
    timber.push(boxes([x,y-.37,25],[x+run+.16,y,34]),boxes([x+run-.30,y-rise,25.15],[x+run,y-.24,33.85]));
    if(i%4===0||i===12)timber.push(beam([x+.22,y,33.75],[x+.22,y+6.0,33.75],.32,.38));
  }
  timber.push(beam([52.95,9.92,33.75],[27.97,32.85,33.75],.52,.62),
    beam([53.11,3.89,25.2],[27.88,26.73,25.2],.54,1.07),beam([53.11,3.89,33.78],[27.88,26.73,33.78],.54,1.07));
  // Two arched openings are cut into the central party wall. The arch and
  // jamb are continuous plaster, so neither floor reads as a sealed box.
  for(const [bottom,top] of [[4.0,25.1],[26.9,50.5]]){
    const wall=new T.Shape();wall.moveTo(19,bottom);wall.lineTo(26,bottom);wall.lineTo(26,bottom+10.4);
    wall.absarc(31,bottom+10.4,5,Math.PI,0,true);wall.lineTo(36,bottom);wall.lineTo(47,bottom);wall.lineTo(47,top);wall.lineTo(19,top);wall.closePath();
    const g=new T.ExtrudeGeometry(wall,{depth:1.30,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:1,curveSegments:12});g.rotateY(-Math.PI/2);g.translate(59.65,0,0);lining.push(g);
    timber.push(boxes([58.11,bottom,45.4],[59.85,top,47.12]),boxes([24,bottom,19.7],[58,bottom+.88,20.3]),boxes([60,bottom,19.88],[95,bottom+.88,20.5]));
  }
  const roofY=(x:number)=>68-Math.abs(60-x)*17/39;
  for(const z of [20,46.8]){
    timber.push(beam([22.4,50.32,z],[60,67.28,z],1.34,1.06),beam([60,67.28,z],[97.6,50.32,z],1.34,1.06),
      beam([60,51.4,z],[60,66.52,z],1.13,1.12),beam([60,52.25,z],[43.3,59.8,z],.91,.88),beam([60,52.25,z],[76.7,59.8,z],.91,.88));
    iron.push(boxes([59.1,51.36,z+.47],[60.9,54.03,z+.66],.15));
  }
  // Lapped slate courses stop at the ridge. The collector remains on the other slope.
  const slates:any[][]=[[],[],[]],course=4.85,wide=5.9;
  for(let j=0;j<8;j++)for(let col=-1;col<6;col++){
    const a=60.3+j*course,b=Math.min(99.2,a+course+.52);
    const zl=Math.max(16.6,16.6+col*wide+(j%2)*wide*.5),zr=Math.min(50.38,16.6+(col+1)*wide+(j%2)*wide*.5-.12);
    if(zr-zl<.45)continue;
    const w=Math.hypot(b-a,roofY(b)-roofY(a)),g=boxes([0,-.12,0],[w,.16,zr-zl],.11);
    g.rotateZ(Math.atan2(roofY(b)-roofY(a),b-a)+.016);g.translate(a,roofY(a)+.21,zl);
    slates[(j*7+col+7)%3].push(g);
  }
  for(let j=0;j<3;j++){
    const m=joined(slates[j],['#505b59','#596560','#535f5d'][j],'rock','slate-roof-course');applyEarthScan(m.material,'outcrop',7.5*s);
  }
  for(let x=25;x<96;x+=5.4)timber.push(boxes([x,24.5,46.5],[x+1.1,25.68,49.55]));
  joined(timber,'#79593f','wood','stair-joists-and-roof-trusses');joined(floor,'#a08a6c','wood','floor-and-stairwell');
  joined(lining,'#ded4bc','ivory','arched-room-partition');joined(iron,'#7b8177','steel','truss-straps');

  // The solar marker is carried on a gooseneck fixed to the building model.
  // Its return curve stays behind the sun and outside the three incident rays.
  const arm=new T.CatmullRomCurve3([[23,48,31],[18.7,49,31],[15.1,52.6,31],[13.6,60.8,31],[10.4,67.7,31],[10,70,32]].map(v=>new T.Vector3(...v)));
  const armParts=[new T.TubeGeometry(arm,38,.36,10,false),
    turnedShaftGeometry([10,70,31],[10,70,36],[[.70,0],[1.03,.14],[.69,.26],[.55,.78],[.83,.89],[.83,1]]),
    turnedShaftGeometry([21.2,48,31],[23.7,48,31],[[1.36,0],[1.50,.19],[1.15,.38],[.88,.69],[1.32,.84],[1.32,1]])];
  joined(armParts,'#a78a52','brass','solar-source-arm');
  const readings=[
    {name:'storage',x:34,y:7.6,z:52.62,stage:2},
    {name:'lower',x:73.2,y:9.2,z:49.0,stage:3},
    {name:'upper',x:73.2,y:32.0,z:49.0,stage:3}
  ] as const;
  const thermometers=readings.map(({x,y,z,name,stage})=>{
    const at=[x,y,z];
    const columnHeight=7.6,plate=joined([boxes([x-1.16,y-.74,z-.32],[x+1.2,y+9.4,z+.01],.24)],'#d4c39f','ivory','thermometer-'+name);
    const fasteners=[boxes([x-1.26,y-.85,z-.42],[x+1.30,y-.45,z+.14]),boxes([x-1.26,y+9.16,z-.42],[x+1.30,y+9.52,z+.14])];
    for(let i=0;i<=6;i++)fasteners.push(boxes([x+.15,y+.52+i*1.19,z+.03],[x+(i%3?.56:.87),y+.63+i*1.19,z+.07],.01));
    joined(fasteners,'#977c50','brass','thermometer-fittings');
    const bulb=new T.SphereGeometry(.43*s,18,12);bulb.translate(...p([x-.31,y+.15,z+.24]));
    const tip=solid(bulb,'#a5482e','thermometer-bulb',false,.02,'enamel');
    const stem=solid(turnedShaftGeometry([0,0,0],[0,columnHeight*s,0],[[.17*s,0],[.17*s,1]]),'#a5482e','thermometer-column',false,.02,'enamel');
    stem.position.set(...p([at[0]-.31,at[1]+.24,at[2]+.21]));
    for(const mesh of [plate,tip,stem]){mesh.userData.solarRoomReading=name;mesh.userData.modelInput={kind:'select',selection:stage,label:name==='storage'?'观察储水罐受热':'观察房间受热'};}
    return {name,stem};
  });
  return (state:SolarHeatingState)=>thermometers.forEach(({name,stem})=>{
    const warmth=name==='storage'?state.storageWarmth:state.roomWarmth[name];
    stem.scale.y=.15+.85*warmth;
  });
}
