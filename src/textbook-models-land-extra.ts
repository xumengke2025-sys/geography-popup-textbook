import { createInstrumentParts } from './textbook-instrument-parts';
import { mountSpecimenKeys } from './textbook-specimen-slides';
import { applyEarthScan } from './textbook-earth-scan';
import { terrainSurveyWorld } from './textbook-terrain-survey-world';
import { beachGrain, beachGrains, beachHeight as beachSectionHeight, beachShore, beachSwash, beachWaterLevel } from './textbook-beach-profile';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, PALETTE as C, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { buildDeltaWorld } from './textbook-delta-world';
import { buildSoilFactorsWorld } from './textbook-soil-factors-world';
import { buildVegetationWorld } from './textbook-vegetation-world';
import { buildCoastalProcessWorld } from './textbook-coastal-process-world';
import { finishCoastalOutcrop } from './textbook-coastal-outcrop';
import { mountFieldInstrument } from './textbook-field-instruments';
import { buildAeolianTunnel } from './textbook-aeolian-tunnel';
import { buildKarstObserver } from './textbook-karst-observer';
import { buildValleyWorld } from './textbook-valley-world';
import { buildReliefCutSurface, type NaturalSurface } from './textbook-natural-form-geometry';

/** Additional chapter 4/5 explanations. All shapes are real geometry in the
 * reference Popout frame. The textbook page is never sampled by a model.
 * phase is demonstration progress, never a measured year, speed or climate. */
export function buildLandExtra(b: TextbookGeometry, effect: string): ModelMotion | null {
  switch (effect) {
    case 'river-valley': return buildValleyWorld(b);
    case 'delta': return delta(b);
    case 'aeolian': return buildAeolianTunnel(b);
    case 'coastal-landform': return coastal(b);
    case 'terrain-observation': return terrainObservation(b);
    case 'vegetation': return buildVegetationWorld(b);
    case 'soil-factors': return buildSoilFactorsWorld(b);
    case 'karst-livelihood': return buildKarstObserver(b,'karst-livelihood');
    default: return null;
  }
}

const clamp = (n: number, a = 0, c = 1) => Math.max(a, Math.min(c, n));
const smooth = (a: number, c: number, n: number) => { const q = clamp((n - a) / (c - a)); return q * q * (3 - 2 * q); };
const stage = (n: number, max: number) => Math.round(clamp(n, 0, max));
const cycle = (n: number) => ((n % 1) + 1) % 1;

function frame(b: TextbookGeometry) {
  const s = b.width / 100, depth = clamp(b.height, 43 * s, 68 * s);
  const z0 = -LIFT_MARGIN - b.height * .62, z1 = z0 + depth;
  return { s, z0, z1, depth,
    p: (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth],
    bounds: (height = 54) => ({ min: [0, 0, z0 - 8 * s] as Vec3, max: [b.width, height * s, z1 + 12 * s] as Vec3 }),
  };
}

type LabelSpec = [string, number, number, number, number?];
function labelSets(b: TextbookGeometry, f: ReturnType<typeof frame>, sets: LabelSpec[][], scale = 1) {
  return sets.map(set => set.map(([text, u, v, h, width = 22]) => b.label(text, f.p(u, v, h), width * f.s * scale, 6 * f.s * scale)));
}
function showLabels(sets: any[][], index: number) { sets.forEach((set, i) => set.forEach(label => { label.visible = i === index; })); }

/** Moving objects use cached edges, not frozen strokes left on the page. The
 * one-time edge extraction is done now, before the animation loop starts. */
