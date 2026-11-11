import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseDialPoint, type PhaseDial } from './textbook-model-input';
import { evaluateTide, tideGround, tideShoreX, TIDE_LAYOUT as L } from './textbook-tide-model';

/** A sloping shore and a fitted water volume. Its changing shoreline is the
 * actual top/bottom intersection, rather than a rectangle hidden in land. */
export function buildTideWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .9;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z * s];
  const role = (mesh: any, value: string) => { mesh.userData.tideRole = value; return mesh; };
  const paper = (color: string, hatch = .18) => {
    const material = createSpecimenMaterial(b.pop, { color, ink: '#697567', hatch, shade: .065, spacing: 2.9, seed: 54 });
    material.side = T.DoubleSide; return material;
  };
  const solid = (geometry: any, color: string, name: string, at: Vec3) => {
    geometry.scale(s, s, s); const mesh = role(b.mesh(geometry, color, false), name); mesh.position.set(...p(...at)); return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, name: string) =>
    solid(new T.BoxGeometry(w, h, d), color, name, [x, y, z]);
  const text = (mesh: any, value: string) => {
    if (mesh.userData.text === value) return;
    const canvas = mesh.material.map.image as HTMLCanvasElement, c = canvas.getContext('2d')!;
    c.fillStyle = '#faf7ee'; c.fillRect(0, 0, canvas.width, canvas.height);
    let size = Math.floor(canvas.height * .69); c.font = `${size}px FieldSerif,SimSun,serif`;
    size = Math.min(size, Math.floor(size * canvas.width * .9 / Math.max(1, c.measureText(value).width)));
    c.font = `${size}px FieldSerif,SimSun,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#303a40';
    c.fillText(value, canvas.width / 2, canvas.height * .53); mesh.material.map.needsUpdate = true;
    mesh.userData.text = value; mesh.userData.fontRatio = size / canvas.height;
  };

  const nx = 88, nz = 32, groundVertices: number[] = [], groundIndices: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = 6 + 91 * i / nx, z = 6 + 49 * j / nz;
    groundVertices.push(...p(x, tideGround(x, z), z));
    if (i < nx && j < nz) { const k = j * (nx + 1) + i; groundIndices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
  }
  const perimeter: number[] = [];
  for (let i = 0; i <= nx; i++) perimeter.push(i);
  for (let j = 1; j <= nz; j++) perimeter.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) perimeter.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) perimeter.push(j * (nx + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i] * 3, c = perimeter[(i + 1) % perimeter.length] * 3, k = groundVertices.length / 3;
    groundVertices.push(groundVertices[a], groundVertices[a + 1], groundVertices[a + 2], groundVertices[c], groundVertices[c + 1], groundVertices[c + 2],
      groundVertices[c], 0, groundVertices[c + 2], groundVertices[a], 0, groundVertices[a + 2]);
    groundIndices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const bottom = groundVertices.length / 3; groundVertices.push(...p(6, 0, 6), ...p(97, 0, 6), ...p(97, 0, 55), ...p(6, 0, 55));
  groundIndices.push(bottom, bottom + 1, bottom + 2, bottom, bottom + 2, bottom + 3);
  const groundGeometry = new T.BufferGeometry(); groundGeometry.setAttribute('position', new T.Float32BufferAttribute(groundVertices, 3));
  groundGeometry.setIndex(groundIndices); groundGeometry.computeVertexNormals();
  const ground = role(b.mesh(groundGeometry, '#c8b99d', false), 'fixed-shore'); ground.material = paper('#c8b99d', .16);

  // A sand band follows the two extreme shorelines on this same terrain.
  // Rising water naturally occludes it; no visibility trick swaps the shore.
  const bandVertices: number[] = [], bandIndices: number[] = [];
  for (let j = 0; j <= 40; j++) {
    const z = 6 + 49 * j / 40;
    for (const level of [L.low, L.high]) bandVertices.push(...p(tideShoreX(level, z), level + .035, z));
    if (j < 40) { const k = j * 2; bandIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const bandGeometry = new T.BufferGeometry(); bandGeometry.setAttribute('position', new T.Float32BufferAttribute(bandVertices, 3));
  bandGeometry.setIndex(bandIndices); bandGeometry.computeVertexNormals();
  const sand = role(b.mesh(bandGeometry, '#ddd0ad', false, false), 'fixed-intertidal-band'); sand.material = paper('#ddd0ad', .11);

  const wx = 42, wz = 40, stride = (wx + 1) * (wz + 1);
  const waterGeometry = new T.BufferGeometry(), waterPosition = new T.Float32BufferAttribute(new Float32Array(stride * 6), 3), waterIndices: number[] = [];
  for (const face of [0, 1]) for (let j = 0; j < wz; j++) for (let i = 0; i < wx; i++) {
    const k = face * stride + j * (wx + 1) + i;
    if (face === 0) waterIndices.push(k, k + wx + 1, k + 1, k + 1, k + wx + 1, k + wx + 2);
    else waterIndices.push(k, k + 1, k + wx + 1, k + 1, k + wx + 2, k + wx + 1);
  }
  const waterBorder: number[] = [];
  for (let i = 0; i <= wx; i++) waterBorder.push(i);
  for (let j = 1; j <= wz; j++) waterBorder.push(j * (wx + 1) + wx);
  for (let i = wx - 1; i >= 0; i--) waterBorder.push(wz * (wx + 1) + i);
  for (let j = wz - 1; j > 0; j--) waterBorder.push(j * (wx + 1));
  for (let i = 0; i < waterBorder.length; i++) {
    const a = waterBorder[i], c = waterBorder[(i + 1) % waterBorder.length];
    waterIndices.push(a, a + stride, c, c, a + stride, c + stride);
  }
  waterGeometry.setAttribute('position', waterPosition); waterGeometry.setIndex(waterIndices);
  const water = role(b.mesh(waterGeometry, '#9abfc6', false), 'fitted-seawater'); water.material = paper('#9abfc6', .045);

  const foamGeometry = new T.BufferGeometry(), foamPosition = new T.Float32BufferAttribute(new Float32Array(41 * 6), 3), foamIndices: number[] = [];
  for (let j = 0; j < 40; j++) { const k = j * 2; foamIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  foamGeometry.setAttribute('position', foamPosition); foamGeometry.setIndex(foamIndices);
  const foam = role(b.mesh(foamGeometry, '#f3eedb', false, false), 'shoreline'); foam.material = paper('#f3eedb', .02);

  // A small Chinese coastal skiff: a thick rim, a shallow open interior and
  // two actual benches. Its floor is above the outside waterline.
  const footprint = [[-6, 0], [-4.2, -2], [4.2, -2], [6, 0], [4.2, 2], [-4.2, 2]];
  const hullV: number[] = [], hullI: number[] = [];
  for (const layer of [0, 1, 2, 3]) for (const [x, z] of footprint) {
    const bow = Math.abs(x) === 6 ? .45 : 0;
    const factor = [1, .73, .85, .69][layer], y = [.95 + bow, -L.boatDraft, .82 + bow, .24][layer];
    hullV.push(x * factor, y, z * factor);
  }
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    for (const [a, c, d, e] of [[i, i + 6, j + 6, j], [i + 12, j + 12, j + 18, i + 18], [i, j, j + 12, i + 12]])
      hullI.push(a, c, d, a, d, e);
  }
  for (let i = 1; i < 5; i++) { hullI.push(6, 6 + i + 1, 6 + i); hullI.push(18, 18 + i, 18 + i + 1); }
  const hullGeometry = new T.BufferGeometry(); hullGeometry.setAttribute('position', new T.Float32BufferAttribute(hullV, 3)); hullGeometry.setIndex(hullI); hullGeometry.computeVertexNormals();
  const hull = solid(hullGeometry, '#af9873', 'floating-skiff', [L.boatX, 0, L.boatZ]); hull.material = paper('#af9873', .24);
  const benches = [-1.9, 1.9].map(x => box(L.boatX + x, .82, L.boatZ, .65, .32, 3.2, '#e1d4b4', 'floating-skiff'));
  benches.forEach(mesh => { mesh.material = paper('#e1d4b4', .12); });

  const pole = solid(new T.CylinderGeometry(.36, .36, 21.4, 10), '#6b7d71', 'fixed-tide-gauge', [L.gaugeX, 13.3, L.gaugeZ]);
  const gaugeParts = [pole];
  for (let i = 0; i < 7; i++) {
    const mesh = box(L.gaugeX, 4.4 + i * 2.8, L.gaugeZ + .42, 1.25, 2.5, .25, i % 2 ? '#ad7d61' : '#f1eddd', 'fixed-tide-gauge');
    mesh.material = paper(i % 2 ? '#ad7d61' : '#f1eddd', .08); gaugeParts.push(mesh);
  }
  const cap = box(L.gaugeX, 24.2, L.gaugeZ, 2.2, .45, 1.1, '#718071', 'fixed-tide-gauge'); gaugeParts.push(cap);
  const waterMark = box(L.gaugeX, L.low, L.gaugeZ + .65, 3, .28, .25, '#3f7b87', 'gauge-water-mark');

  const dial: PhaseDial = { center: p(88, 30.4, 60), radiusX: 7.2 * s, radiusY: 7.6 * s };
  const dialPlate = solid(new T.CylinderGeometry(8.4, 8.4, .55, 40).rotateX(Math.PI / 2), '#eee7d4', 'fixed-tide-dial', [88, 30.4, 59.6]);
  dialPlate.material = paper('#eee7d4', .08);
  const handle = solid(new T.SphereGeometry(1.45, 16, 10), '#6c99a3', 'tide-handle', [88, 30.4, 60]);
  handle.scale.z = .4; handle.material = paper('#6c99a3', .08); handle.userData.tideHandle = true;
  handle.userData.modelInput = { kind: 'phase-dial', dial, label: '拖动潮汐手柄，观察水面和岸线涨落' };

  const caption = b.label('低潮', p(73, 42, 8), 13 * s, 7 * s);
  caption.userData.tideRole = 'stage-label';
  // Keep the skiff's full low-to-high travel unobstructed. The gauge label
  // sits to its right; the intertidal label occupies the upper dry slope.
  const gaugeLabel = b.label('固定潮尺', p(46, 29.5, 48), 24 * s, 6.4 * s); gaugeLabel.userData.tideRole = 'gauge-label';
  const bandLabel = b.label('潮间带', p(73, 40.5, 56), 20 * s, 6.4 * s); bandLabel.userData.tideRole = 'intertidal-label';
  let state = evaluateTide(0), previous = -1;
  return {
    update(phase) {
      state = evaluateTide(phase); text(caption, state.caption);
      if (phase !== previous) {
        for (let j = 0; j <= wz; j++) {
          const z = 6 + 49 * j / wz, shore = tideShoreX(state.waterLevel, z);
          for (let i = 0; i <= wx; i++) {
            const x = 6 + (shore - 6) * i / wx, k = j * (wx + 1) + i;
            waterPosition.setXYZ(k, ...p(x, state.waterLevel, z));
            waterPosition.setXYZ(k + stride, ...p(x, Math.min(state.waterLevel, tideGround(x, z)), z));
          }
        }
        waterPosition.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingBox(); waterGeometry.computeBoundingSphere();
        state.shoreline.forEach(([x, y, z], i) => {
          foamPosition.setXYZ(i * 2, ...p(x - .46, y + .055, z)); foamPosition.setXYZ(i * 2 + 1, ...p(x, y + .055, z));
        });
        foamPosition.needsUpdate = true; foamGeometry.computeVertexNormals(); foamGeometry.computeBoundingSphere();
        hull.position.y = state.boat.waterline * s;
        benches.forEach(mesh => { mesh.position.y = (state.boat.waterline + .82) * s; });
        waterMark.position.y = (state.gauge.waterMark + .07) * s;
        handle.position.set(...phaseDialPoint(state.phase, dial)); previous = phase;
      }
      for (const z of [6, 55]) {
        b.contour(Array.from({ length: 89 }, (_, i) => { const x = 6 + 91 * i / 88; return p(x, tideGround(x, z), z); }), .42);
        b.contour([p(6, 0, z), p(97, 0, z)], .4);
      }
      for (const [x, z] of [[6, 6], [97, 6], [6, 55], [97, 55]]) b.contour([p(x, 0, z), p(x, tideGround(x, z), z)], .45);
      b.contour([p(6, state.waterLevel, 55.04), p(state.shorelineFront, state.waterLevel, 55.04)], .63);
      b.contour(state.shoreline.map(([x, y, z]) => p(x - .08, y + .07, z)), .36);
      // These quiet, stationary surface strokes do not imply a local tidal
      // current direction. No independent wave clock moves the skiff.
      for (const z of [13, 36, 47]) b.contour(Array.from({ length: 18 }, (_, i) => p(8 + i * 1.45, state.waterLevel + .075, z + .3 * Math.sin(i * .7))), .25);
      for (const mesh of [hull, ...benches]) b.outline(mesh, .4);
      for (const mesh of [...gaugeParts, waterMark, dialPlate, handle]) b.outline(mesh, .34);
      for (let i = 0; i < 7; i++) b.contour([p(L.gaugeX - .7, 3.1 + i * 2.8, L.gaugeZ + .68), p(L.gaugeX + 1.4, 3.1 + i * 2.8, L.gaugeZ + .68)], .32);
      b.contour(Array.from({ length: 65 }, (_, i) => {
        const a = i / 64 * Math.PI * 2; return [dial.center[0] + Math.cos(a) * dial.radiusX, dial.center[1] + Math.sin(a) * dial.radiusY, dial.center[2]] as Vec3;
      }), .32);
      for (const value of [0, .25, .5, .75]) {
        const at = phaseDialPoint(value, dial), direction = b.v(at).sub(b.v(dial.center)).normalize();
        b.contour([at, b.v(at).addScaledVector(direction, -.6 * s).toArray() as Vec3], .43);
      }
    },
    focusBounds: () => ({ min: p(1, -1, 2), max: p(101, 47, 68) }),
    describe: () => ({ kind: 'tide', ...state, referencePage: 59,
      originalPagePreserved: true, realShoreIntersection: true, waterVolumeFollowsSeabed: true,
      boatDraftFixed: true, gaugeStationary: true, shoreSurface: 'fixed-sloping-coast',
      measuredTideHeight: false, localTideTimes: false, arrowsForLocalCurrent: false,
      tideDial: dial, fixedWaterVertices: waterPosition.count, fixedShorelineVertices: foamPosition.count,
      buffersStable: true }),
  };
}
