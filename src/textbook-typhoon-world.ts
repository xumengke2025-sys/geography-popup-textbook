import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { evaluateTyphoon, typhoonArrowMeshData, typhoonCloudMesh, typhoonDiagnostics, typhoonPolar, typhoonPrismMesh,
  TYPHOON_BASE_OUTLINE, TYPHOON_EYE_OUTLINE, TYPHOON_LABELS, TYPHOON_LAYOUT as L, TYPHOON_STOPS,
  TYPHOON_WALL_PROFILE, type TyphoonMesh, type TyphoonPoint } from './textbook-typhoon-model';

/** One raised, front-cut paper typhoon. Its eye is the actual open space inside
 * the cloud annulus; map inflow and section arrows inhabit the same XYZ field. */
export function buildTyphoonWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 32 * scale;
  const p = ([x, y, z]: TyphoonPoint): Vec3 => [x * scale, y * scale, back + z * scale];
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
  // The cloud remains one continuous annular volume. Broad, unequal lobes
  // soften the schematic funnel into a cloud wall without filling the eye,
  // scattering cloud balls, or moving the scientific flow paths.
  const cloudRadius = (radius: number, y: number, angle: number, inner: boolean) => {
    const t = Math.max(0, Math.min(1, (y - 4) / 44));
    const shoulder = Math.sin(Math.PI * t) * .75 + .25;
    const folds = inner ? .25 * Math.cos(angle * 10 + t * 2)
      : shoulder * (1.35 * Math.cos(angle * 9 + t * 1.1) + .65 * Math.sin(angle * 15 - t * 2));
    return radius + (inner ? 0 : .5 * Math.cos(angle * 12)) + folds;
  };
  const cloudBody = (profiles: readonly { y: number; inner: number; outer: number }[]) => {
    const levels: { y: number; inner: number; outer: number }[] = [];
    profiles.slice(0, -1).forEach((a, index) => {
      const z = profiles[index + 1], n = Math.ceil((z.y - a.y) / 3);
      for (let j = 0; j < n; j++) levels.push({ y: a.y + (z.y - a.y) * j / n,
        inner: a.inner + (z.inner - a.inner) * j / n, outer: a.outer + (z.outer - a.outer) * j / n });
    });
    levels.push(profiles[profiles.length - 1]);
    const segments = 72, data = typhoonCloudMesh(segments, levels);
    levels.forEach((profile, row) => {
      for (let i = 0; i <= segments; i++) for (const inner of [false, true]) {
        const angle = L.cutStart + (L.cutEnd - L.cutStart) * i / segments;
        const q = typhoonPolar(cloudRadius(inner ? profile.inner : profile.outer, profile.y, angle, inner), angle, profile.y);
        const offset = (row * (segments + 1) * 2 + i * 2 + Number(inner)) * 3;
        data.positions.splice(offset, 3, ...q);
      }
    });
    return data;
  };
  const base = solid(typhoonPrismMesh(TYPHOON_BASE_OUTLINE, 0, 2), '#a9c7c8', 'sea-base', 0, .055);
  // Two closed pieces share the same profile at y=35; this makes the cloud top
  // a real selectable part without a second detached top-view diagram.
  const wall = solid(cloudBody(TYPHOON_WALL_PROFILE.slice(0, 4)), '#dce0d4', 'cloud-eyewall', 1, .055);
  const canopy = solid(cloudBody(TYPHOON_WALL_PROFILE.slice(3)), '#e5e7dc', 'upper-cloud-canopy', 2, .035);
  const eye = solid(typhoonPrismMesh(TYPHOON_EYE_OUTLINE, 2.05, 2.32), '#d8cead', 'eye-footprint', 3, .035);
  base.userData.northernHemisphere = true; wall.userData.trueEyeOpening = true; canopy.userData.trueEyeOpening = true;
  eye.userData.cloudFreeObservation = true;

  const arc = (radius: number, height: number, inner: boolean, count = 72) => Array.from({ length: count + 1 }, (_, i) => {
    const angle = L.cutStart + (L.cutEnd - L.cutStart) * i / count;
    return p(typhoonPolar(cloudRadius(radius, height, angle, inner), angle, height));
  });
  for (const profile of [TYPHOON_WALL_PROFILE[0], TYPHOON_WALL_PROFILE[3], TYPHOON_WALL_PROFILE[5]]) {
    b.stroke(arc(profile.inner, profile.y, true), .27);
    b.stroke(arc(profile.outer, profile.y, false), .25);
  }
  for (const angle of [L.cutStart, L.cutEnd]) {
    b.stroke(TYPHOON_WALL_PROFILE.map(profile => p(typhoonPolar(cloudRadius(profile.inner, profile.y, angle, true), angle, profile.y))), .42);
    b.stroke(TYPHOON_WALL_PROFILE.map(profile => p(typhoonPolar(cloudRadius(profile.outer, profile.y, angle, false), angle, profile.y))), .42);
    for (const profile of [TYPHOON_WALL_PROFILE[0], TYPHOON_WALL_PROFILE[5]]) b.stroke([
      p(typhoonPolar(cloudRadius(profile.inner, profile.y, angle, true), angle, profile.y)), p(typhoonPolar(cloudRadius(profile.outer, profile.y, angle, false), angle, profile.y)),
    ], .37);
  }
  b.stroke([...TYPHOON_BASE_OUTLINE, TYPHOON_BASE_OUTLINE[0]].map(([x, z]) => p([x, 2.03, z])), .38);

  const initial = evaluateTyphoon(1), arrows = initial.arrows.map(arrow => {
    const data = typhoonArrowMeshData(arrow), mesh = solid(data, arrow.color, arrow.stage, arrow.selection, .035, true);
    mesh.userData.typhoonArrowId = arrow.id; mesh.userData.typhoonTipVertices = data.tipVertices;
    return { id: arrow.id, mesh, outline: data.outline };
  });
  const labels = TYPHOON_LABELS.map(label => ({ definition: label,
    mesh: select(role(b.label(label.text, p(label.at), label.width * scale, label.height * scale), 'process-label'), label.selection) }));
  const track: PhaseTrack = { start: p(L.track.start), end: p(L.track.end) };
  const rail = solid(typhoonPrismMesh([[13, 87.8], [87, 87.8], [87, 88.2], [13, 88.2]], -10.14, -9.86), '#afa184', 'phase-rail', undefined, .035);
  rail.userData.modelInput = { kind: 'phase-track', track, label: '沿纸轨拖动，逐步观察同一台风的立体结构' };
  const tab = new T.Shape();
  [[-3.4, 2.1], [3.4, 2.1], [3.4, -.8], [0, -3.1], [-3.4, -.8]].forEach(([x, y], i) =>
    i ? tab.lineTo(x * scale, y * scale) : tab.moveTo(x * scale, y * scale));
  tab.closePath();
  const tabGeometry = new T.ExtrudeGeometry(tab, { depth: .7 * scale, bevelEnabled: false }); tabGeometry.translate(0, 0, -.35 * scale);
  const handle = role(b.mesh(tabGeometry, '#d4bd8b', false), 'phase-handle'); handle.material = paper('#d4bd8b', .035);
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，暂停回看低层、眼墙、高空和台风眼' };
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
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
        const profiles = state.selection === 1 ? TYPHOON_WALL_PROFILE.slice(0, 4) : TYPHOON_WALL_PROFILE.slice(3);
        for (const angle of [L.cutStart, L.cutEnd]) for (const side of ['inner', 'outer'] as const)
          b.contour(profiles.map(profile => p(typhoonPolar(cloudRadius(profile[side], profile.y, angle, side === 'inner'), angle, profile.y))), .86);
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
        geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i]),
        fixedFocusBounds: true, measuredWindSpeed: false, forecast: false };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
