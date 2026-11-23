import { mountResponseBench,observerHeads,opticalHead } from './textbook-response-bench';
import { buildResponseLandscape } from './textbook-response-landscape';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type ModelInput, type PhaseTrack } from './textbook-model-input';
import { applyEarthScan } from './textbook-earth-scan';
import { buildUrbanWaterWorld } from './textbook-urban-water-world';
import { type SolidMaterialRole } from './textbook-solid-materials';
import { createInstrumentParts, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { buildBasinSpecimen } from './textbook-basin-specimen';
import { basinSpecimenGround } from './textbook-basin-detail';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import { basinGround, basinFloodTriangles, basinRiverPoint, evaluateBasin, evaluateCityRain,
  evaluateQuakeResponse, integratedRoutePoint, QUAKE_LAYOUT, quakeResponseActions,
  INTEGRATED_CONTROLS, INTEGRATED_REFERENCES, INTEGRATED_INSPECTIONS, type IntegratedPoint } from './textbook-integrated-model';
export { INTEGRATED_INSPECTIONS } from './textbook-integrated-model';

/** Functional fixtures remain small; water, rock and plants keep geographic
 * colours. Role tags let the shared material system give metal its own BRDF. */
function kit(b: TextbookGeometry, back = 72, railY = -16, railZ = 80) {
  const s = b.width / 100, z0 = -LIFT_MARGIN - back * s;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * s, y * s, z0 + z * s];
  b.root.position.set(0, 43 * s, -8 * s);
  const role = (mesh: any, name: string, materialRole?: SolidMaterialRole) => {
    mesh.userData.integratedRole = name;
    if (materialRole) {
      mesh.userData.materialRole = materialRole;
      if (b.materialFor) mesh.material = b.materialFor(materialRole, `#${mesh.material.color.getHexString()}`);
    }
    return mesh;
  };
  const solid = (geometry: any, color: string, name: string, at: IntegratedPoint = [0, 0, 0], materialRole?: SolidMaterialRole) => {
    geometry.scale(s, s, s); const mesh = role(b.mesh(geometry, color, false, true, materialRole), name);
    mesh.position.set(...p(at)); return mesh;
  };
  const box = (at: IntegratedPoint, size: IntegratedPoint, color: string, name: string, materialRole?: SolidMaterialRole) =>
    solid(new T.BoxGeometry(...size), color, name, at, materialRole);
  const label = (text: string, at: IntegratedPoint, width = 22, height = 6) =>
    role(b.label(text, p(at), width * s, height * s), 'label');
  const input = (mesh: any, definition: ModelInput) => { mesh.userData.modelInput = definition; return mesh; };
  const inspect = (mesh: any, target: string, label: string) => input(mesh, { kind: 'inspect', target, toggleTo: 'overview', label });
  const ball = (at: IntegratedPoint, r: number, color: string, name: string, materialRole?: SolidMaterialRole) =>
    solid(new T.SphereGeometry(r, 16, 10), color, name, at, materialRole);
  const tube = (points: IntegratedPoint[], r: number, color: string, name: string, materialRole?: SolidMaterialRole) => {
    const mesh = b.tube(points.map(p), r * s, color, false); return role(mesh, name, materialRole);
  };
  const track: PhaseTrack = { start: p([13, railY, railZ]), end: p([94, railY, railZ]) };
  const rail = box([53.5, railY, railZ], [83, .45, .7], C.gold, 'process-rail', 'brass');
  input(rail, { kind: 'phase-track', track, label: '拖动过程纸签，暂停并回看同一过程' });
  const handle = solid(new T.OctahedronGeometry(1.8, 0), C.gold, 'process-handle', [13, railY, railZ], 'brass');
  handle.scale.set(1, .65, .5); handle.userData.smallPointTarget = true;
  input(handle, { kind: 'phase-track', track, label: '拖动过程前缘' });
  // Engraved stops belong to the real slider; there is no decorative machine
  // underneath the geography and no second set of giant physical UI labels.
  for (let i = 0; i <= 20; i++) box([13 + i * 4.05, railY+.31, railZ], [.11, .12, i % 5 ? 1.15 : 2.1], C.ink, 'engraved-process-stop', 'steel');
  for (const x of [11.3, 95.7]) {
    box([x, railY-.1, railZ], [1.7, .8, 3.2], C.ink, 'process-rail-foot', 'steel');
    solid(new T.CylinderGeometry(.45, .45, .18, 12), C.gold, 'process-fastener', [x, railY+.4, railZ], 'brass');
  }
  return { s, p, role, solid, box, label, input, inspect, ball, tube, track, handle,
    phase(phase: number) { handle.position.set(...phaseTrackPoint(phase, track)); b.outline(handle, .55); },
    world(point: Vec3): Vec3 { b.root.updateWorldMatrix(true, false); return b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3; },
  };
}

/** An actual clipped water surface. It only occupies land lower than its
 * local stage; a rectangular blue sheet never pretends to be flood extent. */
function floodSurface(b: TextbookGeometry, k: ReturnType<typeof kit>) {
  const nx = 27, nz = 24, maximumTriangles = nx * nz * 4;
  const geometry = new T.BufferGeometry(), positions = new T.Float32BufferAttribute(new Float32Array(maximumTriangles * 9), 3);
  geometry.setAttribute('position', positions); geometry.setDrawRange(0, 0);
  const mesh = k.role(b.mesh(geometry, C.water, false, false), 'terrain-clipped-floodwater', 'water');
  let previous = -1;
  return { mesh, update(rise: number) {
    mesh.visible = rise > .001; if (!mesh.visible || previous === rise) return; previous = rise;
    let count = 0;
    for (const triangle of basinFloodTriangles(rise)) for (const point of triangle) positions.setXYZ(count++, ...k.p(point));
    positions.needsUpdate = true; geometry.setDrawRange(0, count); geometry.computeVertexNormals();
    // Unused buffer capacity contains zeros, not additional water vertices.
    const bounds = new T.Box3();
    for (let i = 0; i < count; i++) bounds.expandByPoint(new T.Vector3().fromBufferAttribute(positions, i));
    geometry.boundingBox = bounds;
    geometry.boundingSphere = count ? bounds.getBoundingSphere(new T.Sphere()) : new T.Sphere(new T.Vector3(), 0);
    mesh.userData.clippedToTerrain = true;
  } };
}

