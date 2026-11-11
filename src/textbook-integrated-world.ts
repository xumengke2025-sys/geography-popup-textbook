import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type ModelInput, type PhaseTrack } from './textbook-model-input';
import { buildUrbanWaterWorld } from './textbook-urban-water-world';
import { type SolidMaterialRole } from './textbook-solid-materials';
import { createInstrumentParts } from './textbook-instrument-parts';
import { buildBasinSpecimen } from './textbook-basin-specimen';
import { basinSpecimenGround } from './textbook-basin-detail';
import { basinGround, basinFloodTriangles, basinRiverPoint, evaluateBasin, evaluateCityRain,
  evaluateQuakeResponse, integratedRoutePoint, QUAKE_LAYOUT, quakeResponseActions,
  INTEGRATED_CONTROLS, INTEGRATED_REFERENCES, INTEGRATED_INSPECTIONS, type IntegratedPoint } from './textbook-integrated-model';
export { INTEGRATED_INSPECTIONS } from './textbook-integrated-model';

/** Functional fixtures remain small; water, rock and plants keep geographic
 * colours. Role tags let the shared material system give metal its own BRDF. */
function kit(b: TextbookGeometry, back = 72) {
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
  const track: PhaseTrack = { start: p([13, -16, 80]), end: p([94, -16, 80]) };
  const rail = box([53.5, -16, 80], [83, .45, .7], C.gold, 'process-rail', 'brass');
  input(rail, { kind: 'phase-track', track, label: '拖动过程纸签，暂停并回看同一过程' });
  const handle = solid(new T.OctahedronGeometry(1.8, 0), C.gold, 'process-handle', [13, -16, 80], 'brass');
  handle.scale.set(1, .65, .5); handle.userData.smallPointTarget = true;
  input(handle, { kind: 'phase-track', track, label: '拖动过程前缘' });
  // Engraved stops belong to the real slider; there is no decorative machine
  // underneath the geography and no second set of giant physical UI labels.
  for (let i = 0; i <= 20; i++) box([13 + i * 4.05, -15.69, 80], [.11, .12, i % 5 ? 1.15 : 2.1], C.ink, 'engraved-process-stop', 'steel');
  for (const x of [11.3, 95.7]) {
    box([x, -16.1, 80], [1.7, .8, 3.2], C.ink, 'process-rail-foot', 'steel');
    solid(new T.CylinderGeometry(.45, .45, .18, 12), C.gold, 'process-fastener', [x, -15.6, 80], 'brass');
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
  const river = k.tube(riverPoints, 1.35, C.water, 'connected-river', 'water');
  k.inspect(river, 'bend', '观察上中下游连续相连的河道');
  // Existing delta lobes leave a real opening for the river mouth.
  for (const footprint of [[[92, 30], [104, 23], [102, 31]], [[93, 40], [105, 48], [102, 39]]]) {
    const mesh = b.prism(footprint.map(([x, z]) => [x * s, p([0, 0, z])[2]]), 3.8 * s, 5.5 * s, C.land, false);
    k.role(mesh, 'existing-delta-lobe'); k.inspect(mesh, 'mouth', '观察已有河口与沉积接收端');
  }
  const accumulated = k.solid(new T.ConeGeometry(8, 1.8, 5), C.land, 'long-term-deposition', [103, 5.6, 29]);
  accumulated.rotation.y = .5; k.inspect(accumulated, 'mouth', '长期沉积累积，采用独立时间尺度');
  for (const at of [[14, 49, 31], [24, 52, 34], [18, 51, 39]] as IntegratedPoint[]) {
    const cloud = k.ball(at, 6, C.paper, 'cloud'); cloud.scale.set(1.4, .55, 1);
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
    mesh.userData.tracerId = packet.id; return k.inspect(mesh, 'mouth', '查看有限泥沙的接收端');
  });
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
      fixedMeshCount: count, geometryBuffersReused: b.meshes.length === count && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
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
  parts.plate(p([11,-7.5,68]),p([89,-6.8,72]),'steel');
  const conditionKnobs=[20,50,80].map((x,selection)=>{
    const knob=parts.knob(p([x,-6.1,70]),[0,1,0],2.1*s,1.2*s);
    knob.traverse((mesh:any)=>{if(mesh.isMesh){mesh.userData.modelInput={kind:'replay',selection,label:`重放${INTEGRATED_CONTROLS['city-rain-system'][selection]}`};mesh.userData.urbanSelection=selection}});
    return knob;
  });
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
  const panels = [[0, 7, C.rock], [7, 7, C.land], [14, 6.8, C.green]].map(([bottom, height, color]) => {
    const g = new T.BoxGeometry(86 * s, Number(height) * s, .75 * s);
    g.translate(43 * s, (Number(bottom) + Number(height) / 2) * s, 0);
    const mesh = b.mesh(g, String(color), false, true, 'rock'); mesh.position.set(...pivot);
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
  const latchGeometry = new T.BoxGeometry(6 * s, 1 * s, 2.7 * s);
  const latch = b.mesh(latchGeometry, C.gold, false, true, 'brass'); latch.position.set(...p([49, 22, 65.2]));
  latch.userData.integratedRole = 'underground-side-latch';
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
      conditionKnobs.forEach((knob,i)=>{knob.position.y=(i===state.selection ? .3 : 0)*s});
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
      fixedMeshCount: count, geometryBuffersReused: b.meshes.length === count && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
      integrated: true, source: INTEGRATED_REFERENCES['city-rain-system'],
    }),
  };
  motion.update(0, 0, 0, true); return motion;
}

