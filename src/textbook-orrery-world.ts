import { THREE as T } from './reference/engine.js';
import { type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { createInstrumentParts, chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { evaluateSolarSystem, ORBIT_RADII, ORBIT_TURNS, PLANET_NAMES, PLANET_RADII, SOLAR_REFERENCE } from './textbook-astronomy-model';
import { phaseDialPoint, type PhaseDial } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';

const FINISH = { brass: '#b99a60', steel: '#a1aaa5', enamel: '#30483e', wood: '#634735', ivory: '#e2d5b4' };
const BODY_COLORS = ['#aaa193', '#c2a56b', '#8bb1b7', '#b67959', '#c3ae8b', '#c9b88c', '#91bab9', '#779eb9'];

/** The instrument is a physical carrier of the existing schematic positions.
 * Bearings and moving supports explain the *model's* assembly, not gravity.
 * No mechanism is presented as the cause of planetary motion. */
export function buildOrreryWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, c = b.p(.49, .74, 24 * s);
  const root = new T.Group(); root.name = 'eight-planet-orrery'; root.position.set(...c); root.scale.setScalar(s); b.root.add(root);
  const part = (g: any, role: SolidMaterialRole, name: string, parent = root, color?: string) => {
    const m = b.mesh(g, color ?? FINISH[role as keyof typeof FINISH], false, true, role);
    parent.add(m); m.name = name; m.userData.orreryPart = name; return m;
  };
  const shaft = (a: Vec3, z: Vec3, r: number, role: SolidMaterialRole, name: string, parent = root) =>
    part(turnedShaftGeometry(a, z, [[r, 0], [r, 1]]), role, name, parent);
  const plate = (a: Vec3, z: Vec3, role: SolidMaterialRole, name: string, parent = root) =>
    part(chamferedPlateGeometry(a, z, .16), role, name, parent);
  const ring = (radius: number, tube: number, y: number, role: SolidMaterialRole, name: string, parent = root, ellipse = 1) => {
    const g = new T.TorusGeometry(radius, tube, 8, radius > 20 ? 160 : 64); g.rotateX(Math.PI / 2); g.scale(1, 1, ellipse); g.translate(0, y, 0);
    return part(g, role, name, parent);
  };
  const band = (radius: number, halfWidth: number, y: number, depth: number, name: string) => {
    const profile = [
      new T.Vector2(radius - halfWidth, -depth / 2),
      new T.Vector2(radius + halfWidth, -depth / 2),
      new T.Vector2(radius + halfWidth, depth / 2),
      new T.Vector2(radius - halfWidth, depth / 2),
      new T.Vector2(radius - halfWidth, -depth / 2),
    ];
    const geometry = new T.LatheGeometry(profile, 160);
    geometry.scale(1, 1, .58); geometry.translate(0, y, 0);
    return part(geometry, 'brass', name);
  };
  const hardware = createInstrumentParts(b, root);
  // Three swept feet meet the central casting. There is no oversized
  // rectangular presentation plinth competing with the open orbital plane.
  const feet: any[] = [], edges: any[] = [], footPoints: Vec3[] = [];
  for (const angle of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 3 / 2]) {
    const x = Math.cos(angle) * 47, z = Math.sin(angle) * 47 * .58;
    footPoints.push([x, -18, z]);
    const path = new T.CatmullRomCurve3([[0, -15, 0], [x * .22, -17, z * .22], [x * .72, -18.6, z * .72], [x, -19, z]].map(p => new T.Vector3(...p)));
    feet.push(new T.TubeGeometry(path, 24, 1.05, 8, false));
    edges.push(turnedShaftGeometry([x, -24, z], [x, -19, z], [[2.9, 0], [3.1, .12], [3.1, .3], [2.4, .64], [2.2, 1]]));
    // The thin outer reference hoop and its internal spokes meet this fork.
    shaft([x, -18.8, z], [x, -4.45, z], .52, 'steel', 'hoop-support-upright');
    shaft([x, -6.2, z], [x, -3.8, z], .9, 'brass', 'hoop-support-collar');
  }
  part(mergeInstrumentGeometry(feet), 'enamel', 'three-swept-cast-feet');
  part(mergeInstrumentGeometry(edges), 'wood', 'three-small-levelling-pads');
  part(turnedShaftGeometry([0, -21, 0], [0, -16.1, 0], [[5.9, 0], [6.2, .1], [6.2, .22], [4.3, .4], [3.4, .83], [3.4, 1]]), 'enamel', 'central-cast-pedestal');
  part(turnedShaftGeometry([0, -21.3, 0], [0, -19.8, 0], [[5.9, 0], [6.2, .22], [6.2, .76], [5.9, 1]]), 'brass', 'pedestal-foot-rebate');
  hardware.fasteners(footPoints.map(([x, y, z]) => [x, y - 1, z]), [0, 1, 0], .5);
  shaft([0, -18, 0], [0, -3.6, 0], 1.05, 'steel', 'shared-centre-spindle');
  shaft([0, -16.7, 0], [0, -15.6, 0], 3.45, 'brass', 'lower-spindle-bearing-seat');
  shaft([0, -6.6, 0], [0, -5.5, 0], 2.85, 'brass', 'upper-spindle-bearing-seat');
  // Quiet radial braces support the engraved orbital references. These are
  // below all planets; they never look like eight extra trajectories.
  const braces = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2].map(a =>
    turnedShaftGeometry([Math.cos(a) * 2.8, -4.65, Math.sin(a) * 2.8 * .58],
      [Math.cos(a) * 47, -4.65, Math.sin(a) * 47 * .58], [[.23, 0], [.23, 1]]));
  part(mergeInstrumentGeometry(braces), 'steel', 'orbital-reference-spokes');
  band(47, .43, -4.3, .42, 'continuous-outer-reference-rim');
  const orbitRings = ORBIT_RADII.map((r, i) => {
    const hoop = ring(r, i === 2 ? .22 : .16, -4.3, i === 2 ? 'steel' : 'brass', 'fixed-elliptic-orbit-reference', root, .58);
    hoop.userData.orbitIndex = i; hoop.userData.orbitRadius = r; hoop.userData.referenceOnly = true;
    hoop.userData.modelInput = { kind: 'select', selection: i + 1, toggleTo: 0, label: `查看${PLANET_NAMES[i]}轨道；再次选择回到整体` };
    return hoop;
  });
  // Sparse quarter divisions, not degrees of a measured ephemeris.
  const divisions: any[] = [];
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, r = i % 4 ? 47.6 : 48.5;
    divisions.push(turnedShaftGeometry([Math.cos(a) * 47.2, -4.2, Math.sin(a) * 47.2 * .58],
      [Math.cos(a) * r, -4.2, Math.sin(a) * r * .58], [[.06, 0], [.06, 1]]));
  }
  part(mergeInstrumentGeometry(divisions), 'steel', 'unnumbered-outer-divisions');

  const body = (index: number) => {
    const r = index < 0 ? 4.2 : PLANET_RADII[index];
    const g = new T.SphereGeometry(r, index < 0 ? 48 : 32, index < 0 ? 32 : 24);
    const a = g.attributes.position, colors: number[] = [], base = new T.Color(index < 0 ? '#d7b76f' : BODY_COLORS[index]);
    for (let j = 0; j < a.count; j++) {
      const x = a.getX(j) / r, y = a.getY(j) / r, z = a.getZ(j) / r;
      const longitude = Math.atan2(z, x), latitude = Math.asin(Math.max(-1, Math.min(1, y)));
      const cloud = Math.sin(longitude * 7 + Math.sin(latitude * 5)) * Math.cos(latitude * 13 + longitude * 2);
      const color = base.clone();
      if (index === 2) {
        // Broad, deliberately unlabelled land/ocean regions, not a map or a
        // geography dataset. Only the body identity matters in this figure.
        const continent = Math.sin(longitude * 2.7 + .7) + Math.cos(latitude * 4.4 - .4) * .78 + cloud * .2;
        if (continent > .52 && Math.abs(latitude) < 1.23) color.set('#708a69').multiplyScalar(.97 + .07 * cloud);
        else color.multiplyScalar(.95 + .045 * cloud);
        if (Math.abs(latitude) > 1.27) color.set('#e0e4d3');
      } else if (index === 4 || index === 5) {
        const bands = Math.sin(latitude * (index === 4 ? 21 : 15) + Math.sin(longitude * 3) * .24);
        color.multiplyScalar(.94 + .1 * bands + .035 * cloud);
      } else color.multiplyScalar(.97 + (index < 0 ? .045 : .065) * cloud);
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    const mesh = part(g, 'enamel', index < 0 ? 'sun-globe' : 'planet-globe', root, index < 0 ? '#d7b76f' : BODY_COLORS[index]);
    mesh.material.color.set('#ffffff'); mesh.material.vertexColors = true;
    mesh.material.roughness = index < 0 ? .36 : .48; mesh.material.metalness = index < 0 ? .16 : .025;
    mesh.userData.body = index < 0 ? 'sun' : PLANET_NAMES[index];
    return mesh;
  };
  const sun = body(-1); sun.userData.modelInput = { kind: 'select', selection: 0, label: '查看整个太阳系' };
  shaft([0, -6.4, 0], [0, -4.1, 0], 1.55, 'brass', 'solar-globe-socket');
  // A narrow latitudinal reference sits on the Sun rather than a wire cage.
  ring(4.23, .035, 0, 'brass', 'solar-equatorial-line');
  const sunLabel = b.label('太阳', [c[0], c[1] + 8 * s, c[2]], 11.5 * s, 5.2 * s);
  const planets = PLANET_NAMES.map((name, i) => {
    const y = -15 + i * .98;
    const pivot = new T.Group(); pivot.name = `orrery-arm-${i}`; root.add(pivot);
    part(turnedShaftGeometry([0, y - .32, 0], [0, y + .32, 0], [[2.4, 0], [2.55, .15], [2.55, .85], [2.4, 1]]), 'brass', 'independent-spindle-bearing', pivot);
    shaft([0, y + .33, 0], [0, y + .49, 0], 2.35, 'enamel', 'bearing-stack-separator', pivot);
    const arm = shaft([0, 0, 0], [1, 0, 0], .33, 'steel', 'telescoping-orbit-arm', pivot);
    arm.position.y = y;
    const cuff = part(turnedShaftGeometry([0, 0, 0], [2.1, 0, 0], [[.51, 0], [.55, .2], [.55, .8], [.51, 1]]), 'brass', 'arm-slide-sleeve', pivot);
    cuff.position.y = y;
    const mount = new T.Group(); mount.name = `orrery-planet-mount-${i}`; root.add(mount);
    const socketY = -PLANET_RADII[i] - .08;
    shaft([0, y, 0], [0, socketY, 0], .18, 'steel', 'planet-support-stalk', mount);
    shaft([0, -4.82, 0], [0, -3.82, 0], .43, 'brass', 'orbital-guide-collar', mount);
    part(turnedShaftGeometry([0, socketY - .9, 0], [0, socketY, 0], [[.37, 0], [.48, .18], [.48, .62], [.29, 1]]), 'brass', 'globe-socket-collar', mount);
    const globe = body(i); mount.add(globe);
    globe.userData.planetIndex = i; globe.userData.smallPointTarget = true;
    globe.userData.modelInput = { kind: 'select', selection: i + 1, toggleTo: 0, label: `查看${name}；再次选择回到整体` };
    const label = b.label(name, [0, 0, 0], Math.max(11, name.length * 5.4) * s, 5.2 * s);
    label.userData.modelInput = globe.userData.modelInput;
    if (i === 5) {
      const rg = new T.RingGeometry(PLANET_RADII[i] * 1.26, PLANET_RADII[i] * 1.88, 80, 1);
      rg.rotateX(-Math.PI / 2 + .32);
      const rr = part(rg, 'ivory', 'saturn-physical-ring', mount); rr.userData.castShadow = false;
    }
    return { globe, pivot, arm, cuff, mount, label, y, name, radius: PLANET_RADII[i] };
  });
  // Reader-facing handwheel is directly draggable. All eight planets and
  // the carriage supports are recomputed from the same deterministic phase.
  const dialAt: Vec3 = [0, -15, 34.5], dialRadius = 4.6;
  shaft([0, -15, 0], [0, -15, 34], .42, 'steel', 'handwheel-spindle');
  part(turnedShaftGeometry([0, -15, 30.7], [0, -15, 33.8], [[2.9, 0], [3.1, .12], [3.1, .77], [2.5, 1]]), 'enamel', 'handwheel-bearing-housing');
  // The front bearing is cantilevered from the casting rather than floating
  // on the input shaft. Its underside stays clear of the printed page.
  const controlBrace = new T.CatmullRomCurve3([
    new T.Vector3(0, -19, 0), new T.Vector3(0, -20.2, 11),
    new T.Vector3(0, -19.2, 24), new T.Vector3(0, -17.3, 32),
  ]);
  part(new T.TubeGeometry(controlBrace, 24, .8, 8, false), 'enamel', 'handwheel-bearing-cantilever');
  const wheel = new T.Group(); wheel.name = 'orrery-phase-handwheel'; wheel.position.set(...dialAt); root.add(wheel);
  const wheelRim = new T.TorusGeometry(dialRadius, .32, 8, 64);
  const rim = part(wheelRim, 'brass', 'phase-handwheel-rim', wheel);
  const spokes = [0, Math.PI * 2 / 3, Math.PI * 4 / 3].map(a =>
    turnedShaftGeometry([0, 0, 0], [Math.cos(a) * dialRadius, Math.sin(a) * dialRadius, 0], [[.18, 0], [.18, 1]]));
  part(mergeInstrumentGeometry(spokes), 'steel', 'handwheel-three-spokes', wheel);
  part(turnedShaftGeometry([0, 0, -.4], [0, 0, .6], [[.9, 0], [1.1, .2], [1.1, .8], [.9, 1]]), 'brass', 'handwheel-axial-hub', wheel);
  const knob = part(turnedShaftGeometry([dialRadius, 0, .2], [dialRadius, 0, 2], [[.45, 0], [.55, .3], [.55, .8], [.4, 1]]), 'wood', 'handwheel-grip', wheel);
  const dial: PhaseDial = { center: [c[0], c[1] + dialAt[1] * s, c[2] + (dialAt[2] + 1.4) * s], radiusX: dialRadius * s, radiusY: dialRadius * s };
  for (const m of [rim, knob, ...wheel.children]) {
    m.userData.modelInput = { kind: 'phase-dial', dial, label: '拖动手轮回看公转；八颗行星与支臂同时响应' };
    m.userData.orreryNativeDial = true;
  }
  let selected = 0, state = evaluateSolarSystem(0);
  return {
    update(phase, selection) {
      selected = Math.max(0, Math.min(8, Math.round(Number.isFinite(selection) ? selection : 0)));
      state = evaluateSolarSystem(phase);
      planets.forEach((planet, i) => {
        const [x, , z] = state.bodies[i].point, length = Math.hypot(x, z), angle = Math.atan2(z, x);
        planet.mount.position.set(x, 0, z); planet.pivot.rotation.y = -angle;
        planet.arm.scale.x = length; planet.cuff.position.x = Math.max(2.8, length * .58);
        planet.label.visible = selected ? selected - 1 === i : i === 2;
        if (planet.label.visible) {
          const q: Vec3 = [c[0] + x * s, c[1] + (planet.radius + 4.1) * s, c[2] + z * s];
          planet.label.position.set(...q);
          const projected = planet.label.position.clone().sub(sunLabel.position).applyQuaternion(sunLabel.quaternion.clone().invert());
          // Protect both the Sun's slip AND its globe below the slip. A label
          // on an approaching foreground planet must not hide the Sun.
          if (Math.abs(projected.x) < 13 * s && projected.y < 6.2 * s && projected.y > -16 * s) {
            const up = new T.Vector3(0, 1, 0).applyQuaternion(sunLabel.quaternion);
            planet.label.position.addScaledVector(up, 6.2 * s - projected.y);
          }
        }
        // Selection accents only one existing track. No second full-screen
        // set of orbit lines or floating labels is introduced.
        if (selected - 1 === i) b.contour(Array.from({ length: 129 }, (_, j): Vec3 => {
          const a = j / 128 * Math.PI * 2; return [c[0] + Math.cos(a) * ORBIT_RADII[i] * s, c[1] - 4.08 * s, c[2] + Math.sin(a) * ORBIT_RADII[i] * .58 * s];
        }), .5);
      });
      wheel.rotation.z = (state.phase - .25) * Math.PI * 2;
    },
    focusBounds: () => ({ min: [c[0] - 51 * s, c[1] - 24.1 * s, c[2] - 31 * s], max: [c[0] + 51 * s, c[1] + 15 * s, c[2] + 38 * s] }),
    describe: () => ({ kind: 'solar-system', bodies: 8, units: 'schematic', orbitalPlane: '3d', turnsPerCycle: ORBIT_TURNS,
      source: SOLAR_REFERENCE, selected, selectedName: selected ? PLANET_NAMES[selected - 1] : null,
      directPlanetSelection: true, realOrbitalPeriodRatio: false, cycleBoundaryContinuous: true,
      construction: 'open-three-foot-orrery-with-connected-independent-bearings',
      instrumentMechanismIsAstronomicalCause: false, proceduralBodyColorsAreMaps: false,
      phaseDial: dial, phaseDialPoint: phaseDialPoint(state.phase, dial),
      planetPositions: state.bodies.map((planet, i) => ({ name: planet.name, local: planets[i].mount.position.toArray(),
        supportEndpoint: planets[i].pivot.localToWorld(new T.Vector3(Math.hypot(planet.point[0], planet.point[2]), planets[i].y, 0)).toArray(),
        stalkBottom: planets[i].mount.localToWorld(new T.Vector3(0, planets[i].y, 0)).toArray() })),
      orbitReferences: orbitRings.length, scientificStateUnchanged: true }),
  };
}
