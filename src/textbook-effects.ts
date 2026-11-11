import type { Figure } from './textbook-catalog';
import { evaluateSeaBreeze } from './model';
import { evaluateRiverCutoff } from './textbook-river-model';
import { evaluateGis } from './textbook-gis-model';
import { evaluateQuake } from './textbook-quake-model';
import { evaluateWave } from './textbook-wave-model';
import { evaluateTide } from './textbook-tide-model';
import { evaluateSalinity } from './textbook-salinity-model';
import { evaluateStrata, STRATA_LAYERS } from './textbook-strata-model';
import { evaluateLandslide } from './textbook-landslide-model';
import { evaluateCoastalProcess } from './textbook-coastal-process-model';
import { evaluateRemoteSensing } from './textbook-remote-model';
import { evaluateAirProcess } from './textbook-air-process-model';
import { evaluateAtmosphere } from './textbook-atmosphere-model';
import { evaluateForest } from './textbook-forest-model';
import { evaluateWaterCycle } from './textbook-water-cycle-model';
import { evaluateOceanCurrent } from './textbook-current-model';
import { evaluateSolarHeating } from './textbook-solar-heating-model';
import { evaluateTyphoon } from './textbook-typhoon-model';
import { evaluateTemperatureProfile } from './textbook-temperature-model';
import { evaluateSlopeRelief } from './textbook-slope-model';
import { evaluateRecovery } from './textbook-recovery-model';
import { evaluateSoilCare } from './textbook-soil-care-model';
import { evaluateGnss } from './textbook-gnss-model';
import { evaluateUrbanWater } from './textbook-urban-water-model';
import { evaluateColdWave } from './textbook-cold-wave-model';
import { evaluateInsolation } from './textbook-insolation-model';
import { evaluateIntegrated } from './textbook-integrated-model';
export type XY = [number,number];
export interface Route { points:XY[]; color?:string; count?:number; closed?:boolean; draw?:boolean }
export interface FigureState { phase:number; selection:number; routes:Route[]; rings:{x:number;y:number;r:number}[]; focus:[number,number,number,number]|null; caption:string }
const line = (...p:XY[]):Route => ({points:p});
const loop = (x:number,y:number,rx:number,ry:number,n=60):XY[] => Array.from({length:n+1},(_,i)=>[x+rx*Math.cos(i/n*Math.PI*2),y-ry*Math.sin(i/n*Math.PI*2)]);
const clamp=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
export function evaluateFigure(f:Figure,phase:number,selection:number):FigureState {
  const t=clamp(phase),s=Math.min(f.selectionLimit??(f.effect==='strata'?7:f.effect==='orbit'?8:(f.controls?.length??1)-1),Math.max(f.effect==='soil'?-1:0,Math.floor(Number.isFinite(selection)?selection:f.effect==='soil'?-1:0)));
  const state:FigureState={phase:t,selection:s,routes:[],rings:[],focus:null,caption:f.controls?.[s]??f.title};
  const integrated=evaluateIntegrated(f.effect,t,s);
  if(integrated){state.caption=integrated.title;return state;}
  switch(f.effect){
    case'solar-distribution':{const model=evaluateInsolation(t);state.selection=model.selection;state.caption=model.caption;break;}
    case'gnss':{const model=evaluateGnss(t);state.selection=model.stageIndex;state.caption=model.caption;break;}
    case'cold-wave':{const model=evaluateColdWave(t);state.selection=model.stageIndex;state.caption=model.caption;break;}
    case'urban-waterlogging':state.caption=evaluateUrbanWater(t,s).caption;break;
    case'soil-care':state.caption=evaluateSoilCare(t,s).caption;break;
    case'salinity':state.caption=evaluateSalinity(t,s).caption;break;
    case'coastal-landform':if(s===0)state.caption=evaluateCoastalProcess(t).caption;break;
    case'orbit':
      state.routes=[.12,.2,.29,.38].map((r,i)=>({points:loop(.58,.59,r,r*.29),color:i===2?'#65c2d9':'#d9c999',count:1}));break;
    case'radiation':{const solar=evaluateSolarHeating(t);state.selection=solar.stageIndex;state.caption=solar.caption;break;}
    case'strata':{const strata=evaluateStrata(t,s);state.caption=strata.focused===null?(strata.separated?'分层查看':'A、B两地地层对比'):`${STRATA_LAYERS[strata.focused].name} · ${strata.match===null?'查看化石':`对照${STRATA_LAYERS[strata.match].name}`}`;break;}
    case'spheres':state.focus=s===0?null:[.59+(s-1)*.1,.11,.12,.63];break;
    case'atmosphere':{const air=evaluateAtmosphere(t);state.selection=air.stageIndex;state.caption=air.caption;break;}
    case'heat':case'circulation':{const air=evaluateAirProcess(f.effect,t);state.selection=air.stageIndex;state.caption=air.caption;break;}
    case'breeze':{
      const day:XY[]=[[.28,.625],[.20,.625],[.174,.58],[.163,.51],[.163,.25],[.177,.17],[.205,.123],[.337,.123],[.37,.14],[.395,.22],[.399,.50],[.385,.58],[.358,.625],[.28,.625]];
      const breeze=evaluateSeaBreeze({phase:t,contrast:1}),night=breeze.direction<0;
      const points=night?day.map(([x,y]):XY=>[x+.56,y]).reverse():day;
      state.focus=breeze.direction===0?null:night?[.5,0,.5,1]:[0,0,.49,1];
      state.routes=breeze.direction===0?[]:[{points,count:2,color:'#456e91'}];state.caption=breeze.stage;break;
    }
    case'pressure':state.routes=s===0?[.25,.5,.75].map(y=>({...line([.1,y],[.9,y]),count:3})):[];break;
    case'water':state.caption=evaluateWaterCycle(t,s).caption;break;
    case'temperature':{const profile=evaluateTemperatureProfile(t);state.selection=profile.stageIndex;state.caption=profile.caption;break;}
    case'wave':state.caption=evaluateWave(t,s).caption;break;
    case'tide':state.caption=evaluateTide(t).caption;break;
    case'current':{const current=evaluateOceanCurrent(t);state.selection=current.stageIndex;state.caption=current.caption;break;}
    case'karst':state.focus=[(s%3)/3,Math.floor(s/3)/2,.33,.47];state.routes=[line([(s%3+.5)/3,Math.floor(s/3)/2+.04],[(s%3+.5)/3,Math.floor(s/3)/2+.18])];break;
    case'river':{const river=evaluateRiverCutoff(t);state.selection=river.stage;state.caption=river.caption;break;}
    case'slope':{const relief=evaluateSlopeRelief(t);state.selection=relief.stageIndex;state.caption=relief.caption;break;}
    case'forest':{const forest=evaluateForest(t);state.selection=forest.stageIndex;state.caption=forest.caption;break;}
    case'soil':state.focus=s<0?null:[0,s/6,.34,1/6];break;
    case'typhoon':{const typhoon=evaluateTyphoon(t);state.selection=typhoon.stageIndex;state.caption=typhoon.caption;break;}
    case'quake':{const quake=evaluateQuake(t,s);state.caption=quake.caption;break;}
    case'landslide':state.caption=evaluateLandslide(t,s).caption;break;
    case'rescue':state.caption=evaluateRecovery(t,s).caption;break;
    case'remote':{const remote=evaluateRemoteSensing(t);state.selection=remote.selection;state.caption=remote.caption;break;}
    case'gis':{const gis=evaluateGis(t);state.selection=gis.overlay>=.999?1:0;state.caption=gis.resultReady?`叠合统计：${gis.counts.map(r=>`${r.id}区${r.count}`).join('、')}`:gis.stage==='classifying'?'按行政区归属雨量站':gis.stage==='aligning'?'图层逐渐对齐':gis.overlay>=.999?'图层已叠合':'图层分离';break;}
  }
  return state;
}
export function atRoute(points:XY[],t:number):XY{
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0),v=((t%1)+1)%1*total;let n=v;
  for(let i=0;i<lengths.length;i++){if(n<=lengths[i]||i===lengths.length-1){const f=n/(lengths[i]||1);return[points[i][0]+(points[i+1][0]-points[i][0])*f,points[i][1]+(points[i+1][1]-points[i][1])*f]}n-=lengths[i]}
  return points[0];
}
export function effectSvg(f:Figure,phase:number,selection:number){
  const s=evaluateFigure(f,phase,selection);
  const routes=s.routes.map((r,i)=>`${!r.draw?'':`<polyline points="${r.points.map(p=>p.map(n=>n*1000).join(',')).join(' ')}" fill="none" stroke="${r.color??'#218d9f'}" stroke-opacity=".55" stroke-width="3"/>`}${Array.from({length:r.count??2},(_,j)=>{const t=(s.phase+j/(r.count??2)+i*.13)%1,p=atRoute(r.points,t),q=atRoute(r.points,Math.max(0,t-.012)),angle=Math.atan2(p[1]-q[1],p[0]-q[0])*180/Math.PI;return`<path d="M-11-6 0 0-11 6" transform="translate(${p[0]*1000} ${p[1]*1000}) rotate(${angle})" fill="none" stroke="${r.color??'#218d9f'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`}).join('')}`).join('');
  const rings=s.rings.map(r=>`<circle cx="${r.x*1000}" cy="${r.y*1000}" r="${r.r*1000}" fill="none" stroke="#b25540" stroke-width="3"/>`).join('');
  const h=s.focus;let focus='';if(h){const[x,y,w,d]=h,a=Math.min(w*.18,.035),b=Math.min(d*.18,.045);focus=[[x,y,1,1],[x+w,y,-1,1],[x+w,y+d,-1,-1],[x,y+d,1,-1]].map(([c,e,sx,sy])=>`<path d="M${(c+sx*a)*1000} ${e*1000}H${c*1000}V${(e+sy*b)*1000}" fill="none" stroke="#50776b" stroke-width="3"/>`).join('')}
  return`<svg class="effect-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${routes}${rings}${focus}</svg>`;
}