function buildBasin(b: TextbookGeometry): ModelMotion {
  const k = kit(b), { s, p } = k;
  let state = evaluateBasin(0), inspection = 'overview';
  const specimen = buildBasinSpecimen(b, k);
  k.box([107.5, .25, 33], [17, 10, 58], C.sea, 'receiving-sea', 'water');
  for (let i = 0; i <= 8; i++) k.box([115.8, 5.35, 9 + i * 6], [i % 2 ? 1.1 : 2.1, .09, .12], C.ink, 'receiving-water-level-scale', 'steel');
  // The open front cut shows a continuous saturated layer, not a transparent
  // mountain or an independent underground scene.
  for (let i = 0; i < 3; i++) {
    const aquifer = k.tube([[17, 16 - i, 62], [41, 8 - i * .4, 62], [78, 5.3, 62], [105, 4.8, 59]], .28, C.cool, 'aquifer-section', 'water');
    k.inspect(aquifer, 'groundwater', '观察这批水的地下支路');
  }
  const riverPoints = Array.from({ length: 90 }, (_, i): IntegratedPoint => {
    const a = basinRiverPoint(i / 89); return [a[0], a[1] + .12, a[2]];
  });
  const waterVertices: number[] = [], waterColors: number[] = [], waterIndices: number[] = [];
  const shallows = new T.Color('#9aab86'), channel = new T.Color('#507a73');
  for (let j = 0; j < riverPoints.length; j++) {
    const [x, y, z] = riverPoints[j], sideWidth = 3.05 + 1.48 * j / (riverPoints.length - 1);
    for (let i = 0; i <= 10; i++) {
      const u = (i - 5) / 5, middle = 1 - u*u;
      waterVertices.push(...p([x,y+middle*.048*Math.sin(x*2.1+u*3.4),z+sideWidth*u]));
      const tint = shallows.clone().lerp(channel,middle*(.92+.07*Math.sin(x*.55+u)));
      waterColors.push(tint.r,tint.g,tint.b);
      if (i < 10 && j < riverPoints.length-1) {
        const a = j*11+i; waterIndices.push(a,a+1,a+11,a+1,a+12,a+11);
      }
    }
  }
  const waterGeometry = new T.BufferGeometry();
  waterGeometry.setAttribute('position',new T.Float32BufferAttribute(waterVertices,3));
  waterGeometry.setAttribute('color',new T.Float32BufferAttribute(waterColors,3));
  waterGeometry.setIndex(waterIndices); waterGeometry.computeVertexNormals();
  const river = k.role(b.mesh(waterGeometry, '#fffffd', false, true, 'water'), 'connected-river');
  river.material.vertexColors = true;
  k.inspect(river, 'bend', '观察上中下游连续相连的河道');
  // Existing delta lobes leave a real opening for the river mouth.
  for (const footprint of [[[92, 30], [104, 23], [102, 31]], [[93, 40], [105, 48], [102, 39]]]) {
    const mesh = b.prism(footprint.map(([x, z]) => [x * s, p([0, 0, z])[2]]), 3.8 * s, 5.5 * s, C.land, false);
    k.role(mesh, 'existing-delta-lobe'); k.inspect(mesh, 'mouth', '观察已有河口与沉积接收端');
    mesh.material = createSoilSpecimenFinish(b.pop, '#ad9c7c', 1, s, 'alluvium');
  }
  const accumulated = k.solid(new T.ConeGeometry(8, 1.8, 5), C.land, 'long-term-deposition', [103, 5.6, 29]);
  accumulated.rotation.y = .5; k.inspect(accumulated, 'mouth', '长期沉积累积，采用独立时间尺度');
  for (const at of [[14, 49, 31], [24, 52, 34], [18, 51, 39]] as IntegratedPoint[]) {
    const cloud = k.ball(at, 6, C.paper, 'cloud'); cloud.scale.set(1.4, .55, 1);
    k.inspect(cloud,'upper','观察上游来水与支沟');
  }
  for (const at of [[10, 37, 10], [18, 32, 15], [47, 18, 12]] as IntegratedPoint[])
    b.tree(p([at[0], basinSpecimenGround(at[0], at[2]), at[2]]), 4.5 * s, 'pine');
  const water = state.packets.map((packet, i) => {
    const mesh = k.solid(new T.IcosahedronGeometry(i === 0 ? 1.15 : .8, 1), C.water, 'water-marker', packet.point, 'water');
    mesh.userData.tracerId = packet.id; mesh.userData.smallPointTarget = true;
    return k.inspect(mesh, i >= 9 ? 'groundwater' : 'water', '跟随同一个水标记，保持当前过程时刻');
  });
  const sand = state.sediment.map(packet => {
    const mesh = k.solid(new T.IcosahedronGeometry(.7, 0), C.gold, 'sediment-grain', packet.point, 'rock');
    mesh.userData.tracerId = packet.id; return k.inspect(mesh, 'sediment', '追踪有限泥沙的去向');
  });
  // A split sediment core seated on the receiving sea's front wall remains
  // accessible even while all moving grains are still in the headwaters.
  const coreAt: IntegratedPoint = [108, 2, 64];
  const coreInput = (mesh: any) => k.inspect(mesh, 'sediment', '检视河口取样芯与泥沙去向，再按返回全景');
  coreInput(k.box([108, .2, 62], [13.6, 2.1, 6.5], '#514332', 'sample-core-holder', 'wood'));
  const core = coreInput(k.solid(new T.CylinderGeometry(2.05, 2.05, 10.8, 32), '#af9572', 'sediment-reference-core', coreAt, 'land'));
  core.rotation.z = Math.PI / 2;
  core.material = createSoilSpecimenFinish(b.pop, '#b49b76', 1, .42 * s, 'alluvium');
  for (const x of [102.6, 113.4]) {
    const collar = coreInput(k.solid(new T.CylinderGeometry(2.3, 2.3, .8, 40), '#a98b50', 'sample-core-end-collar', [x, 2, 64], 'brass'));
    collar.rotation.z = Math.PI / 2;
  }
  const flood = floodSurface(b, k);
  const locationSpecs = [
    ['上游', [22, 38, 19], 'upper'], ['河曲', [57, 16, 52], 'bend'], ['河口', [102, 15, 47], 'mouth'],
  ] as const;
  const labels = locationSpecs.map(([label, at, target]) => k.inspect(k.label(label, [...at], 10, 3.6), target, `观察${label}`));
  const tabs = INTEGRATED_CONTROLS['basin-system'].map((text, i) => {
    const at: IntegratedPoint = [39 + i * 9, -7.7, 70];
    k.box([at[0], at[1] - .7, at[2]], [5.7, .8, 4.3], '#475457', 'comparison-socket', 'steel');
    const tab = k.solid(new T.CylinderGeometry(1.6, 1.9, 1, 24), C.gold, 'time-scale-choice', at, 'brass');
    k.input(tab, { kind: 'replay', selection: i, label: `从同一初态比较${text}` });
    const marker = k.box([at[0], at[1] + .6, at[2]], [.3, .1, 1.8], C.ink, 'comparison-index', 'steel');
    k.input(marker, { kind: 'replay', selection: i, label: `从同一初态比较${text}` }); return [tab, marker];
  });
  const count = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const motion: ModelMotion = {
    inspect(target) { if (INTEGRATED_INSPECTIONS['basin-system'].some(item => item.target === target)) inspection = target; },
    inspectTargets: () => [...INTEGRATED_INSPECTIONS['basin-system']],
    update(phase, selection, dt, reduced) {
      state = evaluateBasin(phase, selection);
      // A surface-inundation comparison needs its original continuous land
      // surface. The laboratory closes the specimen while the flood rises;
      // explicit cutaway inspection remains available independently.
      specimen.update(state.floodRise > .015 && inspection === 'overview' ? 'specimen-closed' : inspection, dt, reduced);
      water.forEach((mesh, i) => { mesh.position.set(...p(state.packets[i].point)); mesh.userData.compartment = state.packets[i].compartment;
        b.outline(mesh, i === 0 && inspection === 'water' ? .8 : .25); });
      sand.forEach((mesh, i) => { mesh.position.set(...p(state.sediment[i].point)); mesh.userData.transportStatus = state.sediment[i].status; b.outline(mesh, .28); });
      accumulated.visible = state.longTerm && state.accumulation > .001;
      accumulated.scale.set(Math.max(.01, state.accumulation), 1, Math.max(.01, state.accumulation));
      flood.update(state.floodRise);
      // Opening an analytical cutaway retains the science state but removes
      // the full-area water sheet; a water plane cannot float over the space
      // from which a solid specimen has been withdrawn. Closing restores it.
      flood.mesh.visible = state.floodRise > .001 && (specimen.describe().sectionOpening as number) < .035;
      if (inspection === 'water') b.contour(state.packets[0].trace.map(p), .9);
      if (inspection === 'groundwater') b.contour(state.packets[9].trace.map(p), .85);
      if (inspection === 'sediment') { b.contour(riverPoints.map(p), .6); sand.forEach(mesh => b.outline(mesh, .8)); }
      labels.forEach((mesh, i) => { mesh.visible = inspection !== 'overview' && locationSpecs[i][2] === inspection; });
      tabs.forEach(([tab, marker], i) => { tab.userData.active = marker.userData.active = i === state.selection;
        tab.position.y = (-7.7 + (i === state.selection ? -.3 : 0)) * s;
        marker.position.y = tab.position.y + .6 * s; b.outline(tab, i === state.selection ? .6 : .23); });
      k.phase(state.phase);
    },
    focusBounds() {
      if (inspection === 'water') { const at = state.packets[0].point; return { min: p([at[0] - 12, at[1] - 10, at[2] - 12]), max: p([at[0] + 12, at[1] + 13, at[2] + 12]) }; }
      if (inspection === 'groundwater') return { min: p([3, -33, 29]), max: p([118, 63, 90]) };
      if (inspection === 'upper') return { min: p([3, -33, 5]), max: p([48, 60, 87]) };
      if (inspection === 'bend') return { min: p([31, -28, 8]), max: p([94, 33, 84]) };
      if (inspection === 'mouth') return { min: p([76, -21, 13]), max: p([119, 25, 83]) };
      if (inspection === 'sediment') return { min: p([3, -33, 5]), max: p([119, 43, 90]) };
      return { min: p([1, -35, 1]), max: p([119, 65, 91]) };
    },
    describe: () => ({ ...state, ...specimen.describe(), inspection, originalPagePreserved: true, integrated: true,
      floodSurfaceVisible: flood.mesh.visible, floodComparisonClosesSpecimen: true,
      fixedMeshCount: count, geometryBuffersReused: buffers.every((buffer, i) => b.meshes[i]?.geometry.attributes.position.array === buffer),
      waterWorld: water.map((mesh, i) => ({ id: state.packets[i].id, point: mesh.getWorldPosition(new T.Vector3()).toArray() })),
      sedimentWorld: sand.map((mesh, i) => ({ id: state.sediment[i].id, point: mesh.getWorldPosition(new T.Vector3()).toArray() })),
      handleWorld: k.world(k.handle.position.toArray()), phaseTrackWorld: { start: k.world(k.track.start), end: k.world(k.track.end) },
      coherentBasinCoordinates: true, finiteMarkers: true, sedimentDoesNotSpawn: true, waterSurfaceClippedToTerrain: true,
    }),
  };
  motion.update(0, 0, 0, true); return motion;
}

