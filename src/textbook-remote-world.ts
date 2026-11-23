import { surveyBench } from './textbook-survey-bench';
import { buildCrownSurface } from './textbook-natural-form-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateRemoteSensing, REMOTE_LAYOUT, REMOTE_PROCESS_REFERENCE, REMOTE_SAMPLE_COUNT,
  REMOTE_PROCESS_STOPS, type RemotePoint, type RemoteJourney } from './textbook-remote-model';

/** The original page stays below this small optical-observation rig. Ground,
 * optics, antenna, workstation, paper and information tiles are actual meshes;
 * no drawing or screen image is mapped onto a plane to imitate the model. */
export function buildRemoteSensingWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 72 * scale, rise = 43 * scale;
  const p = ([x, y, z]: RemotePoint): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const bench=surveyBench(b,scale,p);
  const finishes: Record<string,[SolidMaterialRole,string]> = {
    sensor:['enamel','#294138'],'solar-panel':['enamel','#284c58'],'solar-panel-frame':['brass','#b19459'],
    'payload-cap':['brass','#9a7645'],receiver:['wood','#694734'],'received-data-tray':['enamel','#224139'],
    processor:['wood','#6c4631'],'processing-screen':['enamel','#284039'],'screen-bezel':['brass','#b09764'],
    'workstation-drive-slot':['steel','#534d43'],'workstation-vent':['brass','#9a8150'],
    keyboard:['enamel','#30463e'],'paper-stand':['brass','#9a7a4a'],'paper-stand-foot':['enamel','#30463e'],
    'output-paper-ledge':['brass','#9a7a4a'],'output-paper':['ivory','#e4d5b2']
  };
  const structure: any[] = [];
  const mark = (mesh: any, role: string, selection?: number) => {
    mesh.userData.remoteRole = role;
    if (selection !== undefined) mesh.userData.modelInput = { kind: 'select', selection,
      label: `查看${REMOTE_PROCESS_STOPS[selection].label}` };
    return mesh;
  };
  const box = (center: RemotePoint, size: RemotePoint, color: string, role: string, selection?: number, fixed = true) => {
    const finish=finishes[role], half=size.map(v=>v*scale/2) as Vec3;
    const geo=chamferedPlateGeometry(half.map(v=>-v) as Vec3,half,Math.min(...half)*.16);
    const mesh=b.mesh(geo,finish?.[1]??color,false,true,finish?.[0]);
    mesh.position.set(...p(center)); mark(mesh, role, selection); if (fixed) structure.push(mesh); return mesh;
  };
  const rod = (from: RemotePoint, to: RemotePoint, radius: number, color: string, selection?: number) => {
    const mesh = b.cylinder(p(from), p(to), radius * scale, color, false); mark(mesh, 'support', selection); structure.push(mesh); return mesh;
  };
  bench.bed(.4,99.6,3.3,71);
  // The adjustable saddle holds the optical head over the specimen drawer.
  bench.column([31,.1,6.4],[31,51.4,6.4],3.15);
  bench.shaft([31,51.4,6.4],[31,54,12],1.65);
  bench.parts.bearing(p([31,53,10]),[1,0,0],2.12*scale,9.2*scale);
  bench.column([6,.1,13.5],[6,54.1,13.5],1.95);
  bench.curve([[6,52,13.5],[6,58,14],[5,61,18],[5,61,29]],.69,'brass','lamp swan neck');
  bench.turning([5,61,23],[5,61,28.8],[[1.1,0],[1.55,.1],[1.6,.32],[2.6,.65],[3.8,.94],[3.82,1]],'brass','rolled lamp reflector');
  const sun=b.sphere(p(REMOTE_LAYOUT.sun),2.67*scale,'#e1c28a',false);mark(sun,'sun');
  bench.plate([2,.12,19],[35,1.2,47.8],'brass','specimen drawer rim');
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let j=0;j<=28;j++)for(let i=0;i<=38;i++){
    const x=2.6+i*31.7/38,z=19.6+j*27.55/28;
    const swale=Math.exp(-Math.pow((x-14-.41*(z-26)-3*Math.sin(z*.21))*.42,2));
    const ridge=.48*Math.sin(x*.27+z*.17)+.26*Math.cos(z*.64-x*.31);
    positions.push(...p([x,1.69+.38*ridge-.31*swale,z]));
    const color=new T.Color('#596e4e').lerp(new T.Color('#a28a61'),.41+.30*ridge).lerp(new T.Color('#707b62'),swale*.6);
    colors.push(color.r,color.g,color.b);
    if(i<38&&j<28){const a=j*39+i;indices.push(a,a+39,a+1,a+1,a+39,a+40);}
  }
  const ground=new T.BufferGeometry();ground.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  ground.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.setIndex(indices);ground.computeVertexNormals();
  const groundMesh=b.mesh(ground,'#ffffff',false,true,'land',{vertexColors:true});
  applyEarthScan(groundMesh.material,'turf',8*scale);mark(groundMesh,'ground-plinth',0);
  for (const [x,z,h] of [[6,25,8.8],[25,25,10],[30,38,7.5],[31.2,30.6,5.2],[4.8,42,5.1]]) {
    rod([x,1.5,z],[x,h*.73,z],.27,'#624835',0);
    const crown=buildCrownSurface('deciduous',x+z);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(crown.positions,3));geo.setIndex(crown.indices);
    geo.scale(h*.55*scale,h*.57*scale,h*.55*scale);geo.translate(...p([x,h*.7,z]));geo.computeVertexNormals();
    mark(b.mesh(geo,'#556c4a',false,true,'plant'),'observed-tree',0);
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
  const lens = bench.turning([31,51,14],[31,48.5,18],[[2.32,0],[2.42,.12],[2.05,.22],[2.05,.52],[2.32,.58],[2.4,.84],[2.73,.9],[2.73,1]],'brass','camera objective');
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
  const dish = b.mesh(dishGeometry, '#bea571', false,true,'brass'); dish.position.set(...p(REMOTE_LAYOUT.dish));
  mark(dish, 'receiving-dish', 1); structure.push(dish);
  const dishPoint = ([x, y, z]: RemotePoint): RemotePoint => {
    const v = new T.Vector3(x, y, z).applyAxisAngle(new T.Vector3(1, 0, 0), .32).applyAxisAngle(new T.Vector3(0, 0, 1), -.38);
    return [v.x + REMOTE_LAYOUT.dish[0], v.y + REMOTE_LAYOUT.dish[1], v.z + REMOTE_LAYOUT.dish[2]];
  };
  const rimGeometry = new T.TorusGeometry(5.62 * scale, .16 * scale, 5, 40);
  rimGeometry.rotateX(Math.PI / 2 + .32); rimGeometry.rotateZ(-.38);
  const rim = b.mesh(rimGeometry, '#ae894d', false,true,'brass'); rim.position.set(...p(dishPoint([0, .85, 0])));
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

  bench.parts.knob(p([35.5,54.7,12]),[1,0,0],1.52*scale,.9*scale);
  bench.turning([60.9,11,43],[77.1,11,43],[[1.16,0],[1.22,.07],[.83,.12],[.83,.88],[1.22,.93],[1.16,1]],'brass','comparator roller');
  bench.parts.knob(p([76.6,11,41]),[1,0,0],1.65*scale,1.2*scale);
  for(const x of [82,96]) bench.column([x,.12,51.4],[x,9.2,51.4],1.45);
  bench.turning([80.7,23.5,51.7],[97.3,23.5,51.7],[[.8,0],[.87,.07],[.59,.13],[.59,.87],[.87,.93],[.8,1]],'brass','print frame roller');
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

  const labelPositions: RemotePoint[] = [[16,1.08,56.7],[43.2,1.08,56.7],[64.5,1.08,56.7],[87.6,1.08,58.6]];
  ['获取','传输','处理','成果'].forEach((text,i)=>mark(bench.key(text,labelPositions[i],15.8,5.85,i,REMOTE_PROCESS_STOPS[i].label),'node-label',i));

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

  const drive=bench.carriage(REMOTE_LAYOUT.trackStart,REMOTE_LAYOUT.trackEnd,'推拉木柄，回看同一组遥感样本的获取、传输、整理与成像');
  const {grip:handle,track}=drive;mark(handle,'phase-handle');

  let state = first;
  const infoPath = (points: RemotePoint[], width = .35, warm = false) => {
    const target = warm ? b.accentStrokes : b.flow;
    target.push({ points: points.map(q => b.v(p(q))), width });
  };
  return {
    update(phase, _selection) {
      state = evaluateRemoteSensing(phase);
      for(const mesh of structure) if(mesh.userData.modelHovered) b.outline(mesh,.63);
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
      drive.move(state.phase);
    },
    focusBounds: () => ({ min: p([0,-5.8,3]), max: p([100,64.5,71]) }),
    framingPoints: () => [[0,3],[100,3],[100,71],[0,71]].flatMap(([x,z])=>[p([x,-5.8,z]),p([x,2,z])]).concat([p([5,64.5,29]),p([47,58.9,12])]),
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