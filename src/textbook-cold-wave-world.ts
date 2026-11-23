import type { MeshStandardMaterial } from 'three';
import { mountFieldInstrument } from './textbook-field-instruments';
import { applyEarthScan } from './textbook-earth-scan';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { COLD_WAVE_LAYOUT as L, COLD_WAVE_STOPS,
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
  const geometryFrom = (data: ColdWaveMesh, dynamic = false) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as unknown as ColdWavePoint));
    const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(positions, 3);
    if (dynamic) position.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position', position); geometry.setIndex(data.indices);
    geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox(); return geometry;
  };
  const solid = (data: ColdWaveMesh, color: string, name: string, selection: number, finish: SolidMaterialRole) => {
    const mesh = select(role(b.mesh(geometryFrom(data, true), color, false, false, finish), name), selection);
    mesh.material.side = T.DoubleSide;
    return mesh;
  };
  const fixed = mountFieldInstrument(b, 'cold-wave', scale, [0,0,back]);
  for (const [group, scan, span] of [['ground','turf',10], ['cut','loam',10], ['fields','loam',10]] as const) {
    for (const mesh of fixed.get(group)!) if (!(mesh.material as MeshStandardMaterial).userData.earthScan) applyEarthScan(mesh.material, scan, span*scale);
  }
  for (const [group, name, selection] of [['ground','land-base',0],['fields','field-bed',0],['screen','house',0],
    ['mast','pole',2],['thermometer','gauge-case',3]] as const) {
    for (const mesh of fixed.get(group)!) select(role(mesh, name),selection);
  }
  for (let i=0; i<COLD_WAVE_STOPS.length; i++) for (const mesh of fixed.get('key'+i)!) select(role(mesh,'stage-key'),i);
  const initial = evaluateColdWave(0);
  const wedge = solid(initial.geometry.wedge, '#659ba9', 'cold-air-wedge', 1, 'air');
  // A single-sided translucent volume exposes the common terrain, rather
  // than painting the air onto a second diagram plane.
  wedge.material.side = T.FrontSide; wedge.material.transparent = true;
  wedge.material.opacity = .25; wedge.material.depthWrite = false; wedge.renderOrder = 2;
  const flag = solid(initial.geometry.flag, '#bc8a6a', 'wind-flag', 2, 'enamel');
  const plants = initial.plants.map(plant => solid(plant.mesh, '#7f9575', `plant-${plant.id}`, 2, 'plant'));
  const gauge = solid(initial.geometry.gaugeFill, initial.observation.indicatorColor, 'relative-warmth', 3, 'enamel');
  const flows = initial.geometry.flows.map((mesh, index) => solid(mesh, '#739aa4', `flow-${index}`, 1, 'enamel'));
  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  const carriage = fixed.get('cursor')!;
  const handle = carriage.find(mesh=>mesh.userData.blenderColor === '#467c89')!;
  for (const mesh of carriage) {
    mesh.geometry.translate(-track.start[0],-track.start[1],-track.start[2]);
    mesh.userData.modelInput = { kind: 'phase-track', track, label: '推移冷锋游标，观察同一测站' };
    role(mesh,mesh === handle ? 'front-pull-tab' : 'cursor');
    mesh.userData.smallPointTarget = mesh === handle;
  }
  for (const mesh of b.meshes) mesh.geometry.computeBoundingBox();
  const markWorld=(x:number,h:number,z:number):Vec3=>b.v(p([x,h,z])).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
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
        for (const mesh of carriage) mesh.position.set(...phaseTrackPoint(state.phase, track));
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
      if (handle.userData.modelHovered) b.outline(handle,.46);
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
        labelWorld: [
          {text:'冷',point:markWorld(65.36,7.6,68.51)},{text:'暖',point:markWorld(65.36,21.8,68.51)},
          ...COLD_WAVE_STOPS.map((stop,i)=>({text:stop.label,point:markWorld(14.3+23.9*i,1.02,77.98)})),
        ],
        fixedMeshCount, geometryBuffersReused: buffers.every((buffer, i) =>
          b.meshes[i]?.geometry.attributes.position.array === buffer.position &&
          b.meshes[i]?.geometry.attributes.normal?.array === buffer.normal &&
          b.meshes[i]?.geometry.index?.array === buffer.index),
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
