import { updateLabelSlip } from './textbook-label-slip';
import { applyEarthScan } from './textbook-earth-scan';
import { mountFieldInstrument, tideDialDimensions } from './textbook-field-instruments';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { phaseDialPoint, type PhaseDial } from './textbook-model-input';
import { evaluateTide, tideGround, tideShoreX, TIDE_LAYOUT } from './textbook-tide-model';

/** A sloping shore and a fitted water volume. Its changing shoreline is the
 * actual top/bottom intersection, rather than a rectangle hidden in land. */
export function buildTideWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .9;
  const p = (x: number, y: number, z: number): Vec3 => [x * s, y * s, z0 + z * s];
  const role = (mesh: any, value: string) => { mesh.userData.tideRole = value; return mesh; };
  const parts = mountFieldInstrument(b, 'tides', s, p(0, 0, 0));
  const sand = parts.get('shore')![0];
  role(sand, 'fixed-shore');
  applyEarthScan(sand.material, 'sand', 9.5 * s);
  const pigment = sand.geometry.getAttribute('color'), elevations = sand.geometry.getAttribute('position');
  const sandColors = new T.Float32BufferAttribute(new Float32Array(pigment.count * 3), 3);
  sandColors.setUsage(T.DynamicDrawUsage);
  sand.geometry.setAttribute('color', sandColors);
  const intertidal: number[] = [], shoreHeight = new Float32Array(pigment.count);
  const dampFringe = 2.4;
  for (let i = 0; i < pigment.count; i++) {
    const height = shoreHeight[i] = elevations.getY(i) / s;
    const gain = height <= TIDE_LAYOUT.low ? .60 : 1;
    sandColors.setXYZ(i, pigment.getX(i)*gain, pigment.getY(i)*gain, pigment.getZ(i)*gain);
    if (height > TIDE_LAYOUT.low && height < TIDE_LAYOUT.high + dampFringe) intertidal.push(i);
  }
  const skiff = [...parts.get('skiff-shell')!, ...parts.get('skiff-fittings')!];
  skiff.forEach(mesh => role(mesh, 'floating-skiff'));
  const gauge = parts.get('gauge')!;
  gauge.forEach(mesh => role(mesh, 'fixed-tide-gauge'));
  const waterMarks = parts.get('gauge-mark')!;
  waterMarks.forEach(mesh => role(mesh, 'gauge-water-mark'));

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
  const water = role(b.mesh(waterGeometry, '#ffffff', false, true, 'water'), 'fitted-seawater');
  const tint = new T.Color(), shallow = new T.Color('#aacbbc'), ocean = new T.Color('#558694');
  const seabed = new T.Color('#2a4d54');
  const waterColors = new T.Float32BufferAttribute(new Float32Array(stride * 6), 3);
  for (let i = 0; i < stride; i++) waterColors.setXYZ(i + stride, seabed.r, seabed.g, seabed.b);
  waterGeometry.setAttribute('color', waterColors);
  water.material.vertexColors = true;

  const foamGeometry = new T.BufferGeometry(), foamPosition = new T.Float32BufferAttribute(new Float32Array(41 * 6), 3), foamIndices: number[] = [];
  for (let j = 0; j < 40; j++) { const k = j * 2; foamIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  foamGeometry.setAttribute('position', foamPosition); foamGeometry.setIndex(foamIndices);
  const foam = role(b.mesh(foamGeometry, '#ebeee0', false, false, 'ivory'), 'shoreline');
  foam.castShadow = false;
  const wheel = tideDialDimensions();
  const pivot = p(wheel.x, wheel.height, wheel.depth);
  const dial: PhaseDial = { center: p(wheel.x, wheel.height, wheel.depth + 1.32), radiusX: wheel.radius * s, radiusY: wheel.radius * s };
  const [cx, cy, cz] = pivot;
  const arms = parts.get('dial-arm')!;
  for (const mesh of arms) {
    mesh.geometry.translate(-cx, -cy, -cz);
    mesh.position.set(cx, cy, cz);
  }
  const knobs = parts.get('dial-knob')!;
  const lowPoint = phaseDialPoint(0, dial);
  const control = { kind: 'phase-dial', dial, label: '拖动潮汐手柄，观察水面和岸线涨落' };
  for (const mesh of knobs) {
    mesh.geometry.translate(-lowPoint[0], -lowPoint[1], -lowPoint[2]);
    mesh.userData.modelInput = control;
    mesh.userData.tideRole = 'tide-handle';
  }
  const handle = knobs.find(mesh => mesh.userData.blenderColor === '#37656b')!;
  handle.userData.tideHandle = true;
  const yoke = parts.get('level-yoke')!;
  yoke.forEach(mesh => role(mesh, 'tide-drive-slider'));
  const midWater = (TIDE_LAYOUT.low + TIDE_LAYOUT.high) / 2;

  const caption = b.label('低潮', p(73, 42, 8), 13 * s, 7 * s);
  caption.userData.tideRole = 'stage-label';
  // Keep the skiff's full low-to-high travel unobstructed. The gauge label
  // sits to its right; the intertidal label occupies the upper dry slope.
  const gaugeLabel = b.label('固定潮尺', p(46, 29.5, 48), 24 * s, 6.4 * s); gaugeLabel.userData.tideRole = 'gauge-label';
  const bandLabel = b.label('潮间带', p(73, 40.5, 56), 20 * s, 6.4 * s); bandLabel.userData.tideRole = 'intertidal-label';
  let state = evaluateTide(0), previous = -1;
  return {
    update(phase) {
      state = evaluateTide(phase); updateLabelSlip(caption, state.caption);
      if (phase !== previous) {
        // Damp sand darkens just above the moving waterline. Recompute from
        // its dry pigment so that reversing the wheel restores the same shore.
        for (const i of intertidal) {
          const d = Math.min(1, Math.max(0, (shoreHeight[i] - state.waterLevel) / dampFringe));
          const gain = .60 + .40 * d*d*(3-2*d);
          sandColors.setXYZ(i, pigment.getX(i)*gain, pigment.getY(i)*gain, pigment.getZ(i)*gain);
        }
        sandColors.needsUpdate = true;
        for (let j = 0; j <= wz; j++) {
          const z = 6 + 49 * j / wz, shore = tideShoreX(state.waterLevel, z);
          for (let i = 0; i <= wx; i++) {
            const x = 6 + (shore - 6) * i / wx, k = j * (wx + 1) + i;
            const floor = Math.min(state.waterLevel, tideGround(x, z));
            waterPosition.setXYZ(k, ...p(x, state.waterLevel, z));
            waterPosition.setXYZ(k + stride, ...p(x, floor, z));
            const polish = .963 + .023 * Math.sin(z * .57 + Math.cos(x * .17)) + .014 * Math.sin(z * 1.46 + x * .29);
            tint.copy(shallow).lerp(ocean, Math.min(1, (state.waterLevel - floor) / 12)).multiplyScalar(polish);
            waterColors.setXYZ(k, tint.r, tint.g, tint.b);
          }
        }
        waterColors.needsUpdate = true;
        waterPosition.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingBox(); waterGeometry.computeBoundingSphere();
        state.shoreline.forEach(([x, y, z], i) => {
          foamPosition.setXYZ(i * 2, ...p(x - .46, y + .055, z)); foamPosition.setXYZ(i * 2 + 1, ...p(x, y + .055, z));
        });
        foamPosition.needsUpdate = true; foamGeometry.computeVertexNormals(); foamGeometry.computeBoundingSphere();
        for (const mesh of skiff) mesh.position.y = state.boat.waterline * s;
        for (const mesh of waterMarks) mesh.position.y = state.gauge.waterMark * s;
        for (const mesh of arms) mesh.rotation.z = 2 * Math.PI * state.phase;
        for (const mesh of yoke) mesh.position.y = (state.waterLevel - midWater) * s;
        const hand = phaseDialPoint(state.phase, dial);
        for (const mesh of knobs) mesh.position.set(...hand);
        previous = phase;
      }
      b.contour([p(6, state.waterLevel, 55.04), p(state.shorelineFront, state.waterLevel, 55.04)], .63);
      b.contour(state.shoreline.map(([x, y, z]) => p(x - .08, y + .07, z)), .36);
      // These quiet, stationary surface strokes do not imply a local tidal
      // current direction. No independent wave clock moves the skiff.
      for (const z of [13, 36, 47]) b.contour(Array.from({ length: 18 }, (_, i) => p(8 + i * 1.45, state.waterLevel + .075, z + .3 * Math.sin(i * .7))), .25);
    },
    focusBounds: () => ({ min: p(1, -6, 2), max: p(102, 47, 68) }),
    describe: () => ({ kind: 'tide', ...state, referencePage: 59,
      originalPagePreserved: true, realShoreIntersection: true, waterVolumeFollowsSeabed: true,
      boatDraftFixed: true, gaugeStationary: true, shoreSurface: 'fixed-sloping-coast',
      measuredTideHeight: false, localTideTimes: false, arrowsForLocalCurrent: false,
      tideDial: dial, tideDriveStroke: 2 * wheel.stroke, fixedWaterVertices: waterPosition.count, fixedShorelineVertices: foamPosition.count,
      buffersStable: true }),
  };
}
