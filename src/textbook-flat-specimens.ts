import { evaluateSeismicParticles } from './textbook-ground-process-model';
import { evaluateWaterRenewal } from './textbook-water-renewal-model';

const ink = '#354440';
const brass = '<linearGradient id="instrument-brass" x2=".12" y2="1"><stop stop-color="#e2cf98"/><stop offset=".18" stop-color="#ad905e"/><stop offset=".45" stop-color="#d6bb7a"/><stop offset=".76" stop-color="#a48755"/><stop offset="1" stop-color="#685738"/></linearGradient>';
const metal = 'url(#instrument-brass)';
const lettering = 'font-family="FieldSerif,SimSun,serif"';
const caption = (x:number,y:number,text:string,anchor='middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${ink}" font-size="24" ${lettering}>${text}</text>`;
const pin = (x:number,y:number,r=3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${metal}" stroke="#796749" stroke-width=".9"/>`;
const plate = (x:number,y:number,w:number,h:number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${metal}" stroke="#796749"/>`;
const view = (name:string,body:string,defs='') =>
  `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="img" aria-label="${name}"><defs>${brass}${defs}</defs>${body}</svg>`;

/** Front elevation of the two eccentric wave trains. The wheel, crankpins
 * and bead displacements use the same three revolutions as the bench. */
export function seismicSectionSvg(phase:number,selection:number,inspection='overview') {
  const state=evaluateSeismicParticles(phase,selection),liquid=state.liquid;
  const angle=6*Math.PI*state.phase,cx=63,py=223,sy=105,rad=28;
  const S=(n:number)=>Number(n.toFixed(2));
  const rows=([true,false] as const).map(shear=>{
    const cy=shear?sy:py;
    const points=state.particles.map(q=>({id:q.id,x:S(122+q.id*24+(shear?0:q.pDx*4.25)),y:S(cy-(shear?q.sDy*4.25:0)),off:shear&&!q.transmittedS}));
    const links=points.slice(1).map((c,i)=>{
      const a=points[i];if(shear&&liquid&&c.id>=10)return '';
      if(shear)return `<path d="M${a.x} ${a.y}L${c.x} ${c.y}" stroke="#707f76" stroke-width="2"/>`;
      return `<path d="M${a.x} ${a.y}`+Array.from({length:15},(_,k)=>{
        const u=(k+1)/15;return `L${S(a.x+u*(c.x-a.x))} ${S(cy-3*Math.sin(u*4*Math.PI))}`;
      }).join('')+'" fill="none" stroke="#9e8553" stroke-width="1.6"/>';
    }).join('');
    const nodes=points.map(q=>{
      const id='particle-'+q.id,chosen=inspection===id,selectable=q.id===6||q.id===14;
      const hit=selectable?` data-model-inspection="${chosen?'overview':id}" aria-label="检视${q.id<10?'左侧':'右侧'}质点" role="button" tabindex="0"`:'';
      return `<g${hit}>${selectable?'<circle cx="'+q.x+'" cy="'+q.y+'" r="15" fill="transparent"/>':''}
        ${chosen?'<circle cx="'+q.x+'" cy="'+q.y+'" r="10.8" fill="none" stroke="#a97432" stroke-width="2.3"/>':''}
        ${shear?`<path d="M${q.x} ${cy-17}v34" stroke="#87928a" stroke-width="1.2"/><circle cx="${q.x}" cy="${q.y}" r="5.4" fill="${q.off?'#acb8b1':'#3c655b'}" stroke="#4d5b50"/>`:`<rect x="${q.x-5}" y="${cy-5}" width="10" height="10" rx="2.4" fill="${metal}" stroke="#806333"/>`}</g>`;
    }).join('');
    return `<path d="M106 ${cy}H587" stroke="#939a90" stroke-dasharray="2 4"/>${links}${nodes}`;
  }).join('');
  const pinPX=cx-7.01*Math.sin(angle),pinPY=py-7.01*Math.cos(angle);
  const pinSX=cx-12.75*Math.cos(angle),pinSY=sy+12.75*Math.sin(angle);
  const source=state.particles[0];
  const endpoint=liquid?344:578;
  const yokes=`<path d="M${S(pinPX)} ${py}H${S(122+source.pDx*4.25)}M${cx} ${S(pinSY)}H122" stroke="#9c845b" stroke-width="4"/>
    <rect x="${S(pinPX-3)}" y="${py-9.4}" width="6" height="18.8" fill="none" stroke="#67726c" stroke-width="2"/>
    <rect x="${cx-15}" y="${S(pinSY-3)}" width="30" height="6" fill="none" stroke="#67726c" stroke-width="2"/>
    ${pin(pinSX,pinSY,2.3)}${pin(pinPX,pinPY,2.3)}`;
  const wheel=`<g transform="translate(${cx} ${py})" data-model-crank="3" data-radius="${rad}" tabindex="0" role="slider" aria-label="转动振源手轮" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
    <circle r="39" fill="transparent"/><circle r="${rad}" fill="none" stroke="#6d5736" stroke-width="6"/><circle r="${rad}" fill="none" stroke="${metal}" stroke-width="3.5"/>
    <g transform="rotate(${S(-phase*1080)})">${Array.from({length:5},(_,i)=>`<path d="M0 3Q-2 16 0 27" transform="rotate(${72*i})" fill="none" stroke="#ab8a51" stroke-width="3"/>`).join('')}
    <circle cy="${rad}" r="5.2" fill="#795232" stroke="#574532"/></g>${pin(0,0,3.7)}</g>`;
  const modes=['固体与液体','两侧固体'].map((name,i)=>`<g role="button" tabindex="0" data-specimen-key aria-pressed="${selection===i}" data-model-selection="${i}" data-keep-phase aria-label="${name}">
    <rect x="${69+i*267}" y="317" width="220" height="48" rx="6" fill="${selection===i?'#d6bd8b':'#eee6cf'}" stroke="#917950" stroke-width="2"/>${caption(179+i*267,351,name)}</g>`).join('');
  const body=`<rect x="24" y="280" width="589" height="12" rx="3" fill="#6f513b" stroke="#624d37"/>
    <path d="M51 279V98Q52 82 66 86Q79 86 77 104L74 245Q74 266 88 280Z" fill="#41594c" stroke="#7e714d"/>
    <path d="M586 280V78h9v202" fill="#465a4d" stroke="#847452"/>
    <path d="M${S(cx+9*Math.cos(angle))} ${S(sy-9*Math.sin(angle))}v${py-sy}" stroke="#848578" stroke-width="3"/>
    <circle cx="${cx}" cy="${sy}" r="16" fill="${metal}" stroke="#8a7549"/>
    <path d="M349 78v183" stroke="#9c9987" stroke-dasharray="4 5"/>
    <path d="M119 54l3-16 15-10 15 5 6 17-8 7Z" fill="#8d8471" stroke="#655e50"/><path d="M122 38l13 6 17-11m-17 11-2 9" fill="none" stroke="#a79b80"/>
    <g data-model-selection="${liquid?1:0}" data-keep-phase tabindex="0" role="button" aria-label="更换右侧介质样品">
      <rect x="382" y="12" width="145" height="55" fill="transparent"/>
      ${liquid?'<path d="M400 25h10v8q9 3 9 9v11q0 4-4 4h-20q-4 0-4-4V42q0-6 9-9Z" fill="#d2e2db" stroke="#84978c"/><path d="M393 43q12 3 24 0v11h-24Z" fill="#7eaaa3"/><path d="M399 23h12v5h-12Z" fill="#9b7852"/>':'<path d="M389 53l2-15 15-11 14 7 5 17-9 6Z" fill="#8d8471" stroke="#655e50"/>'}
      ${caption(468,52,liquid?'液体':'固体')}</g>
    ${caption(208,52,'固体')}${rows}${yokes}${wheel}
    <path d="M254 151H${endpoint}l-8 -4m8 4-8 4M254 260H578l-8 -4m8 4-8 4" fill="none" stroke="#52776f" stroke-width="2.2"/>
    ${caption(178,160,'横波 S')}${caption(178,269,'纵波 P')}${modes}`;
  return view('地震纵波与横波演示仪',body).replace('role="img"','role="group"');
}

export function waterRenewalSectionSvg(phase:number,selection:number) {
  const state=evaluateWaterRenewal(phase,selection);
  const base=300, waterTop=base-state.level*205, receiverTop=base-state.receiverLevel*130;
  const fluid=state.contaminated?'#a59674':'#7ba4a6';
  const defs='<linearGradient id="glass"><stop stop-color="#eaf1eb" stop-opacity=".9"/><stop offset=".16" stop-color="#fff6db" stop-opacity=".3"/><stop offset=".8" stop-color="#aabdb7" stop-opacity=".19"/><stop offset="1" stop-color="#e5ece3" stop-opacity=".78"/></linearGradient>';
  const tank=(x:number,w:number,top:number,level:number)=>{
    const marks=Array.from({length:9},(_,i)=>`M${x+3} ${base-6-i*(base-top-10)/8}h${i%2?7:13}`).join('');
    return `<rect x="${x}" y="${top}" width="${w}" height="${base-top}" fill="url(#glass)" stroke="#526862" stroke-width="2"/>
      <rect x="${x+2}" y="${level}" width="${w-4}" height="${base-level}" fill="${fluid}" opacity=".78"/>
      <path d="M${x+2} ${level}q${w*.23} 2 ${w*.48} 0t${w*.48} 0" fill="none" stroke="#506e6d"/>
      <path d="${marks}" fill="none" stroke="#596b60" stroke-width="1.5"/>
      <path d="M${x+w-14} ${top+5}V${base-4}" stroke="white" stroke-width="4" opacity=".5"/>
      ${plate(x-4,top-4,w+8,7)}${plate(x-5,base,w+10,8)}`;
  };
  return view('水资源补给、取用与水质',plate(103,313,455,6)
    +tank(161,184,82,waterTop)+tank(428,93,165,receiverTop)
    +`<path d="M69 112h60v-42h73v22M345 277h41V151h64v18" stroke="#66583d" stroke-width="10" fill="none" stroke-linejoin="round"/>
      <path d="M69 112h60v-42h73v22M345 277h41V151h64v18" stroke="#bca16b" stroke-width="6" fill="none" stroke-linejoin="round"/>
      <path d="M202 93v${Math.max(4,waterTop-96)} M450 169v${Math.max(0,receiverTop-171)}" stroke="${fluid}" stroke-width="3" opacity=".88"/>
      ${pin(129,112,4)}${pin(386,277,4)}`
    +(state.selection===1&&state.phase>.02 ? '<path d="M151 156.5h36" stroke="#7d6a48" stroke-dasharray="3 2"/>'+caption(144,162,'初始水位','end') : '')+caption(83,78,'补给')+caption(474,128,'取用')+caption(250,358,state.contaminated?'受污染的水体':'可用淡水'),defs);
}
