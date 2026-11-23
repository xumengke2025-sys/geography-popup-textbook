import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { DENSITY_INSTRUMENT as D, densityInstrumentPose } from './textbook-density-instrument';
import { mountFieldInstrument, mountInstrumentInscription } from './textbook-field-instruments';

/** A single machined beam rotates against its stationary scale. Both of the
 * sectioned cups and their three-point suspensions remain plumb. */
export function buildDensityInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 56 * scale;
  const root = new T.Group();
  root.name = 'equal-volume-density-instrument';
  root.position.z = back;
  root.scale.setScalar(scale);
  root.userData.rigidFormationGroup = { offset: [0, -6 * scale, 0], start: .06, angle: -.06, axis: 'y' };
  b.root.add(root);
  const parts = mountFieldInstrument(b, 'density', 1, [0, 0, 0]);
  for (const meshes of parts.values()) for (const mesh of meshes) root.add(mesh);
  type Piece = NonNullable<ReturnType<typeof parts.get>>[number];
  const role = (mesh: Piece, name: string) => { mesh.name = name; mesh.userData.densityPart = name; return mesh; };
  const beam = new T.Group();
  beam.name = 'pivoting-scale-beam';
  beam.position.set(...D.pivot);
  beam.userData.rigidFormationGroup = { offset: [0, -4, 0], start: .25, angle: .095, axis: 'z' };
  root.add(beam);
  const place = (group: string, parent: InstanceType<typeof T.Group>, origin: readonly number[]) => {
    const meshes = parts.get(group)!;
    for (const mesh of meshes) {
      mesh.geometry.translate(-origin[0], -origin[1], -origin[2]);
      parent.add(mesh);
    }
    return meshes;
  };
  place('beam', beam, D.pivot).forEach(mesh => role(mesh, 'pierced-balance-beam'));
  place('pointer', beam, D.pivot).forEach(mesh => role(mesh, 'beam-owned-pointer'));
  role(parts.get('bearing')![0], 'pivot-bearing');
  role(parts.get('scale')![0], 'fixed-zero-reference');

  let state = densityInstrumentPose(0);
  const pans = state.suspensions.map(({ pan: base }, i) => {
    const group = new T.Group();
    group.name = `plumb-sample-${i}`;
    group.position.set(...base);
    group.userData.rigidFormationGroup = { offset: [0, -9, 0], start: .36 + .06 * i, angle: i ? .17 : -.17, axis: 'y' };
    root.add(group);
    const supports = place(`pan-${i}`, group, base);
    const cup = role(place(`cup-${i}`, group, base)[0], 'equal-volume-sectioned-cup');
    const liquid = role(place(`water-${i}`, group, base)[0], 'fixed-volume-seawater');
    liquid.userData.equalVolumeSample = i;
    liquid.userData.teachingVolume = state.sampleVolume;
    const tokens = Array.from({ length: 13 }, (_, k) => place(`token-${i}-${k}`, group, base)[0]);
    const input = i === 0 ? { kind: 'select', selection: 0, label: '恢复相同条件，比较等体积样本' }
      : { kind: 'select', selection: 1, toggleTo: 2, label: '对照只降温与只增盐' };
    for (const mesh of [...supports, cup, liquid, ...tokens]) mesh.userData.modelInput = input;
    return { group, cup, liquid, tokens };
  });
  // One local specimen geometry for each pair. Subtracting the assembly
  // origins separately would otherwise round the two Float32 samples apart.
  pans[1].cup.geometry.copy(pans[0].cup.geometry);
  pans[1].liquid.geometry.copy(pans[0].liquid.geometry);
  const options = ['对照', '降温', '增盐'].map((text, selection) => {
    const input = { kind: 'select', selection, label: ['相同条件', '只降低右杯温度', '只增加右杯盐度'][selection] };
    const meshes = parts.get(`choice-${selection}`)!;
    const plaque = mountInstrumentInscription(b, 'density', `choice-${selection}`, text, 1, [0, 0, 0]);
    root.add(plaque);
    for (const mesh of [...meshes, plaque]) {
      mesh.userData.modelInput = input;
      mesh.userData.densitySelection = selection;
    }
    return meshes;
  });
  const water = pans[1].liquid.material;
  const colder = b.materialFor('water', '#598da1');
  const originalBuffers = b.meshes.map(mesh => ({ mesh, array: mesh.geometry.attributes.position.array }));
  const point = (x: number, y: number, z: number): Vec3 => [x * scale, y * scale, back + z * scale];
  const motion: ModelMotion = {
    update(_phase, selection) {
      state = densityInstrumentPose(selection);
      beam.rotation.z = state.angle;
      pans.forEach(({ group, tokens }, i) => {
        group.position.set(...state.suspensions[i].pan);
        tokens.forEach((token, k) => { token.visible = k < state.massTokens[i]; });
      });
      pans[1].liquid.material = state.mode === 1 ? colder : water;
      options.forEach((knob, i) => knob.forEach(mesh => { mesh.position.y = i === state.mode ? -.18 : 0; }));
    },
    focusBounds: () => ({ min: point(4, -.2, 1), max: point(96, 62, 38.3) }),
    describe: () => ({ kind: 'equal-volume-density', ...state, control: ['same', 'temperature-only', 'salinity-only'][state.mode],
      comparison: state.mode ? 'right-more-mass-per-same-volume' : 'equal', pressureHeldEqual: true, numericDensity: false,
      instrument: { kind: 'suspended-equal-volume-comparator', transversePivot: true, piercedBeam: true, realThreePointHangers: true,
        uprightSamplePans: true, cupGeometryIdentical: true, samplesAreFrontSectioned: true, massSymbolsAreNotSaltGrains: true,
        sampleScales: pans.map(sample => sample.liquid.scale.toArray()), panAngles: pans.map(pan => pan.group.rotation.z),
        beamAngle: beam.rotation.z, endpointAnchors: state.suspensions.map(hanger => hanger.anchor),
        fixedMeshCount: originalBuffers.every(({ mesh }, i) => b.meshes[i] === mesh),
        buffersStable: originalBuffers.every(({ mesh, array }) => mesh.geometry.attributes.position.array === array) } }),
  };
  motion.update(0, 0, 0, true);
  return motion;
}
