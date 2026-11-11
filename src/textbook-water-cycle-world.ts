import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { evaluateWaterCycle, waterCycleDiagnostics, waterCycleCoastX, waterCycleTerrainHeight,
  waterCycleRiverSection, waterCycleRiverZ, waterCycleLandMesh, waterCycleSeaMesh, waterCycleRiverMesh,
  waterCyclePathPoint, WATER_CYCLE_LAYOUT as L, WATER_CYCLE_CLOUD_PARTS, WATER_CYCLE_PLANTS,
  WATER_CYCLE_LABELS, WATER_CYCLE_REFERENCE, type WaterCycleMesh, type WaterCyclePoint } from './textbook-water-cycle-model';

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
  const geometryFrom = (data: WaterCycleMesh) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as unknown as WaterCyclePoint));
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const local = (geometry: any) => { geometry.scale(scale, scale, scale); return geometry; };
  const land = solid(geometryFrom(waterCycleLandMesh()), '#bac0a3', 'closed-land-solid', .11);
  const sea = solid(geometryFrom(waterCycleSeaMesh()), '#a7c8cb', 'closed-sea-solid', .035);
  const river = solid(geometryFrom(waterCycleRiverMesh()), '#79a9b0', 'river-fitted-to-valley', .025);
  land.userData.originalPageGeometry = false;

  // The river is embedded into the same elevation field. Quiet contours
  // describe its banks, the cut face and the sea; no flat model image is used.
  for (const side of ['leftZ', 'rightZ'] as const) b.stroke(Array.from({ length: 65 }, (_, i) => {
    const section = waterCycleRiverSection(23 + 44 * i / 64); return p([section.x, section.level + .05, section[side]]);
  }), .34);
  for (const z of [8, 50]) {
    b.stroke(Array.from({ length: 51 }, (_, i) => {
      const x = 4 + (waterCycleCoastX(z) - 4) * i / 50; return p([x, waterCycleTerrainHeight(x, z), z]);
    }), .47);
    b.stroke([p([4, .4, z]), p([waterCycleCoastX(z), .4, z])], .35);
  }
  for (const z of [8, 50]) for (const x of [4, waterCycleCoastX(z)])
    b.stroke([p([x, .4, z]), p([x, waterCycleTerrainHeight(x, z), z])], .35);
  b.stroke(Array.from({ length: 41 }, (_, i) => { const z = 8 + 42 * i / 40; return p([waterCycleCoastX(z), 8.1, z]); }), .46);
  b.stroke([p([waterCycleCoastX(50), 8.02, 50]), p([97, 8.02, 50]), p([97, .8, 50])], .4);
  for (const z of [15, 25, 45]) b.stroke(Array.from({ length: 21 }, (_, i) => p([73 + i, 8.09, z + .25 * Math.sin(i * .4)])), .18);
  // Three small plants occupy actual ground; their tops are the start of
  // the transpiration marks in the land-only selection.
  WATER_CYCLE_PLANTS.forEach(([x, z], i) => {
    const y = waterCycleTerrainHeight(x, z);
    b.tree(p([x, y, z]), 4.8 * scale, i === 1 ? 'broad' : 'pine', '#82977a');
  });
  // Thin stratification only on the exposed front cut face. It avoids
  // implying that groundwater travels through a visible pipe.
  for (const height of [3.2, 6.2]) b.stroke(Array.from({ length: 26 }, (_, i) => p([5 + i * 2.1, height + .12 * Math.sin(i * .7), 50.05])), .16);

  const makeCloud = (parts: readonly (readonly [number, number, number, number])[], center: WaterCyclePoint, name: string) => {
    const vertices: number[] = [], indices: number[] = [];
    parts.forEach(([x, y, z, radius]) => {
      const geometry = new T.SphereGeometry(radius, 18, 10); geometry.scale(1, .54, .66);
      geometry.translate(x - center[0], y - center[1], z - center[2]);
      const offset = vertices.length / 3;
      vertices.push(...Array.from(geometry.attributes.position.array) as number[]);
      indices.push(...(Array.from(geometry.index!.array) as number[]).map(index => index + offset)); geometry.dispose();
    });
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = solid(local(geometry), '#f1edde', name, .02); mesh.position.set(...p(center)); return mesh;
  };
  const landCloud = makeCloud(WATER_CYCLE_CLOUD_PARTS.land, [32, 50, 37], 'condensed-land-cloud');
  const seaCloud = makeCloud(WATER_CYCLE_CLOUD_PARTS.sea, [82, 50, 36], 'condensed-sea-cloud');

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
  const railGeometry = new T.BoxGeometry(76 * scale, .22 * scale, .36 * scale);
  const rail = solid(railGeometry, '#afa184', 'phase-rail', .02); rail.position.set(...p([50, -11, 66]));
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动水循环过程纸签' };
  const shape = new T.Shape();
  [[-2.7, 2.4], [2.7, 2.4], [2.7, -.7], [0, -2.7], [-2.7, -.7]].forEach(([x, y], i) =>
    i ? shape.lineTo(x * scale, y * scale) : shape.moveTo(x * scale, y * scale));
  shape.closePath();
  const handleGeometry = new T.ExtrudeGeometry(shape, { depth: .65 * scale, bevelEnabled: false });
  handleGeometry.translate(0, 0, -.325 * scale);
  const handle = solid(handleGeometry, '#d4bc88', 'phase-handle', .045);
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，追踪同一组水的去向' };
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
        handle.position.set(...phaseTrackPoint(state.phase, track));
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
