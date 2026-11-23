import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { coherentSpecimen } from './textbook-landslide-specimen';
import { mountReadingSlide, mountSpecimenKeys } from './textbook-specimen-slides';
import { evaluateLandslide, landslideGrade, landslideGround, landslideScarp, slideLeaves, LANDSLIDE_LAYOUT as L, LANDSLIDE_REFERENCE,
  type LandslideMode, type LandslidePoint } from './textbook-landslide-model';

/** A cut-away slope in the space above the original page. Its finite body or
 * water-bearing debris is actual volume, retained at the foot after motion. */
export function buildLandslideWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, z0 = -LIFT_MARGIN - 76 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, z0 + z * scale];
  const quiet = (mesh: any, color: string, hatch = .13) => {
    mesh.material = createSpecimenMaterial(b.pop, { color, ink: '#727768', spacing: 3.2, hatch, shade: .075, seed: 211 });
    mesh.material.side = T.DoubleSide; return mesh;
  };
  const role = (mesh: any, name: string) => { mesh.userData.landslideRole = name; return mesh; };
  const vertices: number[] = [], terrainIndices: number[] = [], terrainPoints: { index: number; x: number; z: number }[] = [];
  const nx = 108, nz = 68, perimeter: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = L.left + (L.right - L.left) * i / nx, z = L.back + (L.front - L.back) * j / nz, index = vertices.length / 3;
    vertices.push(...p([x, landslideGround(x, z, 'landslide'), z])); terrainPoints.push({ index, x, z });
    if (i < nx && j < nz) terrainIndices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) perimeter.push(i);
  for (let j = 1; j <= nz; j++) perimeter.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) perimeter.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) perimeter.push(j * (nx + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = terrainPoints[perimeter[i]], c = terrainPoints[perimeter[(i + 1) % perimeter.length]], k = vertices.length / 3;
    vertices.push(...p([a.x, landslideGround(a.x, a.z, 'landslide'), a.z]), ...p([c.x, landslideGround(c.x, c.z, 'landslide'), c.z]),
      ...p([c.x, 0, c.z]), ...p([a.x, 0, a.z]));
    terrainPoints.push({ index: k, x: a.x, z: a.z }, { index: k + 1, x: c.x, z: c.z });
    terrainIndices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const floor = vertices.length / 3;
  for (const [x, z] of [[6, 8], [96, 8], [96, 62], [6, 62]]) vertices.push(...p([x, 0, z]));
  terrainIndices.push(floor, floor + 1, floor + 2, floor, floor + 2, floor + 3);
  const terrainGeometry = new T.BufferGeometry(); terrainGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  terrainGeometry.setIndex(terrainIndices); terrainGeometry.computeVertexNormals();
  const terrain = role(quiet(b.mesh(terrainGeometry, '#b9b69a', false), '#b9b69a', .16), 'slope-and-gully');
  const cutMask=new Float32Array(terrainGeometry.attributes.position.count);
  cutMask.fill(1,(nx+1)*(nz+1));
  terrainGeometry.setAttribute('cutFace',new T.Float32BufferAttribute(cutMask,1));
  const crownExposure=new Float32Array(terrainGeometry.attributes.position.count);
  for(const {index,x,z} of terrainPoints.slice(0,(nx+1)*(nz+1)))crownExposure[index]=landslideScarp(x,z).face;
  terrainGeometry.setAttribute('crownExposure',new T.Float32BufferAttribute(crownExposure,1));
  const slidingTrial={value:1},groundMaterial=terrain.material, inherited=groundMaterial.onBeforeCompile;
  groundMaterial.onBeforeCompile=(shader:any,renderer:any)=>{
    inherited.call(groundMaterial,shader,renderer);shader.uniforms.slidingTrial=slidingTrial;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float cutFace,crownExposure; varying float vCrown,vCut; varying vec3 vSlope;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>\nvCrown=crownExposure; vCut=cutFace; vSlope=(position-vec3(0.,0.,${z0.toFixed(7)}))/${scale.toFixed(7)};`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float slidingTrial; varying float vCrown,vCut; varying vec3 vSlope;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float bed=vSlope.y*.245+vSlope.x*.037+.18*sin(vSlope.x*.105);
        float seam=1.-smoothstep(.014,.052+fwidth(bed),abs(fract(bed+.5)-.5));
        vec3 section=mix(vec3(.80,.64,.49),vec3(1.07,.95,.73),.5+.5*sin(6.283*bed))*(1.-.16*seam);
        float margin=smoothstep(4.,17.,abs(vSlope.z-35.)+.9*sin(.43*vSlope.x));
        float fleck=.5+.5*sin(.31*vSlope.x+.28*vSlope.z)*cos(.22*vSlope.z-.17*vSlope.x);
        vec3 surface=mix(vec3(1.07,.96,.83),vec3(.73,.85,.61),margin*(.65+.32*fleck));
        vec3 exposed=mix(vec3(.68,.42,.25),vec3(.83,.73,.60),fleck);
        surface=mix(surface,exposed,clamp(vCrown*slidingTrial,0.,.91));
        diffuseColor.rgb*=mix(surface,section,vCut);`);
  };
  groundMaterial.customProgramCacheKey=()=>`slope-section:${scale}:${z0}`;
  const facies=new Float32Array(terrainGeometry.attributes.position.count*3);
  for(const node of terrainPoints.slice(0,(nx+1)*(nz+1))){
    const margin=Math.min(1,Math.max(0,(Math.abs(node.z-35)-6)/15));
    const outcrop=margin*Math.max(0,Math.sin(node.x*.16-node.z*.31)*.62+.3);
    facies.set([outcrop,.48*(1-margin),(1-outcrop)*margin*.66],node.index*3);
  }
  for(let i=(nx+1)*(nz+1);i<facies.length/3;i++)facies[i*3]=.75;
  terrainGeometry.setAttribute('facies',new T.Float32BufferAttribute(facies,3));
  applyEarthScan(groundMaterial, 'valley', 10.5*scale);
  terrain.userData.landformDetail='坡头岩土断壁与弧形后缘';
  terrain.userData.modelInput={kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'更换坡面标本，对照滑坡与泥石流'};
  const initial = evaluateLandslide(0), bodyCount = initial.slide.lower.length;
  function volume(bottom: readonly LandslidePoint[], top: readonly LandslidePoint[], indices: number[], boundary: number[], color: string, name: string) {
    const geometry = new T.BufferGeometry(), positions = new T.Float32BufferAttribute(new Float32Array((bottom.length + top.length) * 3), 3);
    const ix: number[] = [], count = bottom.length;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], c = indices[i + 1], d = indices[i + 2];
      ix.push(a, c, d, a + count, d + count, c + count);
    }
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], c = boundary[(i + 1) % boundary.length];
      ix.push(a, a + count, c + count, a, c + count, c);
    }
    geometry.setAttribute('position', positions); geometry.setIndex(ix);
    const mesh = role(quiet(b.mesh(geometry, color, false), color, name === 'finite-wet-debris' ? .06 : .20), name);
    applyEarthScan(mesh.material, name === 'finite-wet-debris' ? 'alluvium' : 'loam', 11 * scale);
    const set = (lower: readonly LandslidePoint[], upper: readonly LandslidePoint[]) => {
      for (let i = 0; i < lower.length; i++) { positions.setXYZ(i, ...p(lower[i])); positions.setXYZ(i + count, ...p(upper[i])); }
      positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    };
    set(bottom, top); return { mesh, set, geometry };
  }
  const slideTriangles: number[] = [];
  for (let i = 1; i < bodyCount - 1; i++) slideTriangles.push(0, i, i + 1);
  const slide=coherentSpecimen(b,scale);
  const leafGeometry=new T.BufferGeometry(),leafIndices:number[]=[];
  slideLeaves.forEach((_,i)=>{const k=i*5;leafIndices.push(k,k+4,k+1,k+1,k+4,k+2,k+2,k+4,k+3,k+3,k+4,k);});
  leafGeometry.setAttribute('position',new T.Float32BufferAttribute(slideLeaves.flat(2).map(v=>v*scale),3));
  leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  const plants=role(b.mesh(leafGeometry,'#71805d',false,false,'plant'),'slide-rooted-plants');
  plants.userData.modelInput=slide.userData.modelInput;
  const flow = volume(initial.debris.bottom, initial.debris.top, initial.debris.indices, initial.debris.boundary, '#92785b', 'finite-wet-debris');
  flow.mesh.material.roughness=.53;
  flow.mesh.userData.modelInput = { kind: 'replay', selection: 1, label: '重新观察同一批含水碎屑' };
  const scarGeometry = new T.BufferGeometry();
  scarGeometry.setAttribute('position', new T.Float32BufferAttribute(initial.slide.lower.flatMap(([x, y, z]) => p([x, y + .018, z])), 3));
  scarGeometry.setIndex(slideTriangles.flatMap((_, i) => i % 3 === 0 ? [slideTriangles[i], slideTriangles[i + 2], slideTriangles[i + 1]] : []));
  scarGeometry.computeVertexNormals();
  const scar = role(quiet(b.mesh(scarGeometry, '#ada18b', false, false), '#ada18b', .24), 'exposed-slip-surface');
  applyEarthScan(scar.material,'outcrop',8*scale);
  const striations:number[]=[];
  for(let i=0;i<15;i++){
    const zi=28.8+i*.83,xi=18.1+.8*Math.sin(i*1.7),length=6.1+4.4*(.5+.5*Math.sin(i*4.2));
    for(let j=0;j<9;j++){
      const a=xi+j*length/9,d=xi+(j+1)*length/9;
      const at=(x:number,jj:number,side:number)=>p([x,landslideGrade(x)+.085,zi+.11*Math.sin(i*1.8+jj*.42)+side*.055*Math.sin(Math.PI*jj/9)]);
      striations.push(...at(a,j,-1),...at(a,j,1),...at(d,j+1,-1),...at(d,j+1,-1),...at(a,j,1),...at(d,j+1,1));
    }
  }
  const scoreGeo=new T.BufferGeometry();scoreGeo.setAttribute('position',new T.Float32BufferAttribute(striations,3));scoreGeo.computeVertexNormals();
  const scores=role(b.mesh(scoreGeo,'#81786a',false,true,'rock'),'slickenside-striations');

  const rockBase = new T.IcosahedronGeometry(1,1), rockSource = rockBase.attributes.position;
  const rockPositions = new T.Float32BufferAttribute(new Float32Array(rockSource.count * L.coarseCount * 3), 3), rockGeometry = new T.BufferGeometry();
  rockGeometry.setAttribute('position', rockPositions); const rocks = role(quiet(b.mesh(rockGeometry, '#b6a486', false), '#b6a486', .18), 'permanent-coarse-fragments');
  rocks.userData.fragmentCount = L.coarseCount; rocks.userData.fragmentStride = rockSource.count;
  applyEarthScan(rocks.material,'outcrop',5.2*scale);
  const shades=new Float32Array(rockPositions.count*3);
  for(let id=0;id<L.coarseCount;id++){
    const hue=new T.Color(['#d7c6a9','#a99579','#8d8877','#c1ab8b','#918a77'][id%5]);
    for(let j=0;j<rockSource.count;j++)shades.set([hue.r,hue.g,hue.b],(id*rockSource.count+j)*3);
  }
  rockGeometry.setAttribute('color',new T.Float32BufferAttribute(shades,3));rocks.material.vertexColors=true;
  const rockTemplate = new Float32Array(rockSource.array), rockStride = rockSource.count; rockBase.dispose();
  const bodyLabel = role(b.label('滑体', p([24, 33, 35]), 14.5 * scale, 7.1 * scale), 'body-label');
  const slipLabel = role(b.label('滑动面', p([23, landslideGround(23,19,'landslide')+10.5,19]), 23.5 * scale, 7.1 * scale), 'slip-label');
  const wetLabel = role(b.label('含水碎屑', p([30, 39, 35]), 27 * scale, 6.5 * scale), 'wet-debris-label');
  const footLabel = role(b.label('坡脚堆积', p([82, 12, 58]), 28 * scale, 6.5 * scale), 'deposit-label');

  const world=(x:number,y:number,z:number)=>p([x,y,z]);
  const hw=createInstrumentParts(b);
  hw.casting(world(3,-3.35,5),world(99,-.43,77),'wood',.6*scale);
  hw.plate(world(3.55,-.54,5.55),world(98.45,-.21,76.45),'brass',.14*scale);
  hw.plate(world(4.1,-.24,6.1),world(97.9,.02,75.9),'wood',.09*scale);
  for(const x of [8,94])for(const z of [10,72])hw.column(world(x,-5.7,z),world(x,-3.35,z),2.1*scale);
  const reader=mountReadingSlide(b,world,scale,12,58,2.6,70,'推拉黄铜游标，复查物质从坡头到坡脚的位移');
  hw.etchedScale(world(12,.08,74.15),world(58,.08,74.15),{ticks:21,width:1.65*scale,thickness:.13*scale});
  const keys=mountSpecimenKeys(b,world,scale,[70,85],['滑坡','泥石流'],1.5,75.6,12.9);
  const tag=role(b.mesh(turnedShaftGeometry(world(96,.1,69),world(96,2.25,69),[[1.65*scale,0],[2.1*scale,.22],[2.1*scale,.8],[1.78*scale,1]]),'#a88b50',false,true,'brass'),'replay-tab');
  tag.userData.modelInput={kind:'replay',label:'重放当前滑坡或泥石流情景'};
  const track=reader.track;
  let state = initial, previousPhase = -1, previousMode: LandslideMode | null = null;
  return {
    update(phase, selection) {
      const mode: LandslideMode = selection === 1 ? 'debris-flow' : 'landslide';
      if (phase !== previousPhase || mode !== previousMode) {
        state = evaluateLandslide(phase, selection);
        if (mode !== previousMode) {
          slidingTrial.value=mode==='landslide'?1:0;
          const a = terrainGeometry.attributes.position;
          for (const q of terrainPoints) a.setY(q.index, landslideGround(q.x, q.z, mode) * scale);
          a.needsUpdate = true; terrainGeometry.computeVertexNormals(); terrainGeometry.computeBoundingBox(); terrainGeometry.computeBoundingSphere();
        }
        slide.visible = scar.visible = scores.visible = mode === 'landslide'; flow.mesh.visible = rocks.visible = mode === 'debris-flow';
        plants.visible=slide.visible;
        if (mode === 'landslide') {
          slide.position.set(...p([state.slide.x,state.slide.y,state.slide.z]));slide.rotation.z=state.slide.pitch;
          plants.position.set(...p([state.slide.x,state.slide.y,state.slide.z]));plants.rotation.z=state.slide.pitch;
          bodyLabel.position.set(...p([state.slide.x, state.slide.y + 11, 35]));
        } else {
          flow.set(state.debris.bottom, state.debris.top);
          for (const rock of state.debris.coarse) for (let j = 0; j < rockStride; j++) {
            const k = j * 3, x = rockTemplate[k] * rock.radius*(1+.24*Math.cos(rock.id*1.1)), y = rockTemplate[k + 1] * rock.radius * (.64+.17*Math.sin(rock.id)), z = rockTemplate[k + 2] * rock.radius*(.91+.22*Math.sin(rock.id*.41));
            rockPositions.setXYZ(rock.id * rockStride + j, ...p([rock.center[0] + x * Math.cos(rock.angle) - z * Math.sin(rock.angle),
              rock.center[1] + y, rock.center[2] + z * Math.cos(rock.angle) + x * Math.sin(rock.angle)]));
          }
          rockPositions.needsUpdate = true; rockGeometry.computeVertexNormals(); rockGeometry.computeBoundingBox(); rockGeometry.computeBoundingSphere();
          const middle = (state.debris.front + state.debris.tail) / 2;
          wetLabel.position.set(...p([middle, landslideGrade(middle) + 12, 35]));
        }
        bodyLabel.visible = mode === 'landslide'; slipLabel.visible = mode === 'landslide' && state.slide.travel > .25;
        wetLabel.visible = mode === 'debris-flow'; footLabel.visible = mode === 'debris-flow' && state.phase > .58;
        reader.move(state.phase);keys(state.selection);
        previousPhase = phase; previousMode = mode;
      }
      const boundary = perimeter.map(i => { const q = terrainPoints[i]; return p([q.x, landslideGround(q.x, q.z, state.mode) + .02, q.z]); });
      b.contour([...boundary, boundary[0]], .48);
      for (const [x, z] of [[6, 8], [6, 62], [96, 62]]) b.contour([p([x, 0, z]), p([x, landslideGround(x, z, state.mode), z])], .45);
      // Quiet strata on the exposed cut face give the slope physical depth.
      for (const fraction of [.27, .58]) b.contour(Array.from({ length: 41 }, (_, i) => {
        const x = 6 + i * 90 / 40; return p([x, landslideGround(x, 62, state.mode) * fraction, 62.03]);
      }), .25);
      if (state.mode === 'landslide') {
        b.contour([...state.slide.upper, state.slide.upper[0]].map(p), .64);
        for (const i of [0, 3, 5]) b.contour([p(state.slide.lower[i]), p(state.slide.upper[i])], .40);
        for (const line of state.slide.seams) b.contour(line.map(p), .39);
        if (state.slide.travel > .25) {
          b.contour([p([24,landslideGrade(24)+.12,34]),p([23,landslideGround(23,19,'landslide')+7.8,19])],.36);
          b.contour([...initial.slide.lower, initial.slide.lower[0]].map(([x, y, z]) => p([x, y + .045, z])), .32);
          for (const z of [30, 35, 40]) b.contour([p([18, landslideGrade(18) + .08, z]), p([29, landslideGrade(29) + .08, z])], .23);
        }
      } else {
        const f = state.debris;
        b.contour([...f.boundary, f.boundary[0]].map(i => p(f.top[i])), .47);
        // Short blue seams belong to the finite wet material, never an endless
        // stream of arrows entering from outside the scene.
        for (const row of [2, 5, 8]) for (const col of [3, 7]) {
          const i = row * (f.columns + 1) + col;
          b.flow.push({ points: [f.top[i], f.top[i + f.columns + 1]].map(([x, y, z]) => b.v(p([x, y + .035, z]))), width: .32 });
        }
      }
      const center=p([96,2.32,69]);
      b.contour(Array.from({length:23},(_,i):Vec3=>{const a=.29+i*.248;return [center[0]+Math.cos(a)*1.22*scale,center[1],center[2]+Math.sin(a)*1.22*scale]}),.34);
    },
    focusBounds: () => ({ min: p([3, -5.7, 5]), max: p([100, 46, 77]) }),
    describe: () => ({ kind: 'slope-movement', reference: LANDSLIDE_REFERENCE, phase: state.phase, selection: state.selection,
      mode: state.mode, stage: state.stage, caption: state.caption, stockVolume: state.stockVolume,
      coherentBody: { x: state.slide.x, y: state.slide.y, pitch: state.slide.pitch, volume: state.slide.volume },
      wetDebris: { front: state.debris.front, tail: state.debris.tail, fanWidth: state.debris.fanWidth, volume: state.debris.volume,
        coarseCount: state.debris.coarse.length, containsWater: true, finiteStock: true },
      slidingBodyIsSolid: true, debrisFollowsSlope: true, separateTrials: true, noWraparound: true,
      fixedBuffers: true, phaseTrack: track, stabilityPrediction: false }),
  };
}