function solid(b: TextbookGeometry, geometry: any, color: string, ink = true) {
  const mesh = b.mesh(geometry, color, false);
  if (ink) b.outline(mesh);
  return mesh;
}
function pebble(b: TextbookGeometry, radius: number, color = C.land, detail = 0) {
  return solid(b, new T.IcosahedronGeometry(radius, detail), color, false);
}
function localBox(b: TextbookGeometry, w: number, h: number, d: number, color: string) {
  const g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return solid(b, g, color);
}
function naturalGeometry(surface: NaturalSurface) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(surface.positions, 3)); g.setIndex(surface.indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

/** Closed heightfield, including its bottom. All vertices have permanent
 * buffers; changing a cross-section only updates existing attributes. */
function relief(b: TextbookGeometry, x0: number, x1: number, z0: number, z1: number,
  height: (x: number, z: number) => number, color: string, nx = 44, nz = 26, bottom = 0, roundness = 0) {
  const data = buildReliefCutSurface(x0, x1, z0, z1, height, nx, nz, bottom, roundness), top = data.samples, boundary = data.boundary;
  const g = naturalGeometry(data);
  const mesh = b.mesh(g, color, false);
  mesh.userData.closedHeightfield = true;
  return { mesh,
    set(fn: (x: number, z: number) => number) {
      const a = g.attributes.position; for (const v of top) a.setY(v.index, fn(v.x, v.z));
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    },
    outline(fn: (x: number, z: number) => number) {
      b.contour(boundary.map(i => { const v = top[i]; return [v.x, fn(v.x, v.z) + .04, v.z] as Vec3; }).concat([[top[boundary[0]].x, fn(top[boundary[0]].x, top[boundary[0]].z) + .04, top[boundary[0]].z]]), .6);
      for (const index of [0, nx + nz, nx * 2 + nz]) { const { x, z } = top[boundary[index]]; b.contour([[x, bottom, z], [x, fn(x, z), z]], .35); }
      b.contour(boundary.map(index => { const v = top[index]; return [v.x, bottom, v.z] as Vec3; }).concat([[top[boundary[0]].x, bottom, top[boundary[0]].z]]), .3);
    },
  };
}

function contourLevels(b: TextbookGeometry, f: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, levels: number[]) {
  for (const y of levels) for (let j = 0; j < 24; j++) for (let i = 0; i < 40; i++) {
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => {
      const x = x0 + (x1 - x0) * u / 40, z = z0 + (z1 - z0) * v / 24; return { x, z, h: f(x, z) };
    });
    const crosses: Vec3[] = [];
    for (let n = 0; n < 4; n++) { const a = corners[n], c = corners[(n + 1) % 4];
      if ((a.h - y) * (c.h - y) < 0) { const q = (y - a.h) / (c.h - a.h); crosses.push([a.x + (c.x - a.x) * q, y + .07, a.z + (c.z - a.z) * q]); }
    }
    if (crosses.length >= 2) b.stroke(crosses.slice(0, 2), .25);
  }
}

/** Textbook pp.70–71: an upstream plain and a river mouth share the same
 * sediment path. The moving coast is a diagram, not a dated shoreline. */
function delta(b: TextbookGeometry): ModelMotion {
  return buildDeltaWorld(b);
}

/** Textbook p.74: cliff/platform, a through-opening arch, stack and beach.
 * The selector identifies forms; it is not a compulsory sequence of stages. */
