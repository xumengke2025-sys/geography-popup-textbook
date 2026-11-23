import { airCompositionExtraSvg } from './textbook-air-composition-model';

const inscribe=(x:number,y:number,text:string)=>`<text x="${x}" y="${y}" font-size="30" text-anchor="middle" fill="#443d31">${text}</text>`;
/** Ten rods stay visible while the separate aspirator is sampled. Turning its
 * hinge adjusts only the angle of the counter. */
export function airSamplerDrawing(phase:number,selected:number,inspection:string){
  const near=inspection==='counting-face';
  const button=(which:number)=>`data-model-selection="${which}" data-keep-phase data-specimen-key role="button" tabindex="0"`;
  const inspect=(target:string)=>`data-model-inspection="${target}" data-specimen-key role="button" tabindex="0"`;
  let rows='';
  for(let row=0;row<10;row++){
    const y=70+row*19.4;
    rows+=`<path d="M37 ${y+9}H276" stroke="#a08b63" stroke-width="2.6"/>`;
    for(let col=0;col<10;col++){const i=row*10+col;
      rows+=`<rect x="${42+col*23.1}" y="${y}" width="18" height="18" fill="${i<78?'#a7c6ce':i<99?'#c18358':'#bb985c'}" rx="7.8" stroke="#806f57" stroke-width=".9"/><path d="M${46.5+col*23.1} ${y+4.2}q2.6-2.6 5.8-1.4" stroke="#f4e7cd" opacity=".66" fill="none" stroke-width="1.65"/>`;
    }
  }
  const max=selected?31:0;
  return `<g class="air-aspirator" data-sample-drawn="${selected}" data-inspection="${inspection}"><defs>
  <linearGradient id="copper-lip"><stop stop-color="#766143"/><stop offset=".20" stop-color="#b49b68"/><stop offset=".44" stop-color="#d5bd82"/><stop offset=".68" stop-color="#ab8e5d"/><stop offset="1" stop-color="#785e3d"/></linearGradient>
  <linearGradient id="aspirator-jars"><stop stop-color="#83a59f" stop-opacity=".41"/><stop offset=".22" stop-color="#d6dfcb" stop-opacity=".21"/><stop offset=".70" stop-color="#d6dfcb" stop-opacity=".04"/><stop offset="1" stop-color="#839b90" stop-opacity=".37"/></linearGradient></defs>
  <path d="M17 307l15-12h561l26 12-5 13H23Z" fill="#4b5b4f" stroke="#6a6048"/><path d="M24 320h590v14H24Z" fill="#77553d" stroke="#644936"/>
  <g transform="${near?'translate(-6 -8) scale(1.04 1.04)':'translate(0 11) scale(1 .94)'}">
  <path d="M30 271v28m251-28v28" stroke="#796345" stroke-width="7"/>
  <g ${button(0)} aria-label="查看干洁空气组成"><rect x="28" y="47" width="258" height="220" rx="4" fill="#efe6d1" stroke="#684d35" stroke-width="8"/>${rows}</g>
  <g ${inspect('counting-face')} aria-label="抬起百格计数板"><path d="M31 55h250" stroke="url(#copper-lip)" stroke-width="5"/></g>
  <g ${inspect(near?'overview':'counting-face')} aria-label="转动百格板铰轴"><circle cx="294" cy="160" r="22" fill="transparent"/><circle cx="294" cy="160" r="11" fill="url(#copper-lip)" stroke="#796645" stroke-width="2"/><path d="M288 165l11-9" stroke="#655839" stroke-width="2"/></g></g>
  <g ${button(1)} aria-label="比较水汽与杂质">
  <path d="M408 91V74q0-8 8-8h116q7 0 7 8v17M477 66v13" fill="none" stroke="#8d7351" stroke-width="4"/>
  ${[409,535].map(x=>`<path d="M${x-48} 227h96l-6-10h-84Z" fill="url(#copper-lip)" stroke="#866d4a"/><rect x="${x-44}" y="100" width="88" height="116" fill="url(#aspirator-jars)" stroke="#8ba099"/><path d="M${x-46} 103h92l-5-10-23-8h-34l-25 8Z" fill="url(#copper-lip)" stroke="#856f4c"/><path d="M${x-42} 106v107m84-107v107" stroke="#a28d66" stroke-width="2"/>`).join('')}
  </g>
  ${selected?'<g transform="translate(0 -112)">'+airCompositionExtraSvg(phase,selected)+'</g>':''}
  <g ${button(1)} data-model-toggle="0" aria-label="抽取或推回气样"><rect x="344" y="250" width="236" height="55" fill="transparent"/>
  <path d="M365 271h98v19h-98Z" fill="url(#copper-lip)" stroke="#77664d"/><path d="M361 268h8v25h-8m98-25h6v25h-6" fill="#a68c5c"/>
  <path d="M472 280h${27+max}" stroke="#86877b" stroke-width="5"/><rect x="${498+max}" y="269" width="18" height="22" rx="7" fill="#70503b" stroke="#5d4c38"/></g>
  <g ${button(0)} aria-label="干洁空气"><rect x="34" y="6" width="251" height="39" fill="transparent"/>${inscribe(157,44,'干洁空气 · 百格')}</g>
  <g ${button(1)} aria-label="观察水汽与杂质"><rect x="343" y="6" width="243" height="39" fill="transparent"/>${inscribe(470,44,'水汽与杂质')}</g>
  ${inscribe(103,376,'氮 78%')}${inscribe(304,376,'氧 21%')}${inscribe(524,376,'其他 1%')}</g>`;
}
