import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSoilPores } from './textbook-ground-process-model';
import { createSoilInstrument } from './textbook-soil-instrument-parts';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';

/** Open-front packed aggregate sample. A pore is the SAME fixed inter-grain
 * cavity in all conditions: the water/air interface moves inside it, while
 * mineral grains and organic pieces never translate or swell. */
export function buildSoilPoreInstrument(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .45;
  const p = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, z0 + z * s];
  const { parts, solid, plate, pipe, bearing, finish } = createSoilInstrument(b, s);
  const tag = (mesh: any, name: string) => { mesh.userData.soilPoreRole = name; return mesh; };
  const selectPore = { kind: 'select', selection: 1, toggleTo: 2, label: '比较同一孔隙中的水与空气' };
  plate(p(4, .1, -15), p(96, 2.1, 23), '#544534', 'wood', 'soil-aggregate-bed');
  plate(p(4.7, 2.1, -14.3), p(95.3, 2.4, 22.3), '#a88b50', 'brass', 'bed-edge-reveal');
  plate(p(5.4, 2.4, -13.6), p(94.6, 3.2, 21.6), '#2c443d', 'enamel', 'soil-sampler-foot');
  parts.fasteners([p(8, 3.25, -11), p(92, 3.25, -11), p(8, 3.25, 19), p(92, 3.25, 19)], [0, 1, 0], .42 * s);
  for (const x of [15, 79]) for (const z of [-6, 10]) {
    pipe(p(x, 3.2, z), p(x, 7, z), .7 * s);
    bearing(p(x, 5.3, z), [0, 1, 0], 1.05 * s, 2.6 * s);
  }
  plate(p(10, 6.6, -10), p(84, 7.5, 14), '#d8d3bb', 'ivory', 'sample-retaining-floor');
  plate(p(10, 7.5, -10), p(84, 55.7, -8.8), '#635944', 'land', 'retained-specimen-back');
  for (const x of [10, 84]) {
    pipe(p(x, 7.5, -8.6), p(x, 55.8, -8.6), .4 * s, '#a88b50', 'brass');
    for (const y of [9.3, 53.5]) {
      plate(p(x - 1.2, y - 1, -9.8), p(x + 1.2, y + 1, 13.8), '#2c443d', 'enamel', 'sample-edge-clamp');
      parts.fasteners([p(x, y + 1.05, 11)], [0, 1, 0], .32 * s);
    }
  }
  const grains: any[] = [], organic: any[] = [];
  const grainFinishes=['#aa9471','#a58c68','#c1ad86','#8c7759'].map(color=>createSoilSpecimenFinish(b.pop,color,1,s));
  // Layers are packed through depth, not a row of separate display tokens.
  // All front pores align with the retained gaps behind them.
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
    const id = layer * 24 + row * 6 + col;
    let geometry: any;
    if (layer) {
      // Truncated aggregates share actual interstitial cavities. Rounded
      // shoulders leave a diamond pore at each four-grain contact, rather
      // than suspending a blue token in front of unrelated round pebbles.
      const outline = [[-6, -1.4], [-1.4, -6], [1.4, -6], [6, -1.4],
        [6, 1.4], [1.4, 6], [-1.4, 6], [-6, 1.4]];
      const perimeter = outline.flatMap((a, i) => { const c = outline[(i + 1) % outline.length];
        return [a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]]; });
      const vertices = [0, 0, 4.9 * s], indices: number[] = [];
      // A continuous, uneven domed surface, not the flat face of an extruded
      // polygon. Indexed shared vertices retain softly lit natural shoulders.
      for (const r of [.4, .75, 1]) for (let k = 0; k < perimeter.length; k++) {
        const [x, y] = perimeter[k], noise = Math.sin(id * 1.9 + k * 2.3) * .32 * (1 - r * .4);
        vertices.push(x * r * s, y * r * s, (4.8 - 3.0 * r ** 2 + noise) * s);
      }
      const n = perimeter.length;
      for (let k = 0; k < n; k++) indices.push(0, 1 + k, 1 + (k + 1) % n);
      for (let ring = 0; ring < 2; ring++) for (let k = 0; k < n; k++) {
        const a = 1 + ring * n + k, c = 1 + ring * n + (k + 1) % n, d = a + n, e = c + n;
        indices.push(a, d, c, c, d, e);
      }
      const back = vertices.length / 3;
      perimeter.forEach(([x, y]) => vertices.push(x * s, y * s, -4 * s));
      for (let k = 0; k < n; k++) { const a = 1 + 2 * n + k, c = 1 + 2 * n + (k + 1) % n;
        indices.push(a, back + k, c, c, back + k, back + (k + 1) % n); }
      geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
    } else {
      geometry = new T.IcosahedronGeometry(1, 1);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const rough = 1 + .07 * Math.sin(x * 7 + y * 5 - z * 8 + id * 1.37);
        positions.setXYZ(i, x * 5.9 * s * rough, y * 5.7 * s * rough, z * 4.7 * s * rough);
      } geometry.computeVertexNormals();
    }
    const mesh = tag(solid(geometry, ['#aa9471', '#a58c68', '#c1ad86', '#8c7759'][id % 4], 'rock', 'fixed-natural-aggregate'), 'mineral');
    mesh.material = grainFinishes[id%4];
    mesh.position.set(...p(17 + col * 12, 13 + row * 12, layer ? 8 : -3.8));
    if (!layer) mesh.rotation.set(0, Math.sin(id * .93) * .23, Math.sin(id * 1.73) * .12);
    mesh.userData.modelInput = selectPore; mesh.userData.interactionFeedback = false; grains.push(mesh);
  }
  // Humus fragments occupy the inter-aggregate contacts, together with the
  // same minerals and pores; there is no separate green tube above the soil.
  for (let i = 0; i < 15; i++) {
    const geometry = new T.IcosahedronGeometry(1, 1); geometry.scale((1.4 + i % 3 * .3) * s, .35 * s, 1.15 * s);
    const mesh = tag(solid(geometry, i % 2 ? '#423d2b' : '#5a4938', 'land', 'embedded-organic-fragment'), 'organic');
    mesh.position.set(...p(17 + i % 6 * 12 + (i % 2 ? 3 : -3), 19 + Math.floor(i / 6) * 12, 9 + i % 2));
    mesh.rotation.z = Math.sin(i * 2.1) * .45; organic.push(mesh);
  }
  type Point = [number, number];
  const outline: Point[] = [[0, -4.6], [4.6, 0], [0, 4.6], [-4.6, 0]];
  const clip = (line: number, below: boolean) => {
    const result: Point[] = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], c = outline[(i + 1) % outline.length], inA = below ? a[1] <= line : a[1] >= line, inC = below ? c[1] <= line : c[1] >= line;
      if (inA) result.push(a);
      if (inA !== inC) { const t = (line - a[1]) / (c[1] - a[1]); result.push([a[0] + (c[0] - a[0]) * t, line]); }
    } return result;
  };
  const cavities = [[23, 19], [35, 31], [47, 19], [59, 43], [71, 31]].map(([x, y], index) => {
    const make = (role: 'water' | 'air') => {
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(72 * 3), 3));
      const mesh = tag(solid(geometry, role === 'water' ? '#6d9da6' : '#dbe4dd', role, 'same-fixed-pore-' + role), role);
      mesh.userData.poreIndex = index; mesh.userData.modelInput = selectPore; mesh.userData.interactionFeedback = false;
      mesh.userData.castShadow = false; mesh.castShadow = false;
      if (role === 'air') { mesh.material.opacity = .035; mesh.material.depthWrite = false; mesh.receiveShadow = false; }
      return mesh;
    };
    const water = make('water'), air = make('air');
    return { x, y, water, air };
  });
  const write = (mesh: any, polygon: Point[], x: number, y: number) => {
    const array = mesh.geometry.attributes.position, vertices: number[] = [];
    const tri = (a: Vec3, c: Vec3, d: Vec3) => vertices.push(...a, ...c, ...d);
    for (let i = 1; i < polygon.length - 1; i++) {
      tri(p(x + polygon[0][0], y + polygon[0][1], 13), p(x + polygon[i][0], y + polygon[i][1], 13), p(x + polygon[i + 1][0], y + polygon[i + 1][1], 13));
      tri(p(x + polygon[0][0], y + polygon[0][1], 4), p(x + polygon[i + 1][0], y + polygon[i + 1][1], 4), p(x + polygon[i][0], y + polygon[i][1], 4));
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], c = polygon[(i + 1) % polygon.length];
      tri(p(x + a[0], y + a[1], 4), p(x + a[0], y + a[1], 13), p(x + c[0], y + c[1], 13));
      tri(p(x + a[0], y + a[1], 4), p(x + c[0], y + c[1], 13), p(x + c[0], y + c[1], 4));
    }
    for (let i = 0; i < array.count; i++) array.setXYZ(i, vertices[i * 3] ?? x * s, vertices[i * 3 + 1] ?? y * s, vertices[i * 3 + 2] ?? z0 + 4 * s);
    array.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    mesh.userData.porePolygon = polygon.map(a => [...a]);
  };
  // The three-stop humidity control is mounted on a true stem and bearing.
  plate(p(86, 3.2, 3), p(93, 5, 17), '#2c443d', 'enamel', 'moisture-control-foot');
  pipe(p(89.5, 5, 9), p(89.5, 15.6, 9), .7 * s);
  const disk = tag(solid(new T.CylinderGeometry(4.4 * s, 4.4 * s, 1 * s, 48), '#e3ddc9', 'ivory', 'three-stop-control-face'), 'moisture-dial');
  disk.rotation.x = Math.PI / 2; disk.position.set(...p(89.5, 16.8, 11));
  const wheel = parts.knob(p(89.5, 16.8, 12.1), [0, 0, 1], 1.6 * s, 1.2 * s);
  const controlMeshes: any[] = [disk]; wheel.traverse((m: any) => { if (m.isMesh) { tag(m, 'moisture-knob'); controlMeshes.push(m); } });
  finish();
  let state = evaluateSoilPores(0), previous = -1;
  const grainPositions = grains.map(m => m.position.toArray());
  return { update(_phase, selection) {
    state = evaluateSoilPores(selection);
    if (previous !== state.mode) {
      const h = state.water <= .5 ? Math.sqrt(state.water / 2) : 1 - Math.sqrt((1 - state.water) / 2);
      const line = -4.6 + 9.2 * h;
      cavities.forEach(({ x, y, water, air }) => { write(water, clip(line, true), x, y); write(air, clip(line, false), x, y);
        water.userData.fraction = state.water; air.userData.fraction = state.air; });
      for (const mesh of controlMeshes) { mesh.userData.modelInput = { kind: 'select', selection: (state.mode + 1) % 3, label: '转动三档干湿旋钮，保持固体与孔隙空间不变' }; mesh.userData.interactionFeedback = false; }
      previous = state.mode;
    }
    const angle = -Math.PI * .75 + state.mode * Math.PI * .75;
    b.contour([p(89.5 + Math.sin(angle) * 1.9, 16.8 + Math.cos(angle) * 1.9, 12.9),
      p(89.5 + Math.sin(angle) * 3.6, 16.8 + Math.cos(angle) * 3.6, 12.9)], .5);
    for (let i = 0; i < 3; i++) { const a = -Math.PI * .75 + i * Math.PI * .75;
      b.contour([p(89.5 + Math.sin(a) * 3.9, 16.8 + Math.cos(a) * 3.9, 11.6), p(89.5 + Math.sin(a) * 4.25, 16.8 + Math.cos(a) * 4.25, 11.6)], .35); }
    // Fine pore outlines mark void boundaries, never measure proportions.
    for (const { x, y } of cavities) b.contour(outline.map(([u, v]) => p(x + u, y + v, 13.1)).concat([p(x + outline[0][0], y + outline[0][1], 13.1)]), .2);
  }, focusBounds: () => ({ min: p(2, 0, -16), max: p(98, 60, 25) }),
    describe: () => ({ kind: 'soil-composition', ...state, components: ['mineral', 'organic', 'water', 'air'], waterReplacesAirInSamePores: true,
      construction: 'packed-open-soil-sample-instrument', actualPoreCount: cavities.length, mineralCount: grains.length, embeddedOrganicCount: organic.length,
      poreShapeConstant: true, waterVolumeUsesDiamondArea: true, airIsUnfilledPore: true, selfSupporting: true,
      solidsStationary: grains.every((m, i) => m.position.toArray().every((v: number, k: number) => v === grainPositions[i][k])) }),
  };
}
