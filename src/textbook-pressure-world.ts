import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountReadingSlide } from './textbook-specimen-slides';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { pneumaticWorkshop } from './textbook-pneumatic-workshop';
import type { ModelInput } from './textbook-model-input';

/** Two regulated chambers have pressure taps at one height. The left and
 * right menisci in the common liquid move opposite to chamber pressure. */
export function buildPressureWind(b:TextbookGeometry):ModelMotion {
  const s=b.width/100,back=-LIFT_MARGIN-38*s,rise=49*s;
  b.root.position.set(0,rise,-8*s);
  const w=pneumaticWorkshop(b,s,back),{p}=w;
  const conditions:ModelInput[]=['存在气压差','气压相同'].map((label,selection)=>({kind:'select',selection,keepPhase:true,label}));
  w.bed(-1,113,8,62);
  const chamberZ=31,level=16.5;
  const pistons=[14,88].map((x,i)=>{
    w.turn([x,.01,chamberZ],[x,6.5,chamberZ],[[9.8,0],[10.1,.15],[10.0,.26],[8.7,.34],[7.4,.74],[8.8,.85],[8.8,1]],'iron','铸铁气室鼓座');
    w.collar([x,5.7,chamberZ],[x,6.9,chamberZ],8.6,7.27,'brass','黄铜缸口端环');
    w.glassTube([x,6.38,chamberZ],[x,31.3,chamberZ],7.43,'储气缸观察玻璃');
    w.collar([x,30.5,chamberZ],[x,31.8,chamberZ],8.67,7.33,'gold','缸盖外压圈');
    w.turn([x,31.42,chamberZ],[x,34.2,chamberZ],[[8.42,0],[8.38,.22],[7.42,.36],[6.57,.56],[3.1,.8],[2.44,1]],'brass','车削缸盖');
    for(const yaw of [.22,2.35,4.45]){
      const xx=x+8.16*Math.cos(yaw),zz=chamberZ+8.16*Math.sin(yaw);
      w.turn([xx,6.51,zz],[xx,32.6,zz],[[.56,0],[.56,.034],[.31,.045],[.31,.939],[.56,.95],[.56,1]],'steel','气缸拉紧杆');
    }
    const seal=w.turn([x,20.5,chamberZ],[x,22.4,chamberZ],[[7.25,0],[7.25,.15],[7.00,.23],[7.21,.40],[7.21,.53],[7.02,.60],[7.22,.79],[7.22,1]],'bronze','皮碗与活塞');
    const stem=w.turn([x,22.32,chamberZ],[x,38.3,chamberZ],[[1.23,0],[1.23,.10],[.56,.16],[.56,.91],[1.19,.94],[1.19,1]],'steel','加压活塞杆');
    const cap=w.turn([x,38.2,chamberZ],[x,39.25,chamberZ],[[1.28,0],[2.03,.24],[2.03,.72],[1.57,1]],'blue','活塞压帽');
    for(const m of [seal,stem,cap])m.userData.modelInput=conditions[i];return [seal,stem,cap];
  });
  for(const [a,c]of [[18.2,25.4],[76.6,83.8]])w.turn([a,level,chamberZ],[c,level,chamberZ],[[4.09,0],[4.87,.16],[4.93,.33],[3.75,.51],[4.52,.73],[4.52,1]],'bronze','同高风道接头');
  w.glassTube([24.55,level,chamberZ],[78.03,level,chamberZ],4.3,'水平玻璃风道');
  for(const x of [25.4,77.4])w.collar([x-.55,level,chamberZ],[x+.55,level,chamberZ],4.79,4.24,'gold','风道压圈');
  // A U-tube manometer receives both static pressure taps through separate pipes.
  const mx=[45.0,57.0],z=17.1,bottom=19;
  w.box([40.3,15.8,z-1.4],[61.7,40.0,z-.46],'wood','压差计胡桃木衬板',.34);
  w.box([40.85,16.3,z-.47],[61.15,39.47,z-.28],'porcelain','压差计背瓷',.12);
  for(const x of [41.9,60.1])w.turn([x,.02,z-1.3],[x,17.4,z-1.3],[[1.22,0],[1.03,.12],[.48,.18],[.48,.90],[.78,1]],'bronze','压差计支足');
  for(const [i,ch] of [14,88].entries()){
    const x=mx[i];
    w.tubes([[[ch,level,23.6],[ch,level,18.4],[ch,28,13.1],[x,39.9,13.1],[x,38.0,z]]],.40,'bronze','等高取压毛细管');
    w.turn([ch,level,22.8],[ch,level,24.2],[[.96,0],[1.09,.2],[1.09,.8],[.96,1]],'brass','封闭取压口');
    w.glassTube([x,bottom,z],[x,38.3,z],1.04,'压差计透明直肢');
    w.collar([x,37.75,z],[x,38.7,z],1.28,.83,'brass','取压管口铜箍');
  }
  const u=Array.from({length:23},(_,i):Vec3=>{const a=Math.PI+i/22*Math.PI;return[51+6*Math.cos(a),bottom+3.0*Math.sin(a),z]});
  w.glass(new T.TubeGeometry(new T.CatmullRomCurve3(u.map(v=>new T.Vector3(...p(...v)))),44,1.04*s,14,false),'差压计玻璃弯管');
  w.tubes([u],.76,'red','差压计连通液');
  const liquid=mx.map(x=>{
    const g=new T.CylinderGeometry(.74*s,.74*s,s,28);g.translate(0,.5*s,0);
    const m=w.mesh(g,'red','差压计液柱');m.position.set(...p(x,bottom,z));return m;
  });
  const ticks=[];
  for(let j=0;j<15;j++){const h=21+j*1.09,span=j%3===0?2.32:1.17;ticks.push(w.shaftGeo([50.6-span/2,h,z-.15],[50.6+span/2,h,z-.15],[[.067,0],[.067,1]]));}
  w.mesh(mergeInstrumentGeometry(ticks),'ink','等距比较刻纹');
  const dial=mountSpecimenDial(b,p(103,6.4,53.0),5.72*s,{choices:['有压差','等压'],label:'拨动双缸调压阀'});
  const left=w.plaque('相对高压',[13.7,1.55,46.7],17.2,5.45,-.89,conditions[0]);
  const right=w.plaque('相对低压',[88,1.55,46.7],17.2,5.45,-.89,conditions[0]);
  const eqLeft=w.plaque('等压',[13.7,1.55,46.7],17.2,5.45,-.89,conditions[0]);
  const eqRight=w.plaque('等压',[88,1.55,46.7],17.2,5.45,-.89,conditions[0]);
  const track=mountReadingSlide(b,p,s,27,74,3.32,54,'推移测风探针，比较同一高度的气流');
  const pointer=w.tubes([[[27,4.58,53.0],[27,4.6,45],[27,8.6,38],[27,13.3,32.2]]],.29,'steel','测风探针连臂');
  const vane=new T.PlaneGeometry(6.9*s,1.77*s,18,4);vane.translate(3.45*s,0,0);
  const flag=w.mesh(vane,'blue','风道内丝带');const rest=new Float32Array(vane.attributes.position.array);
  const input={kind:'phase-track',track:track.track,label:'沿水平风道推移探针'} as const;
  for(const obj of [pointer,flag])obj.userData.modelInput=input;
  let difference=true,clock=0;
  return {update(phase,selection){
    difference=selection===0;clock=phase;dial(phase,selection);const travel=difference?3.1:0;
    pistons.forEach((parts,i)=>parts.forEach(m=>m.position.y=(i===0?-travel:travel)*s));
    liquid[0].scale.y=9.15-travel;liquid[1].scale.y=9.15+travel;
    left.show(difference);right.show(difference);eqLeft.show(!difference);eqRight.show(!difference);
    track.move(phase);const x=27+47*phase;pointer.position.x=(x-27)*s;
    flag.position.set(...p(x,level,chamberZ));const attr=vane.attributes.position;
    for(let i=0;i<attr.count;i++){const xx=rest[3*i],yy=rest[3*i+1],t=xx/(6.9*s);
      attr.setXYZ(i,difference?xx:.31*xx+.90*yy,difference?yy-.23*s*t:yy*.5-2.45*s*t,
        difference?.39*s*t*Math.sin(t*7-2*Math.PI*phase*3):.10*s*t);}
    attr.needsUpdate=true;vane.computeVertexNormals();vane.computeBoundingSphere();
    if(difference)b.trace([p(24,level,chamberZ),p(79,level,chamberZ)],phase*2,3,'flow',.87,.76);
    w.glassMaterial.depthWrite=false;
  },describe:()=>({kind:'pressure-gradient-wind',origin:'textbook-paragraph',sameHeight:true,pressureDifference:difference,
    windDirection:difference?'high-to-low':'none-in-this-idealized-component',phase:clock,elevatedAbovePage:rise,measuredPressure:false,
    specimenConstruction:'coupled-piston-chambers-and-differential-manometer',gaugeCentreHeight:level,relativeReadouts:difference?[1,-1]:[0,0],
    meniscusHeights:liquid.map(m=>bottom+m.scale.y),probeX:27+47*clock,nativeConditionSelector:true}),
    focusBounds:()=>({min:p(-4,-6,5),max:p(116,45,66)})};
}
