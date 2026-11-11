import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { CURRENT_LAYOUT, CURRENT_REFERENCE, CURRENT_SAMPLES, CURRENT_STOPS, CURRENT_WAVE_ORBIT,
  currentCoastMesh, currentPathPoint, currentPathTangent, currentRibbonMesh, currentSeaMesh,
  evaluateOceanCurrent, type CurrentMeshData, type CurrentPoint } from './textbook-current-model';

/** A raised local sea window, not a map of the satellite image. Thick paper
 * water, a deliberately abstract bank and twelve permanent solid water marks
 * replace the old independent drifting arrows. No image forms this model. */
export function buildCurrentWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 43 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, value: string) => { mesh.userData.currentRole = value; return mesh; };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .06) => {
    const key = `${color}:${hatch}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#647a72', spacing: 2.8, hatch, shade: .09, seed: 391 + materials.size });
      material.side = T.DoubleSide; materials.set(key, material);
    }
    return materials.get(key);
  };
  const solid = (geometry: any, color: string, name: string, hatch = .06) => {
    const mesh = role(b.mesh(geometry, color, false), name); mesh.material = paper(color, hatch); return mesh;
  };
  const geometryFrom = (data: CurrentMeshData) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3)));
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const input = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'select', selection, label }; return mesh;
  };
  const sea = solid(geometryFrom(currentSeaMesh()), '#a9c8cb', 'closed-sea-solid', .045);
  const coast = solid(geometryFrom(currentCoastMesh()), '#c7bea0', 'abstract-coast-solid', .12);
  const ribbon = solid(geometryFrom(currentRibbonMesh()), '#a1c0c2', 'open-direction-guide', .025);
  coast.userData.notGeoreferenced = true; ribbon.userData.isActualRoute = false;
  b.stroke(CURRENT_LAYOUT.coast.map(([x, z]) => p([x, 12.85, z])), .48, true);
  b.stroke([[4, .8, 55], [97, .8, 55], [97, 8.5, 55], [4, 8.5, 55]].map(p), .47);
  b.stroke([[97, 8.5, 55], [97, 8.5, 8], [4, 8.5, 8]].map(p), .32);
  for (const y of [3, 5.6]) b.stroke([[18, y, 55.04], [97, y, 55.04]].map(p), .15);
  for (const side of [-5.3, 5.3]) b.stroke(Array.from({ length: 65 }, (_, i) => {
    const point = currentPathPoint(i / 64, side); return p([point[0], 8.86, point[2]]);
  }), .2);
  // A few fixed water strokes give the sea a material surface. They do not
  // move independently or purport to show the velocity of the surrounding sea.
  for (const [x, z] of [[34, 15], [49, 12], [64, 11], [84, 43], [67, 49]])
    b.stroke([[x - 2, 8.55, z], [x, 8.57, z + .2], [x + 2.3, 8.55, z]].map(p), .17);

  const arrowVertices: number[] = [], arrowIndices: number[] = [];
  for (const t of [.38, .73]) {
    const point = currentPathPoint(t), tangent = currentPathTangent(t), nx = -tangent[2], nz = tangent[0];
    const triangle: CurrentPoint[] = [point,
      [point[0] - tangent[0] * 2.1 + nx * .9, 9.05, point[2] - tangent[2] * 2.1 + nz * .9],
      [point[0] - tangent[0] * 2.1 - nx * .9, 9.05, point[2] - tangent[2] * 2.1 - nz * .9]];
    const k = arrowVertices.length / 3;
    for (const y of [8.93, 9.1]) for (const q of triangle) arrowVertices.push(q[0], y, q[2]);
    arrowIndices.push(k, k + 1, k + 2, k + 3, k + 5, k + 4);
    for (let j = 0; j < 3; j++) { const next = (j + 1) % 3; arrowIndices.push(k + j, k + next, k + j + 3, k + next, k + next + 3, k + j + 3); }
  }
  const direction = solid(geometryFrom({ positions: arrowVertices, indices: arrowIndices }), '#648f98', 'fixed-direction-marks', .025);
  input(direction, 1, '沿示意流向追踪同一组水体');

  const tokenGeometry = new T.CylinderGeometry(1.2 * scale, 1.2 * scale, .62 * scale, 16);
  const tokens = CURRENT_SAMPLES.map(sample => {
    const mesh = input(solid(tokenGeometry, sample.color, 'water-tracer', .035), 1, '追踪同一组定向前移的水体');
    mesh.userData.currentSampleId = sample.id; mesh.userData.currentSampleIndex = sample.index;
    mesh.userData.smallPointTarget = true;
    if (sample.index === 0) mesh.scale.set(1.22, 1.22, 1.22);
    return mesh;
  });
  const bookmarkGeometry = new T.TorusGeometry(2.0 * scale, .16 * scale, 6, 32);
  bookmarkGeometry.rotateX(Math.PI / 2);
  const first = CURRENT_SAMPLES[0];
  const origin = input(solid(bookmarkGeometry, '#b69a69', 'origin-bookmark', .035), 0, '回到这组水体的起点');
  const destination = input(solid(bookmarkGeometry, '#93a59a', 'destination-bookmark', .035), 2, '保留并对照这组水体的末位置');
  origin.position.set(...p(first.origin)); destination.position.set(...p(first.destination));
  origin.userData.currentSampleId = destination.userData.currentSampleId = first.id;
  origin.userData.smallPointTarget = destination.userData.smallPointTarget = true;

  // The comparison is the existing ideal-wave orbit, rendered as a small
  // reference above the water. It is not an extra current in the sea window.
  b.stroke(CURRENT_WAVE_ORBIT.map(p), .35);
  const waveReference = solid(new T.SphereGeometry(.75 * scale, 16, 10), '#c6ac7c', 'wave-reference-particle', .035);
  waveReference.userData.motionReference = 'existing-ideal-wave-closed-orbit';
  const waveLabel = role(b.label('往复参照', p(CURRENT_LAYOUT.waveLabel), 28 * scale, 7.8 * scale), 'comparison-label');

  const track: PhaseTrack = { start: p(CURRENT_LAYOUT.track.start), end: p(CURRENT_LAYOUT.track.end) };
  const railGeometry = new T.BoxGeometry(76 * scale, .28 * scale, .65 * scale);
  railGeometry.translate(...p([50, 1, 66]));
  const rail = solid(railGeometry, '#b9ad91', 'phase-rail', .04);
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，回看同一组水体的定向移动' };
  const handleShape = new T.Shape();
  [[-2.7, 0], [0, 1.9], [2.7, 0], [0, -1.9]].forEach(([x, y], i) =>
    i ? handleShape.lineTo(x * scale, y * scale) : handleShape.moveTo(x * scale, y * scale));
  handleShape.closePath();
  const handleGeometry = new T.ExtrudeGeometry(handleShape, { depth: .7 * scale, bevelEnabled: false });
  handleGeometry.translate(0, 0, -.35 * scale);
  const handle = solid(handleGeometry, '#e1d1ab', 'phase-handle', .045);
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动观察进度；末位置停留，不自动回卷' };
  const labels = CURRENT_STOPS.map((stop, i) => {
    const label = role(b.label(stop.label, p(CURRENT_LAYOUT.labels[i]), 22 * scale, 7.8 * scale), 'process-label');
    return input(label, i, stop.label);
  });
  let state = evaluateOceanCurrent(0);
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const fixedStructures = [sea, coast, ribbon, direction];
  const motion: ModelMotion = {
    update(phase, _selection, _dt, _reduced) {
      state = evaluateOceanCurrent(phase);
      tokens.forEach((mesh, i) => {
        const sample = state.samples[i]; mesh.position.set(...p(sample.point));
        mesh.userData.currentProgress = sample.progress;
        b.outline(mesh, i === 0 ? .49 : .27);
      });
      waveReference.position.set(...p(state.comparison.point));
      handle.position.set(...phaseTrackPoint(state.phase, track));
      labels.forEach((label, i) => { label.userData.currentActive = i === state.stageIndex; });
      if (state.phase > 0) b.contour(state.trace.map(p), .37);
      b.outline(handle, .56);
    },
    focusBounds: () => ({ min: p([-2, -14, 4]), max: p([104, 36, 76]) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'ocean-current-advection', source: CURRENT_REFERENCE, state,
        phase: state.phase, stage: state.stage, stageIndex: state.stageIndex, selection: state.selection,
        caption: state.caption, activeStop: state.activeStop,
        sampleCount: state.sampleCount, retainedCount: state.retainedCount, samples: state.samples,
        phaseMeaning: state.phaseMeaning, phaseIsCalibratedTime: false,
        notGeoreferenced: true, actualCoastline: false, actualTrajectory: false, namedCurrent: null,
        measuredSpeed: false, measuredTemperature: false, arrivalDates: false, globalClosedCirculation: false,
        wraps: false, respawns: false, endpointRetained: state.complete, comparison: state.comparison,
        nodeStops: CURRENT_STOPS,
        nodeWorld: labels.map((mesh, selection) => ({ selection, point: meshWorld(mesh) })),
        originWorld: meshWorld(origin), destinationWorld: meshWorld(destination),
        tracerWorld: tokens.map((mesh, i) => ({ id: state.samples[i].id, point: meshWorld(mesh), progress: state.samples[i].progress })),
        waveReferenceWorld: meshWorld(waveReference),
        handleWorld: meshWorld(handle), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        allTracersVisible: tokens.every(mesh => mesh.visible), fixedStructureCount: fixedStructures.length,
        meshRoles: b.meshes.map(mesh => ({ role: mesh.userData.currentRole, sampleId: mesh.userData.currentSampleId, point: meshWorld(mesh) })),
        directInteraction: 'tracer-and-endpoint-select-and-phase-track',
        originalPagePreserved: true, elevatedAbovePage: rise,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
