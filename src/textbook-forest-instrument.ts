import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';
import { FOREST_LAYOUT, FOREST_STOPS } from './textbook-forest-model';

/** An open vertical comparator. The two guide bushes, bridge and observation
 * rim are one carriage. The apparatus measures a schematic position; it does
 * not make trees grow or purport to cause the forest's stratification. */
export function buildForestInstrument(b: TextbookGeometry, p: (v: readonly number[]) => Vec3, s: number) {
  const colors = { brass: '#a88b50', steel: '#929b98', wood: '#544534', ivory: '#e3ddc9', enamel: '#30483e' };
  const meshes: any[] = [], moving: any[] = [];
  const part = (g: any, role: keyof typeof colors, name: string, moves = false) => {
    const m = b.mesh(g, colors[role], false, true, role as SolidMaterialRole);
    m.name = name; m.userData.forestRole = name; m.userData.instrumentPart = name;
    meshes.push(m); if (moves) moving.push(m); return m;
  };
  const plate = (a: Vec3, c: Vec3, role: keyof typeof colors, name: string, moves = false) =>
    part(chamferedPlateGeometry(p(a), p(c), .13 * s), role, name, moves);
  const shaft = (a: Vec3, c: Vec3, r: number) => turnedShaftGeometry(p(a), p(c), [[r * s, 0], [r * s, 1]]);
  const sleeve = (x: number, low: number, high: number, radius: number, bore: number) =>
    turnedSleeveGeometry(p([x, low, 64]), p([x, high, 64]),
      [[radius * s, 0], [radius * s, .12], [radius * .79 * s, .22], [radius * .79 * s, .78], [radius * s, .88], [radius * s, 1]], bore * s);

  // Thin specimen tray and two open shoes seat both the earth specimen and
  // guides on the same datum. There is no surrounding gantry above the crowns.
  plate([1, -1.65, 16], [98, -.4, 67], 'wood', 'forest-specimen-tray');
  plate([1.3, -.4, 16.3], [97.7, -.16, 66.7], 'brass', 'specimen-registration-edge');
  plate([1.8, -.16, 16.8], [97.2, 0, 66.2], 'enamel', 'specimen-recess');
  for (const x of [16, 78]) plate([x - 4, -2.5, 28], [x + 4, -1.65, 55], 'wood', 'tray-foot');
  const seats: any[] = [], rods: any[] = [], caps: any[] = [];
  for (const x of [.5, 91]) {
    // Outboard bracket extends from the tray to the guide centre; the upper
    // cap rests on the guide. Neither post floats beside the specimen.
    seats.push(chamferedPlateGeometry(p([x - 2, -.1, 61.5]), p([x + 2, 1.1, 66.5]), .15 * s));
    seats.push(sleeve(x, 1.05, 3, 1.12, .49));
    rods.push(shaft([x, 2.9, 64], [x, 46.8, 64], .48));
    caps.push(sleeve(x, 46.6, 47.6, .96, .49));
    // The moving sleeve has a real bore around the steel guide.
  }
  part(mergeInstrumentGeometry(seats), 'brass', 'guide-foot-sockets');
  part(mergeInstrumentGeometry(rods), 'steel', 'paired-observation-guides');
  part(mergeInstrumentGeometry(caps), 'brass', 'guide-end-stops');

  // A narrow relative-position scale, not a numbered metre or light meter.
  plate([92.1, 2, 63.72], [93.75, 45.7, 64.22], 'ivory', 'relative-height-scale');
  const ticks: any[] = [];
  for (let i = 0; i <= 26; i++) {
    const y = 3 + i * 1.5;
    ticks.push(chamferedPlateGeometry(p([92.1, y - .055, 64.23]), p([i % 13 === 0 ? 93.65 : 93.05, y + .055, 64.28]), 0));
  }
  const marks = part(mergeInstrumentGeometry(ticks), 'steel', 'height-scale-divisions');
  marks.castShadow = marks.receiveShadow = false; marks.userData.castShadow = false;

  // Front-right leadscrew and fitted nut share a pitch. Turning the screw is
  // a deterministic kinematic consequence of seeking the carriage position.
  const pitch = 3, screwX = 95.25;
  const screw = new T.Group(); screw.name = 'observation-leadscrew';
  screw.position.set(...p([screwX, 0, 64])); b.root.add(screw);
  const core = part(turnedShaftGeometry([0, 1.1 * s, 0], [0, 46 * s, 0], [[.34 * s, 0], [.34 * s, 1]]), 'steel', 'leadscrew-core');
  screw.add(core);
  const helix = new T.CatmullRomCurve3(Array.from({ length: 541 }, (_, i) => {
    const y = 1.2 + 44.5 * i / 540, a = y / pitch * Math.PI * 2;
    return new T.Vector3(Math.cos(a) * .48 * s, y * s, Math.sin(a) * .48 * s);
  }));
  const thread = part(new T.TubeGeometry(helix, 540, .115 * s, 5, false), 'steel', 'leadscrew-thread');
  thread.castShadow = thread.receiveShadow = false; thread.userData.castShadow = false; screw.add(thread);
  for (const [low, high] of [[.15, 1.2], [45.8, 46.8]])
    part(turnedSleeveGeometry(p([screwX, low, 64]), p([screwX, high, 64]), [[.9 * s, 0], [.9 * s, 1]], .35 * s), 'brass', 'screw-end-bearing');
  plate([90, -.1, 62], [97, .3, 66], 'brass', 'screw-guide-shared-foot');
  plate([90.25, 45.85, 63.1], [96.25, 46.4, 64.9], 'brass', 'screw-guide-top-tie');

  const area = FOREST_LAYOUT.observation;
  const rim: any[] = [];
  for (const z of [area.minZ, area.maxZ])
    rim.push(chamferedPlateGeometry(p([area.minX, -.18, z - .23]), p([area.maxX, .18, z + .23]), .055 * s));
  for (const x of [area.minX, area.maxX])
    rim.push(chamferedPlateGeometry(p([x - .23, -.18, area.minZ]), p([x + .23, .18, area.maxZ]), .055 * s));
  const frame = part(mergeInstrumentGeometry(rim), 'brass', 'observation-frame', true);
  frame.raycast = () => {};
  const bushes = part(mergeInstrumentGeometry([sleeve(.5, -1.6, 1.6, 1.14, .5), sleeve(91, -1.6, 1.6, 1.14, .5)]),
    'brass', 'carriage-guide-bushes', true);
  const bridges = [
    chamferedPlateGeometry(p([-.35, -.38, 58.6]), p([3, .38, 64.35]), .15 * s),
    chamferedPlateGeometry(p([85.5, -.38, 58.6]), p([95.8, .38, 64.35]), .15 * s),
    sleeve(screwX, -.9, .9, .91, .36),
  ];
  part(mergeInstrumentGeometry(bridges), 'brass', 'carriage-rim-connections', true);

  // The grip's centre remains exactly on the public phase track. A small
  // front-facing boss provides an unambiguous native pointer target.
  const handleGeometry = turnedShaftGeometry([0, 0, -.2 * s], [0, 0, 1.35 * s],
    [[1.08 * s, 0], [1.25 * s, .15], [1.65 * s, .26], [1.65 * s, .82], [1.34 * s, 1]]);
  const handle = part(handleGeometry, 'wood', 'phase-handle');
  const input = { kind: 'phase-track', track: { start: p(FOREST_LAYOUT.track.start), end: p(FOREST_LAYOUT.track.end) }, label: '上下拖动滑套，观察同一片森林的不同高度' };
  handle.userData.modelInput = input; handle.userData.smallPointTarget = true;
  bushes.userData.modelInput = input;
  part(mergeInstrumentGeometry([
    chamferedPlateGeometry(p([91, -.12, 64.3]), p([93.6, .12, 64.55]), .035 * s),
  ]), 'steel', 'carriage-scale-pointer', true);

  // The fixed nameplates have their own thin spine, seated in the same
  // foot/top tie. They do not obstruct the travelling screw nut.
  plate([96.55, .3, 63.9], [97.25, 46.4, 64.38], 'brass', 'nameplate-support-spine');
  const labels = FOREST_STOPS.map((stop, i) => {
    const [, y] = FOREST_LAYOUT.labels[i];
    plate([97.1, y - 3, 63.83], [116.3, y + 3, 64.48], 'brass', 'layer-nameplate-mount');
    plate([97.4, y - 2.7, 64.49], [116, y + 2.7, 64.66], 'ivory', 'layer-nameplate-face');
    const label = b.label(stop.label, p(FOREST_LAYOUT.labels[i]), 18 * s, 5.2 * s, { appearance: 'engraved', ink: '#35443a' });
    label.name = 'forest-layer-inscription'; label.userData.forestRole = 'layer-label';
    label.userData.labelMount = 'surface'; label.userData.forestLayer = i;
    label.userData.modelInput = { kind: 'select', selection: i, label: `观察${stop.label}` };
    meshes.push(label); return label;
  });
  // An index in the same metal strip makes the selected layer legible without
  // additional floating titles or a second separate display.
  const index = plate([94.05, -.65, 64.5], [95.45, .65, 64.74], 'enamel', 'active-layer-index');
  return {
    meshes, frame, handle, labels,
    update(height: number, selection: number) {
      moving.forEach(mesh => { mesh.position.y = height * s; });
      handle.position.set(...p([91, height, 64]));
      screw.rotation.y = -height / pitch * Math.PI * 2;
      index.position.y = FOREST_LAYOUT.labels[selection][1] * s;
      labels.forEach((label, i) => { label.userData.forestActive = i === selection; });
    },
    diagnostics: () => ({ structure: 'paired-guide-and-leadscrew-observation-carriage', guideBores: true,
      carriageConnectedToRim: true, screwPitch: pitch, screwAngle: screw.rotation.y,
      observationIsApparatus: true, causesForestStratification: false }),
  };
}