/** The established rain-partition model stays intact. A real hinged side
 * closes and opens the SAME city section; it never substitutes a second city. */
function buildCity(b: TextbookGeometry): ModelMotion {
  const inner = buildUrbanWaterWorld(b, { sectionWindow: true, compactControls: true }), s = b.width / 100, back = -LIFT_MARGIN - 72 * s;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * s, y * s, back + z * s];
  let inspection = 'overview', open = false, shown = 0, from = 0, started = 0;
  let state = evaluateCityRain(0);
  const parts = createInstrumentParts(b);
  // The opened leaf now reveals a real viewing bay rather than another
  // opaque face at the same location. Side returns connect leaf and specimen.
  for(const x of [6.25,91.75])parts.plate(p([x-.25,0,50.8]),p([x+.25,20.8,63.8]),'steel');
  parts.plate(p([6,-.7,51]),p([92,0,64]),'steel');
  const pivot = p([6, 0, 63.7]);
  const leaf=new T.Group();leaf.position.set(...pivot);b.root.add(leaf);
  const leafParts=createInstrumentParts(b,leaf);
  const lp=([x,y,z]:Vec3):Vec3=>[x*s,y*s,z*s];
  // One continuous leaf carries all three section samples. It rotates about
  // the same lower pin as the samples, rather than leaving its frame behind.
  for(const x of [0,85.3])leafParts.plate(lp([x,-.35,.4]),lp([x+.7,21.1,1]),'steel');
  for(const y of [-.35,20.6])leafParts.plate(lp([0,y,.4]),lp([86,y+.5,1.05]),'brass');
  for(const y of [7,14])leafParts.plate(lp([.7,y-.1,.39]),lp([85.3,y+.1,.5]),'steel');
  leafParts.fasteners([lp([.35,.5,1.1]),lp([85.65,.5,1.1]),lp([.35,20.8,1.1]),lp([85.65,20.8,1.1])],[0,0,1],.23*s);
  leaf.traverse((mesh:any)=>{if(mesh.isMesh)mesh.userData.modelInput={kind:'inspect',target:'underground',toggleTo:'overview',label:'开合地下侧剖面'}});
  const panels = ([[0,7,'#a39074','alluvium'],[7,7,'#a18567','outcrop'],[14,6.8,'#8f765a','loam']] as const).map(([bottom,height,color,scan]) => {
    const g = new T.BoxGeometry(86 * s, Number(height) * s, .75 * s);
    g.translate(43 * s, (Number(bottom) + Number(height) / 2) * s, 0);
    const mesh = b.mesh(g, String(color), false, true, 'rock'); mesh.position.set(...pivot);
    if (!mesh.material.userData.earthScan) applyEarthScan(mesh.material, scan, (scan==='alluvium' ? 8 : 12)*s);
    mesh.userData.integratedRole = 'hinged-underground-side';
    mesh.userData.modelInput = { kind: 'inspect', target: 'underground', toggleTo: 'overview', label: '打开地下侧剖面' }; return mesh;
  });
  // Two small steel pins explain the hinge; they do not drive infiltration.
  for (const x of [16, 82]) {
    const g = new T.CylinderGeometry(.6 * s, .6 * s, 5 * s, 12); g.rotateZ(Math.PI / 2);
    const mesh = b.mesh(g, C.gold, false, true, 'brass'); mesh.position.set(...p([x, 0, 63.7]));
    mesh.userData.integratedRole = 'side-hinge';
    for (const dx of [-2.2, 2.2]) {
      const collar = new T.CylinderGeometry(.8 * s, .8 * s, .5 * s, 16); collar.rotateZ(Math.PI / 2);
      const ring = b.mesh(collar, '#475457', false, true, 'steel'); ring.position.set(...p([x + dx, 0, 63.7]));
      ring.userData.integratedRole = 'hinge-collar';
    }
  }
  const latchGeometry = mergeInstrumentGeometry([
    new T.CylinderGeometry(.58*s,.58*s,6.9*s,24).rotateZ(Math.PI/2).translate(0,1.45*s,.52*s),
    ...[-3.1,3.1].flatMap(x=>[
      new T.CylinderGeometry(.42*s,.42*s,2.2*s,20).translate(x*s,.55*s,.52*s),
      new T.CylinderGeometry(.78*s,.78*s,.41*s,20).rotateX(Math.PI/2).translate(x*s,.08*s,-.08*s),
    ]),
  ]);
  const latch = b.mesh(latchGeometry, C.gold, false, true, 'brass'); latch.position.set(...p([49, 22, 65.2]));
  latch.userData.integratedRole = 'underground-side-latch';
  latch.userData.smallPointTarget = true;
  latch.userData.modelInput = { kind: 'inspect', target: 'underground', toggleTo: 'overview', label: '开合地下侧剖面' };
  // Telescopic stays connect tray to opening leaf, visibly supporting it.
  // They respond only to the hinge angle and never drive the water state.
  const stays=[16,82].map(x=>{
    const outer=b.mesh(new T.CylinderGeometry(.3*s,.3*s,1,16),'#a88b50',false,true,'brass');
    const rod=b.mesh(new T.CylinderGeometry(.15*s,.15*s,1,12),'#879493',false,true,'steel');
    outer.userData.integratedRole=rod.userData.integratedRole='telescopic-leaf-stay';
    const a=new T.Vector3(...p([x,1,54]));
    parts.bearing(p([x,1,54]),[1,0,0],.5*s,1.2*s);
    return {x,a,outer,rod};
  });
  const count = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  function choose(target: string) {
    if (!INTEGRATED_INSPECTIONS['city-rain-system'].some(item => item.target === target) && !/^packet-(?:[0-9]|1[01])$/.test(target)) return;
    inspection = target; const next = target !== 'overview';
    if (next !== open) { from = shown; open = next; started = performance.now(); }
    inner.inspect?.(['overview', 'underground'].includes(target) ? 'overview' : target);
  }
  const motion: ModelMotion = {
    inspect: choose,
    inspectTargets: () => [...INTEGRATED_INSPECTIONS['city-rain-system']],
    update(phase, selection, dt, reduced) {
      state = evaluateCityRain(phase, selection); inner.update(phase, selection, dt, reduced);
      const t = reduced ? 1 : Math.min(1, (performance.now() - started) / 650), ease = t * t * (3 - 2 * t);
      shown = from + ((open ? 1 : 0) - from) * ease;
      panels.forEach(mesh => { mesh.rotation.x = shown * Math.PI / 2; b.outline(mesh, .35); });
      leaf.rotation.x=shown*Math.PI/2;
      for(const stay of stays){
        const angle=shown*Math.PI/2,end=new T.Vector3(...p([stay.x,14*Math.cos(angle),63.7+14*Math.sin(angle)]));
        const delta=end.clone().sub(stay.a),length=delta.length(),direction=delta.normalize();
        for(const [mesh,fraction,center] of [[stay.outer,.58,.29],[stay.rod,.5,.75]] as const){
          mesh.position.copy(stay.a).addScaledVector(direction,length*center);
          mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);mesh.scale.y=length*fraction;
        }
      }
      latch.rotation.x = shown * Math.PI / 2;
      latch.position.set(...p([49, 22 * Math.cos(shown * Math.PI / 2), 63.7 + 22 * Math.sin(shown * Math.PI / 2)]));
      b.outline(latch, .45);
    },
    focusBounds() {
      if (inspection === 'underground') return { min: p([4, -3, 49]), max: p([116, 37, 89]) };
      if (inspection !== 'overview') return inner.focusBounds!();
      return { min: p([-1, -25, 11]), max: p([117, 75, 89]) };
    },
    describe: () => ({ ...inner.describe?.(), ...state, inspection, undergroundOpen: open,
      sideOpening: shown, undergroundPanelRotation: shown * Math.PI / 2,
      reusedOriginalRainWorld: true, repeatedCityCount: 1, sameCityGeometry: true,
      fixedMeshCount: count, geometryBuffersReused: buffers.every((buffer, i) => b.meshes[i]?.geometry.attributes.position.array === buffer),
      integrated: true, source: INTEGRATED_REFERENCES['city-rain-system'],
    }),
  };
  motion.update(0, 0, 0, true); return motion;
}

