import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { evaluateSalinity, salinityPortionPoint } from '../../src/textbook-salinity-model.ts';
import { desalinationFragmentPose, evaluateDesalination } from '../../src/textbook-desalination-model.ts';

const hooks = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === './textbook-ground-process-model' ? specifier + '.ts' : specifier, context);
  },
});
const { DENSITY_INSTRUMENT, densityInstrumentPose } = await import('../../src/textbook-density-instrument.ts');
hooks.deregister();

const phases = Array.from({ length: 41 }, (_, i) => i / 40);
const salinity = [0, 1, 2].map(mode => phases.map(phase => {
  const state = evaluateSalinity(phase, mode);
  return { ...state, portions: state.portions.map(portion => ({
    point: salinityPortionPoint(state, portion.id), strength: portion.inTransit,
  })) };
}));
const desalination = [0, 1].map(mode => phases.map(phase => {
  const state = evaluateDesalination(phase, mode);
  return { ...state, fragmentPoses: Array.from({ length: 9 }, (_, i) => desalinationFragmentPose(state, i)) };
}));
await mkdir('work', { recursive: true });
await writeFile('work/water-lab-states.json', JSON.stringify({
  density: { dimensions: DENSITY_INSTRUMENT, states: [0,1,2].map(densityInstrumentPose) },
  salinity, desalination,
}));
