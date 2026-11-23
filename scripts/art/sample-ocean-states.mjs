import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { WAVE_GEOMETRY, evaluateWave, waveHeightAt, waveParticleAt } from '../../src/textbook-wave-model.ts';
import { TIDE_LAYOUT, evaluateTide, tideGround } from '../../src/textbook-tide-model.ts';

// The browser bundler normally resolves the single extensionless model import.
const hook = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === './textbook-wave-model' ? specifier + '.ts' : specifier, context);
  },
});
const current = await import('../../src/textbook-current-model.ts');
hook.deregister();

// Include the complete cycle so the editable stand-alone Blender models can
// scrub the same demonstrations as the book.
const phases = Array.from({ length: 25 }, (_, i) => i / 24);
const wave = [...phases, .36].sort((a,b) => a-b).map(phase => {
  const state = evaluateWave(phase, 1);
  return {
    phase, particle: state.particle, deep: waveParticleAt(state, WAVE_GEOMETRY.particleRestX, 8),
    surface: Array.from({ length: 201 }, (_, i) => waveHeightAt(state, i / 2)),
    contours: [3, 6, 10, 15].map(depth => Array.from({ length: 121 }, (_, i) => waveParticleAt(state, 5.9 + i * 88.2 / 120, depth))),
  };
});
const tide = phases.map(phase => evaluateTide(phase));
const t = TIDE_LAYOUT;
const tideGroundGrid = Array.from({ length: 49*93 }, (_, i) => {
  const x = t.seaLeft + (t.landRight-t.seaLeft)*(i%93)/92;
  const z = t.back + (t.front-t.back)*Math.floor(i/93)/48;
  return [x,z,tideGround(x,z)];
});
await mkdir('work', { recursive: true });
await writeFile('work/sea-art-states.json', JSON.stringify({
  wave, waveSize: WAVE_GEOMETRY, tide, tideGroundGrid, tideSize: t,
  current: phases.map(current.evaluateOceanCurrent),
  currentLayout: current.CURRENT_LAYOUT,
  path: Array.from({ length: 81 }, (_, i) => [-5.3,5.3].map(lane => current.currentPathPoint(i/80,lane))),
  arrows: current.CURRENT_ARROWS,
  orbit: current.CURRENT_WAVE_ORBIT,
}));
