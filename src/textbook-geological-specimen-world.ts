import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { GEOLOGICAL_INTERVALS, geologicalInterval } from './textbook-sky-causality-model';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** Four hinged interpretative casts, not a life-size reconstruction or four
 * equally long eras. The separate ruler retains the textbook's real spans. */
export function buildGeologicalSpecimenWorld(b: TextbookGeometry): ModelMotion {
  const firstMesh = b.meshes.length;
  const s = b.width / 110, back = -LIFT_MARGIN - 55 * s;
  const root = new T.Group(); root.name = 'hinged-geological-specimen-folio';
  root.position.z = back; root.scale.setScalar(s); b.root.add(root);
  const colors = { wood: '#63513d', brass: '#a88b50', steel: '#89938e', rock: '#55605a', ivory: '#ddd1ad' };
  const mesh = (g: any, role: SolidMaterialRole, name: string, parent: any = root, color?: string) => {
    const m = b.mesh(g, color ?? colors[role as keyof typeof colors], false, true, role);
    parent.add(m); m.name = name; m.userData.geologicalPart = name; return m;
  };
  const plate = (at: Vec3, size: Vec3, role: SolidMaterialRole, name: string, parent: any = root, color?: string) =>
    mesh(chamferedPlateGeometry(at.map((v, i) => v - size[i] / 2) as Vec3,
      at.map((v, i) => v + size[i] / 2) as Vec3, .12), role, name, parent, color);
  const shaft = (a: Vec3, c: Vec3, r: number, role: SolidMaterialRole, name: string, parent: any = root) =>
    mesh(turnedShaftGeometry(a, c, [[r, 0], [r, 1]]), role, name, parent);
  const extrude = (shape: any, depth: number, z = 0, bevel = .10) => {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2,
      bevelSize: bevel, bevelThickness: bevel, curveSegments: 10, steps: 1 }); g.translate(0, 0, z); return g;
  };
  const polygon = (points: number[][]) => {
    const shape = new T.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return shape;
  };
  const curve = (points: number[][], radius: number, z: number) => new T.TubeGeometry(
    new T.CatmullRomCurve3(points.map(([x, y]) => new T.Vector3(x, y, z))), Math.max(12, points.length * 4), radius, 6, false);
  // Carved organic volumes have a varying elliptical section and a continuous
  // skin. These are not uniform rods with ball joints or flat icon extrusions.
  const carvedLoft = (nodes: number[][], z: number, steps = 48, sides = 14) => {
    const line = new T.CatmullRomCurve3(nodes.map(([x, y]) => new T.Vector3(x, y, 0)));
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, at = line.getPoint(u), tangent = line.getTangent(u);
      const f = u * (nodes.length - 1), k = Math.min(nodes.length - 2, Math.floor(f)), t = f - k;
      const radius = nodes[k][2] * (1 - t) + nodes[k + 1][2] * t;
      const depth = nodes[k][3] * (1 - t) + nodes[k + 1][3] * t;
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2;
        positions.push(at.x - tangent.y * radius * Math.cos(a), at.y + tangent.x * radius * Math.cos(a), z + depth * Math.sin(a));
        if (i < steps && j < sides) { const q = i * (sides + 1) + j; indices.push(q, q + 1, q + sides + 1, q + 1, q + sides + 2, q + sides + 1); }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  };
  const shellDome = (cx: number, cy: number, rx: number, ry: number, depth: number) => {
    const positions: number[] = [], indices: number[] = [], rings = 12, sides = 64;
    for (let r = 0; r <= rings; r++) for (let j = 0; j <= sides; j++) {
      const radius = r / rings, a = j / sides * Math.PI * 2;
      positions.push(cx + rx * radius * Math.cos(a), cy + ry * radius * Math.sin(a), .2 + depth * Math.sqrt(1 - radius * radius));
      if (r < rings && j < sides) { const q = r * (sides + 1) + j; indices.push(q, q + sides + 1, q + 1, q + 1, q + sides + 1, q + sides + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  };
  const inscription = (text: string, width: number, height: number, parent: any, at: Vec3, horizontal = false) => {
    let texture: any;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = Math.round(width * 36); canvas.height = Math.round(height * 36);
      const c = canvas.getContext('2d')!; c.fillStyle = '#c3ae7e'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#2b342e'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `500 ${Math.round(canvas.height * .68)}px FieldSans, 'Microsoft YaHei', sans-serif`;
      c.fillText(text, canvas.width / 2, canvas.height * .54);
      texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    }
    const g = new T.PlaneGeometry(width, height); if (horizontal) g.rotateX(-Math.PI / 2); g.translate(...at);
    const m = mesh(g, 'brass', 'fixed-folio-inscription', parent);
    const mat = new T.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: .74, metalness: .13 }); m.material = mat;
    m.userData.text = text; g.addEventListener('dispose', () => { texture?.dispose(); mat.dispose(); }); return m;
  };
  // An open folio spine with four real knuckles. Two light timber runners
  // support it; the specimen is not enclosed in a universal heavy platform.
  plate([55, 2, 42], [110, 3.2, 9], 'wood', 'folio-bound-spine');
  plate([55, 3.72, 42], [109, .22, 8.4], 'brass', 'spine-inlaid-edge');
  shaft([.3, 6.4, 40], [109.7, 6.4, 40], .55, 'steel', 'continuous-folio-hinge');
  for (const x of [4, 106]) {
    plate([x, 1.2, 20], [3.2, 2.4, 46], 'wood', 'folio-open-runner');
    for (const z of [1, 40]) mesh(turnedShaftGeometry([x, -.7, z], [x, .6, z], [[1.2, 0], [1.3, .3], [.85, .8], [.85, 1]]), 'brass', 'folio-foot');
    plate([x, 5.05, 40], [3.5, 2.6, 4.4], 'brass', 'hinge-pillow-block');
  }

  const leaves: { group: any; angle: number; selection: number; relief: string; meshes: any[] }[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new T.Group(); g.name = `specimen-leaf-${i}`; g.position.set(2 + i * 27, 6.4, 40); root.add(g);
    const first = b.meshes.length;
    // Thin chipped rock faces and visible laminations are distinct from their
    // removable brass clips. This is an interpreted collection, not one column
    // of strata asserting that every place preserves all four periods.
    const outline = [[.4, 1.2], [1.8, .2], [22.6, .3], [24.1, 1.5], [23.8, 35.8], [22.6, 38.4], [18.8, 39], [4, 38.5], [.3, 36.8]];
    for (let layer = 0; layer < 3; layer++) {
      const face = outline.map(([x, y], n) => [x + (layer - 1) * .09 * Math.sin(n * 1.8), y + layer * .10]);
      mesh(extrude(polygon(face), .65, -1.95 + layer * .65, .10), 'rock', 'laminated-rock-leaf', g,
        ['#61655b', '#74786b', '#697369'][layer]);
    }
    for (const x of [2.6, 21.6]) {
      plate([x, 2.3, .5], [2.4, 3.4, .52], 'brass', 'specimen-retaining-lip', g);
      plate([x, 1, -1.15], [2.4, 1, 3.5], 'brass', 'specimen-clip-jaw', g);
      shaft([x, 2.1, .7], [x, 2.1, 1.05], .30, 'steel', 'clip-screw', g);
      mesh(turnedShaftGeometry([x - 1.9, 0, 0], [x + 1.9, 0, 0], [[1, 0], [1, .15], [.8, .24], [.8, .78], [1, .87], [1, 1]]), 'brass', 'leaf-hinge-knuckle', g);
    }
    let relief = '';
    if (i === 0) {
      relief = 'stromatolite-laminations';
      // A section through successive domed microbial laminae, directly based
      // on textbook fig.1.25. The layered rock is not a giant blue-green cell.
      const laminae: any[][] = [[], []];
      const profile = (x: number, k: number) => 8 + k * 1.55 + (3.2 + .14 * k) *
        (Math.exp(-(((x - 6) / 3.3) ** 2)) + .82 * Math.exp(-(((x - 14.8) / 4.5) ** 2)));
      for (let k = 0; k < 11; k++) {
        const top = Array.from({ length: 41 }, (_, j) => { const x = 2 + j / 40 * 20; return [x, profile(x, k)]; });
        const bottom = [...top].reverse().map(([x]) => [x, profile(x, k) - 1.22]);
        laminae[k % 2].push(extrude(polygon([...top, ...bottom]), .9 + k * .05, .18, .10));
      }
      laminae.forEach((parts, j) => mesh(mergeInstrumentGeometry(parts), 'rock', 'stromatolite-section-laminae', g, j ? '#b2a17c' : '#d0bb91'));
      inscription('叠层石', 11, 3.1, g, [12, 34, .24]);
    } else if (i === 1) {
      relief = 'trilobite-relief';
      mesh(shellDome(12, 27.1, 7.2, 5.2, 2.0), 'ivory', 'trilobite-cephalic-shield', g, '#bdac86');
      const tail = new T.Shape(); tail.moveTo(7, 12); tail.quadraticCurveTo(7.2, 7.1, 12, 6.4);
      tail.quadraticCurveTo(16.8, 7.1, 17, 12); tail.closePath();
      mesh(extrude(tail, 1, .15, .18), 'ivory', 'trilobite-pygidium', g);
      const ribs: any[] = [], axis: any[] = [];
      for (let k = 0; k < 11; k++) {
        const y = 12 + k * 1.18, w = 4.5 + .14 * k;
        for (const side of [-1, 1]) {
          const rib = new T.Shape(); rib.moveTo(12 + side * 1.6, y + .9);
          rib.quadraticCurveTo(12 + side * (w * .7), y + 1.5, 12 + side * w, y + .5);
          rib.lineTo(12 + side * (w + .45), y - .6); rib.quadraticCurveTo(12 + side * (w * .7), y + .25, 12 + side * 1.6, y + .05); rib.closePath();
          ribs.push(extrude(rib, .68, .8, .12));
        }
        axis.push(extrude(polygon([[10.5, y], [13.5, y], [13.25, y + .82], [10.75, y + .82]]), 1.05, 1.0, .18));
      }
      mesh(mergeInstrumentGeometry(ribs), 'ivory', 'trilobite-paired-pleural-segments', g, '#c9ba91');
      mesh(mergeInstrumentGeometry(axis), 'ivory', 'trilobite-articulated-axis', g);
      mesh(carvedLoft([[12, 23.5, .6, .4], [12, 27.4, 1.7, .9], [12, 30.6, .7, .4]], 1.85, 24), 'ivory', 'trilobite-glabella', g);
      for (const side of [-1, 1]) mesh(curve([[12 + side * 3.3, 26.0], [12 + side * 3.9, 27], [12 + side * 3.4, 28.4]], .22, 1.83),
        'rock', 'trilobite-eye-ridge', g, '#7d7154');
    } else if (i === 2) {
      relief = 'long-neck-dinosaur-cast';
      const dinoParts = [
        carvedLoft([[7.4, 20, .12, .1], [9.2, 20.3, 2.0, 1.6], [12.7, 20.8, 2.9, 2.3], [16.3, 21, 2.0, 1.6], [17.5, 21.2, .2, .1]], .65),
        carvedLoft([[14.9, 21.3, 1.7, 1.1], [17.3, 23, 1.15, .9], [17.7, 27.1, .75, .65], [18.2, 30.8, .55, .5], [19.7, 32.5, .45, .4]], .8),
        carvedLoft([[19.1, 32.0, .15, .2], [19.8, 32.6, .8, .7], [21.2, 32.4, .6, .55], [22.0, 32.1, .25, .3]], .8, 28),
        carvedLoft([[8.7, 20.1, 1.4, 1.1], [6.4, 18.2, .9, .65], [4.2, 16.1, .50, .35], [2, 15.3, .18, .15], [.8, 15.7, .025, .025]], .7),
        carvedLoft([[10, 19.2, 1.0, .65], [9.3, 15.6, .7, .5], [9.9, 12, .48, .4], [9.4, 8.1, .62, .45], [10.5, 7.8, .14, .1]], .4),
        carvedLoft([[15.5, 20.2, .9, .7], [16.3, 16.1, .65, .5], [15.8, 12.2, .42, .35], [16.2, 8.1, .6, .45], [17.1, 7.9, .1, .1]], .35),
        carvedLoft([[9.2, 19.4, 1.1, .7], [8.2, 16.4, .72, .55], [8.6, 12.9, .45, .42], [7.3, 8.7, .67, .5], [8.2, 8.3, .12, .1]], 1.35),
        carvedLoft([[15.7, 20.4, .95, .7], [14.6, 16.9, .65, .52], [14.7, 13, .43, .38], [13.7, 8.7, .65, .45], [14.6, 8.4, .1, .1]], 1.5),
      ];
      mesh(mergeInstrumentGeometry(dinoParts), 'ivory', 'dinosaur-continuous-sculpted-cast', g, '#c5b591');
      // Fine surface ridges retain the impression of an anatomical specimen
      // without an arbitrary ball-and-rod skeleton or a named-species claim.
      const anatomy: any[] = [curve([[5, 16.7], [8.8, 20.3], [12.7, 21.8], [16, 21.3], [17.9, 25.3], [18.4, 30.8]], .075, 2.12)];
      for (let j = 0; j < 6; j++) { const x = 9.6 + j * .95; anatomy.push(curve([[x, 21.5], [x + .65, 20.4], [x + .45, 18.5]], .075, 2.8)); }
      mesh(mergeInstrumentGeometry(anatomy), 'rock', 'dinosaur-anatomical-ridges', g, '#9c8c68');
      const eye = new T.Shape(); eye.absellipse(20.3, 32.7, .13, .14, 0, Math.PI * 2, false);
      mesh(extrude(eye, .08, 1.55, .02), 'rock', 'dinosaur-eye-mark', g, '#514c38');
    } else {
      relief = 'mammal-and-broadleaf-casts';
      const mammalParts = [
        carvedLoft([[3.8, 22.2, .15, .1], [6.1, 22.2, 3.6, 2.2], [10.4, 22.2, 4.3, 2.8], [14.9, 22, 3.6, 2.3], [17, 22.3, .15, .1]], .75),
        carvedLoft([[15.4, 21.4, .2, .15], [17.4, 23.2, 2.8, 2.2], [19.6, 23.5, 2.1, 1.65], [20.5, 21.8, .5, .45]], 1.05),
        carvedLoft([[19.8, 22.7, 1.1, .8], [20.8, 19.7, .9, .7], [21, 15.8, .65, .5], [20.7, 12.7, .38, .3], [19.4, 13.6, .08, .08]], 1.3),
        carvedLoft([[6.8, 20.5, 1.2, .8], [6.9, 16.3, .85, .6], [6.2, 12.7, .70, .5], [6.6, 9.0, .85, .55], [7.6, 8.7, .1, .1]], .4),
        carvedLoft([[14.7, 20.6, 1.0, .7], [15.9, 16.4, .8, .6], [15.4, 12.7, .6, .5], [16, 9.2, .8, .55], [17.1, 8.8, .1, .1]], .35),
        carvedLoft([[7.9, 20.1, 1.1, .8], [7.2, 16.1, .85, .65], [8.1, 12.9, .6, .5], [7.4, 9.3, .85, .60], [8.4, 8.9, .1, .1]], 1.6),
        carvedLoft([[14.4, 20.5, 1.1, .8], [13.5, 16.2, .8, .6], [13.8, 12.6, .6, .48], [13.1, 9.4, .85, .55], [14.3, 9.0, .1, .1]], 1.7),
        carvedLoft([[4.4, 23, .40, .30], [3.5, 20, .25, .20], [2.6, 18.5, .13, .1]], .6, 24),
      ];
      mesh(mergeInstrumentGeometry(mammalParts), 'ivory', 'mammal-continuous-sculpted-cast', g, '#c7b58f');
      const tusks = [carvedLoft([[18.9, 21.1, .4, .35], [20.6, 19.7, .34, .28], [22.6, 20, .23, .2], [23.1, 21.7, .03, .03]], 2.6, 32)];
      const ear = new T.Shape(); ear.moveTo(16.9, 23.9); ear.bezierCurveTo(13.7, 25, 13.5, 20.5, 16.2, 19.4); ear.quadraticCurveTo(18.3, 21, 16.9, 23.9); ear.closePath();
      mesh(extrude(ear, .45, 3.1, .10), 'rock', 'mammal-ear-relief', g, '#b5a580');
      mesh(mergeInstrumentGeometry(tusks), 'ivory', 'curved-mammal-tusk', g);
      // A separate broadleaf cast states the plant association; it is not a
      // claim that every species pictured is unique to this geological era.
      const leaf = new T.Shape(); leaf.moveTo(6, 29); leaf.bezierCurveTo(1.7, 32, 4.4, 35.3, 11.2, 36.7);
      leaf.bezierCurveTo(11.7, 32.6, 10.5, 29.8, 6, 29); leaf.closePath();
      mesh(extrude(leaf, .65, .25, .12), 'ivory', 'broadleaf-impression', g, '#c6c2a2');
      mesh(curve([[5.3, 28.7], [7, 31.4], [10.5, 36]], .10, 1.08), 'rock', 'broadleaf-central-vein', g, '#7b8067');
    }
    const input = { kind: 'select', selection: i, label: `展开${GEOLOGICAL_INTERVALS[i].label}代表标本；标本宽度不表示持续时间` };
    const specimenMeshes = b.meshes.slice(first); specimenMeshes.forEach(m => { m.userData.modelInput = input; m.userData.geologicalSelection = i; });
    const nameplate = inscription(GEOLOGICAL_INTERVALS[i].label, 23.1, 3.25, root, [14.1 + i * 27, 3.87, 44.2], true);
    nameplate.userData.modelInput = input; nameplate.userData.geologicalSelection = i;
    leaves.push({ group: g, angle: i ? -1.20 : -.20, selection: i, relief, meshes: specimenMeshes });
  }
  // The real-duration scale stays separate from the four equal presentation
  // leaves. Never widen its 66 Ma Cenozoic interval into an equal quarter.
  const ruler = GEOLOGICAL_INTERVALS.map((period, i) => {
    const interval = geologicalInterval(i), x0 = 2 + 106 * interval.start, x1 = 2 + 106 * interval.end;
    const part = plate([(x0 + x1) / 2, 2.3, 51], [x1 - x0, 1.2, 3.2], 'ivory', 'real-duration-ruler', root,
      ['#807866', '#a6b3ab', '#82917c', '#c2ae80'][i]);
    part.userData.geologicalInterval = period.id;
    part.userData.durationEndpoints = [x0, x1];
    part.userData.modelInput = { kind: 'select', selection: i, label: `真实时长尺：${period.label}` };
    return part;
  });
  inscription('46亿年前', 16, 3.0, root, [10, 3.0, 55], true);
  inscription('现在', 9, 3.0, root, [103.5, 3.0, 55], true);
  const markGeometries = [0, .25, .5, .75, 1].map(f => chamferedPlateGeometry([2 + 106 * f - .04, 2.94, 49.6], [2 + 106 * f + .04, 3.04, 50.5], 0));
  mesh(mergeInstrumentGeometry(markGeometries), 'steel', 'ruler-fine-divisions');
  const selectionPointer = plate([0, 3.28, 51], [.32, .32, 3.8], 'brass', 'selected-interval-pointer');
  let selected = 0;
  // Validate this instrument's subtree. The book may add separate support or
  // formation meshes afterwards; those do not belong to this folio's buffers.
  const ownedMeshes = b.meshes.slice(firstMesh), buffers = ownedMeshes.map(m => m.geometry.attributes.position.array);
  const meshCountInFolio = () => { let count = 0; root.traverse((node: any) => { if (node.isMesh) count++; }); return count; };
  return {
    update(_phase, selection, dt, reduced) {
      selected = geologicalInterval(selection).selected;
      // Hinge easing is display motion, independent of normalized lesson time.
      // All four specimens remain present and physically mounted on the rail.
      for (const leaf of leaves) {
        const target = leaf.selection === selected ? -.20 : -1.20;
        leaf.angle = reduced || !Number.isFinite(dt) || dt <= 0 ? target
          : leaf.angle + (target - leaf.angle) * (1 - Math.exp(-Math.min(dt, .1) * 5.8));
        if (Math.abs(target - leaf.angle) < .0001) leaf.angle = target;
        leaf.group.rotation.x = leaf.angle;
      }
      const interval = geologicalInterval(selected);
      selectionPointer.position.x = 2 + 106 * (interval.start + interval.end) / 2;
    },
    focusBounds: () => ({ min: [0, -s, back - 2 * s], max: [110 * s, 50 * s, back + 58 * s] }),
    describe: () => ({ kind: 'geological-time', selected, boundaryMa: [4600, 541, 252, 66, 0], interval: geologicalInterval(selected),
      representativeAssemblages: true, transitionIsBiologicalSimulation: false, equalDuration: false,
      widthUsesRealDuration: true, phaseMeaning: 'static-period-comparison',
      specimens: { kind: 'hinged-rock-folio', allLeavesMounted: true, equalLeafWidthsAreDuration: false,
        reliefs: leaves.map(leaf => leaf.relief), reliefsAreInterpretations: true, namedSpeciesReconstruction: false,
        hingeAngles: leaves.map(leaf => leaf.angle), rulerFractions: GEOLOGICAL_INTERVALS.map((_, i) => geologicalInterval(i).fraction),
        fixedMeshCount: meshCountInFolio() === ownedMeshes.length, buffersStable: ownedMeshes.every((m, i) => m.geometry.attributes.position.array === buffers[i]) } }),
  };
}