function buildQuakeResponse(b: TextbookGeometry): ModelMotion {
  const k = kit(b), { s, p } = k;
  let state = evaluateQuakeResponse(0), inspection = 'overview';
  const ground = k.role(b.terrain(2 * s, 108 * s, p([0, 0, 3])[2], p([0, 0, 65])[2],
    (x, z) => { const xx = x / s, zz = (z - p([0, 0, 0])[2]) / s;
      return (2 - 1.45 * Math.exp(-(((xx - 50) / 4) ** 2)) + 14 * Math.exp(-(((zz - 1) / 5.2) ** 2))) * s;
    }, C.land, 58, 32, -3 * s), 'fictional-response-terrain', 'land');
  ground.userData.interactionFeedback = false;
  for (const z of [2.85, 65.15]) {
    k.tube([[2, -2.7, z], [108, -2.7, z]], .2, C.gold, 'map-datum-edge', 'brass');
    for (let i = 0; i <= 10; i++) k.box([3 + i * 10.4, -2.45, z], [.1, .12, i % 5 ? 1 : 1.8], C.ink, 'map-registration-tick', 'steel');
  }
  k.tube([[50, .9, 3], [50, .9, 25], [49, .9, 44], [51, .9, 65]], .85, C.water, 'river-in-fictional-map', 'water');
  const roadMeshes = QUAKE_LAYOUT.roads.map(edge => k.inspect(k.tube([QUAKE_LAYOUT.nodes[edge.a], QUAKE_LAYOUT.nodes[edge.b]], .75, C.rock, `road-${edge.id}`), 'roads', '道路是否可通，须另行核验'));
  for (const at of Object.values(QUAKE_LAYOUT.nodes)) {
    k.solid(new T.CylinderGeometry(1.35, 1.35, .22, 24), '#475457', 'road-node-seat', [at[0], at[1] + .12, at[2]], 'steel');
    k.solid(new T.CylinderGeometry(.65, .65, .28, 20), C.gold, 'road-node-registration', [at[0], at[1] + .35, at[2]], 'brass');
  }
  // A central bridge leaf visibly loses alignment, while the evidence state
  // remains unknown until the observation/verification stages.
  const bridge = k.box([49.5, 3.5, 43], [10, .9, 4], C.paper, 'damaged-bridge-leaf');
  k.inspect(bridge, 'remote', '桥梁变化先作为线索，不能等同道路通行判断');
  for (const x of [44.5, 54.5]) k.box([x, 1.9, 43], [1.1, 3.8, 4.3], C.rock, 'bridge-abutment');
  const warehouseMeshes = ['a', 'b'].map((id, i) => {
    const at = QUAKE_LAYOUT.nodes[id], body = k.box([at[0], at[1] + 3, at[2]], [9, 6, 7], C.paper, `warehouse-${id}`);
    const roof = k.solid(new T.ConeGeometry(6.5, 3, 4), C.darkGreen, `warehouse-${id}-roof`, [at[0], at[1] + 7.1, at[2]]); roof.rotation.y = Math.PI / 4;
    for (const dx of [-2.5, 0, 2.5]) k.box([at[0] + dx, at[1] + 3.2, at[2] + 3.53], [.3, 5, .14], C.gold, 'warehouse-front-division', 'brass');
    const label = k.label(`${i ? '乙' : '甲'}库`, [at[0], 12, at[2] + 4], 7, 3.1);
    return { id, body, roof, label };
  });
  const town = [[84, 40], [91, 36], [91, 46]].map(([x, z]) => {
    const body = k.box([x, 5.5, z], [4.2, 5, 4], C.paper, 'town-house');
    const roof = k.solid(new T.ConeGeometry(3.3, 1.9, 4), C.darkGreen, 'town-roof', [x, 8.5, z]); roof.rotation.y = Math.PI / 4;
    return { body, roof };
  });
  const receiver = k.box([88, 9, 40], [2.2, 3, 1.5], C.paper, 'position-receiver');
  k.inspect(receiver, 'position', '定位接收机；发送位置由独立通信端完成');
  k.box([88, 9.3, 40.8], [1.5, 1.4, .15], C.cool, 'receiver-screen');
  k.solid(new T.CylinderGeometry(.13, .13, 3, 8), C.gold, 'receiver-antenna', [88, 12, 40], 'brass');
  const sender = k.box([91, 9, 40], [1.7, 3.1, 1.3], C.warm, 'independent-communication-terminal');
  const dispatch = k.box([50, 5.4, 7], [7, 6.8, 5], C.paper, 'dispatch-receiver');
  k.inspect(dispatch, 'position', '调度端只有在独立通信到达后收到位置');
  k.solid(new T.CylinderGeometry(.15, .15, 6, 8), C.gold, 'dispatch-antenna', [50, 11.8, 7], 'brass');
  const sendLabel = k.label('通信', [91, 13.4, 42], 7.5, 3.2);
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
  const satellites = QUAKE_LAYOUT.satellites.map((at, i) => {
    const body = k.box(at, [2.7, 2.8, 2.6], C.gold, 'navigation-satellite', 'brass');
    k.inspect(body, 'position', `观察第${i + 1}条接收链路，四星仅为示意`);
    for (const side of [-1, 1]) {
      k.box([at[0] + side * 3.6, at[1], at[2]], [4.6, .45, 2.4], '#475457', 'satellite-panel-frame', 'steel');
      k.box([at[0] + side * 3.6, at[1] + .25, at[2]], [4.1, .1, 1.95], C.cool, 'satellite-panel', 'steel');
      for (let j = -1; j <= 1; j++) k.box([at[0] + side * 3.6 + j * 1.05, at[1] + .32, at[2]], [.055, .04, 1.95], '#b1d0cf', 'solar-cell-busbar', 'steel');
    }
    const dish = k.solid(new T.ConeGeometry(.95, .5, 20, 1, true), C.paper, 'navigation-antenna-dish', [at[0], at[1] - 1.65, at[2]], 'ivory');
    dish.rotation.z = Math.PI;
    return body;
  });
  const navigation = satellites.map(() => k.ball([0, 0, 0], .45, C.cool, 'navigation-signal', 'water'));
  const receiveLights = satellites.map((_, i) => k.ball([87.2 + i * .55, 8.5, 40.9], .18, C.green, 'received-signal-light'));
  const communication = k.ball([0, 0, 0], .52, C.warm, 'communication-message');
  const positionPin = k.solid(new T.ConeGeometry(.9, 2.6, 12), C.red, 'located-point', [88, 15.5, 40]); positionPin.rotation.z = Math.PI;
  const remoteSatellite = k.box([12, 57, 8], [3.5, 3, 3.5], C.gold, 'remote-sensor', 'brass');
  k.inspect(remoteSatellite, 'remote', '查看影像变化证据的来源');
  k.box([12, 57, 8], [14, .6, 3], C.cool, 'remote-sensor-panels', 'steel');
  k.solid(new T.CylinderGeometry(.95, 1.2, 1.8, 24), '#475457', 'remote-optical-barrel', [12, 54.8, 8], 'steel');
  k.solid(new T.CylinderGeometry(.75, .75, .12, 24), C.water, 'remote-optical-lens', [12, 53.86, 8], 'water');
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
    { mesh: k.box([0, 0, 0], [4.6, 1.8, 2.8], C.warm, 'rescue-truck'), offset: [0, 1.7, 0] as IntegratedPoint },
    { mesh: k.box([0, 0, 0], [1.8, 1.2, 2.5], C.paper, 'truck-cabin'), offset: [1.1, 3.1, 0] as IntegratedPoint },
    ...[-1.4, 1.4].flatMap(x => [-1.4, 1.4].map(z => {
      const g = new T.CylinderGeometry(.62, .62, .45, 12); g.rotateX(Math.PI / 2);
      return { mesh: k.solid(g, C.ink, 'truck-wheel'), offset: [x, .65, z] as IntegratedPoint };
    })),
  ];
  truck.forEach(({ mesh }) => k.inspect(mesh, 'roads', '只沿已核验的完整通路前进'));
  const actionMeshes: Record<string, any[]> = { send: [sender, sendLabel], verify: [verifyControl, verifyLabel],
    'warehouse-a': [warehouseMeshes[0].body, warehouseMeshes[0].label],
    'warehouse-b': [warehouseMeshes[1].body, warehouseMeshes[1].label], layers: [layerControl] };
  const count = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const motion: ModelMotion = {
    inspect(target) { if (INTEGRATED_INSPECTIONS['quake-response-system'].some(item => item.target === target)) inspection = target; },
    inspectTargets: () => [...INTEGRATED_INSPECTIONS['quake-response-system']],
    update(phase, selection) {
      state = evaluateQuakeResponse(phase, selection);
      bridge.rotation.z = -state.damage * .18; bridge.position.y = (3.5 - state.damage * 1.2) * s;
      town[1].body.rotation.z = state.damage * .065; town[1].roof.rotation.z = state.damage * .065;
      quakeResponseActions(state.selection, state.phase).forEach(action => {
        for (const mesh of actionMeshes[action.id]) {
          if (action.enabled) k.input(mesh, { kind: action.replay ? 'replay' : 'select', selection: action.selection, label: action.label } as ModelInput);
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
        const link = state.navigation[i]; mesh.position.set(...p(link.point)); mesh.visible = link.progress > 0 && !link.arrived;
        receiveLights[i].visible = link.arrived;
        if (inspection === 'position' && link.progress > 0) b.contour([p(link.source), p(link.point)], .4);
      });
      const comm = state.communication;
      communication.visible = comm.progress > 0 && comm.progress < 1;
      communication.position.set(...p(comm.source.map((value, axis) => value + (comm.target[axis] - value) * comm.progress) as IntegratedPoint));
      if (inspection === 'position' && comm.progress > 0) b.contour([p(comm.source), p(comm.target)], .7);
      // Optical observation is separate from navigation and radio messaging.
      const reflected = Math.max(0, Math.min(1, (state.phase - .2) / .07));
      const sampleSource: IntegratedPoint = [50, 4, 43], sampleTarget: IntegratedPoint = [12, 57, 8];
      remoteSample.visible = reflected > 0 && reflected < 1;
      remoteSample.position.set(...p(sampleSource.map((value, axis) => value + (sampleTarget[axis] - value) * reflected) as IntegratedPoint));
      if (inspection === 'remote' && reflected > 0) b.contour([p(sampleSource), p(sampleTarget)], .6);
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
        roadMeshes[i].userData.roadStatus = road.status;
        if (state.phase < .28) return;
        const yy = state.layersSeparated ? mapY[2] : 4.7;
        if (road.status === 'passable') b.contour([p([a[0], yy, a[2]]), p([c[0], yy, c[2]])], .75);
        else if (road.status !== 'blocked') for (let j = 0; j < 12; j += 2) b.contour([j, j + 1].map(q => p([a[0] + (c[0] - a[0]) * q / 12, yy, a[2] + (c[2] - a[2]) * q / 12])), .32);
        else {
          const xx = (a[0] + c[0]) / 2, zz = (a[2] + c[2]) / 2;
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
      warehouseMeshes.forEach(({ id, body, roof, label }) => {
        body.userData.selectedWarehouse = id === state.origin; b.outline(body, id === state.origin ? .65 : .25); b.outline(roof, .25);
        label.visible = inspection === 'warehouses' || id === state.origin;
      });
      b.outline(sender, state.selection & 1 ? .6 : .3); b.outline(receiver, .3); k.phase(state.phase);
    },
    focusBounds() {
      if (inspection === 'remote') return { min: p([5, 0, 2]), max: p([68, 65, 56]) };
      if (inspection === 'position') return { min: p([15, 0, 1]), max: p([111, 80, 65]) };
      if (inspection === 'roads') return { min: p([3, 0, 5]), max: p([110, 48, 68]) };
      if (inspection === 'warehouses') return { min: p([3, 0, 7]), max: p([99, 29, 65]) };
      return { min: p([0, -20, 0]), max: p([123, 81, 84]) };
    },
    describe: () => ({ ...state, inspection, integrated: true, originalPagePreserved: true,
      fixedMeshCount: count, geometryBuffersReused: b.meshes.length === count && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
      mapLayerHeights: mapLayers.map(layer => layer.edges[0].position.y / s), sameGeographicCoordinatesAcrossLayers: true,
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
