import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSoilPores } from './textbook-ground-process-model';
import { createSoilInstrument } from './textbook-soil-instrument-parts';
import { soilMatrixGeometry } from './textbook-soil-aggregate';
import { poreNetwork,poreNetworkFill } from './textbook-soil-pore-network';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { cutSpecimen } from './textbook-soil-cut-surface';
import { mountSoilInclusions } from './textbook-soil-inclusions';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';

/** Open-front packed aggregate sample. A pore is the SAME fixed inter-grain
 * cavity in all conditions: the water/air interface moves inside it, while
 * mineral grains and organic pieces never translate or swell. */
export function buildSoilPoreInstrument(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .45;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, z0 + z * s];
  const { parts, solid, plate, pipe, bearing, finish } = createSoilInstrument(b, s);
  const tag = (mesh: any, name: string) => { mesh.userData.soilPoreRole = name; return mesh; };
  const selectPore = { kind: 'select', selection: 1, toggleTo: 2, label: '比较同一孔隙中的水与空气' };
  plate(p(4, .1, -15), p(96, 2.1, 23), '#544534', 'wood', 'soil-aggregate-bed');
  plate(p(4.7, 2.1, -14.3), p(95.3, 2.4, 22.3), '#a88b50', 'brass', 'bed-edge-reveal');
  plate(p(5.4, 2.4, -13.6), p(94.6, 3.2, 21.6), '#2c443d', 'enamel', 'soil-sampler-foot');
  parts.fasteners([p(8, 3.25, -11), p(92, 3.25, -11), p(8, 3.25, 19), p(92, 3.25, 19)], [0, 1, 0], .42 * s);
  for (const x of [15, 79]) for (const z of [-6, 10]) {
    pipe(p(x, 3.2, z), p(x, 7, z), .7 * s);
    bearing(p(x, 5.3, z), [0, 1, 0], 1.05 * s, 2.6 * s);
  }
  plate(p(10, 6.6, -10), p(84, 7.5, 14), '#d8d3bb', 'ivory', 'sample-retaining-floor');
  plate(p(10, 7.5, -10), p(84, 49.7, -8.8), '#635944', 'land', 'retained-specimen-back');
  for (const x of [10, 84]) {
    pipe(p(x, 7.5, -8.6), p(x, 53.2, -8.6), .4 * s, '#a88b50', 'brass');
    for (const y of [9.3, 53.5]) {
      plate(p(x - 1.2, y - 1, -9.8), p(x + 1.2, y + 1, 13.8), '#2c443d', 'enamel', 'sample-edge-clamp');
      parts.fasteners([p(x, y + 1.05, 11)], [0, 1, 0], .32 * s);
    }
  }
  const network=poreNetwork(),cut=cutSpecimen(network);
  const matrix=tag(solid(soilMatrixGeometry(network,cut,s),'#846344','land','cut-loam-monolith'),'soil-matrix');
  matrix.material=createSoilSpecimenFinish(b.pop,'#ffffff',1,.67*s,'loam');
  matrix.material.vertexColors=true;
  const moistureHeight={value:0},baseShader=matrix.material.onBeforeCompile,baseKey=matrix.material.customProgramCacheKey();
  matrix.material.onBeforeCompile=(shader:any,renderer:any)=>{
    baseShader.call(matrix.material,shader,renderer);
    shader.uniforms.moistureHeight=moistureHeight;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float poreContact; varying vec2 moisture;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmoisture=vec2(position.y,poreContact);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float moistureHeight; varying vec2 moisture;')
      .replace('#include <color_fragment>','#include <color_fragment>\nfloat wallWet=moisture.y*(1.-smoothstep(moistureHeight-0.5,moistureHeight+1.2,moisture.x)); diffuseColor.rgb*=mix(vec3(1.),vec3(.61,.67,.69),wallWet);');
  };
  matrix.material.customProgramCacheKey=()=>baseKey+':pore-moisture';
  matrix.position.z=z0;matrix.userData.modelInput=selectPore;
  const {grains,organic}=mountSoilInclusions(b,cut,s,z0,selectPore);
  const buildFill=(target:number)=>{
    const state=poreNetworkFill(network,target);
    const geometry=(array:number[])=>{
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(array.map(n=>n*s),3));
      g.computeVertexNormals();
      const normal=g.attributes.normal,position=g.attributes.position,opacity:number[]=[];
      for(let i=0;i<position.count;i++){
        const x=position.getX(i)/s,y=position.getY(i)/s,z=position.getZ(i)/s;
        const freeSurface=Math.abs(y-state.level)<.00001&&normal.getY(i)>.98;
        let coverage=1;
        if(!freeSurface){
          // Cutting the specimen exposes a conceptual water face. Individual
          // triangles have no optical facets in liquid. Only the actual
          // horizontal free surface carries the brighter reflected line.
          const tilt=.023*Math.sin(.28*x+.36*y);
          normal.setXYZ(i,tilt,.05,Math.sqrt(1-.05*.05-tilt*tilt));
          if(z>8){
            const index=Math.round(Math.min(1,Math.max(0,(x-11)/71))*(network.windows.length-1));
            let lower=0,upper=0,weight=0;
            for(let dj=-2;dj<=2;dj++){
              const w=network.windows[Math.max(0,Math.min(network.windows.length-1,index+dj))],wt=3-Math.abs(dj);
              if(Number.isFinite(w.minY)){lower+=wt*w.minY;upper+=wt*w.maxY;weight+=wt;}
            }
            const d=weight?Math.min(y-lower/weight,upper/weight-y):-1;
            const soft=Math.max(0,Math.min(1,(d+.30)/1.45));
            const front=Math.max(0,Math.min(1,(z-8)/3));
            coverage=1-front*(1-soft);
          }
        }
        opacity.push(coverage,freeSurface?1:0);
      }
      g.setAttribute('poreOptics',new T.Float32BufferAttribute(opacity,2));
      g.computeBoundingSphere();return g;
    };
    return {water:geometry(state.water),air:geometry(state.air),level:state.level,volume:state.waterVolume,capacity:state.capacity};
  };
  const fills=new Map<number,ReturnType<typeof buildFill>>();
  const water=tag(solid(new T.BufferGeometry(),'#527678','water','water-in-connected-pores'),'water');
  const air=tag(solid(new T.BufferGeometry(),'#e5e8da','air','unfilled-connected-pores'),'air');
  water.position.z=air.position.z=z0;water.userData.modelInput=selectPore;air.visible=false;
  water.castShadow=false;water.material=water.material.clone();water.material.transparent=true;water.material.opacity=.79;
  water.material.side=T.DoubleSide;water.material.depthWrite=true;
  const waterShader=water.material.onBeforeCompile.bind(water.material),waterKey=water.material.customProgramCacheKey();
  water.material.onBeforeCompile=(shader:any,renderer:any)=>{
    waterShader(shader,renderer);shader.uniforms.poreLevel=moistureHeight;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 poreOptics; varying vec3 poreGlass;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nporeGlass=vec3(poreOptics,position.y);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 poreGlass; uniform float poreLevel;')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=mix(.38,1.,smoothstep(0.,1.,poreGlass.x)); diffuseColor.rgb*=mix(vec3(.89,.93,.91),vec3(1.05,1.11,1.09),poreGlass.y); float margin=1.-smoothstep(0.,max(fwidth(poreGlass.z)*.75,.13),abs(poreGlass.z-poreLevel)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.44,.43),.42*margin*poreGlass.x);');
  };
  water.material.customProgramCacheKey=()=>waterKey+':pore-cut-transmission';
  water.material.roughness=.54;water.material.metalness=0;water.material.envMapIntensity=.32;
  water.material.polygonOffset=true;water.material.polygonOffsetFactor=1;water.material.polygonOffsetUnits=1;
  // The three detents can be selected directly in either direction.
  plate(p(84.5,3.2,2),p(94.5,5.0,19),'#2c443d','enamel','moisture-control-foot');
  pipe(p(89.5,4.7,9),p(89.5,18.8,9),.65*s,'#a88b50','brass');
  const dialStart=b.meshes.length;
  const dial=mountSpecimenDial(b,p(89.5,19.2,12.7),4.6*s,{label:'转动孔隙干湿旋钮',choices:['较干','适中','较湿']});
  for(const part of b.meshes.slice(dialStart)){tag(part,'moisture-dial');part.userData.interactionFeedback=false;}
  const legend=[['矿物质',17],['有机质',36],['孔隙水',55],['孔隙空气',75]] as const;
  for(const [name,x] of legend){
    plate(p(x-7.6,2.9,17.3),p(x+7.6,7.55,18.5),'#a88b50','brass','soil-identification-plate');
    const label=b.label(name,p(x,5.3,18.63),14.2*s,3.9*s,{appearance:'engraved'});label.userData.labelMount='surface';
    label.material.color?.set?.('#352e23');
  }
  finish();
  let state=evaluateSoilPores(0),previous=-1,current:ReturnType<typeof buildFill>;
  const original=grains.map(m=>m.position.toArray());
  const update=(_phase:number,n:number)=>{
    state=evaluateSoilPores(n);if(previous===state.mode)return;
    if(!fills.has(state.mode))fills.set(state.mode,buildFill(state.water));
    current=fills.get(state.mode)!;water.geometry=current.water;air.geometry=current.air;
    water.userData.fraction=state.water;air.userData.fraction=state.air;
    moistureHeight.value=current.level*s;dial(0,state.mode);previous=state.mode;
  };
  update(0,0);
  return {update,focusBounds:()=>({min:p(2,0,-16),max:p(98,60,25)}),
    describe:()=>({kind:'soil-composition',...state,components:['mineral','organic','water','air'],waterReplacesAirInSamePores:true,
      construction:'packed-open-soil-sample-instrument',actualPoreCount:1,connectedPassage:true,visibleChambers:5,
      mineralCount:grains.length,embeddedOrganicCount:organic.length,interfaceHeight:current.level,
      measuredWaterVolume:current.volume,totalVoidVolume:current.capacity,poreShapeConstant:true,airIsUnfilledPore:true,selfSupporting:true,
      solidsStationary:grains.every((m,i)=>m.position.toArray().every((v:number,k:number)=>v===original[i][k]))})};
}
