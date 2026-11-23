import { SURVEY_GRID as G,SURVEY_MODES,sampleSurvey,surveyFacies,surveyReading } from './textbook-terrain-survey';
import { drawingGrip } from './textbook-drawing-grip';

type P=[number,number];
const n=(v:number)=>Number(v.toFixed(2));
const screen=(x:number,h:number,z:number):P=>[n(40+4.63*x+.61*(z-30)),n(235+.92*z-4.35*h)];
const points=(p:P[])=>p.map(a=>a.join(',')).join(' ');
const line=(p:P[],stroke='#6c604d',w=1.6)=>`<polyline points="${points(p)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;
const text=(p:P,t:string,size=19)=>`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" fill="#3d3b31" font-size="${size}" font-family="FieldSerif,SimSun,serif">${t}</text>`;
const poly=(p:P[],fill:string)=>`<polygon points="${points(p)}" fill="${fill}" stroke="${fill}" stroke-width=".45" stroke-linejoin="round"/>`;
let topDrawing='';
function reliefDrawing(){
  if(topDrawing)return topDrawing;
  const soil=[187,171,143],bedrock=[192,185,172],alluvial=[174,153,124],vegetated=[140,150,113];
  let drawing='';
  for(let j=0;j<22;j++)for(let i=0;i<35;i++){
    const x=G.left+(G.right-G.left)*i/35,z=G.north+(G.south-G.north)*j/22;
    const d=(G.right-G.left)/35,e=(G.south-G.north)/22,q=sampleSurvey(x+d/2,z+e/2),m=surveyFacies(x+d/2,z+e/2);
    const point=(x:number,z:number)=>screen(x,sampleSurvey(x,z).h,z);
    const length=Math.hypot(q.gx,1,q.gz),light=.83+.20*(.72+.32*q.gx+.41*q.gz)/length;
    const weights=[Math.max(0,1-m[0]-m[1]-m[2]),...m];
    const rgb=soil.map((_,k)=>Math.min(255,Math.round(light*([soil,bedrock,alluvial,vegetated].reduce((c,p,i)=>c+p[k]*weights[i],0)))));
    const shade='rgb('+rgb.join(',')+')';
    drawing+=poly([point(x,z),point(x+d,z),point(x+d,z+e),point(x,z+e)],shade);
  }
  for(const side of ['west','south'])for(let i=0;i<44;i++){
    const t=i/44,et=(i+1)/44;
    const a=side==='west'?sampleSurvey(G.left,G.north+(G.south-G.north)*t):sampleSurvey(G.left+(G.right-G.left)*t,G.south);
    const b=side==='west'?sampleSurvey(G.left,G.north+(G.south-G.north)*et):sampleSurvey(G.left+(G.right-G.left)*et,G.south);
    for(let j=0;j<4;j++){
      const v=[0,.4,.78,.9,1],color=['#a49780','#b7ab96','#97876e','#786f54'][j];
      drawing+=poly([screen(a.x,a.h*v[j],a.z),screen(b.x,b.h*v[j],b.z),screen(b.x,b.h*v[j+1],b.z),screen(a.x,a.h*v[j+1],a.z)],color);
    }
  }
  return topDrawing=drawing;
}
export function terrainSurveyDrawing(t:number,mode:number){
  const r=surveyReading(t,mode),q=r.point,f=r.fixed,tip=screen(q.x,q.h,q.z),beam=screen(q.x,40.2,4.5),jib=screen(q.x,40.2,q.z);
  const start=screen(15,40.2,4.5),end=screen(86,40.2,4.5);
  let draw=reliefDrawing();
  draw+=line([screen(9,0,4.5),screen(9,40.2,4.5),screen(92,40.2,4.5),screen(92,0,4.5)],'#876a42',4);
  draw+=line([beam,jib,tip],'#596661',2.45)+`<circle cx="${tip[0]}" cy="${tip[1]}" r="3.5" fill="#b2874d"/><circle cx="${beam[0]}" cy="${beam[1]}" r="7.1" fill="#a88650" stroke="#6b5d42" stroke-width="2"/>`;
  if(mode===1||mode===2){
    const a=screen(f.x,f.h,f.z);draw+=line([a,screen(f.x,f.h+2.8,f.z)],'#8e6d3b',2.4)+text(screen(f.x,f.h+4.4,f.z),'山脊基点',16);
    if(mode===2)draw+=line([a,screen(f.x,q.h,f.z),tip,a],'#977449',1.65);
  }
  draw+=drawingGrip('移动地貌测针',start,end,r.phase);
  draw='<g transform="translate(-5,-32) scale(1.16)">'+draw+'</g>';
  draw+=`<rect x="24" y="313" width="592" height="112" rx="6" fill="#e4dbc4" stroke="#97825c" stroke-width="2"/>`+text([119,379],SURVEY_MODES[mode],22);
  const gauge=(h:number)=>n(400-h*1.9);
  if(mode<2){
    draw+=line([[305,329],[305,402]],'#74684d',2.5)+line([[293,gauge(q.h)],[345,gauge(q.h)]],'#976e30',3)
      +line([[293,gauge(mode===0?0:f.h)],[345,gauge(mode===0?0:f.h)]],'#596b71',2)+text([489,379],mode===0?'海平面基准':'山脊与测点',20);
  }else if(mode===2){
    const a:P=[264,394],e:P=[n(264+92*Math.cos(r.slopeRadians)),n(394-92*Math.sin(r.slopeRadians))];
    draw+=line([a,[356,394]],'#596b71',2)+line([a,e],'#976e30',3.5)+text([489,379],'两点间坡度',20);
  }else{
    const d=r.aspect??{x:0,z:0};draw+=`<circle cx="306" cy="366" r="19" fill="#e9e3d6" stroke="#7c735e" stroke-width="2"/>`+line([[306,366],[306+17*d.x,366+17*d.z]],'#976e30',3.5)
      +text([306,343],'北',16)+text([306,411],'南',16)+text([490,379],r.cardinal+'坡'+(r.exposure?' · '+r.exposure:''),20);
  }
  const keys=SURVEY_MODES.map((name,i)=>`<g tabindex="0" role="button" aria-pressed="${i===mode}" data-specimen-key="true" data-model-selection="${i}" data-keep-phase="" aria-label="观察${name}"><rect x="${24+150*i}" y="444" width="140" height="44" rx="5" fill="${i===mode?'#c5ac7e':'#e5ddc9'}" stroke="#8c7954"/>${text([94+150*i,474],name,22)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 502" role="group" aria-label="地貌测量仪：${SURVEY_MODES[mode]}" data-terrain-probe="${q.faceIndex}" data-terrain-reading="${n(q.h)}"><title>同一地貌测针与四种观察量</title>${draw}${keys}</svg>`;
}