function coastal(b: TextbookGeometry): ModelMotion {
  const f = frame(b), { s, p, z0, z1 } = f;
  const specimens = mountFieldInstrument(b, 'coastal-landform', s, p(0, 0), f.depth / 60);
  const arch = specimens.get('arch')!, stack = specimens.get('stack')!;
  const archWaves = finishCoastalOutcrop(b, arch, 'arch', s, z0, f.depth / 60);
  const stackWaves = finishCoastalOutcrop(b, stack, 'stack', s, z0, f.depth / 60);
  const labels = labelSets(b, f, [
    [],
    [['海蚀拱桥', .557, .70, 32, 27], ['贯通孔', .66, .94, 13, 24]],
    [['海蚀柱', .79, .70, 34, 22], ['岩石海岸', .22, .39, 42, 28]],
  ], 1.08);
  const comparison = [...arch, ...stack, ...labels.flat()];
  comparison.forEach(mesh => { mesh.visible = false; mesh.userData.coastalScene = 'landform-comparison'; });
  const processStart = b.meshes.length;
  const cliffProcess = buildCoastalProcessWorld(b), processMeshes = b.meshes.slice(processStart);
  processMeshes.forEach(mesh => mesh.userData.coastalScene = 'cliff-process');
  const permanentHardware=processMeshes.filter(mesh=>['phase-rail','phase-handle'].includes(mesh.userData.coastalRole));
  const knob=permanentHardware.find(mesh=>mesh.userData.coastalRole==='phase-handle')!.parent!;
  const pWorld=(x:number,h:number,z:number):Vec3=>p(x/100,z/60,h);
  const hardware=createInstrumentParts(b);
  hardware.casting(pWorld(8,.05,59.9),pWorld(92,1.46,74),'wood',.42*s);
  const keys=mountSpecimenKeys(b,pWorld,s,[20,40,60,80],['崖台','拱桥','海柱','海滩'],2.45,74,15.9);
  const detailStart=b.meshes.length;
  const sandPoint=(u:number,v:number,h=beachSectionHeight(u,v)):Vec3=>p(.045+.91*u,.055+.89*v,h);
  const sand=relief(b,.045*b.width,.955*b.width,z0+.055*f.depth,z0+.945*f.depth,
    (x,z)=>beachSectionHeight((x/b.width-.045)/.91,((z-z0)/f.depth-.055)/.89)*s,
    '#d8c49e',56,40,.24*s);
  const sandVertices=sand.mesh.geometry.attributes.position, sandColors:number[]=[];
  const damp=new T.Color('#aa9071'),dry=new T.Color('#ebd5a5');
  for(let i=0;i<sandVertices.count;i++){
    const x=sandVertices.getX(i)/b.width,z=(sandVertices.getZ(i)-z0)/f.depth;
    const u=(x-.045)/.91,v=(z-.055)/.89,distance=beachShore(u)-v;
    const h=sandVertices.getY(i)/s;
    const tone=damp.clone().lerp(dry,smooth(.015,.2,distance));
    const band=.08*Math.exp(-(((distance-.29)/.08)**2));
    tone.multiplyScalar(1+band+.018*Math.sin(u*53+v*29)-.27*(1-smooth(.25,1.5,h)));
    sandColors.push(tone.r,tone.g,tone.b);
  }
  sand.mesh.geometry.setAttribute('color',new T.Float32BufferAttribute(sandColors,3));
  sand.mesh.material=createSpecimenMaterial(b.pop,{role:'rock',color:'#ffffff'});
  sand.mesh.material.vertexColors=true;
  // Stationary sand texture in specimen units, independent of viewport and
  // camera. Filter the fine grain before it falls below a screen pixel.
  const sandMaterial=sand.mesh.material, inheritSand=sandMaterial.onBeforeCompile;
  sandMaterial.onBeforeCompile=(shader:any,renderer:any)=>{
    inheritSand.call(sandMaterial,shader,renderer);
    shader.uniforms.uSandScale={value:s};
    shader.uniforms.uBeachBack={value:z0};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vBeach;uniform float uSandScale;uniform float uBeachBack;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBeach=(position-vec3(0.,0.,uBeachBack))/uSandScale;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vBeach;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 wash=vBeach.xz;
        float bend=.44*sin(wash.x*.19)+.65*sin(wash.x*.079+wash.y*.12);
        float ridge=wash.y*2.45+bend;
        float rippleMask=smoothstep(-.15,.85,sin(wash.x*.13+wash.y*.17)*cos(wash.y*.22));
        float ripple=sin(ridge)*rippleMask*(1.-smoothstep(.6,2.,fwidth(ridge)));
        vec2 pixel=wash*3.2;
        float grain=fract(sin(dot(floor(pixel),vec2(12.9898,78.233)))*43758.5453)-.5;
        float coarse=sin(wash.x*.69+sin(wash.y*.51))*cos(wash.y*.84+bend);
        diffuseColor.rgb*=1.+.067*ripple+.105*grain*(1.-smoothstep(.45,1.3,max(fwidth(pixel.x),fwidth(pixel.y))))+.023*coarse;`);
  };
  sandMaterial.customProgramCacheKey=()=> 'beach-sand-grain-v1';
  applyEarthScan(sandMaterial,'alluvium',14*s);
  const waterGeometry=new T.BufferGeometry(), waterSteps=48, indices:number[]=[];
  const waterPoints=new T.Float32BufferAttribute(new Float32Array((waterSteps+1)*18),3);
  for(let i=0;i<waterSteps;i++)for(let k=0;k<2;k++){
    const j=i*6+k;indices.push(j,j+1,j+6,j+6,j+1,j+7);
  }
  // Every perimeter section meets the bed at its local height. The most
  // seaward edge is visible when the model is tilted towards the reader.
  for(let i=0;i<waterSteps;i++){
    const top=6*i+2;indices.push(top,top+3,top+6,top+6,top+3,top+9);
  }
  for(const i of [0,waterSteps])for(let k=0;k<2;k++){
    const j=i*6+k;indices.push(j,j+3,j+1,j+1,j+3,j+4);
  }
  waterGeometry.setAttribute('position',waterPoints);waterGeometry.setIndex(indices);
  const waterSkin=b.mesh(waterGeometry,'#85b7b8',false);
  waterSkin.material=createSpecimenMaterial(b.pop,{role:'water',color:'#78acaf'});
  waterSkin.material.transparent=true;waterSkin.material.opacity=.68;waterSkin.material.depthWrite=false;
  waterSkin.material.side=T.DoubleSide;waterSkin.frustumCulled=false;
  // Narrow, broken foam edges trace the current run-up. Separate intervals
  // leave clear water between crests and keep the wet sand visible.
  const foamGeometry=new T.BufferGeometry(), segments=14, foamRuns=5, foamIndices:number[]=[];
  const foamPoints=new T.Float32BufferAttribute(new Float32Array(foamRuns*(segments+1)*6),3);
  for(let run=0;run<foamRuns;run++)for(let j=0;j<segments;j++){
    const i=(run*(segments+1)+j)*2;foamIndices.push(i,i+1,i+2,i+2,i+1,i+3);
  }
  foamGeometry.setAttribute('position',foamPoints);foamGeometry.setIndex(foamIndices);
  const foam=b.mesh(foamGeometry,'#e4e9dd',false);
  foam.material=createSpecimenMaterial(b.pop,{color:'#e4e9dd',role:'ivory'});
  foam.material.side=T.DoubleSide;foam.frustumCulled=false;foam.castShadow=false;
  const grainMeshes=beachGrains.map(spec=>pebble(b,spec.radius*s,spec.color));
  labelSets(b,f,[[['滩肩',.19,.12,16],['湿沙',.65,.47,11],['海岸堆积',.73,.96,8,26]]]);
  const beachDetail=b.meshes.slice(detailStart);
  let lastBeachPhase=-1;
  function updateBeach(t:number){
    const edge:Vec3[]=[];
    for(let i=0;i<=waterSteps;i++){
      const u=i/waterSteps,shore=beachShore(u),swash=beachSwash(u,t);
      edge.push(sandPoint(u,swash,beachSectionHeight(u,swash)+.11));
      if(t===lastBeachPhase)continue;
      for(const [k,v] of [swash,shore,1].entries()){
        const pos=sandPoint(u,v,Math.max(beachWaterLevel,beachSectionHeight(u,v))+.06);
        waterPoints.setXYZ(6*i+k,...pos);
        waterPoints.setXYZ(6*i+k+3,...sandPoint(u,v));
      }
    }
    if(t!==lastBeachPhase){
      for(let run=0;run<foamRuns;run++)for(let j=0;j<=segments;j++){
        const q=j/segments,u=.035+.194*run+.145*q;
        const v=beachSwash(u,t)+.007;
        const thickness=.008*Math.sin(Math.PI*q)*(1+.45*Math.sin(run*2+q*8));
        for(const [k,z] of [v,v+thickness].entries()){
          const h=Math.max(beachWaterLevel,beachSectionHeight(u,z))+.115;
          foamPoints.setXYZ((run*(segments+1)+j)*2+k,...sandPoint(u,z,h));
        }
      }
      foamPoints.needsUpdate=true;foamGeometry.computeVertexNormals();
      waterPoints.needsUpdate=true;waterGeometry.computeVertexNormals();
      grainMeshes.forEach((mesh,i)=>{
        const grain=beachGrain(i,t);
        const spec=beachGrains[i];
        mesh.position.set(...sandPoint(grain.u,grain.v,grain.height+spec.radius*.4));
        mesh.scale.set(spec.elongation,.61,1);mesh.rotation.y=grain.angle;
      });
      lastBeachPhase=t;
    }
    b.contour(edge,.54);
    b.contour([p(.19,.12,12.8),sandPoint(.20,beachShore(.20)-.29)],.4);
    b.contour([p(.65,.47,7.8),sandPoint(.68,beachShore(.68)-.10)],.4);
    const deposit=beachGrain(8,t);
    b.contour([p(.73,.96,4.9),sandPoint(deposit.u,deposit.v,deposit.height+.4)],.4);
    // Uneven strandlines left by previous uprushes follow this local shore.
    for(let j=0;j<4;j++){
      const strand=Array.from({length:24},(_,i)=>{
        const u=.08+j*.22+i/23*.135,v=beachShore(u)-.15+.009*Math.sin(20*u+j);
        return sandPoint(u,v,beachSectionHeight(u,v)+.07);
      });
      b.contour(strand,.28);
    }
  }
  let selected = 0;
  return { update(t, n, dt, reduced) {
    selected = stage(n, 3);
    arch.forEach(mesh => mesh.visible = selected === 1);
    stack.forEach(mesh => mesh.visible = selected === 2);
    showLabels(labels, selected);
    processMeshes.forEach(mesh => mesh.visible = selected === 0);
    permanentHardware.forEach(mesh=>mesh.visible=true);
    knob.position.set(...pWorld(15+70*t,8.05,67));
    keys(selected);
    beachDetail.forEach(mesh=>mesh.visible=selected===3);
    if(selected===3){updateBeach(t);return;}
    if (selected === 0) { cliffProcess.update(t, 0, dt, reduced); return; }
    (selected === 1 ? archWaves : stackWaves)(t);
    if (selected === 1) b.contour([p(.65,.91,10.6),p(.55,.80,8.1)], .40);
    else b.contour([p(.79,.70,30.6),p(.758,.712,27.7)], .4);
    for (let j = 0; j < 3; j++) {
      const v = cycle(t * .55 + j / 3), z = z1 - v * f.depth * .64, y = (2.3 + .22 * Math.sin(v * Math.PI)) * s;
      b.contour(Array.from({ length: 31 }, (_, i): Vec3 => [(.04 + .71 * i / 30) * b.width, y, z + Math.sin(i / 30 * Math.PI * 2) * .8 * s]), .45);
    }
    const toward = selected === 2 ? .76 : .545;
    b.trace([p(toward, .96, 3.6), p(toward - .02, .72, 3.8), p(toward, .52, 3.7)], t, 3);
  }, focusBounds: () => ({min:pWorld(0,-1,0),max:pWorld(100,38,77)}), describe: () => ({
    ...(selected === 0 ? cliffProcess.describe!() : {}),
    kind: 'coastal-landforms', selected: ['cliff-platform', 'through-arch', 'sea-stack', 'depositional-beach'][selected],
    archHasRealOpening: true, requiredChronologicalSequence: false, retreatAndWavesAreSchematic: true, buffersStable: true,
  }) };
}

function terrainObservation(b:TextbookGeometry):ModelMotion {
  return terrainSurveyWorld(b);
}
