import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { DISASTER_CHAIN_LAYOUT as L, chainFreshHead, chainSalineInterface, chainValleyGround, chainRiverHalfWidth, evaluateDisasterChain } from './textbook-disaster-chain-model';

/** Real, reversible paper solids above the preserved textbook page. Each
 * material, mesh and vertex buffer is allocated once at construction. */
export function buildDisasterChainWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .9;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z * s];
  let state = evaluateDisasterChain(0);
  const role = (mesh: any, name: string) => { mesh.userData.chainRole = name; return mesh; };
  const solid = (geometry: any, color: string, name: string, at: Vec3) => {
    geometry.scale(s, s, s); const mesh = role(b.mesh(geometry, color, false), name); mesh.position.set(...p(...at)); return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, name: string) =>
    solid(new T.BoxGeometry(w, h, d), color, name, [x, y, z]);
  const label = (text: string, at: Vec3, w: number, h = 5.5) => role(b.label(text, p(...at), w * s, h * s), 'label');
  const text = (mesh: any, value: string) => {
    if (mesh.userData.text === value) return;
    const canvas = mesh.material.map.image as HTMLCanvasElement, c = canvas.getContext('2d')!;
    c.fillStyle = '#faf7ee'; c.fillRect(0, 0, canvas.width, canvas.height);
    let size = Math.floor(canvas.height * .69); c.font = `${size}px FieldSerif,SimSun,serif`;
    size = Math.min(size, Math.floor(size * canvas.width * .9 / Math.max(1, c.measureText(value).width)));
    c.font = `${size}px FieldSerif,SimSun,serif`; c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(value, canvas.width / 2, canvas.height * .53); mesh.material.map.needsUpdate = true;
    mesh.userData.text = value; mesh.userData.fontRatio = size / canvas.height;
  };
  function band(name: string, color: string, count = 48) {
    const g = new T.BufferGeometry(), a = new T.Float32BufferAttribute(new Float32Array((count + 1) * 12), 3), ix: number[] = [];
    for (let i = 0; i < count; i++) {
      const k = i * 4;
      for (const [a0, b0, c0, d0] of [[0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]])
        ix.push(k + a0, k + b0, k + c0, k + a0, k + c0, k + d0);
    }
    ix.push(0, 1, 3, 0, 3, 2);
    const last = count * 4; ix.push(last, last + 2, last + 3, last, last + 3, last + 1);
    g.setAttribute('position', a); g.setIndex(ix);
    const mesh = role(b.mesh(g, color, false), name);
    return { mesh, set(from: number, to: number, upper: (x: number) => number, lower: (x: number) => number,
      back: (x: number) => number, front: (x: number) => number) {
      for (let i = 0; i <= count; i++) {
        const x = from + (to - from) * i / count, hi = upper(x), lo = lower(x), z1 = back(x), z2 = front(x);
        for (const [j, y, z] of [[0, hi, z1], [1, hi, z2], [2, lo, z1], [3, lo, z2]]) a.setXYZ(i * 4 + j, ...p(x, y, z));
      }
      a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    }, edges(width = .45) {
      if (!mesh.visible) return;
      for (const side of [0, 1]) b.contour(Array.from({ length: count + 1 }, (_, i): Vec3 =>
        [a.getX(i * 4 + side), a.getY(i * 4 + side) + .03 * s, a.getZ(i * 4 + side)]), width);
      for (const i of [0, count]) for (const side of [0, 1]) {
        const k = i * 4 + side;
        b.contour([[a.getX(k), a.getY(k), a.getZ(k)], [a.getX(k + 2), a.getY(k + 2), a.getZ(k + 2)]], width);
      }
    } };
  }

  // Coastal cutaway: the front section exposes saturated sediment. Its blue
  // saline wedge advances underground, while the open sea stays at one level.
  const droughtStart = b.meshes.length;
  box(51.5, 2, 29, 91, 4, 42, '#b9aa94', 'bedrock');
  const freshwater = band('fresh-aquifer', '#aac5c2'), drySediment = band('unsaturated-sediment', '#ded0b0');
  const cap = box(39, 23.5, 29, 66, 6, 42, '#c5b293', 'compressible-layer');
  const sea = box(84.5, (4 + L.seaLevel) / 2, 29, 25, L.seaLevel - 4, 42, '#96bac4', 'fixed-sea');
  const saline = band('saline-wedge', '#699ba7');
  const pond = solid(new T.CylinderGeometry(4.5, 4.5, .25, 32), C.water, 'surface-water-source', [20, L.originalSurface + .16, 17]);
  const pipe = solid(new T.CylinderGeometry(.55, .55, 1, 10), '#d0d2c0', 'extraction-well', [44, 20, 31]);
  const wellHead = box(44, 30, 31, 4.5, 2, 2.8, C.paper, 'extraction-well');
  const spout = solid(new T.CylinderGeometry(.34, .34, 5, 10).rotateZ(Math.PI / 2), '#828f85', 'extraction-well', [47, 29.5, 31]);
  const handle = box(44, 31, 31, 6.5, .45, .7, C.rock, 'extraction-well');
  [pipe, wellHead, spout, handle].forEach(mesh => {
    mesh.userData.modelInput = { kind: 'replay', selection: 0, label: '重放沿海缺水与地下水变化' };
  });
  const drops = Array.from({ length: 3 }, () => solid(new T.SphereGeometry(.3, 8, 6), C.water, 'extraction-water', [44, 12, 31.6]));
  const dwelling = [box(29, 28.5, 20, 6.4, 4, 5, C.paper, 'subsiding-building'),
    solid(new T.ConeGeometry(5, 2.6, 4).rotateY(Math.PI / 4), '#a18d72', 'subsiding-building', [29, 31.6, 20]),
    box(29, 27.8, 22.55, 1.3, 2.5, .12, '#75867a', 'subsiding-building')];
  dwelling[1].scale.z = .78;
  const freshLabel = label('淡水', [22, 12, 55], 10.5), seaLabel = label('海水', [85, 24, 37], 10.5);
  const wellLabel = label('抽水井', [44, 36, 29], 17);
  wellLabel.userData.modelInput = { kind: 'replay', selection: 0, label: '重放沿海缺水与地下水变化' };
  const droughtMeshes = b.meshes.slice(droughtStart);

  // Mountain river valley: the same pieces slide, become the obstruction,
  // and leave an actual central gap when this selected dam breaches.
  const quakeStart = b.meshes.length;
  box(51, 1.4, 29.5, 90, 2.8, 45, '#b9aa94', 'valley-bedrock');
  const bank = (back: number, front: number, name: string) => {
    const shape = new T.Shape(); shape.moveTo(back, L.valleyBase);
    for (let i = 0; i <= 28; i++) { const z = back + (front - back) * i / 28; shape.lineTo(z, chainValleyGround(z)); }
    shape.lineTo(front, L.valleyBase); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: 90, bevelEnabled: false, curveSegments: 1 }), a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const z = a.getX(i), y = a.getY(i), x = 6 + a.getZ(i); a.setXYZ(i, ...p(x, y, z)); }
    g.computeVertexNormals(); return role(b.mesh(g, '#b5bd9d', false), name);
  };
  bank(39.4, 52, 'front-river-bank');
  const river = box(51, 3.2, 35.5, 90, .9, 9, C.water, 'river');
  const hillHeight = (x: number, z: number) => {
    const t = Math.max(0, Math.min(1, (30.6 - z) / 10));
    const foothill = L.valleyBase + L.bankSlope * Math.min(14, 35 - z) ** 2;
    return foothill + 23 * Math.exp(-((x - 55) ** 2 / 600 + (z - 10) ** 2 / 145)) * t * t * (3 - 2 * t);
  };
  const hillPositions: number[] = [], hillIndices: number[] = [], nx = 36, nz = 15;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = 6 + 90 * i / nx, z = 7 + 23.6 * j / nz; hillPositions.push(...p(x, hillHeight(x, z), z));
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; hillIndices.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1); }
  }
  const hillBoundary: number[] = [];
  for (let i = 0; i <= nx; i++) hillBoundary.push(i);
  for (let j = 1; j <= nz; j++) hillBoundary.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) hillBoundary.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) hillBoundary.push(j * (nx + 1));
  for (let i = 0; i < hillBoundary.length; i++) {
    const a = hillBoundary[i] * 3, c = hillBoundary[(i + 1) % hillBoundary.length] * 3, k = hillPositions.length / 3;
    hillPositions.push(hillPositions[a], hillPositions[a + 1], hillPositions[a + 2], hillPositions[c], hillPositions[c + 1], hillPositions[c + 2],
      hillPositions[c], L.valleyBase * s, hillPositions[c + 2], hillPositions[a], L.valleyBase * s, hillPositions[a + 2]);
    hillIndices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const hillGeometry = new T.BufferGeometry(); hillGeometry.setAttribute('position', new T.Float32BufferAttribute(hillPositions, 3));
  hillGeometry.setIndex(hillIndices); hillGeometry.computeVertexNormals();
  const hill = role(b.mesh(hillGeometry, '#aeb69a', false), 'steep-loose-slope');
  const stones = Array.from({ length: 12 }, (_, i) => {
    const row = Math.floor(i / 4), col = i % 4, x = 55 + (col - 1.5) * 2.5, z = 13 + row * 2;
    const r = 2.4 + (i % 3) * .28, y = hillHeight(x, z) + r * .45;
    const mesh = solid(new T.IcosahedronGeometry(r, 0), i % 2 ? '#b9a58a' : '#c6b393', 'landslide-block', [x, y, z]);
    mesh.scale.set(1.18, 1.18, 1.16); mesh.userData.modelInput = { kind: 'replay', selection: 1, label: '重放滑坡堵河过程' };
    return { mesh, x, y, z, row, col, r };
  });
  const lake = band('impounded-lake', '#7eabb6'), flood = band('downstream-flood', '#82aaad');
  const settlement: any[] = [];
  for (const [x, z, w] of [[79, 43, 4.9], [86, 45.5, 4.4], [90, 42, 3.8]]) {
    const ground = chainValleyGround(z);
    const wall = box(x, ground + 1.7, z, w, 3.4, w * .77, C.paper, 'downstream-settlement');
    const roof = solid(new T.ConeGeometry(w * .76, 2, 4).rotateY(Math.PI / 4), '#aa9275', 'downstream-settlement', [x, ground + 4.4, z]);
    roof.scale.z = .76; settlement.push(wall, roof);
  }
  const slideLabel = label('滑坡体', [65, 35, 19], 17), lakeLabel = label('堰塞湖', [27, 16, 32], 17);
  slideLabel.userData.modelInput = { kind: 'replay', selection: 1, label: '重放滑坡堵河过程' };
  const breachLabel = label('溃口', [57, 18, 40], 11.5), townLabel = label('聚落', [85, 22, 53], 11.5);
  const quakeMeshes = b.meshes.slice(quakeStart);

  const caption = label(state.caption, [48, 45, 7], 31, 6);
  const replayTile = box(94, 1.2, 61, 8, .7, 8, C.paper, 'replay');
  const rewind = solid(new T.TorusGeometry(2.15, .28, 5, 24, Math.PI * 1.62).rotateX(-Math.PI / 2).rotateY(-Math.PI * .1), C.cool, 'replay', [94, 1.8, 61]);
  const arrowTip = solid(new T.ConeGeometry(.85, 1.7, 3).rotateX(Math.PI / 2).rotateZ(.35), C.cool, 'replay', [92.2, 1.9, 59.9]);
  [replayTile, rewind, arrowTip].forEach(mesh => { mesh.userData.modelInput = { kind: 'replay', label: '重放当前情景' }; });
  // Large cutaway surfaces need quiet paper grain. Dense diagonal hatching
  // on every face masks both the groundwater boundary and the breach.
  const watery = new Set(['fresh-aquifer', 'saline-wedge', 'fixed-sea', 'surface-water-source', 'river', 'impounded-lake', 'downstream-flood']);
  for (const mesh of [...droughtMeshes, ...quakeMeshes]) if (mesh.userData.kind !== 'text-label') {
    const u = mesh.material.userData.uniforms;
    if (u) { u.uHatch.value = watery.has(mesh.userData.chainRole) ? .1 : .24; u.uSpacing.value = 2.9; u.uShade.value = .07; }
  }
  const dynamic = new Set([freshwater.mesh, drySediment.mesh, saline.mesh, lake.mesh, flood.mesh]);
  let previous = '';
  return {
    update(phase, selection) {
      state = evaluateDisasterChain(phase, selection); const d = state.drought, q = state.earthquake, coastal = state.branch === 'drought';
      for (const mesh of droughtMeshes) mesh.visible = coastal;
      for (const mesh of quakeMeshes) mesh.visible = !coastal;
      text(caption, state.caption);
      if (`${state.branch}/${state.phase}` !== previous) {
        if (coastal) {
          freshwater.set(6, 72, x => chainFreshHead(state, x), () => 4, () => 8, () => 50);
          drySediment.set(6, 72, () => 20.5, x => chainFreshHead(state, x), () => 8, () => 50);
          saline.set(d.salineToe, 72, x => chainSalineInterface(state, x), () => 4, () => 49.6, () => 50.3);
          const capHeight = d.surface - 20.5; cap.scale.y = capHeight / 6; cap.position.y = (20.5 + capHeight / 2) * s;
          pond.position.y = (d.surface + .16) * s; pond.scale.set(1.5 * d.pondRadius, 1, .83 * d.pondRadius);
          const top = d.surface + 3.4; pipe.scale.y = top - 8; pipe.position.y = (8 + top) / 2 * s;
          wellHead.position.y = (d.surface + 3.4) * s; spout.position.y = (d.surface + 3.2) * s; handle.position.y = (d.surface + 4.7) * s;
          for (const [i, mesh] of dwelling.entries()) mesh.position.y = (d.surface + [2, 5.1, 1.3][i]) * s;
        } else {
          lake.set(6, 52.5, () => q.lakeLevel, () => L.valleyBase,
            () => 35 - chainRiverHalfWidth(q.lakeLevel), () => 35 + chainRiverHalfWidth(q.lakeLevel));
          const floodTop = (x: number) => {
            const t = Math.max(0, Math.min(1, (q.floodFront - x) / 6));
            return L.riverY + (q.floodLevel - L.riverY) * t * t * (3 - 2 * t);
          };
          flood.set(56, Math.max(56.001, q.floodFront), floodTop, () => L.valleyBase,
            x => 35 - chainRiverHalfWidth(floodTop(x)), x => 35 + chainRiverHalfWidth(floodTop(x)));
        }
        previous = `${state.branch}/${state.phase}`;
      }
      if (coastal) {
        drops.forEach((mesh, i) => {
          mesh.visible = d.pumpingActive;
          mesh.position.set(...p(44, 10 + (d.surface + 2 - 10) * ((phase * 5 + i / 3) % 1), 31.65));
        });
        freshwater.edges(.55); drySediment.edges(.35); saline.edges(.6);
        for (const y of [1.5, 3]) b.contour([p(6, y, 50.2), p(97, y + .08, 50.2)], .3);
        if (d.subsidence > .02) b.contour([p(8, L.originalSurface, 50.4), p(66, L.originalSurface, 50.4)], .35);
        for (const z of [14, 26, 39]) {
          b.contour(Array.from({ length: 23 }, (_, i) => p(75 + i * .85, L.seaLevel + .06, z + Math.sin(i * .7) * .3)), .3);
        }
        if (d.deficit > .15) for (const [x, z] of [[12, 34], [23, 43], [53, 16], [61, 37]]) {
          const k = d.deficit;
          b.contour([p(x - 1.7 * k, d.surface + .06, z - k), p(x, d.surface + .06, z), p(x + 2.5 * k, d.surface + .06, z - 1.6 * k)], .34);
          b.contour([p(x, d.surface + .06, z), p(x + k, d.surface + .06, z + 2.5 * k)], .34);
        }
      } else {
        hill.position.x = q.shake * s;
        stones.forEach(({ mesh, x, y, z, row, col, r }, i) => {
          const central = row === 1, erosion = central ? q.breach : 0;
          mesh.position.set(...p(x + q.shake * (1 - q.slide) + 8 * erosion,
            y + (5.7 + r * .25 + (col % 2) * .18 - y) * q.slide - 4.7 * erosion,
            z + (31.2 + row * 3.8 - z) * q.slide));
          mesh.rotation.set(q.slide * (.23 + i * .03), q.slide * (i % 2 ? .65 : -.45), q.slide * (col - 1.5) * .16);
        });
        settlement.forEach((mesh, i) => { mesh.position.x = p([79, 79, 86, 86, 90, 90][i], 0, 0)[0] + q.shake * .6 * s; });
        lake.mesh.visible = q.lake > .002; flood.mesh.visible = q.flood > .002;
        slideLabel.visible = q.slide < .94; lakeLabel.visible = q.lake > .15; breachLabel.visible = q.breach > .05;
        slideLabel.position.set(...p(65, 35 - 15 * q.slide, 19 + 14 * q.slide));
        lake.edges(.5); flood.edges(.55);
        if (q.blockage < .98) b.trace([p(8, 3.82, 35), p(50, 3.82, 35)], phase * 2, 3, 'flow', 1, 1 - q.blockage);
        if (q.flood < .02 && q.blockage < .98) b.trace([p(61, 3.82, 35), p(94, 3.82, 35)], phase * 2, 2, 'flow', 1, 1 - q.blockage);
        if (q.breach > .01) b.trace([p(49, q.lakeLevel + .14, 35), p(56, q.floodLevel + .14, 35), p(Math.max(57, q.floodFront - 1), q.floodLevel + .14, 35)], phase * 3, 4, 'flow', 1, q.flood);
      }
      for (const mesh of coastal ? droughtMeshes : quakeMeshes) if (mesh.visible && mesh.userData.kind !== 'text-label' && !dynamic.has(mesh)) b.outline(mesh, mesh === hill ? .32 : .43);
      [replayTile, rewind, arrowTip].forEach(mesh => b.outline(mesh, .42));
    },
    focusBounds: () => ({ min: p(1, -1, 3), max: p(101, 50, 67) }),
    describe: () => ({ kind: 'conditional-disaster-links', ...state,
      activeScenario: state.branch, seaSurfaceStable: true, groundwaterMechanism: 'selected-coastal-extraction-and-compressible-sediment',
      linkedStagesAreConditional: true, selectedDamBreach: true, originalPagePreserved: true,
      buffersStable: true, salineIntrusionIsUnderground: true,
      waterBodyGeometry: 'fixed-topology-closed-volumes',
      interactions: { well: 'replay-drought', landslide: 'replay-earthquake', replayTile: 'replay-current' },
      fixedVertexBuffers: [freshwater, drySediment, saline, lake, flood].map(body => body.mesh.geometry.attributes.position.count) }),
  };
}
