import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { createSolidMaterial, type SolidMaterialRole } from './textbook-solid-materials';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateSalinity, salinityPortionPoint, SALINITY_MODES, SALINITY_REFERENCE } from './textbook-salinity-model';

/** A sectioned enamel observation trough. Sources are alternative teaching
 * conditions, not a calibrated rig. Scientific coordinates stay unchanged. */
export function buildSalinityWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, back = -LIFT_MARGIN - 65 * s;
  // Logical ownership only: each physical part is a DIRECT b.root child so
  // the existing rigid formation controller can unfold it independently.
  const root = new T.Group(), owned: any[] = [], membership = new Map<any, any[]>();
  const point = (p: Vec3): Vec3 => [p[0] * s, p[1] * s, back + p[2] * s];
  const colors: Partial<Record<SolidMaterialRole, string>> = { brass: '#a88b50', steel: '#929b98', enamel: '#344841', ivory: '#e8e1cd', water: '#719da7' };
  const mesh = (geometry: any, material: SolidMaterialRole, name: string, parent = root) => {
    geometry.scale(s, s, s);
    const object = b.mesh(geometry, colors[material]!, false, true, material); object.position.z = back;
    owned.push(object); if (!membership.has(parent)) membership.set(parent, []); membership.get(parent)!.push(object);
    object.name = name; object.userData.salinityPart = name; return object;
  };
  const role = (object: any, name: string) => { object.userData.salinityRole = name; return object; };
  const plate = (a: Vec3, c: Vec3, material: SolidMaterialRole, name: string, parent = root, bevel = .16) => mesh(chamferedPlateGeometry(a, c, bevel), material, name, parent);
  const shaftGeo = (a: Vec3, c: Vec3, radius: number) => turnedShaftGeometry(a, c, [[radius, 0], [radius, 1]]);
  const shaft = (a: Vec3, c: Vec3, radius: number, material: SolidMaterialRole, name: string, parent = root) => mesh(shaftGeo(a, c, radius), material, name, parent);
  const tube = (points: Vec3[], radius: number, material: SolidMaterialRole, name: string, parent = root) => mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), Math.max(12, points.length * 8), radius, 8, false), material, name, parent);
  const input = (object: any, mode: number) => {
    object.userData.modelInput = { kind: 'replay', selection: mode, label: `从同一海水开始，观察${SALINITY_MODES[mode]}` };
    object.userData.salinityMode = mode; return object;
  };

  // One vessel: cast shell, ceramic lining and rolled open lip. The front
  // teaching section exposes water/salt instead of pretending glass is absent.
  role(plate([18.4, 1.6, 17.3], [88.6, 3, 60.7], 'enamel', 'cast-trough-floor'), 'basin');
  plate([19, 2.8, 18], [88, 3.12, 60], 'ivory', 'ceramic-inner-floor', root, .04);
  const shell: any[] = [], lining: any[] = [];
  for (const [a, c] of [
    [[18.4, 3, 17.3], [88.6, 27.4, 18.5]], [[18.4, 3, 18.5], [19.7, 27.4, 35.6]],
    [[18.4, 3, 44.4], [19.7, 27.4, 60.7]], [[18.4, 3, 35.6], [19.7, 22.6, 44.4]], [[87.3, 3, 18.5], [88.6, 27.4, 60.7]],
  ] as [Vec3, Vec3][]) shell.push(chamferedPlateGeometry(a, c, .16));
  for (const [a, c] of [
    [[19.6, 3.1, 18.44], [87.4, 27.05, 18.7]], [[19.5, 3.1, 18.6], [19.76, 27.05, 35.6]],
    [[19.5, 3.1, 44.4], [19.76, 27.05, 59.9]], [[19.5, 3.1, 35.6], [19.76, 22.6, 44.4]], [[87.24, 3.1, 18.6], [87.5, 27.05, 59.9]],
  ] as [Vec3, Vec3][]) lining.push(chamferedPlateGeometry(a, c, .035));
  mesh(mergeInstrumentGeometry(shell), 'enamel', 'three-sided-cast-shell');
  mesh(mergeInstrumentGeometry(lining), 'ivory', 'continuous-porcelain-lining');
  // The original river path crosses this exact side opening above the maximum
  // freshwater trial level. A removable plug closes it in the other trials.
  const riverPortPlug = plate([18.42, 22.62, 35.62], [19.68, 27.32, 44.38], 'enamel', 'removable-river-inlet-plug');
  mesh(mergeInstrumentGeometry([shaftGeo([19.79, 22.6, 35.6], [19.79, 22.6, 44.4], .17),
    shaftGeo([19.79, 22.6, 35.6], [19.79, 27.4, 35.6], .17), shaftGeo([19.79, 22.6, 44.4], [19.79, 27.4, 44.4], .17)]), 'brass', 'river-inlet-reinforcing-edge');
  tube([[19.05, 27.45, 60.2], [19.05, 27.45, 19], [20, 27.45, 18.05], [87, 27.45, 18.05], [87.95, 27.45, 19], [87.95, 27.45, 60.2]], .43, 'brass', 'continuous-rolled-open-rim');
  mesh(mergeInstrumentGeometry([shaftGeo([19.05, 3, 60.2], [19.05, 27.45, 60.2], .27), shaftGeo([87.95, 3, 60.2], [87.95, 27.45, 60.2], .27), shaftGeo([19.05, 3, 60.2], [87.95, 3, 60.2], .27)]), 'brass', 'front-cutaway-section-edges');
  const feet = [24, 83].flatMap(x => [23, 55].map(z => turnedShaftGeometry([x, -.4, z], [x, 1.7, z], [[1.8, 0], [1.8, .18], [1.15, .3], [1.15, .78], [1.6, .9], [1.6, 1]])));
  mesh(mergeInstrumentGeometry(feet), 'steel', 'four-trough-levelling-feet');
  mesh(mergeInstrumentGeometry([20.8, 86.2].map(x => turnedShaftGeometry([x, 27.4, 19.1], [x, 27.7, 19.1], [[.38, 0], [.42, .3], [.42, .8], [.36, 1]]))), 'steel', 'rear-rim-flush-fasteners');

  // Original dimensions, level and ripple, in the original model frame.
  const waterGeometry = new T.BoxGeometry(67.6, 1, 40, 32, 1, 12), rest = new Float32Array(waterGeometry.attributes.position.array);
  const water = role(mesh(waterGeometry, 'water', 'sea-water-volume'), 'sea-water'); water.position.set(...point([53.5, 3, 39]));
  mesh(mergeInstrumentGeometry(Array.from({ length: 18 }, (_, i) => shaftGeo([21 + i * 3.7, 17, 60.04], [22.6 + i * 3.7, 17, 60.04], .055))), 'steel', 'fixed-initial-waterline');
  // Fixed initial mark and a separate water-following float, without units.
  plate([89.1, 3.5, 59.6], [92.1, 26.4, 60.4], 'brass', 'water-level-scale-housing');
  plate([89.4, 3.8, 60.4], [91.85, 26.1, 60.56], 'ivory', 'unnumbered-water-level-scale', root, .03);
  const ticks: any[] = [];
  for (let i = 0; i <= 22; i++) ticks.push(shaftGeo([89.6, 4 + i, 60.62], [i % 5 ? 90.65 : 91.4, 4 + i, 60.62], i === 13 ? .075 : .035));
  mesh(mergeInstrumentGeometry(ticks), 'steel', 'qualitative-level-divisions');
  shaft([91.2, 3, 59.5], [88, 3, 58.3], .3, 'steel', 'scale-lower-mount');
  shaft([91.2, 25.2, 59.5], [88, 25.2, 58.3], .3, 'steel', 'scale-upper-mount');
  const follower = new T.Group(); follower.name = 'water-surface-follower';
  mesh(turnedShaftGeometry([84, -.65, 54], [84, .45, 54], [[1.7, 0], [2, .2], [2, .75], [1.65, 1]]), 'ivory', 'surface-float', follower);
  mesh(mergeInstrumentGeometry([shaftGeo([84, .55, 54], [84, 1, 61.2], .13), shaftGeo([84, 1, 61.2], [89.25, 1, 61.2], .13)]), 'steel', 'float-to-scale-link', follower);
  const pointer = new T.Shape(); pointer.moveTo(88.9, 0); pointer.lineTo(90.7, .6); pointer.lineTo(90.7, -.6); pointer.closePath();
  const pointerGeometry = new T.ExtrudeGeometry(pointer, { depth: .22, bevelEnabled: false }); pointerGeometry.translate(0, 0, 60.86);
  mesh(pointerGeometry, 'brass', 'water-surface-pointer', follower);

  const modules = [0, 1, 2].map(i => { const g = new T.Group(); g.name = `salinity-source-${i}`; return g; });
  // A mounted SUN SYMBOL, not a calibrated heater: energy is not solved here.
  const sunGeometry = new T.SphereGeometry(3.6, 36, 20); sunGeometry.scale(1, 1, .28); sunGeometry.translate(34, 53, 30);
  const sun = input(role(mesh(sunGeometry, 'brass', 'solar-energy-symbol', modules[0]), 'evaporation-source'), 0); sun.userData.symbolicEnergySource = true;
  shaft([28, 27.5, 18], [28, 53, 18], .43, 'steel', 'evaporation-symbol-standard', modules[0]);
  tube([[28, 53, 18], [28, 53, 25], [34, 53, 29]], .38, 'brass', 'sun-symbol-support-arm', modules[0]);
  const rays: any[] = [];
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rays.push(shaftGeo([34 + Math.cos(a) * 4.9, 53 + Math.sin(a) * 4.9, 30], [34 + Math.cos(a) * 6.1, 53 + Math.sin(a) * 6.1, 30], .13)); }
  input(mesh(mergeInstrumentGeometry(rays), 'brass', 'radial-solar-symbol', modules[0]), 0);
  mesh(turnedShaftGeometry([28, 25, 18], [28, 29, 18], [[1.2, 0], [1.4, .15], [.8, .32], [.8, .8], [1.15, 1]]), 'brass', 'rear-rim-energy-clamp', modules[0]);
  // Open rain outlets line up with all unchanged 6×3 paths, starting at y49.
  const rain = modules[1], pipes: any[] = [];
  for (const z of [34, 40, 46]) pipes.push(shaftGeo([34, 50.4, z], [71, 50.4, z], .46));
  pipes.push(shaftGeo([71, 50.4, 34], [71, 50.4, 46], .52));
  input(role(mesh(mergeInstrumentGeometry(pipes), 'steel', 'rain-distribution-header', rain), 'rain-source'), 1);
  const outlets: any[] = [];
  for (let row = 0; row < 3; row++) for (let lane = 0; lane < 6; lane++) {
    const nozzle = new T.LatheGeometry([[.22, 0], [.22, .9], [.42, .9], [.42, 0], [.22, 0]].map(([r, y]) => new T.Vector2(r, y)), 16);
    nozzle.translate(35 + lane * 7, 49.2, 34 + row * 6); outlets.push(nozzle);
  }
  input(mesh(mergeInstrumentGeometry(outlets), 'brass', 'eighteen-open-rain-outlets', rain), 1);
  for (const x of [35, 71]) {
    shaft([x, 27.4, 18], [x, 50.4, 18], .42, 'steel', 'rain-bridge-rear-post', rain);
    tube([[x, 50.4, 18], [x, 50.4, 27], [x, 50.4, 34]], .4, 'brass', 'rain-header-cantilever', rain);
    mesh(turnedShaftGeometry([x, 25, 18], [x, 29, 18], [[1.25, 0], [1.4, .2], [.8, .32], [.8, .8], [1.25, 1]]), 'brass', 'rain-bridge-rim-clamp', rain);
  }
  // An actual U-section runnel replaces the old giant green wedge. It ends
  // before the original free drop into the receiving sea-water.
  const river = modules[2], channel: Vec3[] = [[5, 34, 18], [8, 30.5, 25], [12, 27.3, 32], [18, 24.2, 38]];
  const curve = new T.CatmullRomCurve3(channel.map(p => new T.Vector3(...p))), verts: number[] = [];
  const tri = (a: any, c: any, d: any) => verts.push(...a.toArray(), ...c.toArray(), ...d.toArray());
  const section = (t: number, offset: number, h: number) => { const point = curve.getPoint(t), tangent = curve.getTangent(t); return point.addScaledVector(new T.Vector3(tangent.z, 0, -tangent.x).normalize(), offset).add(new T.Vector3(0, h, 0)); };
  const shape = [[-1.85, 1.25], [-1.85, -.65], [1.85, -.65], [1.85, 1.25], [1.42, 1.25], [1.42, -.2], [-1.42, -.2], [-1.42, 1.25]];
  for (let i = 0; i < 32; i++) for (let j = 0; j < shape.length; j++) {
    const k = (j + 1) % shape.length, a = section(i / 32, shape[j][0], shape[j][1]), c = section((i + 1) / 32, shape[j][0], shape[j][1]);
    const d = section((i + 1) / 32, shape[k][0], shape[k][1]), e = section(i / 32, shape[k][0], shape[k][1]); tri(a, c, d); tri(a, d, e);
  }
  const flumeGeometry = new T.BufferGeometry(); flumeGeometry.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); flumeGeometry.computeVertexNormals();
  const flume = input(role(mesh(flumeGeometry, 'ivory', 'open-u-section-river-flume', river), 'river'), 2); flume.userData.freshwaterInput = true;
  tube(channel.map(([x, y, z]) => [x, y + .14, z]), .52, 'water', 'freshwater-runnel', river);
  shaft([5, 1.7, 18], [5, 32.9, 18], .6, 'steel', 'runnel-upper-standard', river);
  shaft([16.4, 1.7, 35.8], [16.4, 24.4, 35.8], .6, 'steel', 'runnel-lower-standard', river);
  mesh(mergeInstrumentGeometry([shaftGeo([1, 1, 18], [9, 1, 18], .64), shaftGeo([13, 1, 36], [20, 1, 36], .64)]), 'enamel', 'runnel-cross-feet', river);
  plate([2.4, 33.1, 17.7], [7.7, 33.6, 19.4], 'brass', 'runnel-head-saddle', river);
  plate([14.3, 24.3, 35], [18.5, 24.8, 37.1], 'brass', 'runnel-receiving-saddle', river);

  // Only type uses a texture. Inscriptions sit on metal, not facing the camera.
  function inscription(text: string, at: Vec3, width: number, height: number, name: string) {
    const g = new T.PlaneGeometry(width, height); g.rotateX(-Math.PI / 2); g.translate(...at);
    const object = mesh(g, 'brass', name); object.userData.text = text;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 160;
      const c = canvas.getContext('2d')!; c.fillStyle = colors.brass!; c.fillRect(0, 0, 640, 160);
      c.fillStyle = '#29332d'; c.font = "500 85px FieldSans, 'Microsoft YaHei', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 320, 83, 610);
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
      const material = createSolidMaterial(b.pop, 'brass', '#ffffff'); material.map = texture; object.material = material;
      g.addEventListener('dispose', () => { texture.dispose(); material.dispose(); });
    }
    return object;
  }
  // Three low native selectors are embedded in the vessel's rear lip.
  const sourceLabels = SALINITY_MODES.map((text, mode) => {
    const x = 37 + mode * 19;
    plate([x - 8.2, 27.35, 18.7], [x + 8.2, 28.1, 24.6], 'brass', 'source-selector-inset', root, .14);
    const label = input(role(inscription(text.slice(0, 2), [x, 28.13, 22.35], 12, 3.4, 'fixed-condition-inscription'), 'source-label'), mode);
    const knob = input(mesh(turnedShaftGeometry([x, 28.25, 19.8], [x, 28.9, 19.8], [[.78, 0], [.82, .15], [1.05, .28], [1.05, .74], [.9, 1]]), 'brass', 'native-condition-stud'), mode);
    return { label, knob };
  });
  // All original 24 positions are retained; gold points mean DISSOLVED salt.
  const saltBase = new T.IcosahedronGeometry(.50, 1), saltTemplate = new Float32Array(saltBase.attributes.position.array);
  const saltGeometry = new T.BufferGeometry(), saltPositions = new T.Float32BufferAttribute(new Float32Array(saltTemplate.length * SALINITY_REFERENCE.saltMarks), 3);
  saltGeometry.setAttribute('position', saltPositions); saltBase.dispose();
  const salt = role(mesh(saltGeometry, 'brass', 'fixed-dissolved-salt-symbols'), 'dissolved-salt-marks'); salt.userData.symbolCount = SALINITY_REFERENCE.saltMarks;
  const dropBase = new T.IcosahedronGeometry(1, 1), dropTemplate = new Float32Array(dropBase.attributes.position.array);
  const dropGeometry = new T.BufferGeometry(), dropPositions = new T.Float32BufferAttribute(new Float32Array(dropTemplate.length * SALINITY_REFERENCE.portionCount), 3);
  dropGeometry.setAttribute('position', dropPositions); dropBase.dispose();
  role(mesh(dropGeometry, 'water', 'finite-water-transfer-symbols'), 'finite-water-portions');
  // Original XY phase rail; separate from the actual level follower/scale.
  const track = { start: point([96, 51, 61]), end: point([96, 6, 61]) };
  shaft([96, 6, 61], [96, 51, 61], .24, 'steel', 'timeline-guide-rail');
  for (const y of [6, 27.2]) {
    shaft([88, y, 60], [96, y, 61], .3, 'brass', 'timeline-rail-bracket');
    mesh(turnedShaftGeometry([96, y - .75, 61], [96, y + .75, 61], [[.65, 0], [.65, .25], [.4, .4], [.4, .6], [.65, .75], [.65, 1]]), 'brass', 'timeline-guide-bush');
  }
  const handleGeometry = new T.SphereGeometry(1.75, 24, 16); handleGeometry.scale(.83, 1.25, .62);
  const handle = role(mesh(handleGeometry, 'water', 'timeline-water-drop-handle'), 'water-handle');
  handle.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动水滴，回看水量与盐度变化' };
  plate([21, 2.3, 60.9], [86, 3.15, 66], 'enamel', 'integral-front-observation-lip');
  plate([24, 3.13, 61.6], [44, 3.4, 65.4], 'brass', 'salt-inventory-inscription-seat', root, .06);
  const saltTag = role(inscription('盐量不变', [34, 3.43, 63.5], 18, 3.1, 'fixed-salt-inscription'), 'salt-label');
  plate([61, 3.13, 61.6], [82, 3.4, 65.4], 'brass', 'concentration-inscription-seat', root, .06);
  const tendencies = ['未变', '升高', '降低'].map(text => role(inscription(`盐度${text}`, [71.5, 3.43, 63.5], 19, 3.1, `concentration-${text}`), 'concentration-label'));

  let state = evaluateSalinity(0), oldPhase = -1, oldMode = -1;
  const buffers = owned.map(object => object.geometry.attributes.position.array);
  return {
    update(phase, selection) {
      if (phase !== oldPhase || selection !== oldMode) {
        state = evaluateSalinity(phase, selection); oldPhase = phase; oldMode = selection;
        const a = waterGeometry.attributes.position, level = state.waterLevel;
        for (let i = 0; i < a.count; i++) {
          const x = rest[i * 3], upper = rest[i * 3 + 1] > 0, ripple = upper && state.stage === 'transferring' ? .11 * Math.sin(x * .27 + phase * 19) : 0;
          a.setXYZ(i, x * s, (upper ? level + ripple : 0) * s, rest[i * 3 + 2] * s);
        }
        a.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingSphere();
        Object.assign(water.userData, { waterAmount: state.water, waterLevel: state.waterLevel, concentration: state.concentration, saltMass: state.salt });
        for (let i = 0; i < SALINITY_REFERENCE.saltMarks; i++) {
          const at = [26 + i % 6 * 10.6, 3.4 + level * (.13 + Math.floor(i / 6) * .21), 59.25];
          for (let j = 0; j < saltTemplate.length / 3; j++) saltPositions.setXYZ(i * saltTemplate.length / 3 + j, (at[0] + saltTemplate[j * 3]) * s, (at[1] + saltTemplate[j * 3 + 1]) * s, (at[2] + saltTemplate[j * 3 + 2] * .45) * s);
        }
        saltPositions.needsUpdate = true; saltGeometry.computeVertexNormals(); saltGeometry.computeBoundingSphere();
        for (const portion of state.portions) {
          const at = salinityPortionPoint(state, portion.id), radius = Math.min(1, portion.inTransit * 3) * .58;
          for (let j = 0; j < dropTemplate.length / 3; j++) dropPositions.setXYZ(portion.id * dropTemplate.length / 3 + j, (at[0] + dropTemplate[j * 3] * radius) * s, (at[1] + dropTemplate[j * 3 + 1] * radius * (state.mode === 0 ? 1.15 : 1.7)) * s, (at[2] + dropTemplate[j * 3 + 2] * radius) * s);
        }
        dropPositions.needsUpdate = true; dropGeometry.computeVertexNormals(); dropGeometry.computeBoundingSphere();
      }
      modules.forEach((module, i) => { membership.get(module)?.forEach(object => { object.visible = i === state.mode; }); });
      riverPortPlug.visible = state.mode !== 2;
      sourceLabels.forEach(({ knob }, i) => { knob.position.y = i === state.mode ? -.22 * s : 0; });
      tendencies.forEach((tag, i) => { tag.visible = i === (state.tendency === '升高' ? 1 : state.tendency === '降低' ? 2 : 0); });
      follower.position.y = 3 + state.waterLevel;
      membership.get(follower)?.forEach(object => { object.position.y = follower.position.y * s; });
      handle.position.set(...phaseTrackPoint(state.phase, track)); saltTag.visible = true;
    },
    // Fit the active alternative, not the union of the high sun/rain source
    // AND the inactive river inlet. Keep every phase's transfer route and the
    // complete native time rail in this fixed envelope: seeking must not zoom.
    focusBounds: () => ({ min: point([state.mode === 2 ? .35 : 17.8, -.4, 16.0]),
      max: point([97.8, state.mode === 0 ? 59.3 : 53.3, 66.1]) }),
    describe: () => ({ kind: 'salinity-balance', mode: state.mode, phase: state.phase, stage: state.stage,
      waterAmount: state.water, initialWaterAmount: SALINITY_REFERENCE.initialWater, saltMass: state.salt,
      saltAmount: 'constant-symbolic', grainCount: SALINITY_REFERENCE.saltMarks, saltMarksDissolved: true,
      concentration: state.concentration, relativeConcentration: state.relativeConcentration, direction: state.tendency,
      inventory: { basin: state.water, source: state.source, inTransit: state.inTransit, removed: state.removed, total: state.totalWater, expected: state.expectedTotalWater },
      sameInitialConditions: true, finiteWaterPortions: SALINITY_REFERENCE.portionCount, sharedFlatState: true, units: state.units, measuredSalinity: false,
      observationTrough: { rolledOpenRim: true, frontSectionIsTeachingCutaway: true, noGlassTrick: true,
        fixedInitialWaterline: 17, followerHeight: follower.position.y, waterSurfaceHeight: 3 + state.waterLevel,
        scaleIsCalibrated: false, energySourceIsSymbolic: true, inputModulesAreAlternatives: true, pathCoordinatesUnchanged: true,
        sourceModule: state.mode, riverPortOpen: !riverPortPlug.visible, riverPortSill: 22.6,
        nativeTimelineTrack: track, sourceSelections: sourceLabels.map(({ label }) => label.userData.modelInput.selection),
        directRigidParts: owned.filter(object => object.parent === b.root || object.parent?.name?.includes('rigid')).length,
        fixedMeshCount: owned.every(object => b.meshes.includes(object)),
        buffersStable: owned.every((object, i) => object.geometry.attributes.position.array === buffers[i]) } }),
  };
}
