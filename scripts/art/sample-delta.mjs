import { writeFile } from 'node:fs/promises';
import { deltaSurfaceHeight, deltaBranchPoint, deltaMainPoint, evaluateDeltaDeposition } from '../../src/textbook-delta-model.ts';

const nx=124, ny=84;
const frames=Array.from({length:121},(_,i)=>{
  const t=i/120,state=evaluateDeltaDeposition(t);
  const frame={grains: state.grains.map(g=>({stage:g.stage,position:[g.position[0],g.position[1]+g.deposition*(deltaSurfaceHeight(state,g.target[0],g.target[2])-7.2),g.position[2]]})), front:state.branches.map(b=>b.front)};
  if(i%4===0) frame.grid=Array.from({length:ny+1},(_,j)=>Array.from({length:nx+1},(_,k)=>
    +deltaSurfaceHeight(state,.035+.93*k/nx,.325+.65*j/ny).toFixed(3)));
  frame.branches = state.branches.map((b,branch)=> b.deposition>.02 ? Array.from({length:31},(_,q)=>deltaBranchPoint(branch,Math.max(.02,b.front-.09)*q/30)):null);
  return frame;
});
await writeFile('work/delta-flume-science.json', JSON.stringify({nx,ny,frames,main:Array.from({length:39},(_,i)=>deltaMainPoint(i/38))}));
