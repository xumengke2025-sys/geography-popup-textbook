import { mkdir, writeFile } from 'node:fs/promises';
import {
  evaluateWaterCycle, waterCycleLandMesh, waterCycleSeaMesh, waterCycleRiverMesh,
  waterCycleTerrainHeight, waterCycleRiverSection, WATER_CYCLE_CLOUD_PARTS, WATER_CYCLE_PLANTS,
} from '../../src/textbook-water-cycle-model.ts';
import { evaluateWaterRenewal } from '../../src/textbook-water-renewal-model.ts';
import {
  evaluateTemperatureProfile, temperatureWaterMesh, TEMPERATURE_LAYOUT,
  TEMPERATURE_PROFILE_CURVE, TEMPERATURE_STOPS, TEMPERATURE_NOTES,
  temperatureAxisX, temperatureDepthY,
} from '../../src/textbook-temperature-model.ts';

const phases = Array.from({ length: 41 }, (_, i) => i / 40);
const modes = [0, 1, 2];
const land = waterCycleLandMesh(108, 68);
const plants = WATER_CYCLE_PLANTS.map(([x,z]) => ({
  at: [x, waterCycleTerrainHeight(x,z), z], height: 4.8,
}));
for (let i = 0; i < 107; i++) {
  const x = 6.2 + ((i * .61803398875) % 1) * 51.8, z = 10.3 + ((i * .454312) % 1) * 37.7;
  const h = waterCycleTerrainHeight(x,z), bank = waterCycleRiverSection(Math.max(23,Math.min(67,x)));
  const inside = x >= 22 && z >= bank.leftZ - .8 && z <= bank.rightZ + .8;
  if (inside || h < 9.6 || h > 28.2 || plants.some(({ at }) => Math.hypot(x - at[0], z - at[2]) < 2.4)) continue;
  plants.push({ at: [x,h,z], height: .8 + 2.3 * ((i * .7133) % 1) });
}
await mkdir('work', { recursive:true });
await writeFile('work/water-observation-states.json', JSON.stringify({
  water: {
    land, divisions:[108,68], sea:waterCycleSeaMesh(), river:waterCycleRiverMesh(),
    clouds:WATER_CYCLE_CLOUD_PARTS, plants,
    states:modes.map(mode => phases.map(t => {
      const state = evaluateWaterCycle(t,mode);
      return { phase:t, clouds:state.cloud, samples:state.samples.map(({position,medium})=>({position,medium})) };
    })),
  },
  'water-renewal': modes.map(mode => phases.map(t => evaluateWaterRenewal(t,mode))),
  temperature: {
    layout:TEMPERATURE_LAYOUT, curve:TEMPERATURE_PROFILE_CURVE, water:temperatureWaterMesh(),
    notes:TEMPERATURE_NOTES, stops:TEMPERATURE_STOPS,
    tickX:Array.from({length:16},(_,i)=>temperatureAxisX(i*2)),
    tickY:Array.from({length:13},(_,i)=>temperatureDepthY(i/2)),
    states:phases.map(t=>evaluateTemperatureProfile(t)),
  },
}));
