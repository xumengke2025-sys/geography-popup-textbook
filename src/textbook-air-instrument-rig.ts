import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { castBodyGeometry, chamferedPlateGeometry, mergeInstrumentGeometry, pedestalColumnGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

const FINISH = { brass: '#b39359', steel: '#9da9a5', enamel: '#31473e', ivory: '#e9e1ce', wood: '#624633', land: '#b8aa8f', rock: '#a59b85' };

/** Open classroom apparatus: the support locates the comparison, not the
 * cause of radiation or air motion. Coordinates remain in model millimetres. */
export function createAirInstrumentRig(b: TextbookGeometry, scale: number, back: number) {
  const p = (x: number, y: number, z: number): Vec3 => [x * scale, y * scale, back + z * scale];
  const rigMeshes: any[] = [];
  const mesh = (geometry: any, finish: keyof typeof FINISH, name: string, parent: any = b.root) => {
    const m = b.mesh(geometry, FINISH[finish], false, true, finish as SolidMaterialRole);
    parent.add(m); m.name = name; m.userData.airInstrumentPart = name; rigMeshes.push(m); return m;
  };
  const plate = (a: Vec3, c: Vec3, finish: keyof typeof FINISH, name: string, bevel = .18) =>
    mesh(chamferedPlateGeometry(p(...a), p(...c), bevel * scale), finish, name);
  const casting = (a: Vec3, c: Vec3, finish: keyof typeof FINISH, name: string, radius = .5) => {
    return mesh(castBodyGeometry(p(...a),p(...c),radius*scale), finish, name);
  };
  const rod = (a: Vec3, c: Vec3, radius: number, finish: keyof typeof FINISH, name: string) =>
    mesh(turnedShaftGeometry(p(...a), p(...c), [[radius * scale, 0], [radius * scale, 1]]), finish, name);
  const stepped = (a: Vec3, c: Vec3, profile: [number, number][], finish: keyof typeof FINISH, name: string) =>
    mesh(turnedShaftGeometry(p(...a), p(...c), profile.map(([r, t]) => [r * scale, t])), finish, name);
  const fasteners = (points: Vec3[], radius = .46) => {
    const heads = points.map(([x, y, z]) => turnedShaftGeometry(p(x, y - .15, z), p(x, y + .18, z),
      [[radius * scale, 0], [radius * scale, .72], [radius * scale * .8, 1]]));
    const slots = points.map(([x, y, z]) => chamferedPlateGeometry(p(x - radius * .64, y + .18, z - radius * .11),
      p(x + radius * .64, y + .20, z + radius * .11), 0));
    if (heads.length) { mesh(mergeInstrumentGeometry(heads), 'brass', 'flush-screw-heads'); mesh(mergeInstrumentGeometry(slots), 'steel', 'recessed-screw-slots'); }
  };
  const ring = (center: Vec3, radius: number, tube: number, finish: keyof typeof FINISH, name: string, xy = true) => {
    const g = new T.TorusGeometry(radius * scale, tube * scale, 8, 56);
    if (!xy) g.rotateX(Math.PI / 2); g.translate(...p(...center)); return mesh(g, finish, name);
  };
  const sameHeightRail = (x0: number, x1: number, y: number, z: number) => {
    // A shallow rectangular backbeam carries the probe arms; the bright
    // exposed edge is a machining surface, rather than another loose wire.
    const beam = plate([x0, y - .70, z - .6], [x1, y + .70, z + .6], 'enamel', 'same-height-comparison-rail', .13);
    rod([x0, y + .68, z + .47], [x1, y + .68, z + .47], .09, 'steel', 'comparison-beam-machined-edge');
    for (const x of [x0, x1]) {
      stepped([x, y - .9, z], [x, y + .9, z], [[.6, 0], [.6, .24], [.39, .35], [.39, .7], [.6, .8], [.6, 1]], 'brass', 'comparison-rail-collar');
    }
    return beam;
  };
  /** The pointer reports only a signed relative state. No calibrated scale,
   * hPa reading or aneroid dynamics is implied by this qualitative readout. */
  const gauge = (at: Vec3, radius: number, name: string) => {
    const [x, y, z] = at, r = radius;
    const depth = r * .32;
    const body = stepped([x, y, z - depth], [x, y, z], [[r * .74, 0], [r * .82, .08],
      [r * .84, .18], [r * .84, .7], [r * .96, .81], [r * .96, 1]], 'enamel', `${name}-housing`);
    // One revolved annulus has an actual open centre and a recessed face.
    // The bevel produces the thin continuous highlight seen on the reference.
    const bezelProfile = [[r * .825, -.04 * r], [r * .98, -.04 * r], [r, -.012 * r],
      [r, .025 * r], [r * .967, .056 * r], [r * .85, .056 * r],
      [r * .825, .026 * r], [r * .825, -.04 * r]].map(([a, b]) => new T.Vector2(a * scale, b * scale));
    const bezelGeometry = new T.LatheGeometry(bezelProfile, 64);
    // Lathe +Y is the viewer-facing +Z axis here. Reversing this rotation
    // put the lip BEHIND the dial, so the face appeared pasted onto the case.
    bezelGeometry.rotateX(-Math.PI / 2); bezelGeometry.translate(...p(x, y, z));
    mesh(bezelGeometry, 'brass', `${name}-machined-open-bezel`);
    stepped([x, y, z - .10], [x, y, z + .09], [[r * .826, 0], [r * .826, 1]], 'ivory', `${name}-face`);
    ring([x, y, z + .12], r * .787, r * .007, 'steel', `${name}-engraved-face-border`);
    const divisions: any[] = [];
    for (let i = -4; i <= 4; i++) {
      const a = Math.PI / 2 + i * .20, ri = r * (i % 2 ? .69 : .62), ro = r * .79;
      divisions.push(turnedShaftGeometry(p(x + Math.cos(a) * ri, y + Math.sin(a) * ri, z + .15),
        p(x + Math.cos(a) * ro, y + Math.sin(a) * ro, z + .15), [[r * .009 * scale, 0], [r * .009 * scale, 1]]));
    }
    mesh(mergeInstrumentGeometry(divisions), 'steel', `${name}-qualitative-divisions`);
    const needle = new T.Group(); needle.position.set(...p(x, y, z + .30)); b.root.add(needle);
    const pointerShape = new T.Shape(); pointerShape.moveTo(-r * .032 * scale, -r * .17 * scale);
    pointerShape.lineTo(0, r * .66 * scale); pointerShape.lineTo(r * .032 * scale, -r * .17 * scale); pointerShape.closePath();
    const pointer = mesh(new T.ExtrudeGeometry(pointerShape, { depth: .11 * scale, bevelEnabled: false }), 'steel', `${name}-pointer`, needle);
    stepped([x, y, z + .28], [x, y, z + .44], [[r * .087, 0], [r * .105, .2], [r * .105, .7], [r * .074, 1]], 'brass', `${name}-pointer-cap`);
    pointer.userData.relativePressurePointer = true;
    return { body, pointer, needle, set: (relative: number) => { needle.rotation.z = -Math.max(-1, Math.min(1, relative)) * .72; needle.userData.relativePressure = relative; } };
  };
  const specimenBed = (x0: number, x1: number, z0: number, z1: number, floor = 0) => {
    // A single rebated perimeter meets the existing scientific ground section.
    // The open centre stays natural; this is not another opaque layer over it.
    for (const [a, c] of [ [[x0 - .9, floor - 2, z0 - .9], [x1 + .9, floor - .35, z0 + .3]],
      [[x0 - .9, floor - 2, z1 - .3], [x1 + .9, floor - .35, z1 + .9]],
      [[x0 - .9, floor - 2, z0 + .3], [x0 + .3, floor - .35, z1 - .3]],
      [[x1 - .3, floor - 2, z0 + .3], [x1 + .9, floor - .35, z1 - .3]] ] as [Vec3, Vec3][])
      plate(a, c, 'enamel', 'rebated-specimen-bed');
    for (const x of [x0, x1]) for (const z of [z0, z1]) {
      plate([x - 1.2, floor - .45, z - 1.2], [x + 1.2, floor + .18, z + 1.2], 'brass', 'specimen-retaining-tab');
      fasteners([[x, floor + .23, z]], .33);
    }
  };
  const phaseSlide = (start: Vec3, end: Vec3) => {
    const [x0, y, z] = start, x1 = end[0];
    // The physical rail sits around the existing track coordinates. No model
    // input or scientific key position is moved by the presentation upgrade.
    for (const zz of [z - .75, z + .75]) rod([x0 - 2, y, zz], [x1 + 2, y, zz], .22, 'steel', 'phase-slide-guide');
    for (const x of [x0 - 2.5, x1 + 2.5]) {
      plate([x - 1, y - 1.7, z - 1.6], [x + 1, y + .55, z + 1.6], 'enamel', 'phase-slide-bearing');
      rod([x, y - 1, z - 1.1], [x, -1.6, z - 10], .29, 'steel', 'phase-slide-support');
      plate([x - 1.5, -2, z - 11.3], [x + 1.5, -1.4, z - 8.7], 'brass', 'phase-slide-foot');
    }
  };
  /** A complete comparator chassis. The original ground, isobars and open
   * air remain between the columns. Moulded feet, turned columns and probe
   * channels form one load-bearing object, rather than six gauges on wires. */
  const circulationChassis = () => {
    casting([2, -5.3, 12], [98, -3.6, 54], 'wood', 'comparator-timber-plinth', .7);
    plate([3, -3.65, 13], [97, -3.28, 53], 'brass', 'comparator-rebated-metal-edge', .12);
    casting([3.6, -3.3, 13.6], [96.4, -.2, 52.4], 'enamel', 'comparator-cast-bed', .7);
    for (const x of [8, 92]) for (const z of [18, 48])
      stepped([x, -8, z], [x, -5, z], [[1.6, 0], [1.8, .1], [1.8, .25], [1.35, .4], [1.2, .8], [1.6, 1]], 'brass', 'comparator-level-foot');
    const hardwareStart = rigMeshes.length;
    for (const x of [8, 92]) {
      casting([x - 3.3, -.3, 23.5], [x + 3.3, 1.6, 30.5], 'enamel', 'comparator-mast-socket', .45);
      mesh(pedestalColumnGeometry(p(x,1.4,27),p(x,58,27),2.05*scale),'brass','comparator-turned-column');
      stepped([x, 58, 27], [x, 59.6, 27], [[1.2, 0], [1.3, .35], [1.1, .7], [.4, 1]], 'brass', 'comparator-column-finial');
      fasteners([[x - 2, 1.6, 25], [x + 2, 1.6, 29]], .38);
      for (const y of [12, 51]) {
        stepped([x, y - 2.7, 27], [x, y + 2.7, 27], [[1.75, 0], [1.9, .1], [1.9, .2], [1.5, .3], [1.5, .7], [1.9, .8], [1.9, .9], [1.75, 1]], 'brass', 'comparator-channel-collar');
        casting([x - 2.4, y - 2.1, 27], [x + 2.4, y + 2.1, 37.5], 'enamel', 'comparator-probe-channel-bracket', .4);
      }
    }
    for (const y of [12, 51]) {
      // The channel is a structural back rail, not a billboard. Each round
      // instrument has a complete case seated onto the rail in front of it.
      casting([8, y - 1.45, 36], [92, y + 1.45, 38], 'enamel', 'comparator-pressure-channel', .4);
      plate([8.5, y - 1.55, 36], [91.5, y - 1.3, 38.3], 'brass', 'comparator-channel-lip', .06);
      rod([9, y + 1.25, 38.1], [91, y + 1.25, 38.1], .1, 'steel', 'comparator-channel-edge');
      for (const x of [11, 89]) {
        const g = new T.CylinderGeometry(.38 * scale, .38 * scale, .13 * scale, 20);
        g.rotateX(Math.PI / 2); g.translate(...p(x, y, 38.15));
        mesh(g, 'brass', 'comparator-channel-fastener');
      }
    }
    const hardwareEnd = rigMeshes.length;
    // The controls are a small open lectern attached to the specimen bed.
    // Three fitted ceramic inserts replace a broad blank dashboard. The
    // original slider datum stays unchanged, including its native hit plane.
    const slope=-Math.atan(1/.8);
    const inclined=(a:Vec3,c:Vec3,at:Vec3,finish:keyof typeof FINISH,name:string,radius=.2)=>{
      const geo=castBodyGeometry(a.map(n=>n*scale) as Vec3,c.map(n=>n*scale) as Vec3,radius*scale);
      geo.rotateX(slope);geo.translate(...p(...at));return mesh(geo,finish,name);
    };
    for (const x of [7,93]) {
      // A swept web broadens at the bed; its rolled edge belongs to this
      // bracket, rather than a wire outlining an otherwise empty panel.
      const shape=new T.Shape();shape.moveTo(50,-1);shape.lineTo(54,-1);
      shape.bezierCurveTo(58,-3,66,-9,72,-15.8);shape.lineTo(72,-17.5);
      shape.lineTo(67,-17.5);shape.bezierCurveTo(63,-12,56,-7,50,-5);shape.closePath();
      const geo=new T.ExtrudeGeometry(shape,{depth:1.7,steps:1,bevelEnabled:true,bevelThickness:.15,bevelSize:.18,bevelSegments:2,curveSegments:8});
      // Drawn in the z/y section, extruded across x. Reflection of the local
      // section preserves the geometry's outward normals (a proper rotation).
      geo.rotateY(-Math.PI/2);geo.scale(scale,scale,scale);geo.translate(...p(x+.85,0,0));
      mesh(geo,'enamel','comparator-swept-control-bracket');
      rod([x,-1.1,53],[x,-15.8,71.5],.16,'brass','comparator-bracket-edge');
    }
    // All three plaques seat on one narrow cross-member. The spaces between
    // them stay open, keeping the instrument lighter above the printed page.
    inclined([-43,-.65,-1.1],[43,.65,0],[50,-5.8,58],'enamel','comparator-nameplate-crossmember');
    for (const x of [18,50,82]) {
      inclined([-11.3,-4.3,-.65],[11.3,4.3,0],[x,-5.8,58],'brass','comparator-rebated-nameplate-rim',.3);
      inclined([-10.8,-3.8,0],[10.8,3.8,.14],[x,-5.8,58],'ivory','comparator-fitted-ceramic-nameplate',.24);
    }
    // Steel guides land in cast bearings at both ends. A recessed ivory bed
    // lies behind the moving handle; it does not become a second control UI.
    inclined([-43,-2.4,-.8],[43,2.4,0],[50,-12.8,68.2],'enamel','comparator-control-cross-casting');
    for (const x of [10,90]) {
      casting([x-1.7,-14.1,66.2],[x+1.7,-11.85,69.8],'enamel','comparator-phase-bearing-seat',.32);
      for(const z of [67.1,68.9])mesh(turnedSleeveGeometry(p(x-1.8,-12.4,z),p(x+1.8,-12.4,z),
        [[.48*scale,0],[.55*scale,.1],[.55*scale,.26],[.43*scale,.34],[.43*scale,.7],[.55*scale,.8],[.55*scale,.92],[.48*scale,1]],.24*scale),
        'brass','comparator-phase-bearing-collar');
    }
    // Put the pressure comparison behind the air, separated in depth from
    // the front flow paths. Bed and controls remain at the sample's edge.
    for (const m of rigMeshes.slice(hardwareStart, hardwareEnd))
      m.geometry.translate(0, 0, -12 * scale);
  };
  return { p, mesh, plate, casting, rod, stepped, ring, fasteners, gauge, sameHeightRail, specimenBed, phaseSlide, circulationChassis };
}
