import { THREE as T } from './reference/engine.js';
import { type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountFieldInstrument, orreryDimensions } from './textbook-field-instruments';
import { evaluateSolarSystem, ORBIT_RADII, ORBIT_TURNS, PLANET_NAMES, PLANET_RADII, SOLAR_REFERENCE } from './textbook-astronomy-model';
import { phaseDialPoint, type PhaseDial, type IndexedDial } from './textbook-model-input';
import mechanism from './assets/orrery-mechanism.json';
import { inspectionTargets } from './textbook-inspection';

/** One crank turn drives eight independently sleeved outputs. The speeds are
 * chosen for the teaching instrument. Planet positions come from the same
 * schematic circular orbits used in the planar diagram. */
export function buildOrreryWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 110;
  const origin = b.p(.49, .62, 0);
  const point = (x: number, y: number, z: number): Vec3 =>
    [origin[0] + x * scale, origin[1] + y * scale, origin[2] + z * scale];
  const mount = new T.Group();
  mount.position.set(...origin);
  mount.scale.setScalar(scale);
  mount.name = 'eight-planet-orrery';
  b.root.add(mount);
  const parts = mountFieldInstrument(b, 'solar', 1, [0, 0, 0]);
  const dims = orreryDimensions();
  const { shaftSpacing, globeHeight, crank, gripRadius, armHeights, teeth } = dims;
  const subassembly = (name: string, pivot: Vec3 = [0, 0, 0]) => {
    const body = new T.Group();
    body.name = name;
    mount.add(body);
    body.position.set(...pivot);
    for (const mesh of parts.get(name)!) {
      mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
      body.add(mesh);
      mesh.name = 'orrery-' + name;
      mesh.userData.orreryPart = name;
    }
    return body;
  };
  subassembly('frame');
  const bezel = subassembly('bezel');
  const sun = subassembly('sun');
  for (const mesh of sun.children) mesh.userData.modelInput = { kind: 'select', selection: 0, label: '查看整个太阳系' };
  const sunLabel = b.label('太阳', point(0, globeHeight + 9, 0), 12.8 * scale, 6 * scale);
  sunLabel.castShadow = sunLabel.userData.castShadow = false;
  const driverAxis: Vec3 = [shaftSpacing, 0, 0];
  const driver = subassembly('driver', driverAxis);
  const crankAxis: Vec3 = [crank[0], crank[1], crank[2]];
  const handwheel = subassembly('wheel', crankAxis), grip = subassembly('grip', crankAxis);
  const dial: PhaseDial = { center: point(crank[0], crank[1], crank[2] + 2.12), radiusX: gripRadius * scale, radiusY: gripRadius * scale };
  for (const mesh of [...handwheel.children, ...grip.children]) {
    mesh.userData.modelInput = { kind: 'phase-dial', dial, label: '拖动木柄，带动八颗行星公转' };
    mesh.userData.orreryNativeDial = true;
  }
  grip.children[0].userData.orreryPart = 'handwheel-grip';
  subassembly('stand');
  const face = subassembly('dialFace');
  const indexed = (spec: typeof mechanism.selector, stops: IndexedDial['stops'], label: string, toggleOnTap = false): IndexedDial => {
    const [x, y, z] = spec.center;
    return { kind: 'indexed-dial', dial: { center: point(x, y, z), radiusX: spec.radius * scale, radiusY: spec.radius * scale },
      start: spec.startDegrees * Math.PI / 180, step: spec.stepDegrees * Math.PI / 180, stops, toggleOnTap, label };
  };
  const selector = indexed(mechanism.selector, [0, ...PLANET_NAMES.map((_, i) => i + 1)].map(selection => ({ selection })), '拨动蓝钢指针选星，零位看整体');
  const leverInput = indexed(mechanism.lever, [{ inspection: 'overview' }, { inspection: 'train' }], '扳动红柄，开合轮系剖视', true);
  const pointer = subassembly('dialPointer', mechanism.selector.center as Vec3);
  const lever = subassembly('leverArm', mechanism.lever.center as Vec3);
  for (const mesh of [...face.children, ...pointer.children]) {
    mesh.userData.modelInput = selector;
    mesh.userData.interactionFeedback = false;
  }
  for (const mesh of lever.children) {
    mesh.userData.modelInput = leverInput;
    mesh.userData.interactionFeedback = false;
  }
  const planets = PLANET_NAMES.map((name, i) => {
    const input = subassembly('input' + i, driverAxis);
    const output = subassembly('pinion' + i);
    const arm = subassembly('arm' + i);
    const globe = subassembly('globe' + i);
    const hoop = subassembly('orbit' + i);
    const label = b.label(name, point(0, 0, 0), Math.max(13, name.length * 6) * scale, 6 * scale);
    const select = { kind: 'select', selection: i + 1, toggleTo: 0, label: '查看' + name + '的公转轨道' };
    for (const mesh of [...globe.children, ...hoop.children, label]) mesh.userData.modelInput = select;
    for (const mesh of globe.children) {
      mesh.userData.planetIndex = i;
      mesh.userData.smallPointTarget = true;
    }
    const pair = teeth[i];
    const caption = name + '轮副  ' + pair[0] + ' / ' + pair[1] + ' 齿';
    const ratioLabel = b.label(caption, point(-25, 25, 9), 32 * scale, 5.4 * scale);
    ratioLabel.visible = false;
    for (const slip of [label, ratioLabel]) slip.castShadow = slip.userData.castShadow = false;
    return { input, output, arm, globe, hoop, label, ratioLabel };
  });
  let state = evaluateSolarSystem(0), selected = 0, inspection = 'overview';
  const fullBounds = () => ({ min: point(-53.6, -.05, -54), max: point(53.6, 57, 53.2) });
  // The void above the rim and beneath its far edge is prominent. Fit the
  // actual tier silhouettes instead of the empty corners of a cuboid.
  const hull: Vec3[] = [];
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    for (const [r, height] of [[53, 36.8], [51, 48], [26, 0]]) {
      hull.push(point(Math.cos(a)*r, height, Math.sin(a)*r));
    }
  }
  for (const a of [90, 212, 328]) {
    hull.push(point(Math.cos(a*Math.PI/180)*52, 0, -Math.sin(a*Math.PI/180)*52));
  }
  hull.push(point(0, 60, 0), point(-21, 0, 46), point(12, 0, 46));
  return {
    framingPoints: () => inspection === 'overview' ? hull : null,
    update(phase, selection) {
      state = evaluateSolarSystem(phase);
      selected = Math.max(0, Math.min(8, Number.isFinite(selection) ? Math.round(selection) : 0));
      const stage = selected ? selected - 1 : 2, cutaway = inspection === 'train';
      pointer.rotation.z = selector.start + selected * selector.step;
      lever.rotation.z = leverInput.start + (cutaway ? leverInput.step : 0);
      const rotation = Math.PI * 2 * state.phase;
      handwheel.rotation.z = grip.rotation.z = rotation - Math.PI / 2;
      driver.rotation.y = -rotation;
      sunLabel.visible = !cutaway;
      sun.visible = !cutaway;
      bezel.visible = !cutaway;
      planets.forEach((planet, i) => {
        const { point: [x, , z], angle } = state.bodies[i];
        planet.input.rotation.y = -rotation;
        planet.output.rotation.y = rotation * ORBIT_TURNS[i];
        planet.arm.rotation.y = planet.globe.rotation.y = -angle;
        planet.input.visible = planet.output.visible = planet.arm.visible = !cutaway || i === stage;
        planet.globe.visible = !cutaway || i === stage;
        planet.hoop.visible = !cutaway;
        planet.ratioLabel.visible = cutaway && i === stage;
        planet.label.visible = !cutaway && i === stage;
        if (planet.label.visible) {
          planet.label.position.set(...point(x, globeHeight + PLANET_RADII[i] + 4.8, z));
          const projected = planet.label.position.clone().sub(sunLabel.position).applyQuaternion(sunLabel.quaternion.clone().invert());
          if (Math.abs(projected.x) < 14 * scale && projected.y < 6.6 * scale && projected.y > -17 * scale) {
            const right = new T.Vector3(1, 0, 0).applyQuaternion(sunLabel.quaternion);
            const side = projected.x >= 0 ? 1 : -1;
            planet.label.position.addScaledVector(right, side * 19 * scale - projected.x);
            const up = new T.Vector3(0, 1, 0).applyQuaternion(sunLabel.quaternion);
            planet.label.position.addScaledVector(up, 2.0 * scale - projected.y);
          }
        }
        if (planet.label.visible) {
          const labelFoot = planet.label.position.clone().addScaledVector(new T.Vector3(0, 1, 0).applyQuaternion(sunLabel.quaternion), -2.9 * scale);
          b.contour([point(x, globeHeight + PLANET_RADII[i], z), labelFoot.toArray() as Vec3], .9);
        }
        if (!cutaway && selected - 1 === i) {
          b.contour(Array.from({ length: 145 }, (_, k) => {
            const a = Math.PI * 2 * k / 144;
            return point(Math.cos(a) * ORBIT_RADII[i], armHeights[i] + .14, Math.sin(a) * ORBIT_RADII[i]);
          }), .6);
        }
      });
    },
    inspect(target) { inspection = target === 'train' ? target : 'overview'; },
    inspectTargets: () => [...inspectionTargets('orbit', selected)],
    overviewBounds: fullBounds,
    focusBounds: () => {
      if (inspection !== 'train') return fullBounds();
      const i = selected ? selected - 1 : 2;
      const reach = ORBIT_RADII[i] + PLANET_RADII[i] * (i === 5 ? 2 : 1);
      return { min: point(-Math.max(37, reach), -.05, -Math.max(19, reach)),
        max: point(Math.max(40, reach), 47, Math.max(48, reach)) };
    },
    describe: () => ({
      kind: 'solar-system', bodies: 8, units: 'schematic', orbitalPlane: '3d', turnsPerCycle: ORBIT_TURNS,
      source: SOLAR_REFERENCE, inspection, selected, selectedName: selected ? PLANET_NAMES[selected - 1] : null,
      gearTeeth: teeth, crankAngle: handwheel.rotation.z, driverAngle: driver.rotation.y,
      outputAngles: planets.map(p => p.output.rotation.y), directPlanetSelection: true,
      realOrbitalPeriodRatio: false, cycleBoundaryContinuous: true, instrumentMechanismIsAstronomicalCause: false,
      construction: 'eight-paired-gears-and-concentric-output-sleeves',
      selectorAngle: pointer.rotation.z, leverAngle: lever.rotation.z,
      phaseDial: dial, phaseDialPoint: phaseDialPoint(state.phase, dial),
      planetPositions: state.bodies.map((body, i) => ({
        name: body.name, local: body.point,
        supportEndpoint: planets[i].arm.localToWorld(new T.Vector3(body.radius, armHeights[i], 0)).toArray(),
        stalkBottom: mount.localToWorld(new T.Vector3(body.point[0], armHeights[i], body.point[2])).toArray(),
      })),
      orbitReferences: planets.length, scientificStateUnchanged: true,
    }),
  };
}
