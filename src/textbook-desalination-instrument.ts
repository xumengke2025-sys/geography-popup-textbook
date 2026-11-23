import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { desalinationFragmentPose, evaluateDesalination } from './textbook-desalination-model';
import { mountSpecimenKeys } from './textbook-specimen-slides';
import { createInstrumentParts } from './textbook-instrument-parts';
import { mountFieldInstrument, mountInstrumentInscription } from './textbook-field-instruments';

/** Both methods drain to a shared open collector. The native mesh groups
 * rotate about the axes of the authored bearings and conical gears. */
export function buildDesalinationInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 78 * s;
  const at = (x: number, y: number, z: number): Vec3 => [x * s, y * s, back + z * s];
  const parts = mountFieldInstrument(b, 'desalination', s, at(0, 0, 0));
  type Piece = NonNullable<ReturnType<typeof parts.get>>[number];
  const role = (mesh: Piece, name: string) => {
    mesh.name = mesh.userData.desalinationRole = name;
    return mesh;
  };
  const rodGroup = (name: string, position: Vec3, lift: number) => {
    const group = new T.Group();
    group.name = name;
    group.position.set(...position);
    group.userData.rigidFormationGroup = { offset: [0, lift * s, 0], start: .25, angle: -.09, axis: 'x' };
    b.root.add(group);
    return group;
  };
  const draining = rodGroup('gravity-drain-assembly', [0, 0, 0], -6);
  const spinning = rodGroup('cutaway-centrifuge-assembly', [0, 0, 0], -6);
  const attach = (group: string, parent: InstanceType<typeof T.Group>, origin?: Vec3) => {
    const meshes = parts.get(group)!;
    for (const mesh of meshes) {
      if (origin) mesh.geometry.translate(-origin[0], -origin[1], -origin[2]);
      parent.add(mesh);
    }
    return meshes;
  };
  role(parts.get('collector-chassis')![0], 'collector-chassis');
  const brine = role(parts.get('brine')![0], 'collected-salt-rich-water');
  brine.geometry.computeBoundingBox();
  const brineFloor = brine.geometry.boundingBox!.min.y;
  attach('gravity', draining);
  // Reading carriage on the front rack column. Its vertical travel lets the
  // operator trace the fall of brine without shifting the drainage grid.
  const rack = createInstrumentParts(b, draining);
  rack.plate(at(70.4,5.4,51),at(76.8,6.9,56.4),'brass',.24*s);
  rack.shaft(at(75,5.9,55),at(75,34.3,55),.59*s,'steel');
  rack.plate(at(73.6,33.8,53.7),at(76.4,34.8,56.3),'brass',.2*s);
  const drainReader=rack.knob(at(75,32.8,55.8),[0,0,1],1.75*s,2.25*s);
  const jaw=rack.plate(at(70.7,32.42,54.1),at(75.7,33.14,55.7),'brass',.19*s);
  const drainTrack={start:at(75,32.8,56.3),end:at(75,7.15,56.3)};
  for(const piece of [jaw,...drainReader.children]){
    piece.userData.modelInput={kind:'phase-track',track:drainTrack,label:'沿立柱下移测爪，观察盐水滴入收集槽'};
    piece.userData.smallPointTarget=true;
  }
  const keys=mountSpecimenKeys(b,at,s,[24.5,41.5],['重力','离心'],4.25,67.5,14.8);
  createInstrumentParts(b).casting(at(15.8,2.67,62),at(50.2,4.85,67.5),'wood',.36*s);
  const play = (selection: number) => ({ kind: 'replay', selection,
    label: selection ? '从头观察破碎离心与收集' : '从头观察重力排盐' });
  for (let i = 0; i < 4; i++) for (const mesh of attach(`ice-${i}`, draining)) {
    role(mesh, 'cleaved-sea-ice');
    mesh.userData.modelInput = play(0);
  }
  attach('spin', spinning);
  const guard = role(attach('guard', spinning)[0], 'sectioned-centrifuge-guard');
  guard.userData.teachingCutaway = true;
  const rotor = new T.Group();
  rotor.name = 'bearing-driven-rotor';
  rotor.position.set(...at(50, 0, 39));
  spinning.add(rotor);
  for (const mesh of attach('rotor', rotor, at(50, 0, 39))) {
    role(mesh, 'rotating-basket-and-spindle');
    mesh.userData.movingWithAxle = true;
  }
  const crank = new T.Group();
  crank.name = 'geared-hand-crank';
  crank.position.set(...at(81, 10.45, 39));
  spinning.add(crank);
  const drive={kind:'phase-dial',dial:{center:at(85.1,10.45,39),radiusX:6.56*s,radiusY:6.56*s,plane:'yz',turns:4},label:'正反摇动木柄，观察离心排盐'};
  for (const mesh of attach('crank', crank, at(81, 10.45, 39))) mesh.userData.modelInput=drive;
  for (const mesh of attach('crank-handle', crank, at(81, 10.45, 39))) {
    mesh.userData.modelInput = drive;
    mesh.userData.desalinationNativeControl = true;
    mesh.userData.smallPointTarget=true;
  }
  const shards = Array.from({ length: 9 }, (_, i) => {
    const mesh = role(attach(`fragment-${i}`, spinning, at(0, 0, 0))[0], 'fractured-sea-ice');
    mesh.userData.modelInput = play(1);
    return mesh;
  });
  const pockets = Array.from({ length: 16 }, (_, i) => {
    const mesh = role(b.mesh(new T.SphereGeometry(.68 * s, 12, 8), '#b6a56b', false, true, 'water'), 'salt-rich-brine-pocket');
    mesh.userData.brinePocketId = i;
    return mesh;
  });
  mountInstrumentInscription(b, 'desalination', 'collector', '盐水收集', s, at(0, 0, 0));
  b.label('海冰', at(28, 40.7, 41), 11.4 * s, 5.9 * s);
  let state = evaluateDesalination(0);
  const motion: ModelMotion = {
    update(phase, selection) {
      state = evaluateDesalination(phase, selection);
      draining.visible = state.mode === 0;
      keys(state.mode);
      jaw.position.y=drainReader.position.y=(7.15-32.8)*s*state.phase;
      spinning.visible = state.mode === 1;
      const angle = state.phase * 4 * Math.PI;
      rotor.rotation.y = -angle;
      crank.rotation.x = 2 * angle;
      brine.scale.y = 1 + state.progress * 2.5;
      brine.position.y = brineFloor * (1 - brine.scale.y);
      shards.forEach((mesh, i) => {
        const [x, z, a] = desalinationFragmentPose(state, i);
        mesh.position.set(...at(x, 16.31, z));
        mesh.rotation.y = -(Math.PI / 2 + a);
      });
      pockets.forEach((mesh, i) => {
        mesh.position.set(...at(...state.pockets[i].point));
        mesh.userData.collected = state.pockets[i].inCollector;
      });
    },
    focusBounds: () => ({ min: at(8.5, -1, 17), max: at(92, 46, 72) }),
    describe: () => ({ kind: 'sea-ice-desalination', method: state.mode ? 'crushing-and-centrifuging' : 'gravity-draining',
      progress: state.progress, retainedBrinePockets: state.retainedBrinePockets, collectedPockets: state.collectedPockets,
      brinePockets: state.pockets, separatedBrineCollected: state.separatedBrineCollected, potableWaterClaim: false,
      operatingParameters: 'not-simulated', specimenConstruction: 'supported-drain-rack-and-bearing-driven-cutaway-centrifuge',
      rotorAngle: rotor.rotation.y, crankAngle: crank.rotation.x, driveRatio: 2,
      cutawayIsTeachingView: true, pocketPositionsUnchanged: true, selfSupported: true }),
  };
  motion.update(0, 0, 0, true);
  return motion;
}
