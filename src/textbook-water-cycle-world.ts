import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { mountFieldInstrument } from './textbook-field-instruments';
import { finishWaterCycleSurfaces } from './textbook-water-cycle-surfaces';
import { evaluateWaterCycle, waterCycleDiagnostics, waterCyclePathPoint, WATER_CYCLE_LAYOUT as L,
  WATER_CYCLE_LABELS, WATER_CYCLE_REFERENCE, type WaterCyclePoint } from './textbook-water-cycle-model';

/** A real, closed watershed floats above the untouched textbook. Six marks
 * retain their identities from source to destination; nothing respawns.
 * Front-face groundwater is an explicitly schematic cutaway, not a tunnel. */
export function buildWaterCycleWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 33 * scale;
  const p = ([x, y, z]: WaterCyclePoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, value: string) => { mesh.userData.waterCycleRole = value; return mesh; };
  const papers = new Map<string, any>();
  const paper = (color: string, hatch = .08) => {
    const key = `${color}:${hatch}`;
    if (!papers.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#697568', hatch, shade: .075, spacing: 2.8, seed: 311 + papers.size });
      material.side = T.DoubleSide; papers.set(key, material);
    }
    return papers.get(key);
  };
  const solid = (geometry: any, color: string, name: string, hatch = .08) => {
    const mesh = role(b.mesh(geometry, color, false), name); mesh.material = paper(color, hatch); return mesh;
  };
  const local = (geometry: any) => { geometry.scale(scale, scale, scale); return geometry; };
  const parts = mountFieldInstrument(b, 'water', scale, p([0, 0, 0]));
  const land = role(parts.get('land')![0], 'closed-land-solid');
  const sea = role(parts.get('sea')![0], 'closed-sea-solid');
  const river = role(parts.get('river')![0], 'river-fitted-to-valley');
  finishWaterCycleSurfaces(b,land,sea,river,scale,back);
  for (const [group,selection,label] of [['land',1,'陆地内循环'],['sea',2,'海上内循环'],['river',0,'海陆间循环']] as const) {
    for(const mesh of parts.get(group)!) mesh.userData.modelInput={kind:'select',selection,keepPhase:true,label:'沿水路追踪'+label};
  }
  land.userData.originalPageGeometry = false;

  const cloud = (group: string, center: WaterCyclePoint, name: string) => {
    const mesh = role(parts.get(group)![0], name), pivot = p(center);
    mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    mesh.position.set(...pivot);
    return mesh;
  };
  const landCloud = cloud('land-cloud', [32, 50, 37], 'condensed-land-cloud');
  const seaCloud = cloud('sea-cloud', [82, 50, 36], 'condensed-sea-cloud');

  const liquidGeometry = local(new T.SphereGeometry(1.03, 14, 9));
  const vaporGeometry = local(new T.OctahedronGeometry(1.35, 0));
  const dropGeometry = local(new T.LatheGeometry([
    new T.Vector2(0, 1.9), new T.Vector2(.32, .98), new T.Vector2(.78, .12),
    new T.Vector2(.85, -.45), new T.Vector2(.57, -1.02), new T.Vector2(0, -1.18),
  ], 12));
  const markers = Array.from({ length: 6 }, (_, i) => {
    const color = i === 0 ? '#aa793e' : i === 3 ? '#84533d' : '#326b7a';
    const liquid = solid(liquidGeometry, color, 'persistent-liquid-mark', .025);
    const vapor = solid(vaporGeometry, color, 'symbolic-vapor-mark', .025);
    const rain = solid(dropGeometry, color, 'persistent-rain-mark', .025);
    for (const mesh of [liquid, vapor, rain]) { mesh.userData.waterSampleId = `water-0${i + 1}`; mesh.raycast = () => {}; }
    return { liquid, vapor, rain };
  });
  const labels = WATER_CYCLE_LABELS.map(label => ({ definition: label,
    // At the 1024×768 classroom view the former 6.2-unit slips projected to
    // only 13.9px. This height leaves a readable margin without shrinking
    // four-character Chinese labels to fit their existing measured widths.
    mesh: role(b.label(label.text, p(label.at), label.width * scale, 9.2 * scale), 'process-label') }));

  const track: PhaseTrack = { start: p(L.trackStart), end: p(L.trackEnd) };
  const cursor = parts.get('cursor')!;
  const handle = role(cursor.find(mesh => mesh.userData.blenderColor === '#467c89')!, 'phase-handle');
  handle.userData.smallPointTarget = true;
  const action = { kind: 'phase-track', track, label: '拖动黄铜游标，追踪同一组水的去向' };
  for (const mesh of cursor) {
    mesh.geometry.translate(-track.start[0], -track.start[1], -track.start[2]);
    mesh.userData.modelInput = action;
  }
  for (const mesh of parts.get('rail')!) role(mesh, 'phase-rail').userData.modelInput = action;
  const legend = role(b.label('◇ 水汽示踪', p([54, -3, 69]), 38 * scale, 9.2 * scale), 'symbol-legend');
  legend.raycast = () => {};
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  let state = evaluateWaterCycle(0), previousKey = '';
  const motion: ModelMotion = {
    update(phase, selection) {
      const key = `${phase}:${selection}`;
      if (key !== previousKey) {
        state = evaluateWaterCycle(phase, selection); previousKey = key;
        for (const [index, marker] of markers.entries()) {
          const sample = state.samples[index];
          marker.liquid.visible = sample.medium === 'liquid' || sample.medium === 'cloud-water';
          marker.vapor.visible = sample.medium === 'vapor'; marker.rain.visible = sample.medium === 'rain';
          for (const mesh of Object.values(marker)) {
            mesh.position.set(...p(sample.position));
            mesh.scale.setScalar(index === 0 || index === 3 ? 1.17 : 1);
          }
        }
        for (const [cloud, amount] of [[landCloud, state.cloud.land], [seaCloud, state.cloud.sea]] as const) {
          cloud.visible = amount > .001; cloud.scale.setScalar(.15 + .85 * amount);
        }
        labels.forEach(({ definition, mesh }) => { mesh.visible = state.labels.some(label => label.id === definition.id); });
        const position = phaseTrackPoint(state.phase, track);
        cursor.forEach(mesh => mesh.position.set(...position));
        legend.visible = state.samples.some(sample => sample.medium === 'vapor');
      }
      // Trails are a partial record of the same finite movement, never a
      // separately looping arrow animation. The two representative marks
      // keep their distinct surface and cutaway return paths visible.
      for (const index of [0, 3]) for (const leg of state.samples[index].route) {
        if (state.phase <= leg.start) continue;
        const q = Math.min(1, Math.max(0, (state.phase - leg.start) / (leg.end - leg.start)));
        const prefix = Array.from({ length: 21 }, (_, i) => p(waterCyclePathPoint(leg.points, q * i / 20)));
        b.flow.push({ points: prefix.map(point => b.v(point)), width: leg.kind === 'subsurface-return' ? .64 : .48 });
      }
      markers.forEach(marker => {
        for (const mesh of Object.values(marker)) if (mesh.visible) b.outline(mesh, .38);
      });
      b.outline(handle, .48);
      b.contour([track.start, track.end], .28);
      for (const stop of state.controls) {
        const at = phaseTrackPoint(stop.phase, track);
        b.contour([[at[0], at[1] - .75 * scale, at[2]], [at[0], at[1] + .75 * scale, at[2]]], .34);
      }
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      return { kind: 'water-cycle-process', ...waterCycleDiagnostics(state), reference: WATER_CYCLE_REFERENCE,
        originalPagePreserved: true, elevatedAbovePage: rise, terrain: 'closed-heightfield-with-fitted-river',
        sea: 'closed-volume-joined-at-same-coast', groundwater: 'exposed-front-face-schematic-cutaway',
        samplesRespawn: false, stableSampleIdentities: true, endpointRetained: state.phase === 1,
        distinctSurfaceAndSubsurfaceReturns: true, cyclic: false, processNodesAreNotCycleSelections: true,
        sampleWorld: state.samples.map(sample => ({ id: sample.id, medium: sample.medium, point: world(p(sample.position)), branch: sample.branch })),
        labelWorld: state.labels.map(label => ({ text: label.text, point: world(p(label.at)), width: label.width * scale })),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(),
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        directInteraction: 'finite-process-phase-track', fixedMeshCount,
        geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        measuredFlowRate: false, measuredWaterAmount: false, measuredTime: false,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
