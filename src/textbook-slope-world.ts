import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { SLOPE_BOUNDARY_INDICES, SLOPE_CONSTRAINTS, SLOPE_CONTOURS, SLOPE_GRID, SLOPE_LAYOUT,
  SLOPE_REFERENCE, SLOPE_SPOTS, SLOPE_STOPS, evaluateSlopeRelief, slopeDisplayY,
  slopeReliefMesh, type SlopePoint } from './textbook-slope-model';

/** One closed paper terrain is unfolded from one fixed heightfield. The phase
 * changes display height only; it never erodes or generates the landform. */
export function buildSlopeWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 78 * scale, rise = 42 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, name: string) => { mesh.userData.slopeRole = name; return mesh; };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .065) => {
    const key = `${color}:${hatch}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#74634b', spacing: 2.9, hatch, shade: .1, seed: 422 + materials.size });
      material.side = T.DoubleSide; materials.set(key, material);
    }
    return materials.get(key);
  };
  const solid = (geometry: any, color: string, name: string, hatch = .065) => {
    const mesh = role(b.mesh(geometry, color, false), name); mesh.material = paper(color, hatch); return mesh;
  };
  const select = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'select', selection, label }; return mesh;
  };
  const raw = slopeReliefMesh(0), positions: number[] = [];
  for (let i = 0; i < raw.positions.length; i += 3) positions.push(...p(raw.positions.slice(i, i + 3)));
  const terrainGeometry = new T.BufferGeometry();
  terrainGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrainGeometry.setIndex(raw.indices); terrainGeometry.computeVertexNormals();
  const terrain = select(solid(terrainGeometry, '#cbb98f', 'closed-contour-constrained-relief', .12), 1, '抬升同一地形，查看中央沟谷与右侧支沟');
  terrain.userData.surveyedDEM = false;
  const positionAttribute = terrainGeometry.attributes.position;
  const topVertexCount = raw.topVertexCount;

  const markerGeometry = new T.CylinderGeometry(1.15 * scale, 1.15 * scale, .6 * scale, 16);
  const markers = SLOPE_SPOTS.map(spot => {
    const mesh = select(solid(markerGeometry, '#9b6947', 'spot-height-marker', .04), 2, `${spot.name}，海拔${spot.elevationM.toFixed(1)}米；比较甲乙高差`);
    mesh.userData.slopePointId = spot.id; mesh.userData.smallPointTarget = true; return mesh;
  });
  const spotLabels = SLOPE_SPOTS.map(spot => {
    const label = role(b.label(`${spot.name} ${spot.elevationM.toFixed(1)}m`, p([spot.x, 7.8, spot.z]), spot.labelWidth * scale, 9.6 * scale), 'spot-height-label');
    label.userData.slopePointId = spot.id;
    return select(label, 2, `${spot.name}，比较甲乙两点高差`);
  });

  // A separate short ruler magnifies only the 6.4 m difference. Its base is
  // Jia's elevation, not sea level; it is not a second relief or slope angle.
  const c = SLOPE_LAYOUT.comparison;
  const comparisonMeshes: any[] = [];
  const rulerGeometry = new T.BoxGeometry(.28 * scale, (c.yiY - c.jiaY) * scale, .65 * scale);
  rulerGeometry.translate(...p([c.rulerX, (c.jiaY + c.yiY) / 2, c.z]));
  const ruler = select(solid(rulerGeometry, '#aa8051', 'relative-height-ruler', .035), 2, '乙比甲高6.4米；局部高差放大');
  comparisonMeshes.push(ruler);
  const comparisonDots = [['甲', c.jiaY], ['乙', c.yiY]].map(([name, y]) => {
    const height = Number(y), dot = solid(new T.SphereGeometry(.62 * scale, 12, 8), '#9b6947', 'comparison-endpoint', .035);
    dot.position.set(...p([c.x, height, c.z]));
    dot.userData.slopePointId = name === '甲' ? 'jia' : 'yi';
    select(dot, 2, `${name}的高差对照位置`); dot.userData.smallPointTarget = true;
    const label = role(b.label(String(name), p([c.x - 5.5, height + .8, c.z]), 10 * scale, 9.6 * scale), 'comparison-label');
    comparisonMeshes.push(dot, label); return dot;
  });
  const differenceLabel = role(b.label('6.4m', p(c.label), 30 * scale, 9.6 * scale), 'difference-label');
  const comparisonTitle = role(b.label('高差放大', p([123, 0, 39]), 45 * scale, 9.6 * scale), 'comparison-title');
  comparisonMeshes.push(differenceLabel, comparisonTitle);

  const track: PhaseTrack = { start: p(SLOPE_LAYOUT.track.start), end: p(SLOPE_LAYOUT.track.end) };
  const railGeometry = new T.BoxGeometry(72 * scale, .28 * scale, .7 * scale);
  railGeometry.translate(...p([50, 1, 91]));
  const rail = solid(railGeometry, '#b4a17e', 'phase-rail', .035);
  rail.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，把同一等高线地形从平面抬起' };
  const shape = new T.Shape();
  [[-2.7, 0], [0, 1.9], [2.7, 0], [0, -1.9]].forEach(([x, y], index) =>
    index ? shape.lineTo(x * scale, y * scale) : shape.moveTo(x * scale, y * scale));
  shape.closePath();
  const handleGeometry = new T.ExtrudeGeometry(shape, { depth: .7 * scale, bevelEnabled: false });
  handleGeometry.translate(0, 0, -.35 * scale);
  const handle = solid(handleGeometry, '#dfcaa0', 'phase-handle', .035);
  handle.userData.modelInput = { kind: 'phase-track', track, label: '连续拖动平面到立体的观察进度；不表示地形演化' };
  handle.userData.smallPointTarget = true;
  const labels = SLOPE_STOPS.map((stop, index) => select(role(b.label(stop.label, p(SLOPE_LAYOUT.labels[index]), 26 * scale, 9.6 * scale), 'process-label'), index, stop.label));

  let state = evaluateSlopeRelief(0);
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const indices = b.meshes.map(mesh => mesh.geometry.index?.array);
  const motion: ModelMotion = {
    update(phase, _selection, _dt, _reduced) {
      state = evaluateSlopeRelief(phase);
      for (let i = 0; i < topVertexCount; i++) positionAttribute.setY(i, slopeDisplayY(SLOPE_GRID[i].elevationM, state.phase) * scale);
      positionAttribute.needsUpdate = true;
      terrainGeometry.computeVertexNormals(); terrainGeometry.computeBoundingSphere();
      state.points.forEach((spot, index) => {
        markers[index].position.set(...p([spot.x, spot.position[1] + .3, spot.z]));
        spotLabels[index].position.set(...p([spot.x, spot.position[1] + 5.8, spot.z]));
        b.outline(markers[index], .44);
      });
      for (const contourLine of SLOPE_CONTOURS) for (const path of contourLine.paths) {
        b.contour(path.map(([x, elevationM, z]) => p([x, slopeDisplayY(elevationM, state.phase) + .1, z])), contourLine.sourceLabelRead ? .46 : .22);
      }
      const boundary = SLOPE_BOUNDARY_INDICES.map(index => {
        const point = SLOPE_GRID[index]; return p([point.x, slopeDisplayY(point.elevationM, state.phase) + .07, point.z]);
      });
      b.contour([...boundary, boundary[0]], .55);
      for (const index of [0, Math.floor(SLOPE_BOUNDARY_INDICES.length / 4), Math.floor(SLOPE_BOUNDARY_INDICES.length / 2), Math.floor(SLOPE_BOUNDARY_INDICES.length * .75)]) {
        const point = SLOPE_GRID[SLOPE_BOUNDARY_INDICES[index]];
        b.contour([p([point.x, 0, point.z]), p([point.x, slopeDisplayY(point.elevationM, state.phase), point.z])], .33);
      }
      comparisonMeshes.forEach(mesh => { mesh.visible = state.comparison.visible; });
      if (state.comparison.visible) {
        for (const y of [c.jiaY, c.yiY]) b.contour([[c.x, y, c.z], [c.rulerX + 2, y, c.z]].map(p), .5);
        b.outline(ruler, .4);
      }
      handle.position.set(...phaseTrackPoint(state.phase, track)); b.outline(handle, .5);
      labels.forEach((label, index) => { label.userData.slopeActive = index === state.stageIndex; });
    },
    focusBounds: () => ({ min: p([-6, -14, -4]), max: p([155, 45, 104]) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'textbook-contour-relief', source: SLOPE_REFERENCE, state,
        phase: state.phase, stage: state.stage, stageIndex: state.stageIndex, selection: state.selection,
        activeStop: state.activeStop, caption: state.caption, phaseMeaning: state.phaseMeaning,
        landformEvolutionSimulated: false, surveyedDEM: false, originalPagePreserved: true,
        sourceConstraints: SLOPE_CONSTRAINTS.map(constraint => ({ id: constraint.id, kind: constraint.kind, points: constraint.points })),
        sourceSpotHeightsM: SLOPE_REFERENCE.checkedElevationsM,
        relativeHeightM: 6.4, higherSpotId: 'yi', sourceContourIntervalM: null,
        contoursFromSameTriangles: true, auxiliaryContourIntervalM: 10, verticalExaggeration: true,
        nodeStops: SLOPE_STOPS, nodeWorld: labels.map((mesh, selection) => ({ selection, point: meshWorld(mesh) })),
        handleWorld: meshWorld(handle), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        spotWorld: markers.map((mesh, index) => ({ id: state.points[index].id, elevationM: state.points[index].elevationM,
          point: meshWorld(mesh), surfacePoint: world(p(state.points[index].position)) })),
        comparisonWorld: { visible: state.comparison.visible, verticallyMagnified: true, sameReference: 'jia-879.0m',
          jia: meshWorld(comparisonDots[0]), yi: meshWorld(comparisonDots[1]), differenceM: 6.4 },
        terrainWorld: { origin: meshWorld(terrain), topVertexCount, closed: true,
          fixedHeightField: true, spotVertexWorld: SLOPE_SPOTS.map(spot => {
            const index = SLOPE_GRID.findIndex(point => point.x === spot.x && point.z === spot.z);
            const point: Vec3 = [positionAttribute.getX(index), positionAttribute.getY(index), positionAttribute.getZ(index)];
            return { id: spot.id, index, point: world(point) };
          }) },
        meshRoles: b.meshes.map(mesh => ({ role: mesh.userData.slopeRole, pointId: mesh.userData.slopePointId, point: meshWorld(mesh), visible: mesh.visible })),
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, index) =>
          mesh.geometry.attributes.position.array === buffers[index] && mesh.geometry.index?.array === indices[index]),
        directInteraction: 'spot-height-click-and-phase-track', elevatedAbovePage: rise,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
