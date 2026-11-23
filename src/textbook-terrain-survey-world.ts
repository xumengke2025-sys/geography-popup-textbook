import { surveyOutcrop } from './textbook-survey-outcrops';
import { mountSurveyTalus } from './textbook-survey-talus';
import { THREE as T } from './reference/engine.js';
import { createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { updateLabelSlip } from './textbook-label-slip';
import { mountSpecimenKeys } from './textbook-specimen-slides';
import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { LIFT_MARGIN, type ModelMotion,type TextbookGeometry,type Vec3 } from './textbook-geometry';
import { SURVEY_GRID as G,SURVEY_MODES,SURVEY_MODE_IDS,sampleSurvey,surveyFacies,surveyNodes,surveyReading } from './textbook-terrain-survey';

export function terrainSurveyWorld(b:TextbookGeometry):ModelMotion {
  const s=b.width/100,z0=-LIFT_MARGIN-b.height*.86;
  const p=(x:number,y:number,z:number):Vec3=>[x*s,y*s,z0+z*s];
  const hw=createInstrumentParts(b),top:number[]=[],colors:number[]=[],facies:number[]=[],indices:number[]=[];
  for(const {x,h,z} of surveyNodes){
    top.push(...p(x,h,z));
    const [rock,gravel,turf]=surveyFacies(x,z),out=surveyOutcrop(x,z,h);
    const exposed=Math.max(out.face,out.crown),bedrock=Math.max(rock,exposed);
    facies.push(bedrock,gravel*(1-exposed),turf*(1-exposed));
    const fleck=.95+.07*Math.sin(x*.88+z*.5)*Math.cos(z*.4-x*.6);
    const shade=1-.35*out.face-.22*out.weathered;
    colors.push(shade*fleck*(.80+.10*rock-.38*turf-.08*out.crown),
      shade*fleck*(.74+.20*rock-.11*turf+.025*out.crown),
      shade*fleck*(.60+.29*rock-.32*turf+.12*out.crown));
  }
  for(let j=0;j<G.nz;j++)for(let i=0;i<G.nx;i++){
    const a=j*(G.nx+1)+i,e=a+G.nx+1;indices.push(a,e,a+1,a+1,e,e+1);
  }
  const scanned=(pos:number[],tone:number[],blend:number[],ix:number[],tag:string,tile:number)=>{
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(tone,3));geo.setAttribute('facies',new T.Float32BufferAttribute(blend,3));
    geo.setIndex(ix);geo.computeVertexNormals();
    const m=b.mesh(geo,'#cec7b0',false);m.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#cec7b0'}),'valley',tile*s);
    m.material.vertexColors=true;m.userData.surveyRole=tag;return m;
  };
  const land=scanned(top,colors,facies,indices,'sampled-terrain',10.2);
  land.userData.landformDetail='测坡标本的层状岩脊与节理陡坎';
  mountSurveyTalus(b,p,s);
  const edge:number[]=[];
  for(let i=0;i<=G.nx;i++)edge.push(i);
  for(let j=1;j<=G.nz;j++)edge.push(j*(G.nx+1)+G.nx);
  for(let i=G.nx-1;i>=0;i--)edge.push(G.nz*(G.nx+1)+i);
  for(let j=G.nz-1;j>0;j--)edge.push(j*(G.nx+1));
  const walls:number[]=[],tones:number[]=[],fmap:number[]=[],sides:number[]=[];
  const beds=['#a6947d','#b9aa91','#9f9788','#c2b59f','#aaa591','#b8a589','#9f886d','#83775b'];
  for(let layer=0;layer<beds.length;layer++){
    const color=new T.Color(beds[layer]),k=walls.length/3;
    for(const idx of [...edge,edge[0]]){
      const {x,z,h}=surveyNodes[idx],rock=facies[3*idx];
      const soil=Math.min(h-.45,.28+(1-rock)*1.05);
      const bed=(i:number)=>i===0?0:i===8?h:i===7?h-soil:
        Math.min(h-soil,1.25+i*2.45+.032*x+.46*Math.sin(x*.145+z*.13+i*.17)+.22*Math.cos(z*.4-x*.11));
      for(const i of [layer,layer+1]){
        walls.push(...p(x,bed(i),z));tones.push(color.r,color.g,color.b);
        fmap.push(layer===7?.05:.81,layer===7?.52:.09,0);
      }
    }
    for(let j=0;j<edge.length;j++){const a=k+j*2;sides.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  scanned(walls,tones,fmap,sides,'soil-and-rock-cut',11);
  hw.plate(p(3,-4.5,2),p(98,-.22,72.5),'wood',.65*s);
  const datum=hw.plate(p(4,-.25,3),p(97,0,71.5),'steel',.11*s);
  datum.material=createSpecimenMaterial(b.pop,{role:'enamel',color:'#527573'});
  datum.userData.modelInput={kind:'select',selection:0,keepPhase:true,label:'查看测点到海平面基准的垂直距离'};
  for(const x of [8,93])for(const z of [7,67])hw.column(p(x,-7,z),p(x,-4.45,z),2*s,'brass');
  for(const x of [9,92]){
    hw.column(p(x,0,4.5),p(x,39.55,4.5),2.05*s,'brass');
    hw.casting(p(x-1.7,38.65,2.45),p(x+1.7,42.85,7.9),'steel',.38*s);
  }
  hw.shaft(p(9,40.8,4.3),p(92,40.8,4.3),.54*s,'steel');
  hw.shaft(p(9,39.5,7.15),p(92,39.5,7.15),.34*s,'brass');
  hw.etchedScale(p(10,39.5,5.95),p(91,39.5,5.95),{width:1.1*s,ticks:39,majorEvery:5});
  const track={start:p(15,42.3,6.8),end:p(86,42.3,6.8)};
  const grab={kind:'phase-track',track,label:'拖动后横梁上的黄铜滑座，探针随地面升降'};
  const carriage=hw.casting(p(13.15,39.1,2.8),p(16.85,42.1,8.1),'brass',.38*s);
  const thumb=hw.knob(p(15,42.3,6.8),[0,0,1],1.6*s,1.4*s);
  for(const m of [carriage,...thumb.children]){m.userData.modelInput=grab;m.userData.smallPointTarget=true;m.userData.surveyRole='probe-carriage';}
  const segment=(radius:number,substance:'steel'|'brass'|'enamel',color:string,name:string)=>{
    const m=b.mesh(new T.CylinderGeometry(radius*s,radius*s,1,16),color,false,true,substance);
    m.userData.surveyRole=name;return m;
  };
  const axial=new T.Vector3(0,1,0),from=new T.Vector3(),to=new T.Vector3();
  const set=(m:any,a:Vec3,e:Vec3)=>{
    from.set(...a);to.set(...e).sub(from);m.scale.y=Math.max(.0001,to.length());
    m.position.copy(from).addScaledVector(to,.5);
    if(to.lengthSq()>1e-8)m.quaternion.setFromUnitVectors(axial,to.normalize());
  };
  const arm=segment(.34,'steel','#737c76','cross-slide'),sleeve=segment(.73,'brass','#ab8a4e','probe-sleeve'),stem=segment(.24,'steel','#959d99','measuring-stylus');
  const tip=b.mesh(turnedShaftGeometry([0,0,0],[0,1.17*s,0],[[.035*s,0],[.30*s,.62],[.36*s,1]]),'#ab864a',false,true,'brass');
  tip.userData.surveyRole='ground-contact';
  const bridge=b.mesh(new T.SphereGeometry(.88*s,18,12),'#a68145',false,true,'brass');
  const fixed=surveyReading(0,0).fixed;
  const pin=hw.shaft(p(fixed.x,fixed.h-.2,fixed.z),p(fixed.x,fixed.h+2.2,fixed.z),.17*s,'brass');
  const fixedLabel=b.label('山脊基点',p(fixed.x,fixed.h+4.35,fixed.z),13.8*s,3.95*s);
  const controls=mountSpecimenKeys(b,p,s,[18,39,60,81],SURVEY_MODES.slice(),1.3,71,17.5);
  hw.plate(p(97.25,0,19),p(120,1.8,44),'wood',.28*s);
  const staff=hw.column(p(106.9,1.8,33),p(106.9,31.75,33),1.02*s,'brass');
  const scale=hw.plate(p(103.8,2.2,32.7),p(105.15,31.65,33.45),'ivory',.12*s);
  const etched=hw.etchedScale(p(104.45,2.35,33.55),p(104.45,31.2,33.55),{ticks:21,width:.85*s,majorEvery:5});
  const running=segment(.28,'brass','#b48b4c','height-index'),reference=segment(.18,'steel','#69736d','height-reference');
  const rocker=segment(.32,'brass','#ae8649','secant-arm'),base=segment(.19,'steel','#687268','secant-base');
  const sectorShape=new T.Shape();
  sectorShape.moveTo(0,0);sectorShape.absarc(0,0,15*s,0,Math.PI*.45,false);sectorShape.lineTo(0,0);
  const sectorGeometry=new T.ExtrudeGeometry(sectorShape,{depth:.38*s,bevelEnabled:false,curveSegments:48});
  sectorGeometry.translate(...p(99.9,5,36.46));
  const sector=b.mesh(sectorGeometry,'#b9a473',false,true,'brass');
  const marks:ReturnType<typeof segment>[]=[];
  for(let i=0;i<=12;i++){
    const theta=i*Math.PI*.45/12,r=i%3===0?12.9:13.9;
    const tick=segment(.085,'enamel','#4f554b','sector-index');
    set(tick,p(99.9+r*Math.cos(theta),5+r*Math.sin(theta),36.91),
      p(99.9+14.7*Math.cos(theta),5+14.7*Math.sin(theta),36.91));
    marks.push(tick);
  }
  const axle=hw.bearing(p(99.9,5,36.8),[0,0,1],.85*s,1.27*s);
  const sectorBase=hw.casting(p(98.5,1.8,35.1),p(101.4,5,37.4),'steel',.17*s);
  const compass=hw.knob(p(108,4,38),[0,1,0],5.2*s,1.2*s);
  const rose=b.mesh(new T.CylinderGeometry(4.5*s,4.5*s,.14*s,48),'#dad2b7',false,true,'ivory');
  rose.position.set(...p(108,4.69,38));
  const divisions:ReturnType<typeof segment>[]=[];
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,r=i%4===0?2.65:i%2===0?3.25:3.83;
    const line=segment(.081,'enamel','#4e544b','compass-index');
    set(line,p(108+r*Math.sin(a),4.83,38+r*Math.cos(a)),p(108+4.35*Math.sin(a),4.83,38+4.35*Math.cos(a)));
    divisions.push(line);
  }
  const pointer=segment(.34,'brass','#b98c48','aspect-pointer');
  const tipCap=b.mesh(new T.ConeGeometry(.79*s,1.6*s,18),'#aa693c',false,true,'enamel');
  const north=b.label('北',p(108,4.95,31.7),4.2*s,3.5*s),south=b.label('南',p(108,4.95,44.2),4.2*s,3.5*s);
  const heading=SURVEY_MODES.map((name,i)=>b.label(i===2?'两点间坡度':i===3?'测点坡向':name,p(108.6,0,48.0),18*s,4.6*s));
  const sun=b.mesh(new T.SphereGeometry(1.6*s,20,14),'#c8a768',false,true,'brass');sun.position.set(...p(94,13,60));
  const sunFoot=hw.column(p(94,0,60),p(94,11.5,60),.67*s,'brass');
  const datumTag=b.label('海平面基准',p(14,4.1,62.3),15.5*s,3.7*s);
  const lampLabel=b.label('南侧日照',p(94,17,60),12*s,3.7*s);
  let read=surveyReading(0,0);
  const update=(phase:number,n:number)=>{
    read=surveyReading(phase,n);const q=read.point,mode=read.mode,world=p(q.x,q.h,q.z);
    carriage.position.x=thumb.position.x=(q.x-15)*s;controls(mode);
    set(arm,p(q.x,40.05,6),p(q.x,40.05,q.z));bridge.position.set(...p(q.x,40.05,q.z));
    set(sleeve,p(q.x,40.0,q.z),p(q.x,36.85,q.z));
    set(stem,p(q.x,36.95,q.z),p(q.x,q.h+1.02,q.z));tip.position.set(...world);
    pin.visible=fixedLabel.visible=mode===1||mode===2;
    running.visible=reference.visible=scale.visible=etched.visible=staff.visible=mode<=1;
    rocker.visible=base.visible=sector.visible=axle.visible=sectorBase.visible=mode===2;
    marks.forEach(m=>m.visible=mode===2);
    compass.visible=rose.visible=pointer.visible=tipCap.visible=north.visible=south.visible=sun.visible=sunFoot.visible=lampLabel.visible=mode===3;
    divisions.forEach(m=>m.visible=mode===3);
    heading.forEach((m,i)=>m.visible=i===mode);datumTag.visible=mode===0;
    const readHeight=(h:number)=>2.55+h*.83;
    if(mode<=1){
      set(running,p(103.8,readHeight(q.h),33.8),p(110.2,readHeight(q.h),33.8));
      const ref=readHeight(mode===0?0:fixed.h);
      set(reference,p(103.8,ref,33.8),p(110.2,ref,33.8));
      b.contour([p(109.5,ref,33.8),p(109.5,readHeight(q.h),33.8)],.38);
    }else if(mode===2){
      const a=p(99.9,5.0,37),length=15,theta=read.slopeRadians;
      set(rocker,a,p(99.9+length*Math.cos(theta),5+length*Math.sin(theta),37.28));
      set(base,a,p(99.9+length,5,37));
      b.contour([world,p(fixed.x,fixed.h,fixed.z)],.49);
    }else if(read.aspect){
      updateLabelSlip(heading[3],read.cardinal+'坡'+(read.exposure?' · '+read.exposure:''));
      const d=read.aspect,start=p(108,5.03,38),end=p(108+3.95*d.x,5.03,38+3.95*d.z);
      set(pointer,start,end);tipCap.position.set(...end);
      tipCap.quaternion.setFromUnitVectors(axial,new T.Vector3(d.x,0,d.z).normalize());
    }
  };
  update(0,0);
  return {update,focusBounds:()=>({min:p(2,-7,1),max:p(121,46,75)}),describe:()=>{
    const q=read.point;
    return {kind:'terrain-observation',selection:SURVEY_MODE_IDS[read.mode],phase:read.phase,phaseMeaning:'moving-observation-point',
      commonEndpoints:{high:p(fixed.x,fixed.h,fixed.z),low:p(q.x,q.h,q.z)},absoluteHeight:read.absoluteHeight,relativeHeight:read.relativeHeight,
      horizontalDistance:read.horizontalDistance,slopeRadians:read.slopeRadians,downhillAzimuth:read.azimuth,cardinalAspect:read.cardinal,exposure:read.exposure,
      probeTip:tip.position.toArray(),sampleTriangle:q.faceIndex,source:land.userData.surveyRole,measuredElevations:false,
      datum:'sea-level-reference',displayedDistancesAreMeasured:false,slopeFromSameTerrain:true,aspectAssumption:'northern-mid-latitudes',northIsNegativeZ:true,buffersStable:true};}};
}
