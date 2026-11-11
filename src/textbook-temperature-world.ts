import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import {
  evaluateTemperatureProfile, evaluateTemperatureInspection, temperatureAxisX, temperatureDepthY, temperatureProfilePoint, temperatureWaterMesh,
  TEMPERATURE_LAYOUT as L, TEMPERATURE_NOTES, TEMPERATURE_PROFILE_CURVE, TEMPERATURE_REFERENCE, TEMPERATURE_STOPS,
  type TemperatureMeshData, type TemperaturePoint,
} from './textbook-temperature-model';

/** One raised water cutaway with the printed profile in front of its face.
 * The water's colors and graph remain fixed while a physical observation
 * slice, curve read-point and probe seek the same depth. No bitmap is used. */
export function buildTemperatureWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 76 * scale, rise = 51 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, value: string) => { mesh.userData.temperatureRole = value; return mesh; };
  const select = (mesh: any, selection: number, label = `观察${TEMPERATURE_STOPS[selection].label}`) => {
    mesh.userData.modelInput = { kind: 'select', selection, label };
    mesh.userData.temperatureSelection = selection; return mesh;
  };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .055, vertexColors = false) => {
    const key = `${color}:${hatch}:${vertexColors}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#6c827b', spacing: 3, hatch, shade: .085, seed: 433 + materials.size });
      material.side = T.DoubleSide; material.vertexColors = vertexColors;
      materials.set(key, material);
    }
    return materials.get(key);
  };
  const solid = (geometry: any, color: string, name: string, hatch = .055, vertexColors = false) => {
    const mesh = role(b.mesh(geometry, color, false), name); mesh.material = paper(color, hatch, vertexColors); return mesh;
  };
  const geometryFrom = (data: TemperatureMeshData) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3)));
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    if (data.colors) geometry.setAttribute('color', new T.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const placedGeometry = (geometry: any, at: TemperaturePoint) => {
    geometry.scale(scale, scale, scale); geometry.translate(...p(at)); return geometry;
  };
  const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
  const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;

  const water = select(solid(geometryFrom(temperatureWaterMesh()), '#ffffff', 'fixed-profile-closed-water-volume', .035, true), 1);
  water.userData.temperatureNeverChangesWithPhase = true;
  water.userData.modelInput = { kind: 'inspect', target: 'surface-compare', toggleTo: 'overview', label: '以表层为固定参照，对照当前深度；再次选择收起' };
  // A thin paper plinth and full depth edge give the cutaway a tangible
  // volume. Neither the display width nor the plinth is an actual distance.
  const base = solid(placedGeometry(new T.BoxGeometry(74, 1.5, 44), [54, 3.1, 33]), '#b9b8a2', 'cutaway-base', .09);
  b.stroke([[18, 4, 54], [90, 4, 54], [90, 64, 54], [18, 64, 54], [18, 4, 54]].map(p), .47);
  b.stroke([[18, 64, 54], [18, 64, 12], [90, 64, 12], [90, 64, 54]].map(p), .35);
  b.stroke([[90, 4, 54], [90, 4, 12], [90, 64, 12]].map(p), .31);
  // Sparse fixed surface ink has no independent animation and cannot imply
  // a current, a forecast, or temporal heating of the profile.
  for (const [x, z] of [[33, 23], [57, 19], [74, 35]])
    b.stroke([[x - 3, 64.1, z], [x, 64.2, z + .3], [x + 3, 64.1, z]].map(p), .18);

  b.stroke(TEMPERATURE_PROFILE_CURVE.map(p), .63);
  const axisZ = L.depthAxis.z;
  b.stroke([[18, 68, axisZ], [90, 68, axisZ]].map(p), .34);
  b.stroke([[12, 64, axisZ], [12, -8, axisZ]].map(p), .34);
  const tickLabels: any[] = [];
  for (const temp of TEMPERATURE_REFERENCE.temperatureAxisC) {
    const x = temperatureAxisX(temp);
    b.stroke([[x, 68, axisZ], [x, 66.8, axisZ]].map(p), .30);
    tickLabels.push(role(b.label(String(temp), p([x, 76, 62]), 14.5 * scale, 10.2 * scale), 'temperature-axis-label'));
  }
  for (const depth of TEMPERATURE_REFERENCE.depthAxisKm) {
    const y = temperatureDepthY(depth);
    b.stroke([[12, y, axisZ], [13.5, y, axisZ]].map(p), .27);
    tickLabels.push(role(b.label(String(depth), p([4.5, y, 62]), 9.4 * scale, 10.2 * scale), 'depth-axis-label'));
  }
  tickLabels.push(role(b.label('km', p([0, 76, 62]), 13.4 * scale, 10.2 * scale), 'depth-unit'));
  tickLabels.push(role(b.label('温度 / °C', p(L.temperatureUnit), 53 * scale, 10.2 * scale), 'temperature-unit'));

  const sliceGeometry = new T.BoxGeometry(73 * scale, .48 * scale, 47.8 * scale);
  const slice = solid(sliceGeometry, '#d5c39e', 'moving-observation-depth-slice', .035);
  slice.userData.observationOnly = true;
  slice.userData.modelInput = { kind: 'phase-track', track: { start: p([95, 64, 62]), end: p([95, 4, 62]) }, label: '拖动切片，连续观察深度；水温曲线不随时间改变' };
  const railGeometry = placedGeometry(new T.CylinderGeometry(.23, .23, 60, 10), [95, 34, 62]);
  const depthRail = solid(railGeometry, '#aaa185', 'fixed-depth-probe-guide', .035);
  const depthTrack: PhaseTrack = { start: p([95, 64, 62]), end: p([95, 4, 62]) };
  depthRail.userData.modelInput = { kind: 'phase-track', track: depthTrack, label: '沿导轨拖动深度探针' };
  const probe = solid(new T.SphereGeometry(1.15 * scale, 16, 12), '#c1a36c', 'moving-depth-probe', .025);
  probe.userData.smallPointTarget = true;
  probe.userData.modelInput = { kind: 'phase-track', track: depthTrack, label: '拖动探针；进度表示观察深度' };
  const curveProbe = solid(new T.SphereGeometry(.93 * scale, 16, 12), '#b58b54', 'moving-curve-read-point', .025);
  curveProbe.userData.smallPointTarget = true;
  curveProbe.userData.modelInput = { kind: 'phase-track', track: depthTrack, label: '拖动读点，比较原曲线不同深度' };

  // Fixed positions are both physical click targets and keyboard/SVG stops.
  // A filled, closed button is intentional: a torus hole would let a click
  // at its reported center fall through to the broad water-volume target.
  const stopGeometry = new T.CylinderGeometry(1.65 * scale, 1.65 * scale, .52 * scale, 20).rotateX(Math.PI / 2);
  const nodes = TEMPERATURE_STOPS.map(stop => {
    const mesh = select(solid(stopGeometry, '#d6c6a3', 'fixed-depth-stop', .025), stop.selection);
    mesh.position.set(...p(temperatureProfilePoint(stop.phase))); mesh.userData.smallPointTarget = true;
    return mesh;
  });
  const noteLabels = TEMPERATURE_NOTES.map((text, i) => {
    const label = role(b.label(text, p(L.currentLabel.at), L.currentLabel.width * scale, L.currentLabel.height * scale), 'fixed-current-observation-label');
    label.userData.temperatureNoteIndex = i; return label;
  });
  const comparisonLabel = role(b.label('固定表层参照', p(L.currentLabel.at), L.currentLabel.width * scale, L.currentLabel.height * scale), 'surface-reference-observation-label');
  const referenceClamps = [0, 1].map(() => solid(new T.BoxGeometry(.55 * scale, 2.8 * scale, .55 * scale), '#a57a45', 'surface-reference-clamp', .025));
  const nodeLabels = TEMPERATURE_STOPS.map((stop, index) => select(role(b.label(stop.label,
    p(L.nodeLabels[index]), (index === 1 ? 44 : 28) * scale, 10.2 * scale), 'depth-shortcut-label'), index));

  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  const phaseRail = solid(placedGeometry(new T.BoxGeometry(80, .28, .65), [54, -18, 70]), '#b9ad8f', 'observation-phase-rail', .035);
  phaseRail.userData.modelInput = { kind: 'phase-track', track, label: '连续观察从表层到约五千米的深度' };
  const tab = new T.Shape();
  [[-2.8, 0], [0, 2], [2.8, 0], [0, -2]].forEach(([x, y], index) =>
    index ? tab.lineTo(x * scale, y * scale) : tab.moveTo(x * scale, y * scale));
  tab.closePath();
  const tabGeometry = new T.ExtrudeGeometry(tab, { depth: .65 * scale, bevelEnabled: false }); tabGeometry.translate(0, 0, -.325 * scale);
  const handle = solid(tabGeometry, '#ddc797', 'observation-phase-handle', .045);
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动观察深度；不会改变水温曲线' };

  let state = evaluateTemperatureProfile(0), inspection = 'overview';
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const waterBuffer = water.geometry.attributes.position.array, waterColorBuffer = water.geometry.attributes.color.array;
  const motion: ModelMotion = {
    update(phase) {
      state = evaluateTemperatureProfile(phase);
      slice.position.set(...p([54, state.sliceY, 35.4]));
      probe.position.set(...p(state.probe)); curveProbe.position.set(...p(state.point));
      handle.position.set(...phaseTrackPoint(state.phase, track));
      const observation = evaluateTemperatureInspection(phase, inspection);
      noteLabels.forEach((label, index) => { label.visible = index === state.stageIndex && !observation.active; });
      comparisonLabel.visible = observation.active;
      referenceClamps.forEach((mesh, index) => { mesh.visible = observation.active; mesh.position.set(...p([index ? state.point[0] : observation.reference[0], state.point[1], 64])); });
      if (observation.active) {
        const reference: TemperaturePoint = [observation.reference[0], observation.reference[1], 64];
        const corner: TemperaturePoint = [observation.reference[0], state.point[1], 64], current: TemperaturePoint = [state.point[0], state.point[1], 64];
        // Broken fixed reference is distinct from the original solid curve.
        for (let i = 0; i < 12; i += 2) b.contour([0, 1].map(j => [reference[0], reference[1] + (corner[1] - reference[1]) * (i + j) / 12, 64] as TemperaturePoint).map(p), .44);
        b.contour([corner, current].map(p), .72); referenceClamps.forEach(mesh => b.outline(mesh, .4));
      }
      b.contour([state.point, state.probe].map(p), .46);
      b.contour([[17.5, state.sliceY, 59.5], [90.5, state.sliceY, 59.5]].map(p), .33);
      b.outline(probe, .45); b.outline(curveProbe, .32); b.outline(handle, .51);
      for (const node of nodes) if (node.userData.modelHovered) b.outline(node, .58);
    },
    inspect(target) { inspection = evaluateTemperatureInspection(0, target).inspection; },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      return { kind: 'temperature-depth-profile', state, source: TEMPERATURE_REFERENCE,
        inspection, observation: evaluateTemperatureInspection(state.phase, inspection),
        phase: state.phase, stage: state.stage, stageIndex: state.stageIndex, selection: state.selection,
        activeStop: state.activeStop, caption: state.caption, depthKm: state.depthKm, approxTemperatureC: state.approxTemperatureC,
        phaseMeaning: state.phaseMeaning, phaseIsTime: false, curveIsFixed: true,
        approximateReadGraph: true, preciseMeasuredDataset: false, extrapolatesBelowCurve: false,
        nodeStops: TEMPERATURE_STOPS,
        nodeWorld: nodes.map((mesh, selection) => ({ selection, phase: TEMPERATURE_STOPS[selection].phase,
          depthKm: TEMPERATURE_STOPS[selection].depthKm, point: meshWorld(mesh) })),
        nodeLabelWorld: nodeLabels.map((mesh, selection) => ({ selection, text: TEMPERATURE_STOPS[selection].label, point: meshWorld(mesh) })),
        probeWorld: meshWorld(probe), curveProbeWorld: meshWorld(curveProbe), sliceWorld: meshWorld(slice),
        curveWorld: TEMPERATURE_PROFILE_CURVE.map(point => world(p(point))),
        labelWorld: [{ text: state.note, point: meshWorld(noteLabels[state.stageIndex]),
          width: L.currentLabel.width * scale, height: L.currentLabel.height * scale }],
        handleWorld: meshWorld(handle), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        depthTrackWorld: { start: world(depthTrack.start), end: world(depthTrack.end) },
        waterBoundsWorld: { min: world(p([18, 4, 12])), max: world(p([90, 64, 54])) },
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount
          && b.meshes.every((mesh, index) => mesh.geometry.attributes.position.array === buffers[index]),
        fixedTemperatureProfile: water.geometry.attributes.position.array === waterBuffer && water.geometry.attributes.color.array === waterColorBuffer,
        visibleCurrentLabelCount: noteLabels.filter(label => label.visible).length + (comparisonLabel.visible ? 1 : 0),
        axisLabelWorld: tickLabels.map(mesh => ({ text: mesh.userData.text, point: meshWorld(mesh) })),
        meshRoles: b.meshes.map(mesh => ({ role: mesh.userData.temperatureRole, selection: mesh.userData.temperatureSelection,
          point: new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()).toArray() })),
        directInteraction: 'depth-stops-and-continuous-probe-and-phase-track', originalPagePreserved: true, elevatedAbovePage: rise,
        fixedStructureCount: [water, base, depthRail].length,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
