/** Snapshot the dry-air and sample positions and the three atmospheric height bookmarks. */
import { sampleBenchInstruments } from './sample-pneumatic-observers.mjs';
await sampleBenchInstruments(process.env.REVIEW_BASE_URL||'http://127.0.0.1:4403','work/sounding-blender-transfer',[
  ['air-composition',[[0,0],[0,1]]], ['atmosphere',[[.12,0],[.42,1],[.82,2]]]
]);
