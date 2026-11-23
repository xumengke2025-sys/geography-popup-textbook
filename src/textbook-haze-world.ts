import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountReadingSlide, mountSpecimenKeys } from './textbook-specimen-slides';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { pneumaticWorkshop } from './textbook-pneumatic-workshop';
import { evaluateHaze } from './textbook-haze-model';
import type { ModelInput } from './textbook-model-input';

function smokePlate() {
  const width=96,bytes=new Uint8Array(width*width*4);
  for(let j=0;j<width;j++)for(let i=0;i<width;i++){
    const x=2*(i+.5)/width-1,y=2*(j+.5)/width-1,a=Math.atan2(y,x);
    const radius=Math.hypot(x,y)*(1+.103*Math.sin(a*3+.86)+.083*Math.cos(a*5-.32));
    const v=Math.max(0,1-radius),turb=.78+.13*Math.sin(x*9+y*6+.7*Math.sin(y*14))+.09*Math.cos(y*9-x*8);
    const k=(j*width+i)*4;bytes.set([242,235,215,Math.round(240*v**1.36*turb)],k);
  }
  const t=new T.DataTexture(bytes,width,width,T.RGBAFormat);t.needsUpdate=true;t.magFilter=T.LinearFilter;
  t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=T.SRGBColorSpace;return t;
}

/** The common marked sample cavity has an adjustable air inlet, a separate
 * emission gate and an observation cassette. Its output is qualitative. */
