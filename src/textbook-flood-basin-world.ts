import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN,type ModelMotion,type TextbookGeometry,type Vec3 } from './textbook-geometry';
import { createInstrumentParts } from './textbook-instrument-parts';
import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { mountFloodRecorder } from './textbook-hydrology-recorders';
import { updateLabelSlip } from './textbook-label-slip';
import { evaluateFloodSequence } from './textbook-ground-process-model';
import { floodGrid as G,basinNodes,basinIndices,floodChannel,floodSites,floodSample,tributaries,connectedFlood } from './textbook-flood-basin';

export function floodBasinWorld(b:TextbookGeometry):ModelMotion {
  const s=b.width/100,z0=-LIFT_MARGIN-78*s,p=(x:number,z:number,y=0):Vec3=>[x*s,y*s,z0+z*s];
  const hw=createInstrumentParts(b),pos:number[]=[],tone:number[]=[],facies:number[]=[];
  const role=(m:any,name:string)=>{m.userData.floodRole=name;return m};
  const bedTint=new T.Color('#ac997c'),turfTint=new T.Color('#838b65'),rockTint=new T.Color('#a8a49a'),gravelTint=new T.Color('#b4aba0');
  for(const n of basinNodes){
    const across=Math.abs(n.x-floodChannel(n.z)),rock=Math.min(.9,Math.max(0,(n.h-8)/10))*(.7+.27*Math.cos(.26*n.x-.32*n.z));
    const gravel=(1-rock)*(.18+.54*Math.max(0,1-across/10)),turf=(1-rock-gravel)*(.63+.23*Math.sin(.2*n.x-.19*n.z));
    const pigment=bedTint.clone().lerp(turfTint,turf).lerp(rockTint,rock).lerp(gravelTint,gravel);
    pigment.multiplyScalar(.90+.09*Math.sin(n.x*.24+n.z*.12)+.045*Math.cos(n.x*.45-n.z*.18));
    pos.push(...p(n.x,n.z,n.h));tone.push(pigment.r,pigment.g,pigment.b);facies.push(rock,gravel,turf);
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geom.setAttribute('color',new T.Float32BufferAttribute(tone,3));geom.setAttribute('facies',new T.Float32BufferAttribute(facies,3));
  geom.setIndex(basinIndices);geom.computeVertexNormals();
  const land=role(b.mesh(geom,'#d9c9b1',false),'catchment');
  land.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#ffffff'}),'valley',13*s);land.material.vertexColors=true;
  const edge:number[]=[];
  for(let i=0;i<=G.nx;i++)edge.push(i);
  for(let j=1;j<=G.nz;j++)edge.push(j*(G.nx+1)+G.nx);
  for(let i=G.nx-1;i>=0;i--)edge.push(G.nz*(G.nx+1)+i);
  for(let j=G.nz-1;j>0;j--)edge.push(j*(G.nx+1));
  const cut:number[]=[],paint:number[]=[],ix:number[]=[];
  for(const j of [0,1,2]){
    const first=cut.length/3;
    for(const i of [...edge,edge[0]]){
      const n=basinNodes[i],bands=[0,Math.min(n.h-.7,1.6+.33*Math.sin(n.x*.15+n.z*.19)),n.h-.58,n.h];
      for(const l of [j,j+1]){
        cut.push(...p(n.x,n.z,bands[l]));const c=new T.Color(['#a18f7c','#b59a78','#807650'][j]);paint.push(c.r,c.g,c.b);
      }
    }
    for(let i=0;i<edge.length;i++){const k=first+i*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const wallGeometry=new T.BufferGeometry();wallGeometry.setAttribute('position',new T.Float32BufferAttribute(cut,3));wallGeometry.setAttribute('color',new T.Float32BufferAttribute(paint,3));
  wallGeometry.setIndex(ix);wallGeometry.computeVertexNormals();
  const walls=role(b.mesh(wallGeometry,'#dfcdb0',false),'alluvial-cut');walls.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#ffffff'}),'alluvium',8*s);walls.material.vertexColors=true;

  const waterGeometry=new T.BufferGeometry(),capacity=basinIndices.length*2;
  const vertices=new T.Float32BufferAttribute(new Float32Array(capacity*3),3),normals=new T.Float32BufferAttribute(new Float32Array(capacity*3),3);
  const waterTones=new T.Float32BufferAttribute(new Float32Array(capacity*3),3);
  waterGeometry.setAttribute('position',vertices);waterGeometry.setAttribute('normal',normals);waterGeometry.setAttribute('color',waterTones);
  const water=role(b.mesh(waterGeometry,'#618b8d',false,false,'water'),'river-connected-water');
  water.material=createSpecimenMaterial(b.pop,{role:'water',color:'#618b8d'});
  water.material.vertexColors=true;water.material.transparent=true;water.material.opacity=.78;water.material.depthWrite=false;water.castShadow=false;
  const replay={kind:'replay',selection:1,label:'从强降水开始复查坡面汇流与低地淹水'};
  water.userData.modelInput=replay;
  function house(x:number,z:number,i:number){
    const ground=floodSample(x,z).h,k=i===1?.85:1;
    const wall=b.box(p(x-2.3*k,z-1.65*k,ground),p(x+2.3*k,z+1.65*k,ground+3.7*k),'#e1d6bd',false);
    const roof=role(b.mesh(new T.ConeGeometry(3.8*k*s,2.7*k*s,4).rotateY(Math.PI/4),'#735e50',false,true,'rock'),'house-roof');
    roof.position.set(...p(x,z,ground+5*k));roof.scale.z=.78;
    const door=b.box(p(x-.56*k,z+1.64*k,ground+.1),p(x+.56*k,z+1.72*k,ground+2.24*k),'#574737',false);
    for(const m of [wall,roof,door])m.userData.modelInput=replay;
  }
  floodSites.forEach(([x,z],i)=>house(x,z,i));

  // A distributor on two standards wets the headwater slopes. The recorded
  // stage drives a real float at the outlet and the existing hydrograph.
  const mounts=[[10,13],[43,13]];
  for(const [x,z] of mounts){
    const h=floodSample(x,z).h;hw.column(p(x,z,h-.1),p(x,z,28.5),1.08*s,'brass');
    hw.bearing(p(x,z,28.45),[1,0,0],.92*s,1.6*s);
  }
  hw.shaft(p(8,13,28.45),p(45,13,28.45),.54*s,'brass');
  const wetHeads:number[][]=[];
  for(const x of [15,24,33,42]){
    hw.shaft(p(x,13,28.45),p(x,24,28.45),.32*s,'steel');
    for(const z of [17,23]){
      const nozzle=hw.bearing(p(x,z,27.99),[0,1,0],.70*s,.86*s);
      nozzle.traverse((m:any)=>{if(m.isMesh)m.userData.modelInput=replay});wetHeads.push([x,z]);
    }
  }
  const gaugeZ=57.5,outlet=floodChannel(gaugeZ);
  hw.plate(p(outlet+2.4,gaugeZ-.2,1.4),p(outlet+3.05,gaugeZ+.9,12.55),'ivory',.13*s);
  for(let i=0;i<=9;i++)hw.shaft(p(outlet+2.4,gaugeZ+.95,2.9+i),p(outlet+(i%2?.79:1.14)+2.4,gaugeZ+.95,2.9+i),.075*s,'steel');
  const float=role(b.mesh(new T.CylinderGeometry(.94*s,.8*s,.43*s,24),'#a37d4b',false,true,'brass'),'outlet-float');
  const reed=role(b.mesh(new T.CylinderGeometry(.105*s,.105*s,6.2*s,16),'#7b8883',false,true,'steel'),'float-stem');
  const levelTag=b.label('常水位 · 0格',p(outlet-1,gaugeZ-2,15.9),21*s,4.6*s);
  b.label('集水坡',p(24,16,32.2),11*s,4*s);b.label('低地聚落',p(82,49,14),14*s,4*s);
  const record=mountFloodRecorder(b,p,s);
  const channel=Array.from({length:42},(_,i)=>{const z=9+i*56/41;return [floodChannel(z),z] as const});
  const routes=tributaries.map(r=>r.flatMap((v,i)=>i===r.length-1?[v]:Array.from({length:7},(_,j)=>[v[0]+(r[i+1][0]-v[0])*j/7,v[1]+(r[i+1][1]-v[1])*j/7])));
  let state=evaluateFloodSequence(0,0),profile=connectedFlood(state.waterLevel),lastLevel=NaN;
  const update=(phase:number,selection:number)=>{
    state=evaluateFloodSequence(phase,selection);record(state.phase,selection);
    if(lastLevel!==state.waterLevel){
      profile=connectedFlood(state.waterLevel);let cursor=0;
      for(let j=0;j<profile.triangles.length;j+=2){
        const x=profile.triangles[j],z=profile.triangles[j+1];vertices.setXYZ(cursor,...p(x,z,state.waterLevel+.025));
        const depth=Math.min(1,Math.max(0,(state.waterLevel-floodSample(x,z).h)/4));
        waterTones.setXYZ(cursor,1-.29*depth,1-.14*depth,.96-.045*depth);
        normals.setXYZ(cursor++,.040*Math.sin(.43*x+.62*z),1,.034*Math.cos(.58*z-.26*x));
      }
      vertices.needsUpdate=normals.needsUpdate=waterTones.needsUpdate=true;waterGeometry.setDrawRange(0,cursor);
      waterGeometry.boundingSphere=new T.Sphere(new T.Vector3(...p(50,37,state.waterLevel)),56*s);
      water.material.color.set('#59838a').lerp(new T.Color('#87948b'),state.rise*.73);
      float.position.set(...p(outlet,gaugeZ,state.waterLevel+.15));reed.position.set(...p(outlet,gaugeZ,state.waterLevel+3.32));
      updateLabelSlip(levelTag,state.rise>0?'较常水位 +'+(state.waterLevel-2.9).toFixed(1)+'格':'常水位 · 0格');lastLevel=state.waterLevel;
    }
    b.trace(channel.map(([x,z])=>p(x,z,state.waterLevel+.15)),phase,state.heavyRain?5:2,'flow',1,.65);
    if(state.heavyRain){
      wetHeads.forEach(([x,z],i)=>{
        const t=(phase*3+i*.137)%1,h=floodSample(x,z).h+(1-t)*(27-floodSample(x,z).h);
        b.flow.push({points:[b.v(p(x,z,h)),b.v(p(x,z,Math.max(floodSample(x,z).h,h-2.35)))],width:.46});
      });
      if(state.runoff>.01)for(const route of routes)b.trace(route.map(([x,z])=>p(x,z,Math.max(floodSample(x,z).h,state.waterLevel)+.16)),phase,3,'flow',1,state.runoff);
    }
  };
  return {update,focusBounds:()=>({min:p(1,4,-3.9),max:p(99,78,36)}),describe:()=>({kind:'floodplain-inundation',...state,
    cause:state.heavyRain?'sustained-heavy-rain':'baseline',terrainClippedWater:true,settlementsOnLowland:true,eventTimeAndLevel:'schematic',
    connectedToOutlet:true,inundatedArea:profile.area,settlementWet:profile.sites,staffReading:state.waterLevel-2.9,readoutUnit:'model-divisions',
    floatWaterContact:(float.position.y/s)-.15,catchmentBranches:routes.length,meshVertexCount:basinNodes.length})};
}
