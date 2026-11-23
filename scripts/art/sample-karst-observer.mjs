import {caveRoofHeight,evaluateCaveDeposition,evaluateKarstCover} from '../../src/textbook-ground-process-model.ts';
import {karstBasinHeight,soilMantleHeight} from '../../src/textbook-karst-terrain.ts';
const nx=100,ny=64;
const grid=Array.from({length:ny+1},(_,j)=>Array.from({length:nx+1},(_,i)=>[karstBasinHeight(i/nx,j/ny),soilMantleHeight(i/nx,j/ny)]));
const roof=Array.from({length:101},(_,i)=>caveRoofHeight(i/100));
const cave=[0,1].map(n=>Array.from({length:81},(_,i)=>evaluateCaveDeposition(i/80,n)));
const relief=[0,1,2,3].map(n=>Array.from({length:81},(_,i)=>evaluateKarstCover(i/80,n)));
process.stdout.write(JSON.stringify({nx,ny,grid,roof,cave,relief}));
