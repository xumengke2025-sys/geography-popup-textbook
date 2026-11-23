import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountFieldInstrument } from './textbook-field-instruments';
import { phaseTrackPoint, type ModelInput } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { evaluateWaterRenewal } from './textbook-water-renewal-model';

/** Open-topped water-budget instrument: one retained storage, real plumbing,
 * an observable receiver and a sample tap. The pane is an actual local window,
 * not a transparent enclosure around the whole lesson. */
export function buildWaterRenewalWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, originZ = -LIFT_MARGIN - b.height * .48;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, originZ + z * s];
  const parts = mountFieldInstrument(b, 'water-renewal', s, p(0, 0));
  const tag = (mesh: any, role: string) => { mesh.userData.waterRenewalRole = role; return mesh; };
  const input = (node: any, action: ModelInput) => {
    node.traverse((mesh: any) => { if (mesh.isMesh) { mesh.userData.modelInput = action; mesh.userData.interactionFeedback = false; } });
    return node;
  };
  const solid = (geometry: any, color: string, material: SolidMaterialRole, role: string, parent = b.root) => {
    const mesh = b.mesh(geometry, color, false, true, material);
    // Filled water volumes receive vessel shadows but do not self-project their
    // closed cylinder onto the surface or inspection pane.
    if (material === 'water') { mesh.castShadow = false; mesh.userData.castShadow = false; }
    parent.add(mesh); return tag(mesh, role);
  };
  const cylinder = (x: number, y: number, z: number, radius: number, height: number, color: string, material: SolidMaterialRole, role: string) => {
    const mesh = solid(new T.CylinderGeometry(radius * s, radius * s, height * s, 48), color, material, role);
    mesh.position.set(...p(x, y, z)); return mesh;
  };
  const balanced: ModelInput = { kind: 'replay', selection: 0, label: '从同一初始水位观察补给与取用相当' };
  const overdraw: ModelInput = { kind: 'replay', selection: 1, label: '从同一初始水位观察取用超过补给' };
  const polluted: ModelInput = { kind: 'replay', selection: 2, label: '比较水量仍在、污染影响可用性的情形' };

  const branch = (group: string, role: string, action?: ModelInput) => {
    const meshes = parts.get(group)!;
    for (const mesh of meshes) {
      tag(mesh, role);
      if (action) input(mesh, action);
    }
    return meshes;
  };
  for (const [group, role, inner, outer, action] of [
    ['tank-wall', 'open-reservoir-wall', 17.28, 18.67, overdraw],
    ['supply-wall', 'open-boundary-supply', 6.27, 7.26, balanced],
    ['receiver-wall', 'open-receiving-cup', 8.01, 8.83, overdraw],
    ['sample-wall', 'sample-cup', 2.65, 3.20, polluted],
  ] as const) {
    for (const mesh of branch(group, role, action)) {
      Object.assign(mesh.userData, { openTop: true, innerRadius: inner * s, wallThickness: (outer - inner) * s });
    }
  }
  branch('tank-floor', 'retained-tank-floor');
  branch('tank-rim', 'open-reservoir-mouth');
  branch('receiver-rim', 'receiver-open-mouth');
  branch('outlet-nozzle', 'withdrawal-open-nozzle');
  branch('datum', 'initial-water-level-reference');
  for (const [group, role, action] of [
    ['supply-pipe', 'inlet-plumbing', balanced], ['outlet-pipe', 'withdrawal-plumbing', overdraw],
    ['sample-tap', 'sampling-tap', polluted],
  ] as const) for (const mesh of branch(group, role, action)) mesh.userData.hollowPipe = true;
  for (const pane of branch('pane', 'reservoir-inspection-pane')) {
    for (const material of [pane.material].flat()) {
      material.opacity = .12;
      material.transparent = true;
      material.depthWrite = false;
    }
    pane.castShadow = pane.userData.castShadow = false;
    pane.userData.isObservationWindow = true;
    input(pane,{kind:'inspect',target:'storage',toggleTo:'overview',label:'近看储水水位，再点回到整台'});
  }
  for(const [group,target,label] of [['tank-rim','storage','储水刻度'],['supply-rim','supply','补给入口'],['receiver-rim','receiver','接收杯'],['sample-rim','sample','水质样本']] as const) {
    for(const mesh of parts.get(group)??[])input(mesh,{kind:'inspect',target,toggleTo:'overview',label:'近看'+label});
  }
  for(const mesh of parts.get('supply-pipe')!)input(mesh,{kind:'inspect',target:'supply',toggleTo:'overview',label:'近看补给管口'});
  for(const mesh of parts.get('sample-tap')!)input(mesh,{kind:'inspect',target:'sample',toggleTo:'overview',label:'近看取样口'});
  branch('quality', 'quality-sample-selector', polluted);
  const float = branch('float', 'surface-float', overdraw);
  const valve = new T.Group();
  valve.position.set(...p(73.5, 20.7, 1.5));
  b.root.add(valve);
  for (const mesh of branch('valve', 'withdrawal-valve-wheel', overdraw)) {
    mesh.geometry.translate(-valve.position.x, -valve.position.y, -valve.position.z);
    valve.add(mesh);
  }
  const reservoir = cylinder(49, 14.4, -3, 16.85, 1, '#5895a2', 'water', 'stored-water');
  const receivedWater = cylinder(84, 3.9, -3, 7.8, 1, '#5895a2', 'water', 'received-water');
  const sampleWater = cylinder(49, 5, 20.72, 2.52, 3.6, '#5895a2', 'water', 'water-quality-sample');
  input(sampleWater, polluted);
  const track = { start: p(24, 5, 28), end: p(74, 5, 28) };
  branch('rail', 'observation-rail');
  const sliders = branch('cursor', 'observation-slider', {
    kind: 'phase-track', track, label: '沿观察轨拖动，比较同一时段的储水与取水',
  });
  for (const mesh of sliders) mesh.geometry.translate(-track.start[0], -track.start[1], -track.start[2]);
  const inputDrops = Array.from({ length: 4 }, (_, i) => cylinder(0, 0, 0, .48, 1.8, '#74abb2', 'water', `inlet-drop-${i}`));
  const outputDrops = Array.from({ length: 3 }, (_, i) => cylinder(0, 0, 0, .5, 1.4, '#74abb2', 'water', `outlet-drop-${i}`));
  const contaminants = Array.from({ length: 10 }, (_, i) => {
    const mesh = solid(new T.OctahedronGeometry(.45 * s), '#8d713d', 'rock', 'quality-symbol');
    mesh.userData.qualitySymbol = i; return mesh;
  });
  const clean = reservoir.material;
  const dirty = b.materialFor('water', '#a9a07e');
  let state = evaluateWaterRenewal(0), inspection = 'overview';
  const fixedCount = b.meshes.length, fixedBuffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const animateWater = (mesh: any, x: number, z: number, bottom: number, depth: number) => {
    mesh.scale.y = Math.max(.002, depth); mesh.position.set(...p(x, bottom + Math.max(.002, depth) / 2, z));
  };
  const update = (phase: number, selection: number) => {
    state = evaluateWaterRenewal(phase, selection);
    const depth = state.level * 25, top = 14.4 + depth;
    animateWater(reservoir, 49, -3, 14.4, depth);
    animateWater(receivedWater, 84, -3, 3.9, state.receiverLevel * 7.3);
    receivedWater.visible = state.phase > .002;
    for (const mesh of [reservoir, receivedWater, sampleWater]) mesh.material = state.contaminated ? dirty : clean;
    for (const mesh of float) mesh.position.y = (top + .17) * s;
    valve.rotation.z = state.selection === 1 ? .85 : -.2;
    input(valve, state.selection === 1 ? balanced : overdraw);
    const cursor = phaseTrackPoint(state.phase, track);
    for (const mesh of sliders) mesh.position.set(...cursor);
    inputDrops.forEach((mesh, i) => {
      const q = (state.phase * 5 + i / inputDrops.length) % 1;
      mesh.visible = state.phase > 0 && state.phase < 1;
      mesh.position.set(...p(38, 42.4 + (top + .3 - 42.4) * q, -3));
    });
    outputDrops.forEach((mesh, i) => {
      const q = (state.phase * (state.selection === 1 ? 10 : 4) + i / outputDrops.length) % 1;
      const low = 4.1 + state.receiverLevel * 7.3;
      mesh.visible = state.phase > 0 && state.phase < 1;
      mesh.position.set(...p(84, 12.2 + (low - 12.2) * q, -3)); mesh.material = state.contaminated ? dirty : clean;
    });
    contaminants.forEach((mesh, i) => {
      const a = i * 2.399963, r = 4 + i % 3 * 3.4;
      mesh.visible = state.contaminated;
      mesh.position.set(...p(49 + Math.sin(a) * r, top + .12, -3 + Math.cos(a) * r));
    });
    reservoir.userData.normalizedLevel = state.level; receivedWater.userData.normalizedReceiverLevel = state.receiverLevel;
  };
  update(0, 0);
  return {
    update,
    inspect(target) { inspection = target; },
    inspectTargets: () => [{ target: 'supply', label: '补给入口' }, { target: 'storage', label: '储水与初始参照' },
      { target: 'receiver', label: '取用与接收' }, { target: 'sample', label: '水质样本' }],
    focusBounds() {
      if (inspection === 'supply') return { min: p(2, 0, -17), max: p(57, 56, 18) };
      if (inspection === 'storage') return { min: p(23, 4, -25), max: p(75, 47, 25) };
      if (inspection === 'receiver') return { min: p(58, 0, -17), max: p(98, 30, 19) };
      if (inspection === 'sample') return { min: p(37, 0, 7), max: p(62, 28, 32) };
      return { min: p(1, 0, -25), max: p(100, 56, 33) };
    },
    describe: () => ({ ...state, inspection, originalPagePreserved: true, actualOpenVessels: true,
      realWallThickness: true, connectedSupplyAndWithdrawal: true, receiverReadsSameState: true,
      isolatedObservationWindow: true, sharedInitialReference: true, qualityChangesStoredAmount: false,
      mainWaterSurface: 14.4 + state.level * 25, receiverWaterSurface: 3.9 + state.receiverLevel * 7.3,
      fixedMeshCount: fixedCount, geometryBuffersReused: b.meshes.length === fixedCount && b.meshes.every((m, i) => m.geometry.attributes.position.array === fixedBuffers[i]),
      handleWorld: new T.Vector3().copy(sliders[0].position).applyMatrix4(b.root.matrixWorld).toArray(),
      phaseTrackWorld: { start: new T.Vector3(...track.start).applyMatrix4(b.root.matrixWorld).toArray(), end: new T.Vector3(...track.end).applyMatrix4(b.root.matrixWorld).toArray() },
      construction: 'open-water-budget-instrument', numericalScalesAreMeasured: false }),
  };
}