export function buildHazeWorld(b:TextbookGeometry):ModelMotion {
  const s=b.width/100,back=-LIFT_MARGIN-72*s,w=pneumaticWorkshop(b,s,back),{p}=w;
  w.bed(-7.8,117,13,72.5);
  const source:ModelInput={kind:'select',selection:2,toggleTo:0,keepPhase:true,label:'比较减排与原排放'};
  const vent:ModelInput={kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'比较通风扩散与微风'};
  const glassBottom=3,glassTop=45.8;
  w.box([2.2,.03,19],[109,2.63,57.7],'bronze','铸铜烟箱底框',.41);
  w.box([3.2,2.63,20.0],[108.1,2.91,56.9],'slate','烟箱密封底板');
  const strips:Vec3[][]=[];
  for(const x of [2.3,108.4])for(const z of [19.4,57.3]){
    w.turn([x,2.6,z],[x,46.7,z],[[.97,0],[1.14,.02],[.81,.055],[.38,.082],[.38,.92],[.75,.95],[.84,.965],[.86,1]],'brass','烟箱黄铜角柱');
  }
  for(const z of [19.4,57.3])strips.push([[2.3,45.92,z],[108.4,45.92,z]]);
  for(const x of [2.3,108.4])strips.push([[x,45.92,19.4],[x,45.92,57.3]]);
  w.tubes(strips,.36,'brass','玻璃顶缘铜压条');
  function pane(center:Vec3,width:number,height:number,rotation:Vec3,name:string){
    const g=new T.PlaneGeometry(width*s,height*s);g.rotateX(rotation[0]);g.rotateY(rotation[1]);g.translate(...p(...center));w.glass(g,name);
  }
  pane([55.35,(glassBottom+glassTop)/2,19.4],106.1,glassTop-glassBottom,[0,0,0],'后观察窗');
  pane([55.35,(glassBottom+glassTop)/2,57.3],106.1,glassTop-glassBottom,[0,0,0],'前观察窗');
  pane([55.35,glassTop,38.35],106.1,37.9,[-Math.PI/2,0,0],'烟箱玻璃盖');
  // Open inlet and exhaust plenums are located at the sides. The fan drives
  // transport through the sample region; the emission gate feeds it independently.
  for(const x of [2,108]){
    w.collar([x-2.28,31.3,38.2],[x+2.28,31.3,38.2],7.52,6.78,'bronze','通风管口');
    w.collar([x-2.48,31.3,38.2],[x-1.80,31.3,38.2],7.95,6.85,'gold','进排气压环');
    w.turn([x,2.9,38.2],[x,24.4,38.2],[[1.63,0],[1.75,.08],[.80,.19],[.57,.83],[1.26,.95],[1.26,1]],'iron','风筒支脚');
  }
  const motor=w.turn([-6.9,31.3,38.2],[1.0,31.3,38.2],[[2.55,0],[3.24,.12],[3.14,.29],[2.07,.72],[.76,1]],'iron','鼓风轴承座');motor.userData.modelInput=vent;
  const fan=new T.Group();fan.position.set(...p(.8,31.3,38.2));b.root.add(fan);
  const blades=[];
  for(let i=0;i<6;i++){
    const g=new T.BufferGeometry(),a=i*Math.PI/3,vs:number[]=[];
    for(const [r,angle,off]of [[1.12,-.22,.0],[2.60,-.05,.12],[5.97,.12,.68],[6.2,.53,.1],[2.30,.32,-.22]]){
      vs.push(off*s,r*Math.cos(a+angle)*s,r*Math.sin(a+angle)*s);}
    g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex([0,1,2,0,2,3,0,3,4]);g.computeVertexNormals();blades.push(g);
  }
  const blade=w.mesh(mergeInstrumentGeometry(blades),'bronze','六叶通风扇');fan.add(blade);blade.userData.modelInput=vent;
  const grill:Vec3[][]=[];for(let j=-2;j<=2;j++){const y=j*2.18,span=Math.sqrt(6.6*6.6-y*y);grill.push([[110.2,31.3+y,38.2-span],[110.2,31.3+y,38.2+span]]);}
  w.tubes(grill,.11,'ink','出口防护格栅');
  // The inlet is the same point used by every newly emitted parcel.
  const pot=w.turn([17,2.92,40],[17,15.35,40],[[3.9,0],[4.18,.06],[4.13,.13],[3.58,.2],[3.58,.72],[4.0,.76],[3.96,.81],[3.38,.90],[1.24,1]],'bronze','示踪烟发生罐');
  const spout=w.collar([17,15.3,40],[17,19.01,40],1.21,.66,'ink','示踪烟口');
  const line=w.tubes([[[17,9,43.3],[17,9,50.1],[17,5.1,55.1],[17,5.1,60.8]]],.47,'bronze','排放阀传动');
  const valve=new T.Group();valve.position.set(...p(17,6.55,61));b.root.add(valve);
  const rim=w.mesh(new T.TorusGeometry(3.16*s,.36*s,9,48),'red','进烟阀手轮');valve.add(rim);
  const spokes=[];
  for(let j=0;j<3;j++){const a=j*2*Math.PI/3,g=new T.CylinderGeometry(.16*s,.16*s,3.12*s,8);g.rotateZ(a-Math.PI/2);g.translate(1.56*s*Math.cos(a),1.56*s*Math.sin(a),0);spokes.push(g);}
  valve.add(w.mesh(mergeInstrumentGeometry(spokes),'brass','进烟阀辐条'));
  for(const ob of [pot,spout,line,...valve.children]){ob.userData.modelInput=source;ob.userData.emissionValve=true;}
  // Opal backing gives the dispersed tracer a light field on a dark bench.
  // Its bead, corner escutcheons and screw slots are separate physical parts.
  w.box([4.0,4.5,18.85],[107.0,42.6,19.08],'walnut','乳白观察屏木框',.28);
  w.box([4.81,5.30,19.10],[106.2,41.83,19.29],'porcelain','乳白观察衬屏',.14);
  for(const x of [5.6,105.5])for(const h of [6.05,41.1]){
    w.turn([x,h,19.24],[x,h,19.64],[[.49,0],[.55,.43],[.46,1]],'brass','视板沉头螺钉');
    w.tubes([[[x-.24,h-.12,19.65],[x+.24,h+.12,19.65]]],.048,'ink','螺钉直槽');
  }
  // A single achromatic contrast board makes the smoke density apparent in
  // one fixed direction. The nearby low rooftops give a stationary reference.
  w.box([67,10.4,22],[78,21.8,23],'bronze','黑白视标铜框');
  for(const x of [69,76])w.turn([x,2.96,22.5],[x,10.45,22.5],[[.52,0],[.52,.12],[.25,.23],[.25,1]],'steel','视标支杆');
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)
    w.box([67.54+col*2.47,10.91+row*2.57,23.01],[70.02+col*2.47,13.49+row*2.57,23.17],(row+col)%2?'ink':'porcelain','黑白对比视标',.012);
  for(const [x,z,h]of [[37,33,8.15],[46,28,9.2],[54,37,6.85]]){
    w.box([x-3.20,2.95,z-2.14],[x+3.20,h,z+2.14],'porcelain','街区石舍',.12);
    const g=new T.BufferGeometry();const pts:Vec3[]=[[x-3.60,h,z-2.53],[x+3.60,h,z-2.53],[x+3.60,h,z+2.53],[x-3.60,h,z+2.53],[x-3.60,h+1.72,z],[x+3.60,h+1.72,z]];
    g.setAttribute('position',new T.Float32BufferAttribute(pts.flatMap(v=>p(...v)),3));g.setIndex([0,4,5,0,5,1,3,2,5,3,5,4,0,3,4,1,5,2]);g.computeVertexNormals();w.mesh(g,'slate','石舍瓦顶');
    for(const dx of [-1.65,0,1.65])w.box([x+dx-.30,4.2,z+2.15],[x+dx+.30,5.30,z+2.28],'ink','测距参照立窗',.025);
  }
  const flag=w.mesh(new T.PlaneGeometry(6.58*s,2.97*s,15,3),'blue','排风侧丝旗');flag.userData.modelInput=vent;flag.userData.windFlag=true;flag.position.set(...p(102,28.9,53.4));
  w.turn([102,2.94,53.4],[102,29.45,53.4],[[.40,0],[.42,.03],[.15,.08],[.15,.97],[.32,1]],'steel','风旗支杆');
  const flagRest=new Float32Array(flag.geometry.attributes.position.array);
  const names=['排放积聚','通风扩散','减少排放'];const keys=mountSpecimenKeys(b,p,s,[41,62,83],names,1.6,70.0,18);
  const reader=mountReadingSlide(b,p,s,35,88,4.15,62.6,'沿时间尺推移观察滤片，比较污染物留存');
  const filter=w.mesh(new T.CircleGeometry(3.13*s,42),'porcelain','定性留存滤片');filter.material=createSpecimenMaterial(b.pop,{color:'#d4ceac',role:'ivory'});
  const bezel=w.mesh(new T.TorusGeometry(3.31*s,.35*s,9,48),'brass','取样滤片夹');const filterInput={kind:'phase-track',track:reader.track,label:'移动滤片读数'} as const;
  for(const m of [filter,bezel])m.userData.modelInput=filterInput;
  w.plaque('进烟',[8.3,1.53,66.7],10.1,4.6,-.81,source);
  w.plaque('通风',[104.1,1.53,66.7],12.1,4.6,-.81,vent);
  let state=evaluateHaze(0,0),previous=-1,previousMode=-1;
  const count=state.particles.length,xyz=new Float32Array(count*12),centers=new Float32Array(count*12),uv:number[]=[],idx:number[]=[];
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let i=0;i<count;i++){
    const j=i*4,turn=i%4;
    for(let k=0;k<4;k++){const [u,v]=corners[(k+turn)%4];uv.push((u+1)/2,(v+1)/2);}
    idx.push(j,j+1,j+2,j,j+2,j+3);
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(xyz,3).setUsage(T.DynamicDrawUsage));
  geom.setAttribute('plumeCenter',new T.BufferAttribute(centers,3).setUsage(T.DynamicDrawUsage));
  geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(idx);
  const parcels=b.mesh(geom,'#726f65',false,false,'air');parcels.name='悬浮气溶胶示踪团';parcels.userData.pollutionParcels=true;parcels.frustumCulled=false;parcels.castShadow=false;
  const fog=createSpecimenMaterial(b.pop,{color:'#746d62',role:'air'});const texture=smokePlate();
  fog.map=texture;fog.addEventListener('dispose',()=>texture.dispose());fog.opacity=.86;fog.transparent=true;fog.depthWrite=false;fog.side=T.DoubleSide;fog.forceSinglePass=true;fog.roughness=.91;
  // A translucent tracer has one optical footprint from every viewing angle.
  // Orient its density screen in the camera plane to avoid crossing dark seams.
  const prepare=fog.onBeforeCompile;
  fog.onBeforeCompile=(shader:any,renderer:any)=>{
    prepare.call(fog,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 plumeCenter;')
      .replace('#include <project_vertex>',`vec4 mvPosition=modelViewMatrix*vec4(plumeCenter,1.);
        mvPosition.xy+=(position.xy-plumeCenter.xy)*vec2(length(modelViewMatrix[0].xyz),length(modelViewMatrix[1].xyz));
        gl_Position=projectionMatrix*mvPosition;`);
  };
  fog.customProgramCacheKey=()=>'pneumatic-tracer-view-v1';
  parcels.material=fog;parcels.renderOrder=2;parcels.raycast=()=>{};
  const fresh=new T.Color('#ded9c0'),dark=new T.Color('#5a6155');
  return {update(t,condition){
    if(previous!==t||previousMode!==condition){state=evaluateHaze(t,condition);previous=t;previousMode=condition;
      for(const q of state.particles){
        const radius=q.visible?q.size*(q.cohort==='existing'?4.9:4.2):0,c=p(q.x,q.y,q.z);
        for(let j=0;j<4;j++){
          const [u,v]=corners[j],k=(q.id*4+j)*3;
          xyz[k]=c[0]+u*radius*1.21*s;xyz[k+1]=c[1]+v*radius*.88*s;xyz[k+2]=c[2];
          centers[k]=c[0];centers[k+1]=c[1];centers[k+2]=c[2];
        }
      }
      geom.attributes.position.needsUpdate=true;geom.attributes.plumeCenter.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingSphere();
    }
    reader.move(t);keys(condition);const x=35+53*t;bezel.position.set(...p(x,9.02,62.7));filter.position.set(...p(x,9.02,62.77));filter.material.color.copy(fresh).lerp(dark,Math.min(1,state.stock/80));
    valve.rotation.z=(1-state.sourceRate)*.91/.82;fan.rotation.x=state.fanAngle;
    const a=flag.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const u=flagRest[3*i]/(6.58*s)+.5,v=flagRest[3*i+1]/(2.97*s)+.5,f=.14+.86*state.windStrength;
      a.setXYZ(i,6.58*s*u*f,-(1-v)*2.97*s-u*(1-f)*5.04*s,Math.sin(u*7-13*t)*u*f*.5*s);}
    a.needsUpdate=true;flag.geometry.computeVertexNormals();flag.geometry.computeBoundingSphere();w.glassMaterial.depthWrite=fog.depthWrite=false;
  },focusBounds:()=>({min:p(-10,-6,10),max:p(120,49,76)}),
  describe:()=>({...state,particles:undefined,parcelSample:state.particles.filter(q=>q.visible).slice(0,8),originalPagePreserved:true,sameInitialStock:true,
    directTargets:['chimney','wind-flag','ventilation-fan','source-valve','filter-carriage'],batchedParcelMesh:true,meshCountDoesNotGrow:true,
    chamber:'glass-observation-and-independent-source',filterReading:Math.min(1,state.stock/80),fanAngle:fan.rotation.x})};
}
