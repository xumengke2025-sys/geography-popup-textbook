import { applyEarthScan, type EarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { createInstrumentParts } from './textbook-instrument-parts';
import { mountReadingSlide, mountSpecimenKeys } from './textbook-specimen-slides';
import { chainHill, chainScour } from './textbook-disaster-chain-stock';
import { abutmentGeometry, chainTalusPiece } from './textbook-disaster-chain-taluses';
import { coastalCap, coastalPump } from './textbook-disaster-chain-coast';
import { mountDamSection } from './textbook-disaster-chain-section';
import { updateLabelSlip } from './textbook-label-slip';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { DISASTER_CHAIN_LAYOUT as L, chainFreshHead, chainSalineInterface, chainValleyGround, chainRiverHalfWidth, evaluateDisasterChain } from './textbook-disaster-chain-model';

/** Real, reversible paper solids above the preserved textbook page. Each
 * material, mesh and vertex buffer is allocated once at construction. */
export function buildDisasterChainWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .9;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z * s];
  let state = evaluateDisasterChain(0);
  const facies:Record<string,EarthScan|'valley'>={'bedrock':'outcrop','valley-bedrock':'outcrop','landslide-block':'valley','unsaturated-sediment':'alluvium','compressible-layer':'loam','front-river-bank':'turf','steep-loose-slope':'valley','dam-abutment':'valley'};
  const surfaceMaterials=new Map<string,any>();
  const role = (mesh: any, name: string) => {
    mesh.userData.chainRole=name;
    if(facies[name]){
      const color='#'+mesh.material.color.getHexString(),key=name+color;
      if(!surfaceMaterials.has(key))surfaceMaterials.set(key,applyEarthScan(createSpecimenMaterial(b.pop,{role:facies[name]==='outcrop'?'rock':'land',color}),facies[name],s*(name==='landslide-block'?6:17)));
      mesh.material=surfaceMaterials.get(key);mesh.material.vertexColors=!!mesh.geometry.attributes.color;
    }
    return mesh;
  };
  const solid = (geometry: any, color: string, name: string, at: Vec3) => {
    geometry.scale(s, s, s); const mesh = role(b.mesh(geometry, color, false), name); mesh.position.set(...p(...at)); return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, name: string) =>
    solid(new T.BoxGeometry(w, h, d), color, name, [x, y, z]);
  const label = (text: string, at: Vec3, w: number, h = 5.95) => role(b.label(text, p(...at), w * s, h * s), 'label');
  function band(name: string, color: string, count = 48) {
    const g = new T.BufferGeometry(), a = new T.Float32BufferAttribute(new Float32Array((count + 1) * 12), 3), ix: number[] = [];
    for (let i = 0; i < count; i++) {
      const k = i * 4;
      for (const [a0, b0, c0, d0] of [[0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]])
        ix.push(k + a0, k + b0, k + c0, k + a0, k + c0, k + d0);
    }
    ix.push(0, 1, 3, 0, 3, 2);
    const last = count * 4; ix.push(last, last + 2, last + 3, last, last + 3, last + 1);
    g.setAttribute('position', a); g.setIndex(ix);
    const mesh = role(b.mesh(g, color, false), name);
    return { mesh, set(from: number, to: number, upper: (x: number) => number, lower: (x: number) => number,
      back: (x: number) => number, front: (x: number) => number) {
      for (let i = 0; i <= count; i++) {
        const x = from + (to - from) * i / count, hi = upper(x), lo = lower(x), z1 = back(x), z2 = front(x);
        for (const [j, y, z] of [[0, hi, z1], [1, hi, z2], [2, lo, z1], [3, lo, z2]]) a.setXYZ(i * 4 + j, ...p(x, y, z));
      }
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    }, edges(width = .45) {
      if (!mesh.visible) return;
      for (const side of [0, 1]) b.contour(Array.from({ length: count + 1 }, (_, i): Vec3 =>
        [a.getX(i * 4 + side), a.getY(i * 4 + side) + .03 * s, a.getZ(i * 4 + side)]), width);
      for (const i of [0, count]) for (const side of [0, 1]) {
        const k = i * 4 + side;
        b.contour([[a.getX(k), a.getY(k), a.getZ(k)], [a.getX(k + 2), a.getY(k + 2), a.getZ(k + 2)]], width);
      }
    } };
  }

  // Coastal cutaway: the front section exposes saturated sediment. Its blue
  // saline wedge advances underground, while the open sea stays at one level.
  const droughtStart = b.meshes.length;
  box(51.5, 2, 29, 91, 4, 42, '#b9aa94', 'bedrock');
  const freshwater = band('fresh-aquifer', '#aac5c2'), drySediment = band('unsaturated-sediment', '#ded0b0');
  const cap=coastalCap(b,s);cap.position.set(...p(39,23.5,29));
  const sea = box(84.5, (4 + L.seaLevel) / 2, 29, 25, L.seaLevel - 4, 42, '#96bac4', 'fixed-sea');
  const saline = band('saline-wedge', '#699ba7');
  const pond = solid(new T.CylinderGeometry(4.5, 4.5, .25, 32), C.water, 'surface-water-source', [20, L.originalSurface + .16, 17]);
  const pipe = solid(new T.CylinderGeometry(.55, .55, 1, 10), '#d0d2c0', 'extraction-well', [44, 20, 31]);
  const pump=coastalPump(b,p,s);
  pipe.userData.modelInput={kind:'replay',selection:0,label:'重放沿海抽水井水位变化'};
  const drops = Array.from({ length: 3 }, () => solid(new T.SphereGeometry(.3, 8, 6), C.water, 'extraction-water', [44, 12, 31.6]));
  const dwelling = [box(29, 28.5, 20, 6.4, 4, 5, C.paper, 'subsiding-building'),
    solid(new T.ConeGeometry(5, 2.6, 4).rotateY(Math.PI / 4), '#a18d72', 'subsiding-building', [29, 31.6, 20]),
    box(29, 27.8, 22.55, 1.3, 2.5, .12, '#75867a', 'subsiding-building')];
  dwelling[1].scale.z = .78;
  const freshLabel = label('淡水', [22, 12, 55], 11.6), seaLabel = label('海水', [85, 24, 37], 10.5);
  const wellLabel = label('抽水井', [44, 36, 29], 18.5);
  wellLabel.userData.modelInput = { kind: 'replay', selection: 0, label: '重放沿海缺水与地下水变化' };
  const droughtMeshes = b.meshes.slice(droughtStart);

  // Mountain river valley: the same pieces slide, become the obstruction,
  // and leave an actual central gap when this selected dam breaches.
  const quakeStart = b.meshes.length;
  box(51, 1.4, 29.5, 90, 2.8, 45, '#b9aa94', 'valley-bedrock');
  const bank = (back: number, front: number, name: string) => {
    const shape = new T.Shape(); shape.moveTo(back, L.valleyBase);
    for (let i = 0; i <= 28; i++) { const z = back + (front - back) * i / 28; shape.lineTo(z, chainValleyGround(z)); }
    shape.lineTo(front, L.valleyBase); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: 90, bevelEnabled: false, curveSegments: 1 }), a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const z = a.getX(i), y = a.getY(i), x = 6 + a.getZ(i); a.setXYZ(i, ...p(x, y, z)); }
    g.computeVertexNormals(); return role(b.mesh(g, '#b5bd9d', false), name);
  };
  bank(39.4, 52, 'front-river-bank');
  const river = box(51, 3.2, 35.5, 90, .9, 9, C.water, 'river');
  const hillPositions: number[] = [], hillIndices: number[] = [], hillColors:number[]=[],hillFacies:number[]=[],nx = 100, nz = 48;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = 6 + 90 * i / nx, z = 7 + 23.6 * j / nz; const cut=chainScour(x,z);
    hillPositions.push(...p(x,chainHill(x,z)-cut,z));
    const vegetation=Math.max(0,Math.min(.75,.38+.30*Math.sin(x*.21+z*.13)+.19*Math.cos(z*.29-x*.27)))*(1-Math.min(1,cut/1.8));
    hillFacies.push(.3+.45*Math.min(1,cut/3),.11,vegetation*.65);
    hillColors.push(.86-.29*vegetation,.77-.09*vegetation,.62-.22*vegetation);
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; hillIndices.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2); }
  }
  const hillBoundary: number[] = [];
  for (let i = 0; i <= nx; i++) hillBoundary.push(i);
  for (let j = 1; j <= nz; j++) hillBoundary.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) hillBoundary.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) hillBoundary.push(j * (nx + 1));
  for (let i = 0; i < hillBoundary.length; i++) {
    const a = hillBoundary[i] * 3, c = hillBoundary[(i + 1) % hillBoundary.length] * 3, k = hillPositions.length / 3;
    hillPositions.push(hillPositions[a], hillPositions[a + 1], hillPositions[a + 2], hillPositions[c], hillPositions[c + 1], hillPositions[c + 2],
      hillPositions[c], L.valleyBase * s, hillPositions[c + 2], hillPositions[a], L.valleyBase * s, hillPositions[a + 2]);
    const bandShade=.85+.10*Math.cos(hillPositions[a]*.19/s+hillPositions[a+2]*.18/s);
    for(let j=0;j<4;j++){hillColors.push(bandShade,.76*bandShade,.59*bandShade);hillFacies.push(.80,.1,0);}
    hillIndices.push(k,k+1,k+2,k,k+2,k+3);
  }
  const hillGeometry = new T.BufferGeometry(); hillGeometry.setAttribute('position', new T.Float32BufferAttribute(hillPositions, 3));
  hillGeometry.setAttribute('color',new T.Float32BufferAttribute(hillColors,3));
  hillGeometry.setAttribute('facies',new T.Float32BufferAttribute(hillFacies,3));
  hillGeometry.setIndex(hillIndices); hillGeometry.computeVertexNormals();
  const hill = role(b.mesh(hillGeometry, '#d7cbb2', false), 'steep-loose-slope');
  const seats=[-1,1].map(side=>role(b.mesh(abutmentGeometry(side,p),'#bba88d',false),'dam-abutment'));
  const stones = Array.from({ length: 12 }, (_, i) => {
    const block=chainTalusPiece(i,s);
    const mesh=role(b.mesh(block.geometry,'#d3c4a9',false),'landslide-block');
    mesh.userData.talusId=i;mesh.userData.nominalVolume=block.nominalVolume;
    mesh.userData.modelInput = {kind:'replay',selection:1,label:'重放同一批坡体碎块堵河、溃决的过程'};
    return {...block,mesh};
  });
  const lake = band('impounded-lake', '#7eabb6'), flood = band('downstream-flood', '#82aaad');
  const settlement: any[] = [];
  for (const [x, z, w] of [[79, 43, 4.9], [86, 45.5, 4.4], [90, 42, 3.8]]) {
    const ground = chainValleyGround(z);
    const wall = box(x, ground + 1.7, z, w, 3.4, w * .77, C.paper, 'downstream-settlement');
    const roof = solid(new T.ConeGeometry(w * .76, 2, 4).rotateY(Math.PI / 4), '#aa9275', 'downstream-settlement', [x, ground + 4.4, z]);
    roof.scale.z = .76; settlement.push(wall, roof);
  }
  const slideLabel = label('滑坡体', [65, 35, 19], 17), lakeLabel = label('堰塞湖', [27, 16, 32], 18, 6.35);
  slideLabel.userData.modelInput = { kind: 'replay', selection: 1, label: '重放滑坡堵河过程' };
  const breachLabel = label('溃口', [57, 25.2, 38], 11.5), townLabel = label('聚落', [85, 22, 53], 11.5);
  const quakeMeshes = b.meshes.slice(quakeStart);

  const archive=mountReadingSlide(b,p,s,9,53,2.6,59,'依次推移观察游标，复查同一灾害链中的因果联系');
  const hardware=createInstrumentParts(b);
  hardware.casting(p(3,-2.6,3),p(99,-.1,65),'wood',.5*s);
  for(const x of [9,93])for(const z of [10,59])hardware.column(p(x,-3.75,z),p(x,-2.6,z),1.72*s);
  hardware.plate(p(7,1.1,53),p(55,8.73,55.8),'brass',.32*s);
  hardware.plate(p(7.5,1.5,55.8),p(54.5,8.32,56.08),'ivory',.14*s);
  const plotY=(phase:number,condition:number)=>{
    const sample=evaluateDisasterChain(phase,condition);
    return condition?2.15+.91*(sample.earthquake.lakeLevel-L.riverY):2.15+.51*(chainFreshHead(sample,L.wellX)-10);
  };
  const curves=[0,1].map(c=>{
    const curve=new T.CatmullRomCurve3(Array.from({length:51},(_,i)=>new T.Vector3(...p(9+44*i/50,plotY(i/50,c),56.21))));
    return b.mesh(new T.TubeGeometry(curve,96,.13*s,6,false),c?'#396a75':'#62785e',false,true,'enamel');
  });
  const cursor=hardware.shaft(p(9,1.8,56.63),p(9,8.12,56.63),.16*s,'brass');
  const nib=solid(new T.SphereGeometry(.43,14,8),'#934b32','record-nib',[9,0,56.8]);
  for(const m of [cursor,nib])m.userData.modelInput={kind:'phase-track',track:archive.track,label:'沿曲线复查地下水位或堰塞湖水位'};
  const section=mountDamSection(b,p,s,z0,stones.map(o=>o.mesh));
  const trials=mountSpecimenKeys(b,p,s,[66,80],['沿海','山谷'],2.4,64,12.5);
  const caption = label(state.caption, [48, 45, 7], 31, 6);
  const replayTile = box(94, 1.2, 61, 8, .7, 8, C.paper, 'replay');
  const rewind = solid(new T.TorusGeometry(2.15, .28, 5, 24, Math.PI * 1.62).rotateX(-Math.PI / 2).rotateY(-Math.PI * .1), C.cool, 'replay', [94, 1.8, 61]);
  const arrowTip = solid(new T.ConeGeometry(.85, 1.7, 3).rotateX(Math.PI / 2).rotateZ(.35), C.cool, 'replay', [92.2, 1.9, 59.9]);
  [replayTile, rewind, arrowTip].forEach(mesh => { mesh.userData.modelInput = { kind: 'replay', label: '重放当前情景' }; });
  // Large cutaway surfaces need quiet paper grain. Dense diagonal hatching
  // on every face masks both the groundwater boundary and the breach.
  const watery = new Set(['fresh-aquifer', 'saline-wedge', 'fixed-sea', 'surface-water-source', 'river', 'impounded-lake', 'downstream-flood']);
  for (const mesh of [...droughtMeshes, ...quakeMeshes]) if (mesh.userData.kind !== 'text-label') {
    const u = mesh.material.userData.uniforms;
    // Physical solids expose only the shared reveal uniform. Paper hatch
    // controls belong to the legacy paper shader, not to every material that
    // happens to carry a uniforms registry.
    if (u?.uHatch) u.uHatch.value = watery.has(mesh.userData.chainRole) ? .1 : .24;
    if (u?.uSpacing) u.uSpacing.value = 2.9;
    if (u?.uShade) u.uShade.value = .07;
  }
  const dynamic = new Set([freshwater.mesh,drySediment.mesh,saline.mesh,lake.mesh,flood.mesh,cap,hill,...seats,...stones.map(o=>o.mesh)]);
  let previous = '';
  return {
    update(phase, selection) {
      archive.move(phase);trials(selection);state = evaluateDisasterChain(phase, selection); const d = state.drought, q = state.earthquake, coastal = state.branch === 'drought';
      cursor.position.x=44*phase*s;
      nib.position.set(...p(9+44*phase,plotY(phase,selection),56.8));
      curves.forEach((m,i)=>m.visible=i===selection);
      for (const mesh of droughtMeshes) mesh.visible = coastal;
      for (const mesh of quakeMeshes) mesh.visible = !coastal;
      updateLabelSlip(caption, state.caption);
      if (`${state.branch}/${state.phase}` !== previous) {
        if (coastal) {
          freshwater.set(6, 72, x => chainFreshHead(state, x), () => 4, () => 8, () => 50);
          drySediment.set(6, 72, () => 20.5, x => chainFreshHead(state, x), () => 8, () => 50);
          saline.set(d.salineToe, 72, x => chainSalineInterface(state, x), () => 4, () => 49.6, () => 50.3);
          const capHeight = d.surface - 20.5; cap.scale.y = capHeight / 6; cap.position.y = (20.5 + capHeight / 2) * s;
          pond.position.y = (d.surface + .16) * s; pond.scale.set(1.5 * d.pondRadius, 1, .83 * d.pondRadius);
          const top = d.surface + 3.4; pipe.scale.y = top - 8; pipe.position.y = (8 + top) / 2 * s;
          pump.update(d.surface,phase,d.pumpingActive);
          for (const [i, mesh] of dwelling.entries()) mesh.position.y = (d.surface + [2, 5.1, 1.3][i]) * s;
        } else {
          lake.set(6, 52.5, () => q.lakeLevel, () => L.valleyBase,
            () => 35 - chainRiverHalfWidth(q.lakeLevel), () => 35 + chainRiverHalfWidth(q.lakeLevel));
          const floodTop = (x: number) => {
            const t = Math.max(0, Math.min(1, (q.floodFront - x) / 6));
            return L.riverY + (q.floodLevel - L.riverY) * t * t * (3 - 2 * t);
          };
          flood.set(56, Math.max(56.001, q.floodFront), floodTop, () => L.valleyBase,
            x => 35 - chainRiverHalfWidth(floodTop(x)), x => 35 + chainRiverHalfWidth(floodTop(x)));
        }
        previous = `${state.branch}/${state.phase}`;
      }
      if (coastal) {
        drops.forEach((mesh, i) => {
          mesh.visible = d.pumpingActive;
          mesh.position.set(...p(44, 10 + (d.surface + 2 - 10) * ((phase * 5 + i / 3) % 1), 31.65));
        });
        freshwater.edges(.55); drySediment.edges(.35); saline.edges(.6);
        for (const y of [1.5, 3]) b.contour([p(6, y, 50.2), p(97, y + .08, 50.2)], .3);
        if (d.subsidence > .02) b.contour([p(8, L.originalSurface, 50.4), p(66, L.originalSurface, 50.4)], .35);
        for (const z of [14, 26, 39]) {
          b.contour(Array.from({ length: 23 }, (_, i) => p(75 + i * .85, L.seaLevel + .06, z + Math.sin(i * .7) * .3)), .3);
        }
        if (d.deficit > .15) for (const [x, z] of [[12, 34], [23, 43], [53, 16], [61, 37]]) {
          const k = d.deficit;
          b.contour([p(x - 1.7 * k, d.surface + .06, z - k), p(x, d.surface + .06, z), p(x + 2.5 * k, d.surface + .06, z - 1.6 * k)], .34);
          b.contour([p(x, d.surface + .06, z), p(x + k, d.surface + .06, z + 2.5 * k)], .34);
        }
      } else {
        hill.position.x = q.shake * s;
        for(const part of stones)part.place(part.mesh,q,p);
        settlement.forEach((mesh, i) => { mesh.position.x = p([79, 79, 86, 86, 90, 90][i], 0, 0)[0] + q.shake * .6 * s; });
        lake.mesh.visible = q.lake > .002; flood.mesh.visible = q.flood > .002;
        slideLabel.visible = q.slide < .94; lakeLabel.visible = q.lake > .15; breachLabel.visible = q.breach > .05;
        slideLabel.position.set(...p(65, 35 - 15 * q.slide, 19 + 14 * q.slide));
        lake.edges(.5); flood.edges(.55);
        if (q.blockage < .98) b.trace([p(8, 3.82, 35), p(50, 3.82, 35)], phase * 2, 3, 'flow', 1, 1 - q.blockage);
        if (q.flood < .02 && q.blockage < .98) b.trace([p(61, 3.82, 35), p(94, 3.82, 35)], phase * 2, 2, 'flow', 1, 1 - q.blockage);
        if (q.breach > .01) b.trace([p(49, q.lakeLevel + .14, 35), p(56, q.floodLevel + .14, 35), p(Math.max(57, q.floodFront - 1), q.floodLevel + .14, 35)], phase * 3, 4, 'flow', 1, q.flood);
      }
      section.update(state);
      for (const mesh of coastal ? droughtMeshes : quakeMeshes) if (mesh.visible && mesh.userData.kind !== 'text-label' && !dynamic.has(mesh)) b.outline(mesh, mesh === hill ? .32 : .43);
      [replayTile, rewind, arrowTip].forEach(mesh => b.outline(mesh, .42));
    },
    focusBounds: () => ({ min: p(1, -3.75, 3), max: p(101, 50, 67) }),
    describe: () => ({ kind: 'conditional-disaster-links', ...state,
      activeScenario: state.branch, seaSurfaceStable: true, groundwaterMechanism: 'selected-coastal-extraction-and-compressible-sediment',
      linkedStagesAreConditional: true, selectedDamBreach: true, originalPagePreserved: true,
      buffersStable: true, salineIntrusionIsUnderground: true,
      damSection:section.describe(), talus:stones.map(b=>({id:b.id,volume:b.nominalVolume,source:b.source,position:[b.mesh.position.x/s,b.mesh.position.y/s,(b.mesh.position.z-z0)/s]})),
      waterBodyGeometry: 'fixed-topology-closed-volumes',
      interactions: { well: 'replay-drought', landslide: 'replay-earthquake', replayTile: 'replay-current' },
      fixedVertexBuffers: [freshwater, drySediment, saline, lake, flood].map(body => body.mesh.geometry.attributes.position.count) }),
  };
}
