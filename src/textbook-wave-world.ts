import { mountFieldInstrument, mountScrewDrive } from './textbook-field-instruments';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { evaluateWave, evaluateWaveInspection, waveHeightAt, waveParticleAt, WAVE_GEOMETRY, WAVE_REFERENCE } from './textbook-wave-model';

/** A thick, closed ocean cutaway. The changing surface, cut faces and tracked
 * water point are all evaluated from one periodic wave, without frame history. */
export function buildWaveWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = WAVE_GEOMETRY.depth * s;
  const z0 = -LIFT_MARGIN - b.height * .64 - depth * .35;
  const p = (x: number, v: number, height = 0): Vec3 => [x * s, height * s, z0 + v * depth];
  let state = evaluateWave(0), lastPhase = -1, lastSelection = -1, inspection = 'overview';
  const groups = mountFieldInstrument(b, 'waves', s, p(0, 0));
  const water = groups.get('water-cut')![0];
  water.userData.waveRole = 'water-volume';
  water.userData.modelInput = {kind:'select',selection:1,toggleTo:0,keepPhase:true,label:'点开水体，追踪质点，再点回到波形'};

  const geometry = water.geometry;
  const position = geometry.attributes.position;
  const pigments = geometry.attributes.color;
  const nx = 200;
  const movingVertices: { index: number; sample: number; polish: number }[] = [];
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) <= .01 * s) continue;
    const x = position.getX(i) / s, z = (position.getZ(i) - z0) / s;
    const polish = .975 + .023 * Math.sin(z * .49 + Math.cos(x * .16)) + .013 * Math.sin(z * 1.38 + x * .24);
    movingVertices.push({ index: i, sample: Math.round(x * 2), polish });
  }
  const deep = new T.Color('#275660'), lit = new T.Color('#8cbbb6'), tint = new T.Color();
  const threads = [3, 6, 10, 15].map(depth => {
    const ribbon = new T.BufferGeometry();
    const positions = new T.Float32BufferAttribute(new Float32Array(121 * 6), 3);
    const indices = [];
    for (let i = 0; i < 120; i++) {
      const j = 2 * i;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
    ribbon.setAttribute('position', positions);
    ribbon.setIndex(indices);
    const mesh = b.mesh(ribbon, '#a9c6bf', false, false, 'ivory');
    mesh.userData.waveRole = 'depth-trace';
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    return { depth, mesh, positions };
  });
  const particle = b.sphere([0, 0, 0], 1.18 * s, '#b57751', false);
  particle.userData.waveRole = 'particle'; particle.userData.restX = WAVE_GEOMETRY.particleRestX;
  particle.userData.smallPointTarget = true;
  particle.userData.modelInput = { kind: 'inspect', target: 'displacement', toggleTo: 'overview', label: '量看水质点相对固定位置的位移；再次选择收起' };
  const deepParticle = b.sphere([0, 0, 0], .95 * s, '#8ab9a9', false);
  deepParticle.userData.waveRole = 'deep-particle'; deepParticle.userData.materialIdentity = 'deep-water-point';
  deepParticle.userData.modelInput = { kind: 'inspect', target: 'depth-pair', toggleTo: 'overview', label: '比较表层与深处水质点的闭合运动' };
  const depthTarget = b.sphere(p(WAVE_GEOMETRY.particleRestX, 1.035, WAVE_GEOMETRY.meanHeight - 8), 1.1 * s, '#d8ddce', false);
  depthTarget.userData.waveRole = 'deep-equilibrium-target'; depthTarget.userData.smallPointTarget = true;
  depthTarget.userData.modelInput = deepParticle.userData.modelInput;
  const topLabel = b.label('波向前传播', p(22, -.03, 38), 30 * s, 6.8 * s);
  const pointLabel = b.label('水质点', p(79, -.03, 38), 22 * s, 6.8 * s);
  const arrow: Vec3[] = [p(8, 0, 32.5), p(37, 0, 32.5)];
  b.stroke(arrow, .65); b.stroke([p(33.5, 0, 34), p(37, 0, 32.5), p(33.5, 0, 31)], .65);
  const drive = mountScrewDrive('waves', groups, (x, y, depth) => p(x, depth / WAVE_GEOMETRY.depth, y),
    '拖动黄铜游标，观察同一周期的波形和水质点');
  drive.handle.userData.waveRole = 'phase-handle';
  let currentHeights = Array.from({ length: nx + 1 }, (_, i) => waveHeightAt(state, i / nx * 100));
  let surfaceContours: Vec3[][] = [];
  const rings = [0, 8].map((depth, i) => {
    const { meanHeight, wavelength, amplitude, particleRestX } = WAVE_GEOMETRY;
    const radius = amplitude * Math.exp(-2 * Math.PI * depth / wavelength);
    const mesh = b.mesh(new T.TorusGeometry(radius * s, .086 * s, 8, 96),
      i === 0 ? '#b77c52' : '#9ebfb0', false, false, i === 0 ? 'brass' : 'ivory');
    mesh.position.set(...p(particleRestX, 1.027, meanHeight - depth));
    mesh.castShadow = false;
    return mesh;
  });
  return {
    update(phase, selection) {
      if (phase !== lastPhase || selection !== lastSelection) {
        state = evaluateWave(phase, selection);
        // X samples are fixed, making a closed Eulerian cutaway; the surface
        // inversion keeps the separately tracked material point on that surface.
        currentHeights = Array.from({ length: nx + 1 }, (_, i) => waveHeightAt(state, i / nx * 100));
        for (const { index, sample, polish } of movingVertices) {
          const height = currentHeights[sample];
          position.setY(index, height * s);
          tint.copy(deep).lerp(lit, (height / 24.8) ** .63).multiplyScalar(polish);
          pigments.setXYZ(index, tint.r, tint.g, tint.b);
        }
        pigments.needsUpdate = true;
        for (const { depth, mesh, positions } of threads) {
          for (let i = 0; i <= 120; i++) {
            const sample = waveParticleAt(state, 5.9 + i * 88.2 / 120, depth);
            positions.setXYZ(i * 2, ...p(sample.x, 1.009, sample.height - .092));
            positions.setXYZ(i * 2 + 1, ...p(sample.x, 1.009, sample.height + .092));
          }
          positions.needsUpdate = true;
          mesh.geometry.computeVertexNormals();
        }
        surfaceContours = [0, .5, 1].map(v => currentHeights.map((height, i) => p(i / nx * 100, v, height + .025)));
        position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        particle.position.set(...p(state.particle.x, 1.025, state.particle.height));
        drive.move(state.phase);
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

      const q = WAVE_GEOMETRY.particleRestX, y = state.meanHeight;
      // The stationary cross survives every phase, including a paused crest.
      // It distinguishes the particle's orbit from horizontal wave travel.
      b.accentStrokes.push({ points: [b.v(p(q - 1.05, 1.027, y)), b.v(p(q + 1.05, 1.027, y))], width: .67 });
      b.accentStrokes.push({ points: [b.v(p(q, 1.027, y - 1.05)), b.v(p(q, 1.027, y + 1.05))], width: .67 });
      const observation = evaluateWaveInspection(phase, inspection);
      rings[0].visible = state.selection === 1 || observation.displacementVisible;
      rings[1].visible = observation.inspection === 'depth-pair';
      deepParticle.visible = observation.inspection === 'depth-pair'; depthTarget.visible = !deepParticle.visible;
      if (observation.displacementVisible) for (const sample of observation.points) {
        const rest = p(sample.rest.x, 1.035, sample.rest.height), point = p(sample.point.x, 1.035, sample.point.height);
        const corner = p(sample.point.x, 1.035, sample.rest.height);
        b.contour([rest, corner, point], .83);
        b.contour([p(sample.rest.x - .8, 1.035, sample.rest.height), p(sample.rest.x + .8, 1.035, sample.rest.height)], .45);
        b.contour([p(sample.rest.x, 1.035, sample.rest.height - .8), p(sample.rest.x, 1.035, sample.rest.height + .8)], .45);
        if (sample.depth) { deepParticle.position.set(...point); b.outline(deepParticle, .55); }
      }
      topLabel.visible = true; pointLabel.visible = true;
    },
    inspect(target) { inspection = evaluateWaveInspection(0, target).inspection; },
    focusBounds: () => ({ min: p(-4, -.08, -5), max: p(104, 1.34, 43) }),
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
