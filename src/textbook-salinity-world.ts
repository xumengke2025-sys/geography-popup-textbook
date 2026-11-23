import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { mountFieldInstrument, mountInstrumentInscription } from './textbook-field-instruments';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateSalinity, salinityPortionPoint, SALINITY_MODES, SALINITY_REFERENCE } from './textbook-salinity-model';

/** Three source modules fit the same enamel section. Water level, follower,
 * dissolved salt and the incoming or outgoing portions share one state. */
export function buildSalinityWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 65 * s;
  const point = (x: number, y: number, z: number): Vec3 => [x * s, y * s, back + z * s];
  const parts = mountFieldInstrument(b, 'salinity', s, point(0, 0, 0));
  type Piece = NonNullable<ReturnType<typeof parts.get>>[number];
  const role = (object: Piece, name: string) => { object.userData.salinityRole = name; return object; };
  const inscription = (plaque: string, text: string, name: string) =>
    role(mountInstrumentInscription(b, 'salinity', plaque, text, s, point(0, 0, 0)), name);
  const input = (mesh: Piece, mode: number) => {
    mesh.userData.modelInput = { kind: 'replay', selection: mode, label: `从同一海水开始，观察${SALINITY_MODES[mode]}` };
    mesh.userData.salinityMode = mode;
  };

  const sourceRoles = ['evaporation-source', 'rain-source', 'river'];
  const sources = sourceRoles.map((name, i) => {
    const meshes = parts.get(`source-${i}`)!;
    for (const mesh of meshes) { role(mesh, name); input(mesh, i); }
    return meshes;
  });
  const plugs = parts.get('plug')!;
  plugs.forEach(mesh => { mesh.name = 'removable-river-inlet-plug'; });
  const follower = parts.get('float')!;
  follower.find(mesh => mesh.userData.blenderColor === '#d5ad72')!.name = 'surface-float';
  const choice = SALINITY_MODES.map((text, mode) => {
    const label = inscription(`choice-${mode}`, text.slice(0, 2), 'source-label');
    const meshes = parts.get(`choice-${mode}`)!;
    for (const object of [...meshes, label]) input(object, mode);
    return meshes;
  });
  const saltLabel = inscription('salt', '盐量不变', 'salt-label');
  const resultLabels = ['未变','升高','降低'].map(text =>
    inscription('result', `盐度${text}`, 'concentration-label'));

  const track = { start: point(96, 51, 61), end: point(96, 6, 61) };
  const carriage = parts.get('cursor')!;
  const handle = carriage.find(mesh => mesh.userData.blenderColor === '#467c89')!;
  role(handle, 'water-handle');
  handle.userData.smallPointTarget = true;
  for (const mesh of carriage) {
    mesh.geometry.translate(-track.start[0], -track.start[1], -track.start[2]);
    mesh.userData.modelInput = { kind: 'phase-track', track, label: '沿导柱拖动游标，回看水量和盐度变化' };
  }

  const waterGeometry = new T.BoxGeometry(67.6, 1, 40, 32, 1, 12);
  const rest = new Float32Array(waterGeometry.attributes.position.array);
  const waterColor = new T.Float32BufferAttribute(new Float32Array(rest.length), 3);
  const deep = new T.Color('#315963'), surface = new T.Color('#8fb7b5'), shade = new T.Color();
  for (let i = 0; i < waterColor.count; i++) {
    const top = rest[i * 3 + 1] > 0;
    const x = rest[i * 3], z = rest[i * 3 + 2];
    shade.copy(top ? surface : deep).multiplyScalar(.97 + .03 * Math.sin(z * .51 + Math.cos(x * .18)) + .015 * Math.sin(z * 1.26 + x * .25));
    waterColor.setXYZ(i, shade.r, shade.g, shade.b);
  }
  waterGeometry.setAttribute('color', waterColor);
  const water = role(b.mesh(waterGeometry, '#ffffff', false, true, 'water'), 'sea-water');
  (water.material as InstanceType<typeof T.MeshStandardMaterial>).vertexColors = true;
  water.position.set(...point(53.5, 3, 39));

  const saltBase = new T.IcosahedronGeometry(.62, 1);
  const saltTemplate = new Float32Array(saltBase.attributes.position.array);
  saltBase.dispose();
  const saltGeometry = new T.BufferGeometry();
  const saltPositions = new T.Float32BufferAttribute(new Float32Array(saltTemplate.length * SALINITY_REFERENCE.saltMarks), 3);
  saltGeometry.setAttribute('position', saltPositions);
  const salt = role(b.mesh(saltGeometry, '#d5ad72', false, true, 'brass'), 'dissolved-salt-marks');
  salt.position.z = back;
  salt.userData.symbolCount = SALINITY_REFERENCE.saltMarks;

  const dropBase = new T.IcosahedronGeometry(1, 1);
  const dropTemplate = new Float32Array(dropBase.attributes.position.array);
  dropBase.dispose();
  const dropGeometry = new T.BufferGeometry();
  const dropPositions = new T.Float32BufferAttribute(new Float32Array(dropTemplate.length * SALINITY_REFERENCE.portionCount), 3);
  dropGeometry.setAttribute('position', dropPositions);
  const drops = role(b.mesh(dropGeometry, '#719da7', false, true, 'water'), 'finite-water-portions');
  drops.position.z = back;

  const owned = b.meshes.map(mesh => ({ mesh, buffer: mesh.geometry.attributes.position.array }));
  let state = evaluateSalinity(0), previousPhase = -1, previousSelection = -1;
  const refresh = (geometry: typeof saltGeometry) => {
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };
  const motion: ModelMotion = {
    update(phase, selection) {
      if (phase === previousPhase && selection === previousSelection) return;
      state = evaluateSalinity(phase, selection);
      previousPhase = phase;
      previousSelection = selection;
      const { waterLevel: level } = state;
      const positions = waterGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3], upper = rest[i * 3 + 1] > 0;
        const ripple = upper && state.stage === 'transferring' ? .11 * Math.sin(x * .27 + phase * 19) : 0;
        positions.setXYZ(i, x * s, (upper ? level + ripple : 0) * s, rest[i * 3 + 2] * s);
      }
      refresh(waterGeometry);
      Object.assign(water.userData, { waterAmount: state.water, waterLevel: level, concentration: state.concentration, saltMass: state.salt });
      for (let i = 0; i < SALINITY_REFERENCE.saltMarks; i++) {
        const x = 26 + i % 6 * 10.6, y = 3.4 + level * (.13 + Math.floor(i / 6) * .21);
        for (let j = 0; j < saltTemplate.length; j += 3) saltPositions.setXYZ((i * saltTemplate.length + j) / 3,
          (x + saltTemplate[j]) * s, (y + saltTemplate[j + 1]) * s, (59.25 + saltTemplate[j + 2] * .45) * s);
      }
      refresh(saltGeometry);
      for (const portion of state.portions) {
        const [x, y, z] = salinityPortionPoint(state, portion.id), radius = .58 * Math.min(1, portion.inTransit * 3);
        const height = radius * (state.mode === 0 ? 1.15 : 1.7);
        for (let j = 0; j < dropTemplate.length; j += 3) dropPositions.setXYZ((portion.id * dropTemplate.length + j) / 3,
          (x + dropTemplate[j] * radius) * s, (y + dropTemplate[j + 1] * height) * s, (z + dropTemplate[j + 2] * radius) * s);
      }
      refresh(dropGeometry);
      sources.forEach((meshes, i) => meshes.forEach(mesh => { mesh.visible = i === state.mode; }));
      plugs.forEach(mesh => { mesh.visible = state.mode !== 2; });
      choice.forEach((meshes, i) => meshes.forEach(mesh => { mesh.position.y = i === state.mode ? -.22 * s : 0; }));
      resultLabels.forEach((label, i) => { label.visible = i === (state.tendency === '升高' ? 1 : state.tendency === '降低' ? 2 : 0); });
      follower.forEach(mesh => { mesh.position.y = (3 + level) * s; });
      const cursor = phaseTrackPoint(state.phase, track);
      carriage.forEach(mesh => mesh.position.set(...cursor));
      saltLabel.visible = true;
    },
    focusBounds: () => ({ min: point(state.mode === 2 ? .8 : 15.8, -2.7, 14.6),
      max: point(99.4, state.mode === 0 ? 59.3 : 53.4, 69.5) }),
    describe: () => ({ kind: 'salinity-balance', mode: state.mode, phase: state.phase, stage: state.stage,
      waterAmount: state.water, initialWaterAmount: SALINITY_REFERENCE.initialWater, saltMass: state.salt,
      saltAmount: 'constant-symbolic', grainCount: SALINITY_REFERENCE.saltMarks, saltMarksDissolved: true,
      concentration: state.concentration, relativeConcentration: state.relativeConcentration, direction: state.tendency,
      inventory: { basin: state.water, source: state.source, inTransit: state.inTransit, removed: state.removed, total: state.totalWater, expected: state.expectedTotalWater },
      sameInitialConditions: true, finiteWaterPortions: SALINITY_REFERENCE.portionCount, sharedFlatState: true, units: state.units, measuredSalinity: false,
      observationTrough: { rolledOpenRim: true, frontSectionIsTeachingCutaway: true, noGlassTrick: true,
        fixedInitialWaterline: 17, followerHeight: 3 + state.waterLevel, waterSurfaceHeight: 3 + state.waterLevel,
        scaleIsCalibrated: false, energySourceIsSymbolic: true, inputModulesAreAlternatives: true, pathCoordinatesUnchanged: true,
        sourceModule: state.mode, riverPortOpen: state.mode === 2, riverPortSill: 22.6,
        nativeTimelineTrack: track, sourceSelections: choice.map((_, i) => i),
        directRigidParts: owned.filter(({ mesh }) => mesh.parent === b.root || mesh.parent?.name.startsWith('formation:')).length,
        fixedMeshCount: owned.every(({ mesh }, i) => b.meshes[i] === mesh),
        buffersStable: owned.every(({ mesh, buffer }) => mesh.geometry.attributes.position.array === buffer) } }),
  };
  motion.update(0, 0, 0, true);
  return motion;
}
