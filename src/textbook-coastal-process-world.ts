import { applyEarthScan } from './textbook-earth-scan';
import { createInstrumentParts } from './textbook-instrument-parts';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { COASTAL_PROCESS_GEOMETRY as G, COASTAL_PROCESS_REFERENCE,
  evaluateCoastalProcess, coastalCoreGeometry, coastalPlatformGeometry, coastalBlockGeometry,
  coastalBlockContours, coastalPlatformHeight, coastalRockTop, coastalShoreOffset,
  type CoastalMeshData, type CoastalPoint } from './textbook-coastal-process-model';

export function applyCoastalBedding(b:TextbookGeometry,mesh:any,color:string,restPositions:number[]) {
  mesh.material = createSpecimenMaterial(b.pop, {color,role:'rock'});
  // Layers belong to the original cliff. A falling block carries its
  // bedding with it rather than acquiring horizontal stripes as it turns.
  mesh.geometry.setAttribute('beddingPosition',new T.Float32BufferAttribute(restPositions,3));
  const inherited=mesh.material.onBeforeCompile;
  mesh.material.onBeforeCompile=(shader:any,renderer:any)=>{
    inherited.call(mesh.material,shader,renderer);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 beddingPosition; varying vec3 vBedding;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBedding=beddingPosition;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vBedding;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float level=vBedding.y+.066*vBedding.x+.033*vBedding.z+.42*sin(vBedding.x*.13);
        float bedding=level*.257+.12*sin(level*.54);
        float seam=abs(fract(bedding+.5)-.5);
        float ink=1.-smoothstep(.018,.06+fwidth(bedding),seam);
        float bedTone=.5+.5*sin(level*1.18+.4*sin(level*.81));
        float grains=sin(vBedding.x*2.73+vBedding.y*.78)*sin(vBedding.z*1.23+level*2.1);
        diffuseColor.rgb *= mix(vec3(.83,.82,.76),vec3(1.11,1.05,.94),bedTone)
          *(1.-.21*ink+.022*grains);
      `);
  };
  mesh.material.customProgramCacheKey=()=> 'coastal-bedding-v1';
  applyEarthScan(mesh.material,'outcrop',17*b.width/100);
}

/** One finite cliff section. The inland core and gently sloping platform are
 * permanent solids. Only three identifiable outer slabs undercut and fall. */
export function buildCoastalProcessWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = Math.max(43 * s, Math.min(68 * s, b.height));
  const z0 = -LIFT_MARGIN - b.height * .62;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z / 60 * depth];
  const point = (q: CoastalPoint): Vec3 => p(...q);
  const geometry = (data: CoastalMeshData) => {
    const g = new T.BufferGeometry(), vertices: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) vertices.push(...p(data.positions[i], data.positions[i + 1], data.positions[i + 2]));
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(data.indices); g.computeVertexNormals();
    return g;
  };
  const surface = (data: CoastalMeshData, color: string, role: string) => {
    const mesh = b.mesh(geometry(data), color, false);
    applyCoastalBedding(b,mesh,color,data.positions);
    mesh.material.side = T.DoubleSide; mesh.userData.coastalRole = role; return mesh;
  };
  const base = b.box(p(2, 0, 2), p(98, .8, 61), '#b8b2a2', false);
  const sea = b.box(p(3,.8,16),p(97,G.seaHeight,61),'#80aeb3',false);
  sea.material=createSpecimenMaterial(b.pop,{color:'#78a9b0',role:'water'});
  sea.material.opacity=.60;sea.material.depthWrite=false;sea.castShadow=false;sea.userData.castShadow=false;
  sea.renderOrder=2;sea.raycast=()=>{};
  const platform = surface(coastalPlatformGeometry(), '#b3a792', 'fixed-platform');
  const core = surface(coastalCoreGeometry(), '#b7a991', 'fixed-inland-core');
  let state = evaluateCoastalProcess(0), lastPhase = -1;
  const slabs = state.blocks.map(block => {
    const mesh = surface(coastalBlockGeometry(state, block.id), '#c4b39a', 'finite-collapse-block');
    mesh.userData.coastalBlockId = block.id; mesh.userData.coastalLayers = 7; mesh.userData.coastalSections = 10; return mesh;
  });
  const cliffLabel = b.label('海蚀崖', p(20, 34, 4), 23 * s, 7.2 * s);
  const platformLabel = b.label('原位平台', p(76, 9, 61), 22 * s, 6 * s);
  platformLabel.visible = false;
  const track = { start: p(15, 8.05, 67), end: p(85, 8.05, 67) };
  const hardware=createInstrumentParts(b), hardwareStart=b.meshes.length;
  hardware.casting(p(11,.2,62.9),p(89,1.5,69.6),'wood',.36*s);
  for(const x of [12.8,87.2])hardware.plate(p(x-.75,1.4,65),p(x+.75,8.65,69),'brass',.21*s);
  for(const z of [65.9,68.1])hardware.shaft(p(12.8,8.05,z),p(87.2,8.05,z),.34*s,'steel');
  const handle=hardware.knob([0,0,0],[0,1,0],1.85*s,1.62*s);
  const shoe=hardware.plate([-1.6*s,-.69*s,-1.6*s],[1.6*s,-.36*s,1.6*s],'brass',.10*s);
  handle.add(shoe);
  for(const mesh of b.meshes.slice(hardwareStart))mesh.userData.coastalRole='phase-rail';
  const drive={kind:'phase-track',track,label:'往复推移游标，观察波浪与当前海岸地貌'};
  for(const mesh of handle.children){mesh.userData.coastalRole='phase-handle';mesh.userData.smallPointTarget=true;mesh.userData.modelInput=drive;}
  handle.position.set(...phaseTrackPoint(0, track));
  const fixedPlatformOutline = [p(3, coastalPlatformHeight(2), 2), p(97, coastalPlatformHeight(2), 2),
    p(97, coastalPlatformHeight(58), 58), p(3, coastalPlatformHeight(58), 58), p(3, coastalPlatformHeight(2), 2)];
  return {
    update(phase) {
      if (phase !== lastPhase) {
        state = evaluateCoastalProcess(phase);
        slabs.forEach((mesh, id) => {
          const data = coastalBlockGeometry(state, id), a = mesh.geometry.attributes.position;
          for (let i = 0; i < a.count; i++) a.setXYZ(i, ...p(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]));
          a.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
          mesh.userData.coastalState = state.blocks[id].state; mesh.userData.coastalFall = state.blocks[id].fall;
        });
        handle.position.set(...phaseTrackPoint(state.phase, track)); lastPhase = phase;
      }
      cliffLabel.visible = true; platformLabel.visible = state.exposedPlatform > 2;
      if (platformLabel.visible) {
        const gap=state.blocks.reduce((best,block)=>block.exposedPlatform>best.exposedPlatform?block:best);
        const x=(gap.minX+gap.maxX)/2,z=G.coreFrontZ+coastalShoreOffset(x)+gap.exposedPlatform*.48;
        b.contour([p(76,5.7,61),p(x,coastalPlatformHeight(z)+.16,z)],.32);
      }
      b.outline(base, .4); b.contour(fixedPlatformOutline, .55);
      // The back of the core is a fixed reference while its seaward face is
      // uncovered. No object-position retreat is applied to this bedrock.
      for (const x of [G.minX, G.maxX]) b.contour([
        p(x, coastalPlatformHeight(G.backZ), G.backZ), p(x, coastalRockTop(x), G.backZ),
        p(x, coastalRockTop(x), G.coreFrontZ + coastalShoreOffset(x)),
        p(x, coastalPlatformHeight(G.coreFrontZ), G.coreFrontZ + coastalShoreOffset(x)),
      ], .48);
      b.contour(Array.from({ length: 31 }, (_, i) => {
        const x = G.minX + (G.maxX - G.minX) * i / 30; return p(x, coastalRockTop(x), G.backZ);
      }), .42);
      state.blocks.forEach(block => coastalBlockContours(state, block.id).forEach(contour => b.contour(contour.map(point), .47)));
      for (let j = 0; j < 3; j++) {
        const z = 61 - ((state.phase * 3.1 + j / 3) % 1) * 27;
        b.contour(Array.from({ length: 32 }, (_, i) => p(5 + i * 2.9, G.seaHeight + .08, z + Math.sin(i * .38) * .42)), .31);
      }
      b.trace([p(49, 2.65, 54), p(49, 3.05, 40), p(49, 3.8, 29 - state.undercut * .28)], state.phase * 3, 2, 'flow', 1, .65);
      b.contour([track.start, track.end], .35);
      // Avoid a silhouette-only inland wall: three restrained bedding lines are
      // revealed behind the same collapsing slabs, rather than sliding with them.
      if (state.inventory.falling + state.inventory.deposited > 0) for (const y of [8, 15, 22]) {
        b.contour(Array.from({ length: 31 }, (_, i) => {
          const x = G.minX + (G.maxX - G.minX) * i / 30;
          return p(x, y + .16 * Math.sin(x * .16), G.coreFrontZ + coastalShoreOffset(x) + .025);
        }), .22);
      }
      sea.userData.coastalRole = 'sea';
    },
    focusBounds: () => ({ min: p(0, 0, 0), max: p(100, 38, 72) }),
    describe: () => ({ kind: 'coastal-cliff-process', reference: COASTAL_PROCESS_REFERENCE,
      phase: state.phase, stage: state.stage, caption: state.caption, undercut: state.undercut,
      inventory: { ...state.inventory }, exposedPlatform: state.exposedPlatform,
      fixedInlandCore: true, fixedPlatform: true, finiteBlocksRetained: true, closedVolumes: true, fixedBuffers: true,
      blocks: state.blocks.map(block => ({ id: block.id, state: block.state, fall: block.fall,
        angle: block.angle, translation: [...block.translation], exposedPlatform: block.exposedPlatform })),
      controls: ['phase-track'] }),
  };
}
