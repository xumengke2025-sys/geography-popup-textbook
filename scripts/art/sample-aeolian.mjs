import { evaluateAeolian, aeolianTransportPoint } from '../../src/textbook-aeolian-model.ts';

// Render the native animation's grains at precisely the same teaching positions
// used by the browser. A backward seek therefore restores the same saltation lane.
const trials = [0,1,2,3].map(selection=>Array.from({length:121},(_,frame)=>{
  const state=evaluateAeolian(frame/120,selection);
  return state.grains.map(g=>[...aeolianTransportPoint(g.x,g.depth,g.height,selection,state.duneOffset),g.visible]);
}));
process.stdout.write(JSON.stringify(trials));
