import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { evaluateRemoteSensing, REMOTE_LAYOUT, REMOTE_PROCESS_REFERENCE, REMOTE_SAMPLE_COUNT,
  REMOTE_PROCESS_STOPS, type RemotePoint, type RemoteJourney } from './textbook-remote-model';

/** The original page stays below this small optical-observation rig. Ground,
 * optics, antenna, workstation, paper and information tiles are actual meshes;
 * no drawing or screen image is mapped onto a plane to imitate the model. */
export function buildRemoteSensingWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 43 * scale;
  const p = ([x, y, z]: RemotePoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const structure: any[] = [];
  const quietMaterials = new Map<string, any>();
  const mark = (mesh: any, role: string, selection?: number) => {
    mesh.userData.remoteRole = role;
    if (mesh.userData.kind !== 'text-label') {
      const color = `#${mesh.material.color.getHexString()}`;
      if (!quietMaterials.has(color)) {
        const material = createSpecimenMaterial(b.pop, { color, ink: '#6a776c', hatch: .045, spacing: 2.8, shade: .07, seed: 502 + quietMaterials.size });
        material.side = T.DoubleSide; quietMaterials.set(color, material);
      }
      mesh.material = quietMaterials.get(color);
    }
    if (selection !== undefined) mesh.userData.modelInput = { kind: 'select', selection,
      label: `查看${REMOTE_PROCESS_STOPS[selection].label}` };
    return mesh;
  };
  const box = (center: RemotePoint, size: RemotePoint, color: string, role: string, selection?: number, fixed = true) => {
    let geometry: any;
    if (['sensor', 'receiver', 'processor'].includes(role)) {
      const [w, h, d] = size, c = .6, shape = new T.Shape();
      [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c],
        [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]]
        .forEach(([x, y], i) => i ? shape.lineTo(x * scale, y * scale) : shape.moveTo(x * scale, y * scale));
      shape.closePath(); geometry = new T.ExtrudeGeometry(shape, { depth: d * scale, bevelEnabled: false }); geometry.translate(0, 0, -d * scale / 2);
    } else geometry = new T.BoxGeometry(...size.map(v => v * scale));
    const mesh = b.mesh(geometry, color, false);
    mesh.position.set(...p(center)); mark(mesh, role, selection); if (fixed) structure.push(mesh); return mesh;
  };
  const rod = (from: RemotePoint, to: RemotePoint, radius: number, color: string, selection?: number) => {
    const mesh = b.cylinder(p(from), p(to), radius * scale, color, false); mark(mesh, 'support', selection); structure.push(mesh); return mesh;
  };
  box([50, .6, 36], [98, 1.2, 48], '#dfd6bd', 'ground-plinth');
  // These trees identify the observed object without labelling an inferred
  // land-cover class. The finite tones remain explicitly illustrative samples.
  for (const [x, z, height] of [[7, 26, 9], [25, 27, 12], [30, 38, 8]]) {
    rod([x, 1.3, z], [x, height * .75, z], .32, '#a89d7e', 0);
    const crown = b.cylinder(p([x, height * .35, z]), p([x, height + 2, z]), 2.2 * scale, '#94a18b', false, 0);
    mark(crown, 'observed-tree', 0); structure.push(crown);
  }
  const sun = b.sphere(p(REMOTE_LAYOUT.sun), 2.7 * scale, '#cfb27a', false);
  mark(sun, 'sun'); structure.push(sun);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    b.stroke([4.1, 5.7].map(radius => p([REMOTE_LAYOUT.sun[0] + Math.cos(angle) * radius,
      REMOTE_LAYOUT.sun[1] + Math.sin(angle) * radius, REMOTE_LAYOUT.sun[2]])) as Vec3[], .42);
  }

  // Compact satellite, solar panels and a downward-facing optical aperture.
  box([31, 54, 12], [8.5, 7, 6], '#e8e3d4', 'sensor', 0);
  for (const x of [20, 42]) {
    box([x, 54.5, 12], [12, .8, 9], '#97afaf', 'solar-panel', 0);
    for (const z of [7.35, 16.65]) box([x, 54.8, z], [12.5, .45, .35], '#b5bdb0', 'solar-panel-frame', 0);
    for (const edge of [-6.1, 6.1]) box([x + edge, 54.8, 12], [.35, .45, 9], '#b5bdb0', 'solar-panel-frame', 0);
    for (let i = 0; i < 4; i++) b.stroke([p([x - 4.5 + i * 3, 55, 7.5]), p([x - 4.5 + i * 3, 55, 16.5])], .22);
    for (const z of [10.5, 13.5]) b.stroke([p([x - 6, 55, z]), p([x + 6, 55, z])], .22);
  }
  rod([24, 54.5, 12], [38, 54.5, 12], .3, '#7d8c7e', 0);
  box([31, 58.15, 12], [7.1, .45, 4.8], '#d1c5a7', 'payload-cap', 0);
  const lens = b.cylinder(p([31, 51, 14]), p([31, 48.5, 18]), 2.2 * scale, '#718981', false);
  mark(lens, 'optical-aperture', 0); structure.push(lens);
  const lensGlass = b.cylinder(p([31, 48.5, 18]), p([31, 48.3, 18.3]), 1.65 * scale, '#a9c5c2', false);
  mark(lensGlass, 'passive-optical-sensor', 0); structure.push(lensGlass);
  const collar = b.cylinder(p([31, 49.4, 16.56]), p([31, 49.05, 17.12]), 2.4 * scale, '#b5c3b6', false);
  mark(collar, 'lens-barrel-collar', 0); structure.push(collar);

  // A thick, curved dish catches the downlink; the little tray below retains
  // the received data, so later processing never erases the earlier result.
  box([48, 5, 43], [12, 8, 10], '#e7e1d2', 'receiver', 1);
  box([48, 9.6, 48], [9, 7, .5], '#d3d7c8', 'received-data-tray', 1);
  rod([48, 8, 38], [48, 17.4, 38], .55, '#8d9581', 1);
  const profile = [[0, -1], [1, -.9], [3, -.5], [5.8, .7], [5.8, 1], [5.4, .9], [3, -.15], [1, -.55], [0, -.6]];
  const dishGeometry = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r * scale, y * scale)), 28);
  dishGeometry.rotateX(.32); dishGeometry.rotateZ(-.38);
  const dish = b.mesh(dishGeometry, '#e3e4d5', false); dish.position.set(...p(REMOTE_LAYOUT.dish));
  mark(dish, 'receiving-dish', 1); structure.push(dish);
  const dishPoint = ([x, y, z]: RemotePoint): RemotePoint => {
    const v = new T.Vector3(x, y, z).applyAxisAngle(new T.Vector3(1, 0, 0), .32).applyAxisAngle(new T.Vector3(0, 0, 1), -.38);
    return [v.x + REMOTE_LAYOUT.dish[0], v.y + REMOTE_LAYOUT.dish[1], v.z + REMOTE_LAYOUT.dish[2]];
  };
  const rimGeometry = new T.TorusGeometry(5.62 * scale, .16 * scale, 5, 40);
  rimGeometry.rotateX(Math.PI / 2 + .32); rimGeometry.rotateZ(-.38);
  const rim = b.mesh(rimGeometry, '#bdc7b7', false); rim.position.set(...p(dishPoint([0, .85, 0])));
  mark(rim, 'dish-rolled-rim', 1); structure.push(rim);
  // Back ribs converge on the mount; their direction belongs to the bowl,
  // rather than a decorative radial pattern floating in front of it.
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    b.stroke([[1, -.8], [3, -.45], [5.4, .5]].map(([r, y]) => p(dishPoint([Math.cos(a) * r, y, Math.sin(a) * r]))), .2);
  }
  const pedestal = b.cylinder(p([48, 7.3, 38]), p([48, 9.2, 38]), 1.75 * scale, '#b0b9a7', false);
  mark(pedestal, 'dish-azimuth-mount', 1); structure.push(pedestal);
  for (const side of [-1, 1]) rod([48 + side * 4.8, 18, 38], [49, 23, 35], .14, '#8f9885', 1);
  const feed = b.sphere(p([49, 23, 35]), .6 * scale, '#7b8f87', false); mark(feed, 'dish-feed', 1); structure.push(feed);

  // Screen and output contain separate solid tiles, never a canvas texture.
  box([69, 12, 40], [14, 20, 7], '#e5e0d1', 'processor', 2);
  box([69, 16.6, 44.1], [10.2, 7.3, .4], '#c6cec2', 'processing-screen', 2);
  for (const x of [63.55, 74.45]) box([x, 16.6, 44.35], [.45, 8.3, .4], '#a5b1a2', 'screen-bezel', 2);
  for (const y of [12.45, 20.75]) box([69, y, 44.35], [11.3, .45, .4], '#a5b1a2', 'screen-bezel', 2);
  box([69, 8.7, 43.65], [10, .3, .32], '#a4ad9d', 'workstation-drive-slot', 2);
  for (let i = 0; i < 3; i++) box([64.3 + i * 1.2, 5.8, 43.65], [.65, 1.9, .25], '#b5bbaa', 'workstation-vent', 2);
  box([69, 2, 49], [14, 1, 5], '#c6bba6', 'keyboard', 2);
  for (let row = 0; row < 2; row++) for (let key = 0; key < 5; key++)
    b.stroke([p([63.8 + key * 2.1, 2.55, 47.7 + row * 1.8]), p([65.1 + key * 2.1, 2.55, 47.7 + row * 1.8])], .18);
  box([89, 15.8, 51.6], [15.5, 14, .6], '#f4efdf', 'output-paper', 3);
  box([89, 5, 51.3], [1.1, 8, 1.8], '#b7ab8d', 'paper-stand', 3);
  box([89, 1.8, 51.3], [11.5, .9, 5.4], '#c4b79a', 'paper-stand-foot', 3);
  box([89, 8.4, 52.15], [16, .8, 1.7], '#c6b99a', 'output-paper-ledge', 3);
  const corner = new T.BufferGeometry();
  const vertices = [[94.5, 22.8, 52.1], [96.8, 20.4, 52.1], [94.5, 20.4, 53.2]].flatMap(q => p(q as RemotePoint));
  corner.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); corner.setIndex([0, 1, 2]); corner.computeVertexNormals();
  const fold = b.mesh(corner, '#ded7c0', false, false); mark(fold, 'folded-paper-corner', 3); structure.push(fold);

  const labelPositions: RemotePoint[] = [[23, 3, 61], [48, 3, 61], [70, 3, 61], [91, 3, 61]];
  ['获取', '传输', '处理', '成果'].forEach((text, i) => {
    const label = b.label(text, p(labelPositions[i]), 17 * scale, 7.9 * scale);
    mark(label, 'node-label', i);
  });

  const first = evaluateRemoteSensing(0);
  const copyKinds = ['captured', 'received', 'processed', 'output'] as const;
  const copyPositions = ['sensor', 'receiver', 'processor', 'result'] as const;
  const sizes = [1.9, 1.9, 2.05, 2.5];
  const sampleMeshes = first.samples.map(sample => {
    const source = box(sample.source, [4.7, .5, 4.7], sample.color, 'sample-source', 0, false);
    source.userData.sampleId = source.userData.remoteSampleId = sample.id;
    source.userData.remoteTone = sample.tone; source.userData.remoteCopy = 'source';
    const copies = copyKinds.map((kind, i) => {
      const mesh = box(sample[copyPositions[i]], [sizes[i], sizes[i], .35], sample.color, 'sample-copy', i, false);
      mesh.userData.sampleId = mesh.userData.remoteSampleId = sample.id;
      mesh.userData.remoteTone = sample.tone; mesh.userData.remoteCopy = kind; mesh.visible = false;
      return { kind, mesh };
    });
    const packets = ['acquisition', 'transmission', 'processingTransfer', 'outputTransfer'].map((kind, i) => {
      const mesh = box(sample.source, [1.5, 1.5, .7], i === 0 ? '#ba9b66' : sample.color, 'information-packet', i, false);
      mesh.userData.sampleId = mesh.userData.remoteSampleId = sample.id;
      mesh.userData.remoteJourney = kind; mesh.visible = false; return { kind, mesh };
    });
    return { source, copies, packets };
  });

  const track: PhaseTrack = { start: p(REMOTE_LAYOUT.trackStart), end: p(REMOTE_LAYOUT.trackEnd) };
  const rail = rod(REMOTE_LAYOUT.trackStart, REMOTE_LAYOUT.trackEnd, .13, '#b5ac92'); mark(rail, 'phase-rail');
  const handleGeometry = new T.BoxGeometry(4.4 * scale, 3.2 * scale, .7 * scale); handleGeometry.rotateZ(Math.PI / 4);
  const handle = b.mesh(handleGeometry, '#e4d7ba', false);
  handle.position.set(...phaseTrackPoint(0, track)); mark(handle, 'phase-handle');
  handle.userData.smallPointTarget = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，回看遥感信息链' };

  let state = first;
  const infoPath = (points: RemotePoint[], width = .35, warm = false) => {
    const target = warm ? b.accentStrokes : b.flow;
    target.push({ points: points.map(q => b.v(p(q))), width });
  };
  return {
    update(phase, _selection) {
      state = evaluateRemoteSensing(phase);
      structure.forEach(mesh => {
        const active = mesh.userData.modelInput?.selection === state.selection;
        b.outline(mesh, mesh.userData.remoteRole === 'ground-plinth' ? .32 : mesh.userData.modelHovered ? .85 : active ? .66 : .32);
      });
      if (state.illumination > 0) infoPath([REMOTE_LAYOUT.sun, REMOTE_LAYOUT.target], .35, true);
      if (state.phase >= .025) infoPath([REMOTE_LAYOUT.target, REMOTE_LAYOUT.sensor], .21, true);
      if (state.phase >= .245) infoPath([REMOTE_LAYOUT.downlink, REMOTE_LAYOUT.dish, REMOTE_LAYOUT.receiver], .29);
      if (state.phase >= .475) infoPath([REMOTE_LAYOUT.receiver, [58, 9, 47], REMOTE_LAYOUT.processor], .29);
      if (state.phase >= .715) infoPath([REMOTE_LAYOUT.processor, [79, 17, 49], REMOTE_LAYOUT.result], .29);
      state.samples.forEach((sample, i) => {
        const meshes = sampleMeshes[i];
        b.outline(meshes.source, sample.acquisition.active ? .73 : .32);
        for (const { kind, mesh } of meshes.copies) {
          mesh.visible = sample[kind]; if (mesh.visible) b.outline(mesh, mesh.userData.modelInput?.selection === state.selection ? .68 : .4);
        }
        for (const { kind, mesh } of meshes.packets) {
          const packet = sample[kind as 'acquisition' | 'transmission' | 'processingTransfer' | 'outputTransfer'] as RemoteJourney;
          mesh.visible = packet.active; mesh.position.set(...p(packet.point));
          mesh.userData.remoteProgress = packet.progress;
          if (mesh.visible) b.outline(mesh, .4);
        }
      });
      handle.position.set(...phaseTrackPoint(state.phase, track)); b.outline(handle, .62);
    },
    focusBounds: () => ({ min: [-3 * scale, -2 * scale, back + 5 * scale], max: [103 * scale, 69 * scale, back + 71 * scale] }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      return { kind: 'remote-sensing-process', source: REMOTE_PROCESS_REFERENCE,
        phase: state.phase, stage: state.stage, caption: state.caption, selection: state.selection,
        sampleCount: REMOTE_SAMPLE_COUNT, samples: state.samples, counts: state.counts,
        processing: state.processing, output: state.output,
        retainedInformationCopies: state.retainedInformationCopies, sensorIlluminatesTarget: false,
        measuredSamples: false, predictsDisasters: false, automaticRecognition: false,
        nodeStops: REMOTE_PROCESS_STOPS, nodeWorld: labelPositions.map((point, i) => ({ selection: i, point: world(p(point)) })),
        handleWorld: handle.getWorldPosition(new T.Vector3()).toArray(),
        phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        sampleMeshes: sampleMeshes.map((meshes, i) => ({ id: state.samples[i].id, source: true,
          copies: Object.fromEntries(meshes.copies.map(({ kind, mesh }) => [kind, mesh.visible])) })),
        directInteraction: 'node-select-and-phase-track', fixedInformationPool: true,
        geometryBuffersReused: true, elevatedAbovePage: rise, originalPagePreserved: true,
      };
    },
  };
}

/** Short alias used by the existing geography dispatcher. */
export const buildRemoteWorld = buildRemoteSensingWorld;
