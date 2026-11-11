import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { buildUrbanSpecimen } from './textbook-urban-specimen';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { evaluateUrbanWater, URBAN_WATER_LABELS, URBAN_WATER_LAYOUT, URBAN_WATER_REFERENCE,
  URBAN_WATER_STOPS, urbanWaterPrismMesh, urbanWaterSolids,
  type UrbanWaterPoint, type UrbanWaterSolid } from './textbook-urban-water-model';

/** One raised city section. Every blue solid is a persistent rain marker;
 * condition selection replays the same finite rain, never a new city panel. */
export function buildUrbanWaterWorld(b: TextbookGeometry, options: { sectionWindow?: boolean; compactControls?: boolean } = {}): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 72 * s, rise = 43 * s;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * s, y * s, back + z * s];
  b.root.position.set(0, rise, -8 * s);
  const solid = (geometry: any, color: string, role: string, _hatch = .07) => {
    // Use the same physical material/reveal path as the rest of the book.
    // The former local paper override flattened every manufactured fitting.
    const substance:SolidMaterialRole=/water-packet/.test(role)?'water':/drain|inlet|collector/.test(role)?'steel':/soil|garden-(?:gravel|sand|fill|mulch)/.test(role)?'rock':/foundation/.test(role)?'wood':/phase|condition-tab/.test(role)?'brass':'ivory';
    const mesh = b.mesh(geometry, color, false,true,substance);
    mesh.userData.urbanRole = role; return mesh;
  };
  const input = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'replay', selection, label }; return mesh;
  };
  let inspection = 'overview';
  const inspect = (mesh: any, target: string, label: string) => {
    mesh.userData.modelInput = { kind: 'inspect', target, toggleTo: 'overview', label }; return mesh;
  };
  const sectionGeometry = (definition: UrbanWaterSolid) => {
    // A deliberately omitted front slice forms the observation bay behind
    // the integrated world's hinged leaf. This is a cutaway convention,
    // not a hollow soil simulation. The water paths remain unchanged.
    const expose = options.sectionWindow && /soil|garden-(?:gravel|sand|fill|mulch)/.test(definition.role);
    const data = urbanWaterPrismMesh(expose ? { ...definition, front: 51 } : definition), positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3)));
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const commonRoles = new Set(['foundation', 'drain-floor', 'drain-back', 'drain-front-lip',
    'surface-inlet-back', 'surface-inlet-left', 'surface-inlet-right', 'collector-floor',
    'collector-back', 'collector-left', 'collector-right', 'collector-front-lip']);
  const common = urbanWaterSolids(0).filter(definition => commonRoles.has(definition.role)).map(definition =>
    solid(sectionGeometry(definition), definition.color, definition.role));
  common.forEach(mesh => {
    const role = mesh.userData.urbanRole;
    if (/drain|inlet/.test(role)) inspect(mesh, 'drain', '观察排水口');
    if (/collector/.test(role)) inspect(mesh, 'collected', '观察收集池及已排出水');
  });
  const fitting = (center: UrbanWaterPoint, size: UrbanWaterPoint, color: string, role: string, target: 'drain' | 'collected') => {
    const geometry = new T.BoxGeometry(...size.map(v => v * s)); geometry.translate(...p(center));
    const mesh = inspect(solid(geometry, color, role, .035), target, target === 'drain' ? '观察排水口' : '观察收集池及已排出水');
    common.push(mesh); return mesh;
  };
  // Raised collars make the surface opening an actual inlet. The middle is
  // deliberately open: the same rain markers can descend through the throat.
  for (const x of [85.95, 90.05]) fitting([x, 21.05, 58.25], [.6, .65, 4], '#bdc4b7', 'surface-inlet-frame-side', 'drain');
  for (const z of [56.2, 60.3]) fitting([88, 21.05, z], [4.7, .65, .55], '#bdc4b7', 'surface-inlet-frame-crosspiece', 'drain');
  // The cut-open channel has a separate wall cap and sits on saddles. None
  // crosses its open front or the moving-water centreline.
  fitting([73.5, 6.9, 56.75], [47.6, .38, .6], '#c1c9bb', 'drain-wall-cap', 'drain');
  for (const x of [64, 79, 92]) {
    fitting([x, 3.7, 58.35], [1.2, 1.8, 3.9], '#adb4a7', 'drain-support-saddle', 'drain');
    fitting([x, 5.9, 56.55], [.65, 2.3, .35], '#8eaaa4', 'drain-wall-joint', 'drain');
  }
  // A small flared outlet connects channel and pool. The front stays cut away
  // so neither the travelling marker nor the retained pool inventory is hidden.
  fitting([96.9, 5.05, 58.3], [2.2, .45, 3.8], '#bfcbc0', 'drain-outlet-sill', 'drain');
  for (const z of [56.35, 60.2]) fitting([96.9, 5.8, z], [2.2, 1.4, .35], '#acbdb1', 'drain-outlet-cheek', 'drain');
  for (const x of [95.8, 113.2]) fitting([x, 5.2, 57.6], [.65, .65, 15.8], '#c3cbbb', 'collector-side-coping', 'collected');
  fitting([104.5, 5.2, 49.7], [18, .65, .65], '#c3cbbb', 'collector-back-coping', 'collected');
  fitting([104.5, 2.5, 65.3], [18, .5, .7], '#a2b7ad', 'collector-cutaway-front-edge', 'collected');
  const conditionMeshes = [0, 1, 2].map(selection => urbanWaterSolids(selection)
    .filter(definition => !commonRoles.has(definition.role)).map(definition => {
      const mesh = input(solid(sectionGeometry(definition), definition.color, definition.role), selection,
        `重放${URBAN_WATER_LABELS[selection]}地面条件`);
      mesh.userData.urbanSelection = selection; mesh.userData.sectionDefinition = definition; return mesh;
    }));
  buildUrbanSpecimen(b,p,s);
  for (const at of URBAN_WATER_LAYOUT.houses) {
    const start = b.meshes.length;
    b.house(p(at), 11 * s, 9.5 * s);
    for (const mesh of b.meshes.slice(start)) mesh.userData.urbanRole = 'paper-house';
  }
  // The open planted depression is deliberately clear of any full top slab.
  // Stems are solid narrow prisms, leaves are thick folded paper diamonds.
  const plants: any[] = [];
  for (const [i, x] of [41, 49, 58].entries()) {
    const height = 10 + i % 2 * 2;
    const stem = solid(new T.CylinderGeometry(.17 * s, .23 * s, height * s, 6), '#859779', 'garden-plant-stem', .025);
    stem.position.set(...p([x, 16.9 + height / 2, 30])); plants.push(stem);
    for (const side of [-1, 1]) {
      const leaf = solid(new T.OctahedronGeometry(1, 0), '#a6b299', 'garden-paper-leaf', .05);
      leaf.scale.set(2.7 * s, .4 * s, 1.3 * s); leaf.rotation.z = side * .62;
      leaf.position.set(...p([x + side * 1.8, 20.3 + (side > 0 ? 2 : 0), 30])); plants.push(leaf);
    }
  }
  // A few fixed gravel faces make the lowest garden layer distinguishable
  // from planting soil. They never stand for water or a measured pore volume.
  for (const [i, x] of [39, 44, 49, 54, 60].entries()) {
    const mesh = solid(new T.IcosahedronGeometry(.72 * s, 0), '#c5c9b6', 'garden-gravel-face', .05);
    mesh.position.set(...p([x, 4.1 + i % 2 * 1.4, 56.45])); plants.push(mesh);
  }
  const tokenGeometry = new T.IcosahedronGeometry(1.05 * s, 1);
  let state = evaluateUrbanWater(0, 0);
  const packets = state.packets.map(packet => {
    const mesh = inspect(solid(tokenGeometry, packet.color, 'water-packet', .025), `packet-${packet.index}`, '追踪这滴水；保留当前观察进度');
    mesh.userData.urbanPacketId = packet.id; mesh.userData.urbanPacketIndex = packet.index;
    mesh.userData.smallPointTarget = true; return mesh;
  });
  const leaderRing = solid(new T.TorusGeometry(1.45 * s, .095 * s, 5, 24), '#b39664', 'tracked-water-ring', .025);
  leaderRing.userData.urbanPacketId = state.packets[0].id;
  const surfaceLabel = b.label('地表余水', p(URBAN_WATER_LAYOUT.surfaceLabel), 29 * s, 7.8 * s);
  const storageLabel = b.label('洼地暂存', p(URBAN_WATER_LAYOUT.storageLabel), 29 * s, 7.8 * s);
  const collectorLabel = b.label('排出', p(URBAN_WATER_LAYOUT.collectorLabel), 18 * s, 7.8 * s);
  for (const mesh of [surfaceLabel, storageLabel, collectorLabel]) mesh.userData.urbanRole = 'process-label';
  inspect(collectorLabel, 'collected', '观察收集池及已排出水');
  const tags = URBAN_WATER_LABELS.map((label, selection) => {
    const at = URBAN_WATER_LAYOUT.conditionLabels[selection];
    const geometry = new T.BoxGeometry(24 * s, 8.8 * s, .6 * s); geometry.translate(...p(at));
    const tab = input(solid(geometry, '#e9e1ca', 'condition-tab', .035), selection, `重放${label}地面条件`);
    tab.userData.urbanSelection = selection;
    const text = input(b.label(label, p([at[0], at[1], at[2] + .45]), 20 * s, 7.8 * s), selection,
      `重放${label}地面条件`);
    text.userData.urbanRole = 'condition-label'; text.userData.urbanSelection = selection;
    return { tab, text };
  });
  const track: PhaseTrack = { start: p(URBAN_WATER_LAYOUT.track.start), end: p(URBAN_WATER_LAYOUT.track.end) };
  const railGeometry = new T.BoxGeometry(76 * s, .28 * s, .6 * s); railGeometry.translate(...p([50, -20, 76]));
  const rail = solid(railGeometry, '#b6ab8e', 'phase-rail', .035);
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，回看同一场雨的连续去向' };
  const handleShape = new T.Shape();
  [[-2.7, 0], [0, 1.9], [2.7, 0], [0, -1.9]].forEach(([x, y], i) =>
    i ? handleShape.lineTo(x * s, y * s) : handleShape.moveTo(x * s, y * s));
  handleShape.closePath();
  const handleGeometry = new T.ExtrudeGeometry(handleShape, { depth: .7 * s, bevelEnabled: false });
  handleGeometry.translate(0, 0, -.35 * s);
  const handle = solid(handleGeometry, '#e0cd9f', 'phase-handle', .04);
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动观察进度；排出的水停留在收集池' };
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const motion: ModelMotion = {
    inspect(target) { if (['overview', 'drain', 'collected'].includes(target) || /^packet-(?:[0-9]|1[01])$/.test(target)) inspection = target; },
    inspectTargets: () => [{ target: 'overview', label: '整体' }, { target: 'packet-0', label: '追踪水滴' },
      { target: 'drain', label: '排水口' }, { target: 'collected', label: '收集池' }],
    update(phase, selection) {
      state = evaluateUrbanWater(phase, selection);
      const trackedIndex = inspection.startsWith('packet-') ? Number(inspection.slice(7)) : 0;
      conditionMeshes.forEach((meshes, i) => { for (const mesh of meshes) mesh.visible = i === state.selection; });
      for (const mesh of plants) mesh.visible = state.selection === 2;
      surfaceLabel.visible = !options.compactControls&&inspection==='overview'&&state.selection !== 2 && state.phase >= .3;
      storageLabel.visible = !options.compactControls&&inspection==='overview'&&state.selection === 2 && state.phase >= .3;
      collectorLabel.visible = (!options.compactControls||inspection==='collected')&&['overview','collected','drain'].includes(inspection)&&state.inventory.drain + state.inventory.collected > 0;
      collectorLabel.scale.setScalar(.5);
      packets.forEach((mesh, i) => {
        const packet = state.packets[i]; mesh.position.set(...p(packet.point));
        mesh.scale.setScalar(inspection === `packet-${i}` ? 1.5 : 1.18);
        mesh.userData.urbanCompartment = packet.compartment; mesh.userData.finalDestination = packet.finalDestination;
        const focused = inspection === 'collected' ? packet.compartment === 'collected'
          : inspection === 'drain' ? packet.compartment === 'drain' : i === trackedIndex;
        b.outline(mesh, focused ? .8 : packet.endpointReached ? .48 : .29);
        // Keep the same marker at the receiving place. An ink footprint makes
        // arrival legible without adding water or inventing another quantity.
        if(packet.endpointReached&&packet.compartment==='collected')b.ring(p([packet.point[0],2.55,packet.point[2]]),1.65*s,'xz');
      });
      leaderRing.position.set(...p(state.packets[trackedIndex].point));
      leaderRing.visible = inspection !== 'drain' && inspection !== 'collected';
      for (const mesh of [...common, ...conditionMeshes[state.selection]]) {
        const role = mesh.userData.urbanRole;
        const focused = inspection === 'drain' && /drain|inlet/.test(role) || inspection === 'collected' && /collector/.test(role);
        b.outline(mesh, focused ? .76 : .3);
      }
      if (state.selection === 2) for (const mesh of plants) b.outline(mesh, .25);
      tags.forEach(({ tab, text }, i) => {
        tab.visible=text.visible=!options.compactControls&&inspection==='overview';
        tab.userData.active = text.userData.active = i === state.selection;
        b.outline(tab, i === state.selection ? .62 : .27);
      });
      if (state.phase > 0 && leaderRing.visible) b.contour(state.packets[trackedIndex].trace.map(p), inspection === 'overview' ? .38 : .65);
      handle.position.set(...phaseTrackPoint(state.phase, track)); b.outline(handle, .53);
    },
    focusBounds: () => {
      if(inspection==='drain')return {min:p([60,0,49]),max:p([116,30,69])};
      if(inspection==='collected')return {min:p([93,0,47]),max:p([118,27,68])};
      if(inspection.startsWith('packet-')){const at=state.packets[Number(inspection.slice(7))].point;
        return {min:p([at[0]-15,at[1]-10,at[2]-12]),max:p([at[0]+15,at[1]+13,at[2]+12])};}
      return {min:p([-1,-25,11]),max:p([117,75,81])};
    },
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'urban-rainfall-partition', source: URBAN_WATER_REFERENCE, state,
        phase: state.phase, selection: state.selection, mode: state.mode, surface: state.mode, inspection,
        stage: state.stage, stageIndex: state.stageIndex, caption: state.caption, text: state.text,
        packets: state.packets, inventory: state.inventory, packetCount: packets.length,
        inputCount: state.inputCount, retainedCount: state.retainedCount, collectedCount: state.collectedCount,
        complete: state.complete, wraps: false, respawns: false, sameRainInput: true,
        infiltration: state.infiltration, temporaryStorage: state.temporaryStorage,
        quantitativeRunoffModel: false, preventsAllFlooding: false, calibratedTime: false,
        packetUnitsAreSchematic: true, purificationSimulated: false, delayIsQualitative: true,
        nodeStops: URBAN_WATER_STOPS, allPacketsVisible: packets.every(mesh => mesh.visible),
        packetWorld: packets.map((mesh, i) => ({ id: state.packets[i].id, point: meshWorld(mesh), compartment: state.packets[i].compartment })),
        conditionWorld: tags.map(({ text }, selection) => ({ selection, point: meshWorld(text) })),
        handleWorld: meshWorld(handle), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        openGardenSection: state.selection === 2, noFullGardenTopSlab: true,
        visibleRoles: b.meshes.filter(mesh => mesh.visible).map(mesh => mesh.userData.urbanRole),
        directInteraction: 'condition-replay-packet-inspection-and-front-phase-track', originalPagePreserved: true, elevatedAbovePage: rise,
        sectionWindow: !!options.sectionWindow, omittedFrontSliceIsSchematic: !!options.sectionWindow,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
