import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { COLD_WAVE_LABELS, COLD_WAVE_LAYOUT as L, COLD_WAVE_PARTS, COLD_WAVE_STOPS,
  coldAirDepthAt, evaluateColdWave, type ColdWaveMesh, type ColdWavePoint } from './textbook-cold-wave-model';

/** The advancing cutaway and the fixed observation station share one XYZ
 * field. Cloth, plants and warmth respond only after that front reaches them.
 * There is no autonomous motion and seeking never replaces the landscape. */
export function buildColdWaveWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 33 * scale;
  const p = ([x, y, z]: ColdWavePoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, name: string) => { mesh.userData.coldWaveRole = name; return mesh; };
  const select = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, label: `观察${COLD_WAVE_STOPS[selection].label}` };
    return mesh;
  };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .045) => {
    const key = `${color}:${hatch}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#6d7c71', hatch, shade: .075, spacing: 2.9, seed: 621 + materials.size });
      material.side = T.DoubleSide; materials.set(key, material);
    }
    return materials.get(key);
  };
  const geometryFrom = (data: ColdWaveMesh, dynamic = false) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as unknown as ColdWavePoint));
    const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(positions, 3);
    if (dynamic) position.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position', position); geometry.setIndex(data.indices);
    geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox(); return geometry;
  };
  const solid = (data: ColdWaveMesh, color: string, name: string, selection: number, dynamic = false, hatch = .045) => {
    const mesh = select(role(b.mesh(geometryFrom(data, dynamic), color, false), name), selection);
    mesh.material = paper(color, hatch); return mesh;
  };
  const fixedParts = COLD_WAVE_PARTS.map(part => ({ definition: part,
    mesh: solid(part.mesh, part.color, part.id, part.id.startsWith('gauge') ? 3 : part.id === 'pole' ? 2 : 0) }));
  const initial = evaluateColdWave(0);
  const wedge = solid(initial.geometry.wedge, '#a7c0cd', 'cold-air-wedge', 1, true, .015);
  // A single-sided translucent volume exposes the common terrain, rather
  // than painting the air onto a second diagram plane.
  wedge.material.side = T.FrontSide; wedge.material.transparent = true;
  wedge.material.opacity = .25; wedge.material.depthWrite = false; wedge.renderOrder = 2;
  const flag = solid(initial.geometry.flag, '#bc8a6a', 'wind-flag', 2, true, .035);
  const plants = initial.plants.map(plant => solid(plant.mesh, '#7f9575', `plant-${plant.id}`, 2, true));
  const gauge = solid(initial.geometry.gaugeFill, initial.observation.indicatorColor, 'relative-warmth', 3, true, .015);
  const flows = initial.geometry.flows.map((mesh, index) => solid(mesh, '#739aa4', `flow-${index}`, 1, true, .015));
  const labels = COLD_WAVE_LABELS.map(label => select(role(
    b.label(label.text, p(label.at), label.width * scale, label.height * scale), 'process-label'), label.selection));
  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  const handle = role(b.label('前缘', [0, 0, 0], 17 * scale, 7 * scale), 'front-pull-tab');
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动冷空气前缘，比较同一地点的变化' };
  const fixedMeshCount = b.meshes.length;
  const buffers = b.meshes.map(mesh => ({ position: mesh.geometry.attributes.position.array,
    normal: mesh.geometry.attributes.normal?.array, index: mesh.geometry.index?.array }));
  const write = (mesh: any, data: ColdWaveMesh) => {
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < data.positions.length; i += 3) position.setXYZ(i / 3, ...p(data.positions.slice(i, i + 3) as unknown as ColdWavePoint));
    position.needsUpdate = true; mesh.geometry.computeVertexNormals();
    // A stale bound makes the moving front miss Raycaster despite looking
    // correct. Refresh both bounds in place whenever the phase is changed.
    mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
  };
  let state = initial, previous = -1;
  const motion: ModelMotion = {
    update(input) {
      const phase = Number.isFinite(input) ? Math.max(0, Math.min(1, input)) : 0;
      if (phase !== previous) {
        state = evaluateColdWave(phase); previous = phase;
        write(wedge, state.geometry.wedge); write(flag, state.geometry.flag); write(gauge, state.geometry.gaugeFill);
        gauge.material.color.set(state.observation.indicatorColor);
        state.plants.forEach((plant, i) => { write(plants[i], plant.mesh); plants[i].userData.coldWaveWind = plant.wind; });
        state.geometry.flows.forEach((data, i) => write(flows[i], data));
        handle.position.set(...phaseTrackPoint(state.phase, track));
        flag.userData.coldWaveWind = state.observation.wind;
        wedge.userData.coldWaveFront = state.frontX;
      }
      // The Popout surface pass restores depthWrite; set this every frame so
      // the transparent air can never erase the station behind its surface.
      wedge.material.depthWrite = false;
      const profile = Array.from({ length: 21 }, (_, i): Vec3 => {
        const x = L.sourceX + (state.frontX - L.sourceX) * i / 20;
        return p([x, L.ground + .12 + coldAirDepthAt(x, state.frontX), L.nearZ]);
      });
      b.contour(profile, wedge.userData.modelHovered ? .58 : .34);
      b.contour([p([L.sourceX, L.ground + .12, L.nearZ]), p(state.front)], .24);
      b.contour([p(state.front), [handle.position.x, handle.position.y - 3.5 * scale, handle.position.z]], .25);
      b.contour([track.start, track.end], .22);
      for (const stop of COLD_WAVE_STOPS) {
        const at = phaseTrackPoint(stop.phase, track);
        b.contour([[at[0], at[1] - .6 * scale, at[2]], [at[0], at[1] + .6 * scale, at[2]]], .25);
      }
      for (const { definition, mesh } of fixedParts) if (mesh.userData.modelHovered || ['land-base', 'roof', 'gauge-case'].includes(definition.id))
        b.outline(mesh, mesh.userData.modelHovered ? .56 : .26);
      for (const plant of state.plants) b.contour(plant.points.map(p), .28);
      // Cloth contours use current vertices; cached EdgesGeometry would leave
      // the old drooping silhouette behind after the first drag.
      for (const side of [0, 1]) {
        const edge = Array.from({ length: state.geometry.flag.positions.length / 12 }, (_, i) => {
          const index = (i * 4 + side) * 3;
          return p(state.geometry.flag.positions.slice(index, index + 3) as unknown as ColdWavePoint);
        });
        b.contour(edge, flag.userData.modelHovered ? .5 : .25);
      }
      b.outline(handle, handle.userData.modelHovered ? .55 : .3);
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      return { ...state, kind: 'cold-wave', originalPagePreserved: true, elevatedAbovePage: rise,
        commonCoordinateField: true, fixedFocusBounds: true, fixedLandscape: true,
        directInteraction: 'actual-front-cloth-plants-and-relative-warmth', nodeStops: COLD_WAVE_STOPS,
        frontWorld: world(p(state.front)), observationWorld: world(p(state.observation.point)),
        flagTipWorld: world(p(state.flag.tip)), gaugeTopWorld: world(p([L.gauge.x, state.observation.fillTop, 68.52])),
        plantWorld: state.plants.map(plant => ({ id: plant.id, base: world(p(plant.base)), top: world(p(plant.top)), wind: plant.wind })),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), phaseTrack: track,
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        meshTargetsWorld: b.meshes.filter(mesh => mesh.visible && mesh.userData.modelInput).map(mesh => {
          mesh.geometry.computeBoundingBox();
          const center = mesh.geometry.boundingBox.getCenter(b.v([0, 0, 0])).applyMatrix4(mesh.matrixWorld);
          return { role: mesh.userData.coldWaveRole, selection: mesh.userData.modelInput.selection,
            input: mesh.userData.modelInput.kind, point: center.toArray(), mesh: mesh.uuid };
        }),
        labelWorld: labels.map((mesh, i) => ({ text: COLD_WAVE_LABELS[i].text,
          point: mesh.getWorldPosition(new T.Vector3()).toArray() })),
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) =>
          mesh.geometry.attributes.position.array === buffers[i].position && mesh.geometry.attributes.normal?.array === buffers[i].normal && mesh.geometry.index?.array === buffers[i].index),
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
