import cloud from './assets/typhoon/cloud.json';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { evaluateTyphoon, typhoonArrowMeshData, typhoonDiagnostics, typhoonPrismMesh,
  TYPHOON_BASE_OUTLINE, TYPHOON_EYE_OUTLINE, TYPHOON_LABELS, TYPHOON_LAYOUT as L, TYPHOON_STOPS,
  type TyphoonMesh, type TyphoonPoint } from './textbook-typhoon-model';

/** One raised, front-cut paper typhoon. Its eye is the actual open space inside
 * the cloud annulus; map inflow and section arrows inhabit the same XYZ field. */
export function buildTyphoonWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 32 * scale;
  // Keep the ocean tray at full depth. Cloud, arrows and their observation
  // points share the same shallow vertical section above the water surface.
  const p = ([x, y, z]: TyphoonPoint): Vec3 => [x * scale, (y - .30 * Math.max(0, y - 2)) * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, value: string) => { mesh.userData.typhoonRole = value; return mesh; };
  const select = (mesh: any, selection: number) => {
    mesh.userData.modelInput = { kind: 'select', selection, label: `观察${TYPHOON_STOPS[selection].label}` };
    mesh.userData.typhoonSelection = selection; return mesh;
  };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .07) => {
    const key = `${color}:${hatch}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#707c70', hatch, shade: .085, spacing: 2.7, seed: 337 + materials.size });
      material.side = T.DoubleSide; materials.set(key, material);
    }
    return materials.get(key);
  };
  const geometryFrom = (data: TyphoonMesh, dynamic = false) => {
    const positions: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) positions.push(...p(data.positions.slice(i, i + 3) as unknown as TyphoonPoint));
    const geometry = new T.BufferGeometry(), attribute = new T.Float32BufferAttribute(positions, 3);
    if (dynamic) attribute.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position', attribute); geometry.setIndex(data.indices); geometry.computeVertexNormals(); return geometry;
  };
  const solid = (data: TyphoonMesh, color: string, name: string, selection?: number, hatch = .07, dynamic = false) => {
    const mesh = role(b.mesh(geometryFrom(data, dynamic), color, false), name); mesh.material = paper(color, hatch);
    return selection === undefined ? mesh : select(mesh, selection);
  };
  // The ocean insert sits in a stepped brass tray on a dark enamel plinth.
  const tray = (factor: number, low: number, high: number, color: string, substance: 'enamel' | 'brass') => {
    const outline = TYPHOON_BASE_OUTLINE.map(([x, z]): [number, number] =>
      [50 + (x - 50) * factor, 42 + (z - 42) * factor]);
    return b.mesh(geometryFrom(typhoonPrismMesh(outline, low, high)), color, false, true, substance);
  };
  tray(1.044, -3.1, -2.5, '#a88b50', 'brass');
  tray(1.037, -2.5, -.7, '#364e48', 'enamel');
  tray(1.025, -.7, .7, '#b3925a', 'brass');
  const base = solid(typhoonPrismMesh(TYPHOON_BASE_OUTLINE, 0, 2), '#a9c7c8', 'sea-base', 0, .055);
  // Two closed pieces share the same profile at y=35; this makes the cloud top
  // a real selectable part without a second detached top-view diagram.
  const cloudBody = (data: TyphoonMesh & {tones: number[]}, color: string, name: string, selection: number) => {
    const geometry = geometryFrom(data);
    geometry.setAttribute('color', new T.BufferAttribute(new Uint8Array(data.tones), 3, true));
    const mesh = b.mesh(geometry, color, false, true, 'air');
    mesh.material.vertexColors = true;
    mesh.material.roughness = .88;
    return select(role(mesh, name), selection);
  };
  const wall = cloudBody(cloud.parts.wall, '#e2e7e8', 'cloud-eyewall', 1);
  const canopy = cloudBody(cloud.parts.crown, '#f8f4e7', 'upper-cloud-canopy', 2);
  const eye = solid(typhoonPrismMesh(TYPHOON_EYE_OUTLINE, 2.05, 2.32), '#d8cead', 'eye-footprint', 3, .035);
  base.userData.northernHemisphere = true; wall.userData.trueEyeOpening = true; canopy.userData.trueEyeOpening = true;
  eye.userData.cloudFreeObservation = true;

  for (const band of [cloud.parts.band0, cloud.parts.band1, cloud.parts.band2]) {
    cloudBody(band, '#cedae0', 'spiral-rainband', 0);
  }
  const line = (points: number[][]) => points.map(([x, y, z]) => p([x, y, z]));
  for (const rim of [...cloud.edges.wallrim, ...cloud.edges.crownrim]) b.stroke(line(rim), .24);
  for (const face of [...cloud.edges.wall, ...cloud.edges.crown]) b.stroke(line(face), .38);
  b.stroke([...TYPHOON_BASE_OUTLINE, TYPHOON_BASE_OUTLINE[0]].map(([x, z]) => p([x, 2.03, z])), .38);

  const initial = evaluateTyphoon(1), arrows = initial.arrows.map(arrow => {
    const data = typhoonArrowMeshData(arrow), mesh = solid(data, arrow.color, arrow.stage, arrow.selection, .035, true);
    mesh.userData.typhoonArrowId = arrow.id; mesh.userData.typhoonTipVertices = data.tipVertices;
    return { id: arrow.id, mesh, outline: data.outline };
  });
  const labels = TYPHOON_LABELS.map(label => ({ definition: label,
    mesh: select(role(b.label(label.text, p(label.at), label.width * scale, label.height * scale), 'process-label'), label.selection) }));
  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  // A bent pair of feet carries the lower slide back to the front of the tray.
  for (const x of [14, 86]) {
    const profile = new T.Shape();
    const section = [[77, -1.4], [80.4, -1.4], [86.3, -8.9], [89, -8.9],
      [89, -10.5], [85.3, -10.5], [79.5, -3.1], [77, -3.1]];
    section.forEach(([z, y], i) => i ? profile.lineTo(-z * scale, y * scale) : profile.moveTo(-z * scale, y * scale));
    profile.closePath();
    const foot = new T.ExtrudeGeometry(profile, { depth: 1.6 * scale, bevelEnabled: true,
      bevelThickness: .12 * scale, bevelSize: .12 * scale, bevelSegments: 1 });
    foot.rotateY(Math.PI / 2);
    foot.translate((x - .8) * scale, 0, back);
    role(b.mesh(foot, '#a88b50', false), 'rail-bracket');
  }
  const rail = role(b.mesh(geometryFrom(typhoonPrismMesh([[13, 87.35], [87, 87.35], [87, 88.65], [13, 88.65]], -10.36, -9.64)), '#a88b50', false), 'phase-rail');
  rail.userData.modelInput = { kind: 'phase-track', track, label: '沿铜轨拖动，逐步观察同一台风的立体结构' };
  const indexPlate = chamferedPlateGeometry(p([11.4,-15.2,86.2]),p([88.6,-9.9,87.3]),.32*scale);
  const scaleFace = role(b.mesh(indexPlate, '#d9d0b5', false, true, 'ivory'), 'stage-scale');
  scaleFace.userData.modelInput = rail.userData.modelInput;
  const ticks = Array.from({length:17},(_,i) => {
    const x=13+74*i/16;
    return chamferedPlateGeometry(p([x-.09,-14.65,87.35]),p([x+.09,i%4===0?-11.6:-13.35,87.43]),.02*scale);
  });
  const graduations = b.mesh(mergeInstrumentGeometry(ticks),'#665c48',false,true,'steel');
  graduations.userData.modelInput=rail.userData.modelInput;
  const tab = new T.Shape();
  [[-3.4, 2.1], [3.4, 2.1], [3.4, -.8], [0, -3.1], [-3.4, -.8]].forEach(([x, y], i) =>
    i ? tab.lineTo(x * scale, y * scale) : tab.moveTo(x * scale, y * scale));
  tab.closePath();
  const tabGeometry = new T.ExtrudeGeometry(tab, { depth: .7 * scale, bevelEnabled: true, bevelSize: .2 * scale, bevelThickness: .18 * scale, bevelSegments: 2 }); tabGeometry.translate(0, 0, -.35 * scale);
  const pull=turnedShaftGeometry([0,0,.29*scale],[0,0,3.10*scale],
    [[1.34*scale,0],[1.52*scale,.12],[.72*scale,.32],[.74*scale,.50],[1.92*scale,.68],[2.02*scale,.86],[1.58*scale,1]]);
  const handle = role(b.mesh(mergeInstrumentGeometry([tabGeometry,pull]), '#b3925a', false,true,'brass'), 'phase-handle');
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动铜游标，暂停回看低层、眼墙、高空和台风眼' };
  const fixedMeshCount = b.meshes.length;
  // The book mounts additional fittings after the model constructor returns.
  const buffers = b.meshes.map(mesh => ({ mesh, positions: mesh.geometry.attributes.position.array }));
  let state = evaluateTyphoon(0), previous = -1;
  const motion: ModelMotion = {
    update(phase) {
      const next = evaluateTyphoon(phase);
      if (next.phase !== previous) {
        state = next; previous = state.phase;
        for (const [index, entry] of arrows.entries()) {
          const arrow = state.arrows[index], data = typhoonArrowMeshData(arrow), attribute = entry.mesh.geometry.attributes.position;
          for (let i = 0; i < data.positions.length; i += 3) {
            const point = p(data.positions.slice(i, i + 3) as unknown as TyphoonPoint); attribute.setXYZ(i / 3, ...point);
          }
          attribute.needsUpdate = true; entry.mesh.geometry.computeVertexNormals();
          entry.mesh.visible = arrow.reveal > .001; entry.mesh.userData.typhoonReveal = arrow.reveal;
          entry.outline = data.outline;
        }
        handle.position.set(...phaseTrackPoint(state.phase, track));
        labels.forEach(({ definition, mesh }) => { mesh.visible = definition.selection === state.selection; });
      }
      for (const entry of arrows) if (entry.mesh.visible) b.contour(entry.outline.map(p),
        entry.mesh.userData.modelHovered ? .8 : entry.mesh.userData.typhoonSelection === state.selection ? .6 : .26);
      // A local ink edge identifies the selected physical structure without
      // recolouring shared paper materials or adding another floating panel.
      const selectedCloud = state.selection === 1 ? wall : state.selection === 2 ? canopy : null;
      if (selectedCloud) {
        const faces = state.selection === 1 ? cloud.edges.wall : cloud.edges.crown;
        for (const face of faces) b.contour(line(face), .86);
      }
      if (state.selection === 3) b.contour([...TYPHOON_EYE_OUTLINE, TYPHOON_EYE_OUTLINE[0]].map(([x, z]) => p([x, 2.4, z])), .85);
      b.contour([track.start, track.end], .28); b.outline(handle, handle.userData.modelHovered ? .63 : .38);
      for (const stop of TYPHOON_STOPS) {
        const point = phaseTrackPoint(stop.phase, track);
        b.contour([[point[0], point[1] - .75 * scale, point[2]], [point[0], point[1] + .75 * scale, point[2]]], .32);
      }
    },
    focusBounds: () => ({ min: p(L.bounds.min), max: p(L.bounds.max) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      return { kind: 'typhoon-structure-process', ...typhoonDiagnostics(state), originalPagePreserved: true,
        elevatedAbovePage: rise, commonCoordinateField: true, frontCutaway: true, trueEyeOpening: true,
        cloudBodiesAreStationary: true, freeRunningRotation: false, cyclic: false, structuresRetained: true,
        nodeStops: TYPHOON_STOPS, nodeWorld: state.targets.map(target => ({ ...target, point: world(p(target.point)) })),
        arrowWorld: state.arrows.map((arrow, i) => ({ id: arrow.id, selection: arrow.selection, reveal: arrow.reveal,
          start: world(p(arrow.path[0])), tip: world(p(arrow.tip)), mesh: arrows[i].mesh.uuid,
          actualTip: (() => { const a = arrows[i].mesh.geometry.attributes.position, vertices = arrows[i].mesh.userData.typhoonTipVertices;
            const point = vertices.reduce((v: any, index: number) => v.add(b.v([a.getX(index), a.getY(index), a.getZ(index)])), b.v([0, 0, 0])).multiplyScalar(.5);
            return world(point.toArray() as Vec3); })() })),
        meshTargetsWorld: b.meshes.filter(mesh => mesh.visible && mesh.userData.modelInput).map(mesh => {
          mesh.geometry.computeBoundingBox();
          const point = mesh.geometry.boundingBox.getCenter(b.v([0, 0, 0])).applyMatrix4(mesh.matrixWorld);
          return { role: mesh.userData.typhoonRole, selection: mesh.userData.modelInput.selection, input: mesh.userData.modelInput.kind,
            point: point.toArray(), mesh: mesh.uuid };
        }),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(), phaseTrack: track,
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        directInteraction: 'actual-cloud-and-flow-select-and-phase-track', fixedMeshCount,
        geometryBuffersReused: buffers.every(({ mesh, positions }, i) => b.meshes[i] === mesh && mesh.geometry.attributes.position.array === positions),
        fixedFocusBounds: true, measuredWindSpeed: false, forecast: false };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
