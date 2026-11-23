import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { castBodyGeometry, chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { INSOLATION_LAYOUT as L,insolationSource } from './textbook-insolation-model';

/** The rack rises by exactly one pitch-circle circumference in one revolution. */
export function elevationDrive(b:TextbookGeometry,s:number,p:(v:Vec3)=>Vec3){
  const [sx,sy,sz]=insolationSource(0),range=L.radius*Math.sin(L.maxLatitudeDegrees*Math.PI/180),pitchRadius=range/(2*Math.PI);
  const rackX=sx-2.2,rackZ=sz+3.45,cx=rackX-.65-pitchRadius,cy=sy-4.1,teeth=24,pitch=range/teeth;
  const rackGeo=[chamferedPlateGeometry([rackX-.46,sy-26.55,rackZ-.55],[rackX+.52,sy+.65,rackZ+.55],.065)];
  for(let j=0;j<31;j++){const y=sy-.1-j*pitch;
    rackGeo.push(chamferedPlateGeometry([rackX-.92,y-pitch*.23,rackZ-.52],[rackX-.44,y+pitch*.23,rackZ+.52],.065));}
  const rack=b.mesh(mergeInstrumentGeometry(rackGeo).scale(s,s,s),'#997941',false,true,'brass');
  rack.position.z=p([0,0,0])[2];rack.name='toothed-elevation-bar';
  const link=b.mesh(turnedShaftGeometry(p([rackX,sy,rackZ]),p([sx,sy,sz+1.4]),[[.55*s,0],[.55*s,1]]),'#8f7753',false,true,'brass');
  const frame=b.mesh(castBodyGeometry(p([cx-1.42,2.67,rackZ-1.8]),p([cx+1.42,cy+.5,rackZ-.75]),.49*s),'#354e41',false,true,'enamel');
  frame.name='elevation-bearing-standard';
  b.mesh(turnedShaftGeometry(p([cx,cy,rackZ-2.15]),p([cx,cy,rackZ+3.2]),[[.84*s,0],[1.07*s,.11],[.73*s,.2],[.73*s,.8],[.88*s,.92],[.8*s,1]]),'#a28454',false,true,'brass');
  const geo=new T.Shape();
  for(let i=0;i<teeth;i++)for(const [f,r] of [[-.5,pitchRadius-.26],[-.36,pitchRadius-.26],[-.225,pitchRadius+.23],[.225,pitchRadius+.23],[.36,pitchRadius-.26]]){
    const a=(i+f)*Math.PI*2/teeth,x=r*s*Math.cos(a),y=r*s*Math.sin(a);if(i===0&&f===-.5)geo.moveTo(x,y);else geo.lineTo(x,y);
  }
  geo.closePath();
  const pinion=b.mesh(new T.ExtrudeGeometry(geo,{depth:.88*s,bevelEnabled:false}),'#937445',false,true,'brass');
  pinion.position.set(...p([cx,cy,rackZ-.44]));
  const wheel=b.mesh(new T.TorusGeometry(4.04*s,.42*s,10,56),'#ae8c52',false,true,'brass');wheel.position.set(...p([cx,cy,rackZ+3.25]));
  const spokeGeo=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2;
    spokeGeo.push(turnedShaftGeometry([0,0,0],[3.96*s*Math.cos(a),3.96*s*Math.sin(a),0],[[.47*s,0],[.46*s,.15],[.22*s,.6],[.29*s,.95],[.27*s,1]]));}
  const spokes=b.mesh(mergeInstrumentGeometry(spokeGeo),'#aa8953',false,true,'brass');spokes.position.copy(wheel.position);
  const grip=b.mesh(turnedShaftGeometry([0,-4.04*s,0],[0,-4.04*s,1.83*s],[[.48*s,0],[.55*s,.16],[.46*s,.34],[.72*s,.68],[.64*s,.86],[.40*s,1]]),'#684831',false,true,'wood');
  grip.position.copy(wheel.position);
  const dial={center:p([cx,cy,rackZ+4.95]),radiusX:4.04*s,radiusY:4.04*s,turns:1};
  for(const m of [pinion,wheel,spokes,grip])m.userData.modelInput={kind:'phase-dial',dial,label:'转动升降手轮，比较同一束光在不同纬度的照射范围'};
  grip.userData.smallPointTarget=true;grip.userData.insolationRole='elevation-crank-grip';
  return (phase:number)=>{
    for(const m of [pinion,wheel,spokes,grip])m.rotation.z=phase*2*Math.PI;
    rack.position.y=link.position.y=phase*range*s;
  };
}

