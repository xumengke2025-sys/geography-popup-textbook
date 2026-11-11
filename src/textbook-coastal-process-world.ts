import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { COASTAL_PROCESS_GEOMETRY as G, COASTAL_PROCESS_REFERENCE,
  evaluateCoastalProcess, coastalCoreGeometry, coastalPlatformGeometry, coastalBlockGeometry,
  coastalBlockContours, coastalPlatformHeight, coastalRockTop, coastalShoreOffset,
  type CoastalMeshData, type CoastalPoint } from './textbook-coastal-process-model';

/** One finite cliff section. The inland core and gently sloping platform are
 * permanent solids. Only three identifiable outer slabs undercut and fall. */
export function buildCoastalProcessWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = Math.max(43 * s, Math.min(68 * s, b.height));
  const z0 = -LIFT_MARGIN - b.height * .62;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z / 60 * depth];
  const point = (q: CoastalPoint): Vec3 => p(...q);
  const geometry = (data: CoastalMeshData) => {
    const g = new T.BufferGeometry(), vertices: number[] = [];
    for (let i = 0; i < data.positions.length; i += 3) vertices.push(...p(data.positions[i], data.positions[i + 1], data.positions[i + 2]));
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(data.indices); g.computeVertexNormals();
    return g;
  };
  const surface = (data: CoastalMeshData, color: string, role: string, seed: number) => {
    const mesh = b.mesh(geometry(data), color, false);
    mesh.material = createSpecimenMaterial(b.pop, { color, ink: '#645e52', spacing: 3.4, hatch: .17, shade: .11, seed });
    mesh.material.side = T.DoubleSide; mesh.userData.coastalRole = role; return mesh;
  };
  const base = b.box(p(2, 0, 2), p(98, .8, 61), '#b8b2a2', false);
  const sea = b.box(p(3, .8, 25), p(97, G.seaHeight, 61), '#a7c6ce', false);
  const platform = surface(coastalPlatformGeometry(), '#c4b59b', 'fixed-platform', 126);
  const core = surface(coastalCoreGeometry(), '#b7a991', 'fixed-inland-core', 127);
  let state = evaluateCoastalProcess(0), lastPhase = -1;
  const slabs = state.blocks.map(block => {
    const mesh = surface(coastalBlockGeometry(state, block.id), '#c4b39a', 'finite-collapse-block', 128 + block.id);
    mesh.userData.coastalBlockId = block.id; mesh.userData.coastalLayers = 7; mesh.userData.coastalSections = 10; return mesh;
  });
  const cliffLabel = b.label('海蚀崖', p(20, 34, 4), 23 * s, 7.2 * s);
  const platformLabel = b.label('原位平台', p(76, 9, 61), 22 * s, 6 * s);
  platformLabel.visible = false;
  const track = { start: p(15, 2.6, 67), end: p(85, 2.6, 67) };
  const rail = b.box(p(13, 2.25, 66.7), p(87, 2.65, 67.3), '#ddd5c2', false);
  rail.userData.coastalRole = 'phase-rail';
  const handle = b.box([-2 * s, -1.35 * s, -.65 * s], [2 * s, 1.35 * s, .65 * s], '#f1e8d2', false);
  handle.userData.coastalRole = 'phase-handle'; handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，暂停回看凹蚀、崩塌与平台露出' };
  handle.position.set(...phaseTrackPoint(0, track));
  const fixedPlatformOutline = [p(3, coastalPlatformHeight(2), 2), p(97, coastalPlatformHeight(2), 2),
    p(97, coastalPlatformHeight(58), 58), p(3, coastalPlatformHeight(58), 58), p(3, coastalPlatformHeight(2), 2)];
  return {
    update(phase) {
      if (phase !== lastPhase) {
        state = evaluateCoastalProcess(phase);
        slabs.forEach((mesh, id) => {
          const data = coastalBlockGeometry(state, id), a = mesh.geometry.attributes.position;
          for (let i = 0; i < a.count; i++) a.setXYZ(i, ...p(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]));
          a.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
          mesh.userData.coastalState = state.blocks[id].state; mesh.userData.coastalFall = state.blocks[id].fall;
        });
        handle.position.set(...phaseTrackPoint(state.phase, track)); lastPhase = phase;
      }
      cliffLabel.visible = true; platformLabel.visible = state.exposedPlatform > 2;
      if (platformLabel.visible) b.contour([p(76, 5.7, 61), p(82, coastalPlatformHeight(57.5) + .12, 57.5)], .25);
      b.outline(base, .4); b.contour(fixedPlatformOutline, .55);
      // The back of the core is a fixed reference while its seaward face is
      // uncovered. No object-position retreat is applied to this bedrock.
      for (const x of [G.minX, G.maxX]) b.contour([
        p(x, coastalPlatformHeight(G.backZ), G.backZ), p(x, coastalRockTop(x), G.backZ),
        p(x, coastalRockTop(x), G.coreFrontZ + coastalShoreOffset(x)),
        p(x, coastalPlatformHeight(G.coreFrontZ), G.coreFrontZ + coastalShoreOffset(x)),
      ], .48);
      b.contour(Array.from({ length: 31 }, (_, i) => {
        const x = G.minX + (G.maxX - G.minX) * i / 30; return p(x, coastalRockTop(x), G.backZ);
      }), .42);
      state.blocks.forEach(block => coastalBlockContours(state, block.id).forEach(contour => b.contour(contour.map(point), .47)));
      for (let j = 0; j < 3; j++) {
        const z = 61 - ((state.phase * 3.1 + j / 3) % 1) * 27;
        b.contour(Array.from({ length: 32 }, (_, i) => p(5 + i * 2.9, G.seaHeight + .08, z + Math.sin(i * .38) * .42)), .31);
      }
      b.trace([p(49, 2.65, 54), p(49, 3.05, 40), p(49, 3.8, 29 - state.undercut * .28)], state.phase * 3, 2, 'flow', 1, .65);
      b.contour([track.start, track.end], .35); b.outline(handle, .40);
      // Avoid a silhouette-only inland wall: three restrained bedding lines are
      // revealed behind the same collapsing slabs, rather than sliding with them.
      if (state.inventory.falling + state.inventory.deposited > 0) for (const y of [8, 15, 22]) {
        b.contour(Array.from({ length: 31 }, (_, i) => {
          const x = G.minX + (G.maxX - G.minX) * i / 30;
          return p(x, y + .16 * Math.sin(x * .16), G.coreFrontZ + coastalShoreOffset(x) + .025);
        }), .22);
      }
      sea.userData.coastalRole = 'sea';
    },
    focusBounds: () => ({ min: p(0, 0, 0), max: p(100, 38, 72) }),
    describe: () => ({ kind: 'coastal-cliff-process', reference: COASTAL_PROCESS_REFERENCE,
      phase: state.phase, stage: state.stage, caption: state.caption, undercut: state.undercut,
      inventory: { ...state.inventory }, exposedPlatform: state.exposedPlatform,
      fixedInlandCore: true, fixedPlatform: true, finiteBlocksRetained: true, closedVolumes: true, fixedBuffers: true,
      blocks: state.blocks.map(block => ({ id: block.id, state: block.state, fall: block.fall,
        angle: block.angle, translation: [...block.translation], exposedPlatform: block.exposedPlatform })),
      controls: ['phase-track'] }),
  };
}
