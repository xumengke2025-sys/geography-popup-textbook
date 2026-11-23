import { caveRoofHeight, evaluateCaveDeposition, evaluateKarstCover } from './textbook-ground-process-model';
import { karstBasinHeight, soilMantleHeight } from './textbook-karst-terrain';

const fixed=(n:number)=>Number(n.toFixed(2));
const line=(points:number[][])=>'M'+points.map(p=>p.map(fixed).join(',')).join('L');
const label=(x:number,y:number,t:string)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="#33403a" font-size="28">${t}</text>`;
function panel(names:string[],phase:number,chosen:number,cave:boolean) {
  const rail=70+500*phase;
  const keys=names.map((name,i)=>{
    const x=cave?178+i*284:97+i*148,w=cave?202:126,pressed=i===chosen;
    return `<g transform="translate(${x} 465)" role="button" tabindex="0" data-model-selection="${i}" data-keep-phase="" data-specimen-key="" aria-label="选择${name}" aria-pressed="${pressed}">
      <rect x="${-w/2-5}" y="-42" width="${w+10}" height="84" fill="transparent"/>
      <rect x="${-w/2}" y="-29" width="${w}" height="57" rx="6" fill="#715b3f" stroke="#563e2b" stroke-width="2"/>
      <rect x="${5-w/2}" y="${pressed?-20:-26}" width="${w-10}" height="45" rx="5" fill="${pressed?'#d0c5a6':'#f3e8c9'}"/>
      ${label(0,pressed?15:9,name)}</g>`;
  }).join('');
  return `<rect x="27" y="416" width="586" height="90" rx="9" fill="#76563d" stroke="#574630" stroke-width="3"/>${keys}
    <g data-phase-track="karst-observer" data-track-start="70" data-track-end="570" role="slider" aria-label="左右推拉观察游标" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100*phase)}" tabindex="0">
      <rect x="30" y="332" width="580" height="82" fill="transparent"/>
      <path d="M65 390H575M65 395H575" fill="none" stroke="#718381" stroke-width="3"/>
      ${Array.from({length:25},(_,i)=>`<path d="M${70+i*500/24} 386v-${i%4?4:9}" stroke="#967f52" stroke-width="2"/>`).join('')}
      <g transform="translate(${rail} 391)"><rect x="-23" y="-8" width="46" height="19" rx="6" fill="#ab8b5e" stroke="#5c5036" stroke-width="3"/>
      <path d="M0 -8v-20" stroke="#715b3c" stroke-width="4"/><circle cy="-31" r="8" stroke="#476872" stroke-width="4" fill="#a7c4c2"/></g></g>`;
}

function caveDrawing(phase:number,selection:number) {
  const state=evaluateCaveDeposition(phase,selection);
  const sx=(u:number)=>66+510*u, sy=(h:number)=>285-(h-4)*5.65;
  const arch=Array.from({length:97},(_,i)=>{const u=.08+.84*i/96;return [sx(u),sy(caveRoofHeight(u))];});
  const roof=line(arch);
  const walls=Array.from({length:7},(_,i)=>`<path d="M67 ${105+27*i}q76 22 151 4t135 1t127 2t104 1" stroke="${i%2?'#a49777':'#b6a98a'}" stroke-width="${i%2?2:5}" opacity=".4" fill="none"/>`).join('');
  const calcite=(x:number,y:number,base:number,len:number,up:boolean)=>`<path transform="translate(${fixed(x)} ${fixed(y)}) scale(1 ${up?-1:1})" d="M${-base} -1Q${-base*.6} ${len*.22} ${-base*.22} ${len*.72}Q0 ${len*1.2} ${base*.20} ${len*.8}Q${base*.42} ${len*.27} ${base} 0Z" fill="url(#karst-calcite)" stroke="#8c7958" stroke-width="1"/>`;
  const fixedColumns=Array.from({length:17},(_,i)=>{const u=.16+i*.041,x=sx(u),y=sy(caveRoofHeight(u));return calcite(x,y-2,5+(i%3)*2,12+13*(.5+.5*Math.cos(i*1.73)),false);}).join('');
  const active=state.deposits.map(d=>calcite(sx(d.u),sy(d.ceiling)-1,13,5.65*d.hanging,false)+calcite(sx(d.u),sy(4),16,5.65*d.rising,true)).join('');
  const drops=state.drops.filter(d=>d.visible).map(d=>{const site=state.deposits[d.site],t=site.ceiling-site.hanging,b=4+site.rising;
    return `<path transform="translate(${fixed(sx(d.u))} ${fixed(sy(t+(b-t)*d.progress))})" d="M0 -5Q7 3 0 5Q-6 3 0 -5Z" fill="#b5d8d6" stroke="#395e64"/>`;}).join('');
  return `<defs><linearGradient id="karst-calcite"><stop stop-color="#967955"/><stop offset=".31" stop-color="#e6d6ae"/><stop offset=".62" stop-color="#c5ac7e"/><stop offset="1" stop-color="#f1e1bc"/></linearGradient>
    <clipPath id="karst-inner"><path d="${roof}L${arch.at(-1)![0]} 285H${arch[0][0]}Z"/></clipPath></defs>
    <path d="M65 299h512" stroke="#70624b" stroke-width="8"/>
    <g clip-path="url(#karst-inner)"><rect x="70" y="38" width="510" height="250" fill="#716b5d"/>${walls}${fixedColumns}</g>
    <path d="${line(arch.map(([x,y])=>[x,y-29]))}L${arch.slice().reverse().map(p=>p.map(fixed).join(',')).join('L')}Z" fill="#b0a78d" stroke="#726c59" stroke-width="3"/>
    ${active}${drops}<path d="M80 286H562" stroke="#8c8062" stroke-width="4"/>
    ${label(320,336,selection?'洞顶生石钟乳，洞底长石笋':'剖开灰岩，观察洞腔与底板')}`;
}

const project=(u:number,v:number,h:number)=>[74+486*u-34*v,32+142*v+47*u+(30-h)*3.25];
const ground=(u:number,v:number)=>project(u,v,karstBasinHeight(u,v));
function sampleBasinRelief() {
  const tiles:{threshold:number;rock:string;soil:string}[]=[];
  const nx=37,nz=23;
  const prev=Array.from({length:nx+1},(_,i)=>ground(i/nx,0));
  for(let j=0;j<nz;j++){
    const next=Array.from({length:nx+1},(_,i)=>ground(i/nx,(j+1)/nz));
    for(let i=0;i<nx;i++){
      const u=(i+.5)/nx,v=(j+.5)/nz,h=karstBasinHeight(u,v);
      const dx=(karstBasinHeight(u+.01,v)-karstBasinHeight(u-.01,v))/1.88;
      const dz=(karstBasinHeight(u,v+.02)-karstBasinHeight(u,v-.02))/2.04;
      const light=.79+.32*(.70+.41*dx+.18*dz)/Math.hypot(1,dx,dz);
      const threshold=(soilMantleHeight(u,v)-h)/.81;
      const outline=line([prev[i],prev[i+1],next[i+1],next[i]]);
      function swatch(base:number[]){
        const color='rgb('+base.map(c=>Math.round(c*light)).join(',')+')';
        return `<path d="${outline}Z" fill="${color}" stroke="${color}" stroke-width=".8"/>`;
      }
      tiles.push({threshold,rock:swatch([184,174,145]),soil:swatch([143,153,111])});
    }
    prev.splice(0,prev.length,...next);
  }
  const front=Array.from({length:nx+1},(_,i)=>ground(i/nx,1));
  const edge=`<path d="${line([...front,...front.slice().reverse().map(([x,y])=>[x,y+8])])}Z" fill="#8a7e63" stroke="#746b59" stroke-width="1"/>`;
  return (loss:number)=>tiles.map(tile=>loss>tile.threshold?tile.rock:tile.soil).join('')+edge;
}
let shadedRelief:ReturnType<typeof sampleBasinRelief>|undefined;
function basinDrawing(phase:number,selection:number) {
  const s=evaluateKarstCover(phase,selection);
  shadedRelief??=sampleBasinRelief();
  const basin=ground(.5,.72);
  const water=s.wet>.035?`<ellipse cx="${basin[0]}" cy="${basin[1]}" rx="${9+49*s.wet}" ry="${2+8*s.wet}" fill="#74a2ab"/>`:'';
  const trees=[[.16,.29],[.24,.45],[.41,.19],[.55,.23],[.77,.29],[.83,.58],[.73,.78],[.24,.70]].flatMap(([u,v],i)=>{
    if(![3,7].includes(i)&&s.loss>=.16+.11*i)return [];
    return [-1,0,1].map((k,j)=>{const [x,y]=ground(u+k*.019,v+j*.009);return `<path d="M${x} ${y}v-7" stroke="#605640" stroke-width="2"/><path d="M${x-6} ${y-6}q-2 -5 2 -8q3 -8 7 -2q8 3 4 9Z" fill="${j%2?'#61744e':'#75815b'}" stroke="#56654c"/>`;});
  }).join('');
  const particles=s.particles.filter(()=>selection===1).map(p=>{const [x,y]=ground(p.u,p.v);return `<circle cx="${x}" cy="${y-2}" r="2.7" fill="#9f704a" stroke="#6e523d"/>`;}).join('');
  const farms=selection===3?Array.from({length:7},(_,i)=>`<path d="${line(Array.from({length:12},(_,j)=>ground(.37+j*.022,.72+.024*i)))}" fill="none" stroke="#526b40" stroke-width="2"/>`).join(''):'';
  const caption=['植被覆盖，薄土留在坡面','覆被减少，坡土向洼地迁移',s.dry?'雨歇，水沿裂隙渗漏':'雨时，水在洼地汇集','山顶保林，坡地栽果，洼地种粮'][selection];
  return shadedRelief(s.loss)+water+trees+particles+farms+label(320,339,caption);
}

export function karstObserverDrawing(cave:boolean,phase:number,selection:number) {
  const names=cave?['洞腔','滴水沉积']:['覆被','侵蚀','涝旱','农林'];
  return `<svg class="flat-model-svg flat-explanation-svg karst-observer" viewBox="0 0 640 520" role="group" aria-label="${cave?'地下喀斯特剖面':'喀斯特峰丛洼地'} · ${names[selection]}" data-karst-phase="${phase}" data-karst-condition="${selection}" xmlns="http://www.w3.org/2000/svg">
    <g stroke-linejoin="round" stroke-linecap="round" font-family="FieldSerif,SimSun,serif">${cave?caveDrawing(phase,selection):basinDrawing(phase,selection)}${panel(names,phase,selection,cave)}</g></svg>`;
}
