import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateWave, evaluateWaveInspection, waveHeightAt, waveParticleAt, WAVE_GEOMETRY, WAVE_REFERENCE } from './textbook-wave-model';

/** A thick, closed ocean cutaway. The changing surface, cut faces and tracked
 * water point are all evaluated from one periodic wave, without frame history. */
export function buildWaveWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = WAVE_GEOMETRY.depth * s;
  const z0 = -LIFT_MARGIN - b.height * .64 - depth * .35;
  const p = (x: number, v: number, height = 0): Vec3 => [x * s, height * s, z0 + v * depth];
  let state = evaluateWave(0), lastPhase = -1, lastSelection = -1, inspection = 'overview';
  const nx = 160, nz = 14, vertices: number[] = [], indices: number[] = [];
  const movingVertices: { index: number; x: number }[] = [], border: [number, number][] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = i / nx * 100, v = j / nz, k = vertices.length / 3;
    vertices.push(...p(x, v, waveHeightAt(state, x))); movingVertices.push({ index: k, x });
    if (i < nx && j < nz) indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
  }
  for (let i = 0; i <= nx; i++) border.push([i / nx * 100, 0]);
  for (let j = 1; j <= nz; j++) border.push([100, j / nz]);
  for (let i = nx - 1; i >= 0; i--) border.push([i / nx * 100, 1]);
  for (let j = nz - 1; j > 0; j--) border.push([0, j / nz]);
  for (let i = 0; i < border.length; i++) {
    const [x, v] = border[i], [nextX, nextV] = border[(i + 1) % border.length], k = vertices.length / 3;
    vertices.push(...p(x, v, waveHeightAt(state, x)), ...p(nextX, nextV, waveHeightAt(state, nextX)), ...p(nextX, nextV), ...p(x, v));
    movingVertices.push({ index: k, x }, { index: k + 1, x: nextX });
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  // The bottom follows the same segmented border as the sides, avoiding
  // even a hidden T-junction in the closed cutaway.
  const bottom = vertices.length / 3;
  vertices.push(...p(50, .5));
  for (const [x, v] of border) vertices.push(...p(x, v));
  for (let i = 0; i < border.length; i++) indices.push(bottom, bottom + 1 + i, bottom + 1 + (i + 1) % border.length);
  const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(vertices, 3);
  geometry.setAttribute('position', position); geometry.setIndex(indices); geometry.computeVertexNormals();
  const water = b.mesh(geometry, '#accbd0', false); water.userData.waveRole = 'water-volume';
  water.material = createSpecimenMaterial(b.pop, { color: '#accbd0', ink: '#66838a', spacing: 4, hatch: .12, shade: .12, seed: 83 });
  water.material.side = T.DoubleSide;
  const particle = b.sphere([0, 0, 0], 1.18 * s, '#b57751', false);
  particle.userData.waveRole = 'particle'; particle.userData.restX = WAVE_GEOMETRY.particleRestX;
  particle.userData.smallPointTarget = true;
  particle.userData.modelInput = { kind: 'inspect', target: 'displacement', toggleTo: 'overview', label: '量看水质点相对固定位置的位移；再次选择收起' };
  const deepParticle = b.sphere([0, 0, 0], .95 * s, '#6b8d81', false);
  deepParticle.userData.waveRole = 'deep-particle'; deepParticle.userData.materialIdentity = 'deep-water-point';
  deepParticle.userData.modelInput = { kind: 'inspect', target: 'depth-pair', toggleTo: 'overview', label: '比较表层与深处水质点的闭合运动' };
  const depthTarget = b.sphere(p(WAVE_GEOMETRY.particleRestX, 1.035, WAVE_GEOMETRY.meanHeight - 8), 1.1 * s, '#d8ddce', false);
  depthTarget.userData.waveRole = 'deep-equilibrium-target'; depthTarget.userData.smallPointTarget = true;
  depthTarget.userData.modelInput = deepParticle.userData.modelInput;
  const topLabel = b.label('波向前传播', p(22, -.03, 38), 30 * s, 6.8 * s);
  const pointLabel = b.label('水质点', p(79, -.03, 38), 22 * s, 6.8 * s);
  const arrow: Vec3[] = [p(8, 0, 32.5), p(37, 0, 32.5)];
  b.stroke(arrow, .65); b.stroke([p(33.5, 0, 34), p(37, 0, 32.5), p(33.5, 0, 31)], .65);
  const track = { start: p(18, 1.20, 2), end: p(82, 1.20, 2) };
  const rail = b.box(p(16, 1.18, 1.7), p(84, 1.22, 2.1), '#ddd5c2', false); rail.userData.waveRole = 'phase-rail';
  const handle = b.sphere([0, 0, 0], 1.7 * s, '#f1e8d2', false, [1, .75, .7]);
  handle.userData.waveRole = 'phase-handle';
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动纸签，观察同一周期的波形和水质点' };
  let currentHeights = Array.from({ length: nx + 1 }, (_, i) => waveHeightAt(state, i / nx * 100));
  let surfaceContours: Vec3[][] = [];
  const orbit = Array.from({ length: 97 }, (_, i): Vec3 => {
    const point = waveParticleAt({ cyclePhase: i / 96 }, WAVE_GEOMETRY.particleRestX);
    return p(point.x, 1.024, point.height);
  });
  const orbitInk = orbit.map(point => b.v(point));
  return {
    update(phase, selection) {
      if (phase !== lastPhase || selection !== lastSelection) {
        state = evaluateWave(phase, selection);
        // X samples are fixed, making a closed Eulerian cutaway; the surface
        // inversion keeps the separately tracked material point on that surface.
        currentHeights = Array.from({ length: nx + 1 }, (_, i) => waveHeightAt(state, i / nx * 100));
        for (const sample of movingVertices) position.setY(sample.index, currentHeights[Math.round(sample.x / 100 * nx)] * s);
        surfaceContours = [0, .5, 1].map(v => currentHeights.map((height, i) => p(i / nx * 100, v, height + .025)));
        position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        particle.position.set(...p(state.particle.x, 1.025, state.particle.height));
        handle.position.set(...phaseTrackPoint(state.phase, track));
        particle.userData.particleX = state.particle.x; particle.userData.particleHeight = state.particle.height;
        lastPhase = phase; lastSelection = selection;
      }
      surfaceContours.forEach((points, i) => b.contour(points, i === 2 ? .70 : .32));
      for (const x of [0, 100]) {
        const height = currentHeights[x === 0 ? 0 : nx];
        b.contour([p(x, 0, height), p(x, 1, height)], .45);
        b.contour([p(x, 1, height), p(x, 1)], .48);
      }
      b.contour([p(0, 1), p(100, 1), p(100, 0)], .45);
      for (const h of [4, 8, 12]) b.contour([p(0, 1.002, h), p(100, 1.002, h)], .14);
      b.contour([track.start, track.end], .38);
      const q = WAVE_GEOMETRY.particleRestX, y = state.meanHeight;
      // The stationary cross survives every phase, including a paused crest.
      // It distinguishes the particle's orbit from horizontal wave travel.
      b.accentStrokes.push({ points: [b.v(p(q - 1.05, 1.027, y)), b.v(p(q + 1.05, 1.027, y))], width: .67 });
      b.accentStrokes.push({ points: [b.v(p(q, 1.027, y - 1.05)), b.v(p(q, 1.027, y + 1.05))], width: .67 });
      if (state.selection === 1) {
        // A thin broken orbit leaves the wave face visible behind the marker.
        for (let i = 0; i < 96; i += 4) b.accentStrokes.push({ points: orbitInk.slice(i, i + 3), width: .80 });
      }
      const observation = evaluateWaveInspection(phase, inspection);
      deepParticle.visible = observation.inspection === 'depth-pair'; depthTarget.visible = !deepParticle.visible;
      if (observation.displacementVisible) for (const sample of observation.points) {
        const rest = p(sample.rest.x, 1.035, sample.rest.height), point = p(sample.point.x, 1.035, sample.point.height);
        const corner = p(sample.point.x, 1.035, sample.rest.height);
        b.contour([rest, corner, point], .83);
        b.contour([p(sample.rest.x - .8, 1.035, sample.rest.height), p(sample.rest.x + .8, 1.035, sample.rest.height)], .45);
        b.contour([p(sample.rest.x, 1.035, sample.rest.height - .8), p(sample.rest.x, 1.035, sample.rest.height + .8)], .45);
        for (let i = 0; i < 64; i += 4) b.contour(Array.from({ length: 3 }, (_, j) => {
          const q = waveParticleAt({ cyclePhase: (i + j) / 64 }, sample.rest.x, sample.depth); return p(q.x, 1.035, q.height);
        }), .48);
        if (sample.depth) { deepParticle.position.set(...point); b.outline(deepParticle, .55); }
      }
      topLabel.visible = true; pointLabel.visible = true;
    },
    inspect(target) { inspection = evaluateWaveInspection(0, target).inspection; },
    focusBounds: () => ({ min: p(-1, -.08, 0), max: p(101, 1.27, 43) }),
    describe: () => ({ kind: 'surface-wave', reference: WAVE_REFERENCE, phase: state.phase, cyclePhase: state.cyclePhase,
      inspection, observation: evaluateWaveInspection(state.phase, inspection),
      selection: state.selection, caption: state.caption, wavePropagates: true, propagationDirection: 'right',
      particleAdvection: false, particleMotion: 'closed-orbit', particle: { restX: WAVE_GEOMETRY.particleRestX, ...state.particle },
      waveHeight: state.waveHeight, amplitude: state.amplitude, wavelength: state.wavelength,
      closedVolume: true, fixedBuffers: true, surfaceEquation: 'monotone-gerstner-inverse',
      heightProbes: [0, 25, 50, 75, 100].map(x => ({ x, height: waveHeightAt(state, x) })),
      trackedSurfaceError: Math.abs(waveHeightAt(state, state.particle.x) - state.particle.height),
      controls: ['particle-displacement', 'depth-comparison', 'phase-track'] }),
  };
}