function buildQuakeResponse(b: TextbookGeometry): ModelMotion {
  const k = kit(b,72,-1.45,71.4), { s, p } = k;
  mountResponseBench(b,s,p);
  let state = evaluateQuakeResponse(0), inspection = 'overview';
  buildResponseLandscape(b, s, p);
  for (const z of [2.85, 65.15]) {
    k.tube([[2, -2.7, z], [108, -2.7, z]], .2, C.gold, 'map-datum-edge', 'brass');
    for (let i = 0; i <= 10; i++) k.box([3 + i * 10.4, -2.45, z], [.1, .12, i % 5 ? 1 : 1.8], C.ink, 'map-registration-tick', 'steel');
  }
  const roadMeshes = QUAKE_LAYOUT.roads.map(edge => {
    const a = QUAKE_LAYOUT.nodes[edge.a], c = QUAKE_LAYOUT.nodes[edge.b];
    const start = new T.Vector3(...a), end = new T.Vector3(...c);
    const direction = end.clone().sub(start).normalize();
    // The deck spans a real opening in the centre route.
    if (edge.b === 'bridge') end.addScaledVector(direction, -4.4);
    if (edge.a === 'bridge') start.addScaledVector(direction, 5.4);
    const mid = start.clone().lerp(end, .5);
    const geometry = new T.BoxGeometry(start.distanceTo(end), .46, 2.25);
    geometry.rotateZ(Math.asin(direction.y));
    geometry.rotateY(Math.atan2(-direction.z, direction.x));
    return k.inspect(k.solid(geometry, '#9e9484', 'road-' + edge.id, mid.toArray() as IntegratedPoint, 'rock'),
      'roads', '道路是否可通，须另行核验');
  });
  for (const at of Object.values(QUAKE_LAYOUT.nodes)) {
    k.solid(new T.CylinderGeometry(1.35, 1.35, .22, 24), '#475457', 'road-node-seat', [at[0], at[1] + .12, at[2]], 'steel');
    k.solid(new T.CylinderGeometry(.65, .65, .28, 20), C.gold, 'road-node-registration', [at[0], at[1] + .35, at[2]], 'brass');
  }
  // A central bridge leaf visibly loses alignment, while the evidence state
  // remains unknown until the observation/verification stages.
  const bridge = k.box([49.5, 3.5, 43], [10, .9, 4], C.paper, 'damaged-bridge-leaf');
  k.inspect(bridge, 'remote', '桥梁变化先作为线索，不能等同道路通行判断');
  const truss: any[] = [];
  const beam = (a: Vec3, c: Vec3, thick: number) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), delta = to.clone().sub(from);
    const g = new T.BoxGeometry(thick, delta.length(), thick);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    const mid = from.lerp(to,.5);
    g.translate(mid.x,mid.y,mid.z); truss.push(g);
  };
  for (const z of [-1.92, 1.92]) {
    beam([-5,.56,z],[5,.56,z],.27);
    beam([-4.1,2.6,z],[4.1,2.6,z],.28);
    const lower: Vec3[] = [[-5,.56,z],[-2.5,.56,z],[0,.56,z],[2.5,.56,z],[5,.56,z]];
    for (let i=0;i<4;i++) {
      const apex: Vec3 = [(lower[i][0]+lower[i+1][0])/2,2.6,z];
      beam(lower[i],apex,.19); beam(apex,lower[i+1],.19);
    }
  }
  const rails = k.solid(mergeInstrumentGeometry(truss),'#536c66','bridge-side-trusses',[0,0,0],'enamel');
  bridge.add(rails); rails.position.set(0,0,0);
  k.inspect(rails,'remote','观察桥面与桥台的错位');
  for (const x of [44.5, 54.5]) k.box([x, 1.9, 43], [1.1, 3.8, 4.3], C.rock, 'bridge-abutment');
  const warehouseMeshes = ['a', 'b'].map((id, i) => {
    const node = QUAKE_LAYOUT.nodes[id];
    const at:IntegratedPoint=[node[0],node[1],node[2]-6.5];
    const body = k.box([at[0],5.85,at[2]], [11,6.8,8.6], '#decfb2', 'warehouse-'+id,'ivory');
    const pieces = [body];
    // An industrial sawtooth roof gives the stores a different silhouette
    // from the pitched houses at the receiving settlement.
    const bays = i ? 2 : 3, span=11.6/bays, sections: any[]=[];
    for (let j=0;j<bays;j++) {
      const shape = new T.Shape();
      const x=-5.8+j*span;
      shape.moveTo(x,0); shape.lineTo(x+span*.78,2.1); shape.lineTo(x+span,.36);
      shape.lineTo(x+span,-.25); shape.lineTo(x,-.25); shape.closePath();
      sections.push(new T.ExtrudeGeometry(shape,{depth:9.15,bevelEnabled:false}));
    }
    const roof=k.solid(mergeInstrumentGeometry(sections),'#526e65','warehouse-'+id+'-roof',
      [at[0],9.28,at[2]-4.57],'enamel');
    const dock=k.box([at[0],2.95,at[2]+5],[10.7,.95,2.6],'#9d9381','loading-platform','rock');
    pieces.push(roof,dock);
    for(const dx of [-2.65,2.65]) {
      pieces.push(k.box([at[0]+dx,5.53,at[2]+4.33],[3.1,4.2,.24],'#485e5c','freight-door','enamel'));
      pieces.push(k.box([at[0]+dx,7.02,at[2]+4.48],[2.6,.74,.11],'#a6c6c0','freight-door-light','ivory'));
    }
    pieces.push(k.box([at[0],7.94,at[2]+4.92],[10.6,.28,1.75],'#a88b50','loading-canopy','brass'));
    const post = k.box([at[0], 7.4, at[2]+4.85], [10.1, 2.95, .34], '#a88b50', 'warehouse-signpost', 'brass');
    k.inspect(post,'warehouses','查看两座物资库的服务路线');
    post.userData.smallPointTarget=true;
    const label=b.label(i?'乙库':'甲库',p([at[0],7.42,at[2]+5.05]),9.7*s,3.20*s,{appearance:'engraved'});
    label.userData.labelMount='surface';label.userData.integratedRole='depot-nameplate';pieces.push(post);
    return { id, body, roof, label, post, pieces };
  });
  const town = [[82,38],[93,34],[94,47]].map(([x,z]) => {
    const before = b.meshes.length;
    const pivot = new T.Group();
    pivot.position.set(...p([x,2.4,z])); b.root.add(pivot);
    b.house([0,0,0],6.8*s,4.9*s,'#e2d4b9');
    for(const part of b.meshes.slice(before)) {
      pivot.add(part);part.userData.integratedRole='town-house';k.inspect(part,'position','查看村镇定位接收端');
    }
    return pivot;
  });
  const receiver = k.box([88, 9, 40], [3.3, 3.7, 2.2], C.paper, 'position-receiver');
  k.inspect(receiver, 'position', '定位接收机；发送位置由独立通信端完成');
  k.inspect(k.box([88,9.4,41.15],[2.4,1.9,.20],C.cool,'receiver-screen'),'position','查看接收位置');
  receiver.userData.smallPointTarget=true;
  k.solid(new T.CylinderGeometry(.13, .13, 3, 8), C.gold, 'receiver-antenna', [88, 12, 40], 'brass');
  const sender = k.box([91, 9, 40], [1.7, 3.1, 1.3], C.warm, 'independent-communication-terminal');
  // A small instrument station occupies the surveyed communication point on the bank.
  k.box([50,2.04,7],[8.7,.58,6.3],'#92948a','dispatch-platform','rock');
  for(const x of [46.7,53.3]) k.box([x,.85,7],[.65,1.9,5.4],'#757b74','platform-pier','rock');
  const dispatch = k.box([50, 5.4, 7], [7, 6.8, 5], C.paper, 'dispatch-receiver');
  k.box([50,8.98,7],[7.7,.45,5.6],'#526b64','dispatch-roof','enamel');
  k.box([50,6.55,9.55],[5.5,1.6,.20],'#566e71','dispatch-observation-window','steel');
  k.box([50,7.61,9.74],[6.2,.18,.82],'#a88b50','dispatch-window-hood','brass');
  k.inspect(dispatch, 'position', '调度端只有在独立通信到达后收到位置');
  k.solid(new T.CylinderGeometry(.15, .15, 6, 8), C.gold, 'dispatch-antenna', [50, 11.8, 7], 'brass');
  const sendLabel = k.label('通信', [91, 13.4, 42], 7.5, 3.2);
  // A bench telegraph key compares the sent and unsent trials at the same
  // instant, independently of the map's verify, layers and depot settings.
  const telegraph=createInstrumentParts(b),point=(x:number,y:number,z:number)=>p([x,y,z]);
  telegraph.casting(point(21,1.9,58),point(37,3.6,65.5),'wood',.4*s);
  telegraph.plate(point(21.55,3.58,58.55),point(36.45,3.91,64.95),'brass',.13*s);
  telegraph.shaft(point(26,4.85,59.9),point(26,4.85,63.5),.48*s,'steel');
  for(const z of [59.9,63.15])telegraph.plate(point(25.1,3.9,z-.25),point(26.9,5.13,z+.25),'brass',.18*s);
  const lever=telegraph.shaft(point(23.4,4.5,61.5),point(34.3,5.63,61.5),.48*s,'brass');
  const finger=telegraph.knob(point(34.4,5.98,61.5),[0,1,0],1.86*s,.94*s);
  const sendKeyMeshes=[lever,...finger.children];
  for(const mesh of sendKeyMeshes)mesh.userData.smallPointTarget=true;
  const deliveredLabel = k.label('已送达', [51, 13, 7], 10, 3.5);
  const verifyControl = k.solid(new T.CylinderGeometry(1.8, 2.1, 1.2, 24), C.gold, 'road-verification-switch', [55, 5, 63], 'brass');
  const verifyLabel = k.label('核验', [55, 8.3, 66], 7.5, 3.2);
  const pendingLabel = k.label('待确认', [57, 9, 53], 10, 3.5);
  const blockedLabel = k.label('中断', [52, 11, 42], 7.5, 3.2);
  const layerControl = k.solid(new T.CylinderGeometry(1.9, 2.2, 1.3, 24), C.gold, 'layer-separation-switch', [106, 5, 63], 'brass');
  for (const x of [55, 106]) {
    k.box([x, 4.1, 63], [5.5, .6, 5.5], '#475457', 'map-action-socket', 'steel');
    k.box([x, 5.75, 63], [.2, .12, 2.2], C.ink, 'map-action-index', 'steel');
  }
  const satellites = observerHeads.map((at, i) => {
    const first=b.meshes.length;
    const body = k.box(at, [2.7, 2.8, 2.6], C.gold, 'navigation-satellite', 'brass');
    k.inspect(body, 'position', `观察第${i + 1}条接收链路，四星仅为示意`);
    for (const side of [-1, 1]) {
      k.box([at[0] + side * 3.6, at[1], at[2]], [4.6, .45, 2.4], '#475457', 'satellite-panel-frame', 'steel');
      k.box([at[0] + side * 3.6, at[1] + .25, at[2]], [4.1, .1, 1.95], C.cool, 'satellite-panel', 'steel');
      for (let j = -1; j <= 1; j++) k.box([at[0] + side * 3.6 + j * 1.05, at[1] + .32, at[2]], [.055, .04, 1.95], '#b1d0cf', 'solar-cell-busbar', 'steel');
    }
    const dish = k.solid(new T.ConeGeometry(.95, .5, 20, 1, true), C.paper, 'navigation-antenna-dish', [at[0], at[1] - 1.65, at[2]], 'ivory');
    dish.rotation.z = Math.PI;
    for(const part of b.meshes.slice(first)){k.inspect(part,'position','查看定位卫星与接收机');part.userData.smallPointTarget=true;}
    return body;
  });
  const navigation = satellites.map(() => k.ball([0, 0, 0], .45, C.cool, 'navigation-signal', 'water'));
  const receiveLights = satellites.map((_, i) => k.ball([87.2 + i * .55, 8.5, 40.9], .18, C.green, 'received-signal-light'));
  const communication = k.ball([0, 0, 0], .52, C.warm, 'communication-message');
  const positionPin = k.solid(new T.ConeGeometry(.9, 2.6, 12), C.red, 'located-point', [88, 15.5, 40]); positionPin.rotation.z = Math.PI;
  const [rx,ry,rz]=opticalHead,remoteStart=b.meshes.length;
  const remoteSatellite=k.box(opticalHead,[3.7,3.2,3.6],C.gold,'remote-sensor','brass');
  for(const side of [-1,1])k.box([rx+side*4.4,ry,rz],[5.5,.60,3.15],'#586d69','remote-sensor-panels','enamel');
  k.solid(new T.CylinderGeometry(1.05,1.35,1.9,24),'#485357','remote-optical-barrel',[rx,ry-2.2,rz],'steel');
  k.solid(new T.CylinderGeometry(.86,.86,.16,24),C.water,'remote-optical-lens',[rx,ry-3.16,rz],'water');
  for(const part of b.meshes.slice(remoteStart)){k.inspect(part,'remote','查看桥面变化的影像来源');part.userData.smallPointTarget=true;}
  const remoteSample = k.ball([0, 0, 0], .55, C.gold, 'remote-evidence-signal');
  // Three thin, open map carriers share EXACT horizontal coordinates with
  // the terrain. Only their observation height separates; no new landscape.
  const mapLayers = [0, 1, 2].map(index => {
    const edges = [
      k.box([54, 7 + index * .7, 4], [104, .28, .4], C.gold, 'map-layer-edge', 'brass'),
      k.box([54, 7 + index * .7, 65], [104, .28, .4], C.gold, 'map-layer-edge', 'brass'),
      k.box([2, 7 + index * .7, 34.5], [.4, .28, 61], C.gold, 'map-layer-edge', 'brass'),
      k.box([106, 7 + index * .7, 34.5], [.4, .28, 61], C.gold, 'map-layer-edge', 'brass'),
    ];
    const label = k.label(['影像', '位置', '道路'][index], [111, 7 + index * .7, 38], 9.5, 3.5);
    edges.forEach(mesh => k.inspect(mesh, ['remote', 'position', 'roads'][index], '同一点位，分层查看信息来源'));
    return { edges, label };
  });
  const truck = [
    {mesh:k.box([0,0,0],[3.4,1.6,3.25],'#a1734c','canvas-covered-supply-bed','enamel'),offset:[-.95,3.15,0] as IntegratedPoint},
    ...[-2,-.9,.15].map(x=>({mesh:k.box([0,0,0],[.17,.16,3.40],'#73624e','tarpaulin-batten','steel'),offset:[x,4.00,0] as IntegratedPoint})),
    {mesh:k.box([0,0,0],[.16,1.02,2.55],'#45686e','truck-windshield','enamel'),offset:[2.56,3.4,0] as IntegratedPoint},
    {mesh:k.box([0,0,0],[2.05,.23,3.1],'#8d694c','truck-cab-roof','enamel'),offset:[1.63,4.03,0] as IntegratedPoint},
    ...[-1.23,1.23].map(z=>({mesh:k.ball([0,0,0],.28,'#d9be82','truck-headlamp','brass'),offset:[2.61,2.08,z] as IntegratedPoint})),
    { mesh: k.box([0, 0, 0], [5.7, 1.8, 3.3], C.warm, 'rescue-truck'), offset: [0, 1.7, 0] as IntegratedPoint },
    { mesh: k.box([0, 0, 0], [1.95, 1.65, 2.98], C.paper, 'truck-cabin'), offset: [1.65, 3.1, 0] as IntegratedPoint },
    ...[-1.9, 1.85].flatMap(x => [-1.56, 1.56].map(z => {
      const g = new T.CylinderGeometry(.73,.73,.52,18); g.rotateX(Math.PI / 2);
      return { mesh: k.solid(g, C.ink, 'truck-wheel'), offset: [x, .65, z] as IntegratedPoint };
    })),
  ];
  truck.forEach(({ mesh }) => k.inspect(mesh, 'roads', '只沿已核验的完整通路前进'));
  const actionMeshes: Record<string, any[]> = { send: [sender, sendLabel,...sendKeyMeshes], verify: [verifyControl, verifyLabel],
    'warehouse-a': [...warehouseMeshes[0].pieces, warehouseMeshes[0].label],
    'warehouse-b': [...warehouseMeshes[1].pieces, warehouseMeshes[1].label], layers: [layerControl] };
  const depotLens=k.solid(new T.TorusGeometry(3.25,.49,10,42),C.gold,'depot-comparison-lens',[11.3,8.8,63.1],'brass');
  const lensCentre=k.solid(new T.CircleGeometry(2.87,40),'#769999','depot-comparison-glass',[11.3,8.8,63.1],'water');
  k.box([11.3,4.1,63],[1.21,3.25,1.38],C.gold,'depot-lens-stand','brass');
  k.box([11.3,2.62,63],[5.2,.78,3.9],'#465e57','depot-lens-foot','enamel');
  for(const m of [depotLens,lensCentre]){k.inspect(m,'warehouses','翻看甲乙两库的服务范围；再点返回整体');m.userData.smallPointTarget=true;}
  const selectRoadTint=roadMeshes.map(m=>({base:m.material,pass:b.materialFor?.('enamel','#53766c'),blocked:b.materialFor?.('rock','#a16c54'),pending:b.materialFor?.('rock','#968368')}));
  const count = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const motion: ModelMotion = {
    inspect(target) { if (INTEGRATED_INSPECTIONS['quake-response-system'].some(item => item.target === target)) inspection = target; },
    inspectTargets: () => [...INTEGRATED_INSPECTIONS['quake-response-system']],
    update(phase, selection) {
      state = evaluateQuakeResponse(phase, selection);
      const pressed=!!(state.selection&1);
      finger.position.y=(pressed?-.58:0)*s;
      lever.position.y=(pressed?-.26:0)*s;
      bridge.rotation.z = -state.damage * .18; bridge.position.y = (3.5 - state.damage * 1.2) * s;
      town[1].rotation.z = state.damage * .065;
      quakeResponseActions(state.selection, state.phase).forEach(action => {
        for (const mesh of actionMeshes[action.id]) {
          if (action.enabled) k.input(mesh, { kind: action.replay ? 'replay' : 'select', selection: action.selection, keepPhase:true, label: action.label } as ModelInput);
          else delete mesh.userData.modelInput;
          mesh.userData.actionId = action.id; mesh.userData.actionEnabled = action.enabled; mesh.userData.actionPressed = action.pressed;
        }
      });
      sendLabel.visible = state.positionKnown && !state.communicationDelivered && inspection === 'position';
      deliveredLabel.visible = state.communicationDelivered && inspection === 'position';
      verifyLabel.visible = state.phase >= .62 && inspection === 'roads';
      pendingLabel.visible = state.remoteObserved && state.pendingRoads.length > 0 && inspection === 'roads';
      blockedLabel.visible = state.phase >= .62 && ['roads', 'remote'].includes(inspection);
      positionPin.visible = state.positionKnown;
      navigation.forEach((mesh, i) => {
        const link=state.navigation[i],source=observerHeads[i],target=QUAKE_LAYOUT.receiver;
        const at=source.map((v,j)=>v+(target[j]-v)*link.progress) as IntegratedPoint;
        mesh.position.set(...p(at));mesh.visible=link.progress>0&&!link.arrived;
        receiveLights[i].visible = link.arrived;
        if(link.progress>0&&(inspection==='position'||!link.arrived))b.contour([p(source),p(at)],.48);
      });
      const comm = state.communication;
      communication.visible = comm.progress > 0 && comm.progress < 1;
      communication.position.set(...p(comm.source.map((value, axis) => value + (comm.target[axis] - value) * comm.progress) as IntegratedPoint));
      if(comm.progress>0&&(inspection==='position'||comm.progress<1)) b.contour([p(comm.source), p(comm.target)], .7);
      // Optical observation is separate from navigation and radio messaging.
      const reflected = Math.max(0, Math.min(1, (state.phase - .2) / .07));
      const sampleSource: IntegratedPoint = [50, 4, 43], sampleTarget: IntegratedPoint = opticalHead;
      remoteSample.visible = reflected > 0 && reflected < 1;
      remoteSample.position.set(...p(sampleSource.map((value, axis) => value + (sampleTarget[axis] - value) * reflected) as IntegratedPoint));
      if(reflected>0&&(inspection==='remote'||reflected<1)) b.contour([p(sampleSource), p(sampleTarget)], .6);
      const mapY = [0, 1, 2].map(i => state.layersSeparated ? 18 + i * 10 : 7 + i * .7);
      mapLayers.forEach((layer, i) => {
        const available = i === 0 ? state.remoteObserved : i === 1 ? state.positionKnown : state.phase >= .62;
        layer.edges.forEach(mesh => { mesh.visible = available && state.layersSeparated; mesh.position.y = mapY[i] * s; });
        layer.label.visible = available && state.layersSeparated; layer.label.position.y = mapY[i] * s;
      });
      if (state.remoteObserved) b.contour([[43, mapY[0], 36], [57, mapY[0], 36], [57, mapY[0], 49], [43, mapY[0], 49], [43, mapY[0], 36]].map(p), .7);
      if (state.positionKnown) b.ring(p([88, mapY[1], 40]), 2.2 * s, 'xz');
      state.roads.forEach((road, i) => {
        const a = QUAKE_LAYOUT.nodes[road.a], c = QUAKE_LAYOUT.nodes[road.b];
        roadMeshes[i].userData.roadStatus=road.status;
        const tint=selectRoadTint[i],current=road.status==='passable'?tint.pass:road.status==='blocked'?tint.blocked:road.status==='pending'?tint.pending:tint.base;
        roadMeshes[i].material=current??tint.base;
        if (state.phase < .28) return;
        const yy = state.layersSeparated ? mapY[2] : road.status === 'blocked' ? 6.8 : 4.7;
        if (road.status === 'passable') b.contour([p([a[0], yy, a[2]]), p([c[0], yy, c[2]])], .75);
        else if (road.status !== 'blocked') for (let j = 0; j < 12; j += 2) b.contour([j, j + 1].map(q => p([a[0] + (c[0] - a[0]) * q / 12, yy, a[2] + (c[2] - a[2]) * q / 12])), .32);
        else {
          const [xx, , zz] = QUAKE_LAYOUT.nodes.bridge;
          b.contour([p([xx - 2, yy, zz - 2]), p([xx + 2, yy, zz + 2])], .85);
          b.contour([p([xx - 2, yy, zz + 2]), p([xx + 2, yy, zz - 2])], .85);
        }
      });
      if (state.route) b.contour(state.routePoints.map(at => p([at[0], 4.7, at[2]])), 1.35);
      const before = integratedRoutePoint(state.routePoints, Math.max(0, state.rescueProgress - .005));
      const after = integratedRoutePoint(state.routePoints, Math.min(1, state.rescueProgress + .005));
      const yaw = state.route ? Math.atan2(-(after[2] - before[2]), after[0] - before[0]) : 0;
      truck.forEach(({ mesh, offset }) => {
        const [x, y, z] = offset;
        mesh.position.set(...p([state.vehicle[0] + x * Math.cos(yaw) + z * Math.sin(yaw), state.vehicle[1] + y,
          state.vehicle[2] - x * Math.sin(yaw) + z * Math.cos(yaw)]));
        mesh.rotation.y = yaw; b.outline(mesh, .28);
      });
      warehouseMeshes.forEach(({ id, body, roof, label, post }) => {
        body.userData.selectedWarehouse = id === state.origin; b.outline(body, id === state.origin ? .65 : .25); b.outline(roof, .25);
        post.visible=label.visible=true;
      });
      b.outline(sender, state.selection & 1 ? .6 : .3); b.outline(receiver, .3); k.phase(state.phase);
    },
    framingPoints(){
      if(inspection!=='overview')return null;
      const lamp=observerHeads.map(([x,y,z])=>[x,y+1.6,z] as IntegratedPoint);
      const corners:IntegratedPoint[]=[];
      for(const x of [1,109])for(const z of [1,75])corners.push([x,-6.5,z]);
      const folds:IntegratedPoint[]=state.layersSeparated?[[2,38,4],[106,38,4],[2,38,65],[106,38,65],[115,38,38]]:[];
      const points=[...corners,...lamp,opticalHead,...folds,[2,17,2],[106,17,2]] as IntegratedPoint[];
      // The rear optical bar and the low front rail form a wedge. The
      // upper front corners of a rectangular box do not contain a specimen.
      const frame=state.layersSeparated?.88:.78;
      return points.map(([x,y,z])=>p([55.0+(x-55)*frame,9+(y-9)*frame,39+(z-39)*frame]));
    },
    focusBounds() {
      if(inspection==='remote')return {min:p([1,-3,2]),max:p([64,28,53])};
      if(inspection==='position')return {min:p([23,-3,1]),max:p([109,31,61])};
      if(inspection==='roads')return {min:p([4,-4,6]),max:p([105,state.layersSeparated?41:19,67])};
      if (inspection === 'warehouses') return { min: p([3, 0, 7]), max: p([99, 29, 65]) };
      return {min:p([.5,-6.5,.2]),max:p([state.layersSeparated?116:109.5,state.layersSeparated?41:28,75])};
    },
    describe: () => ({ ...state, inspection, integrated: true, originalPagePreserved: true,
      fixedMeshCount: count, geometryBuffersReused: buffers.every((buffer, i) => b.meshes[i]?.geometry.attributes.position.array === buffer),
      mapLayerHeights: mapLayers.map(layer => layer.edges[0].position.y / s), sameGeographicCoordinatesAcrossLayers: true,
      tabletopNavigation:observerHeads,tabletopOpticalSource:opticalHead,physicalBench:'linked-observation-bridge',
      vehicleWorld: k.world(p(state.vehicle)), receiverWorld: k.world(p(QUAKE_LAYOUT.receiver)),
      roadWorld: state.roads.map(edge => ({ ...edge, a: k.world(p(QUAKE_LAYOUT.nodes[edge.a])), b: k.world(p(QUAKE_LAYOUT.nodes[edge.b])) })),
      handleWorld: k.world(k.handle.position.toArray()), phaseTrackWorld: { start: k.world(k.track.start), end: k.world(k.track.end) },
      bookmarkEncoding: 'phase + selection bitmask: communication=1, road-verification=2, warehouse-B=4, separate-layers=8',
      actualDispatch: false, calibratedTime: false,
    }),
  };
  motion.update(0, 0, 0, true); return motion;
}

/** Shared integration contract; unknown effects are not silently substituted. */
export function buildIntegratedWorld(g: TextbookGeometry, effect: string): ModelMotion | null {
  if (effect === 'basin-system') return buildBasin(g);
  if (effect === 'city-rain-system') return buildCity(g);
  if (effect === 'quake-response-system') return buildQuakeResponse(g);
  return null;
}
