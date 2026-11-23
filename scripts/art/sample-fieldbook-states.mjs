import { mkdir, writeFile } from 'node:fs/promises';
import { evaluateWindForces } from '../../src/textbook-sky-causality-model.ts';
import { evaluateQuake } from '../../src/textbook-quake-model.ts';
import { evaluateRiverCutoff, sampleRiverBanks, RIVER_RELIEF, RIVER_HEIGHT } from '../../src/textbook-river-model.ts';

const { columns, rows } = RIVER_RELIEF;
const distance = new Float32Array((columns + 1) * (rows + 1));
const river = [0, .2, .42, .55, .62, .72, .84, 1].map(phase => {
  const state = evaluateRiverCutoff(phase);
  sampleRiverBanks(state, columns, rows, distance);
  return {
    phase,
    distance: Array.from(distance, value => Math.round(value * 1000) / 1000),
  };
});
await mkdir('work', { recursive: true });
await writeFile('work/fieldbook-art-states.json', JSON.stringify({
  columns, rows,
  height: [RIVER_HEIGHT.plateau, RIVER_HEIGHT.bed, RIVER_HEIGHT.water],
  wind: [0, 1, 2, 3].map(evaluateWindForces),
  quake: [0, 1, 2].map(selection => evaluateQuake(.42, selection)),
  river,
}));
