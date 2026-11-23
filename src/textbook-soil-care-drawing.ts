import { evaluateSoilCare } from './textbook-soil-care-model';

const random=(i:number,s:number)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
const round=(x:number)=>+x.toFixed(1);
const surface=(x:number)=>157+1.75*Math.sin(x*.064)+.95*Math.sin(x*.193);
const top=Array.from({length:81},(_,i)=>{const x=93+i*5.67;return round(x)+' '+round(surface(x));}).join(' L');
const grains=Array.from({length:230},(_,i)=>{
  const x=96+random(i,12)*448,y=162+random(i,17)*121,rx=.65+random(i,23)*2.65,ry=.3+random(i,41)*1.15;
  return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(rx)}" ry="${round(ry)}" transform="rotate(${round(35*(random(i,9)-.5))} ${round(x)} ${round(y)})" fill="${['#685138','#a68960','#d2ad7b','#534735'][i%4]}" opacity=".69"/>`;
}).join('');
const gravels=Array.from({length:96},(_,i)=>`<ellipse cx="${round(96+random(i,5)*447)}" cy="${round(306+random(i,33)*6)}" rx="${round(1.4+random(i,18)*3.8)}" ry="${round(.7+random(i,57)*1.45)}" fill="${['#877c68','#59685e','#aba185'][i%3]}"/>`).join('');

export function soilCareDrawing(phase:number,selection:number) {
  const state=evaluateSoilCare(phase,selection),names=['蒸发返盐','引淡淋盐','覆盖抑蒸发'];
  const salt=state.packets.map(p=>`<circle data-salt-id="${p.id}" cx="${round(p.u*640)}" cy="${round(316-p.height*8)}" r="4.1" fill="#e5bc66" stroke="#695334" stroke-width="1.2"/>`).join('');
  const crust=Array.from({length:Math.round(55*state.surfaceSalt)},(_,i)=>{
    const x=95+random(i,27)*447,w=2+random(i,8)*8;
    return `<path d="M${round(x)} ${round(surface(x)-.5)}l${round(w*.35)} -1.5 ${round(w*.65)} .7" fill="none" stroke="#ede4c6" stroke-width="2.5"/>`;
  }).join('');
  const straw=selection===2?Array.from({length:83},(_,i)=>{
    const x=99+random(i,67)*438,y=surface(x)-3-random(i,89)*2;
    return `<path d="M${round(x-5)} ${round(y+.9)}q4 -2 11 -1.7" stroke="${i%3?'#968449':'#766c45'}" stroke-width="2" fill="none"/>`;
  }).join(''):'';
  const water=Array.from({length:selection===2?7:21},(_,i)=>{
    if(phase<=.08||phase>=.98)return '';
    const lane=i%7,progress=(phase*2+Math.floor(i/7)/3)%1,x=140+lane*58,y=selection===1?145+progress*147:284-progress*133;
    return `<path d="M${x} ${round(y-3)}q-4 5 -2 7q2 2 4 0t-2 -7Z" fill="#9ec8c5" stroke="#557875" stroke-width=".65"/>`;
  }).join('');
  const keys=names.map((name,i)=>`<g data-model-selection="${i}" data-specimen-key="" data-keep-phase="" role="button" tabindex="0" aria-label="${name}" aria-pressed="${selection===i}"><rect x="${64+i*173}" y="339" width="161" height="37" rx="5" fill="${i===selection?'#d8c89e':'#eae1cb'}" stroke="#867452" stroke-width="2"/><text x="${145+i*173}" y="366" text-anchor="middle" style="font-size:27px" fill="#3d463c">${name}</text></g>`).join('');
  const cup=selection===1?'<path d="M550 279h28v4h-28m29-14v29h41v-29" fill="none" stroke="#8a805e" stroke-width="2"/><path d="M581 283h37v13h-37z" fill="#96b9b9" opacity=".55"/>':'';
  return `<svg class="flat-model-svg flat-explanation-svg" viewBox="0 0 640 390" role="group" aria-label="${state.caption}，金色点示踪同一批溶解盐"><defs><linearGradient id="care-horizons" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#60503c"/><stop offset=".19" stop-color="#82674b"/><stop offset=".68" stop-color="#a78b65"/><stop offset="1" stop-color="#8e8064"/></linearGradient></defs>
    <g font-family="FieldSerif,SimSun,serif"><g fill="#3f4b43"><path d="M178 41q-10 14 -7 18q7 10 14 0q3 -4 -7 -18Z" fill="#89b4b7" stroke="#557875" stroke-width="2"/><text x="200" y="62" style="font-size:28px">水分</text><circle cx="342" cy="54" r="8" fill="#e5bc66" stroke="#695334" stroke-width="2"/><text x="361" y="62" style="font-size:28px">溶解盐</text></g>
    <path d="M93 152V114h454v38" fill="none" stroke="#a48c5b" stroke-width="3"/>
    <path d="M95 114h450v9H95Z" fill="${selection===1?'#9fbdbc':'#e2d9c0'}" stroke="#898163"/>
    <path d="M${top} V286 H93Z" fill="url(#care-horizons)" stroke="#776448" stroke-width="1.4"/>${grains}
    <path d="M93 286h454v29H93Z" fill="#96b8b4" stroke="#737d69"/>${gravels}
    <path d="M89 315h462v6H89Z" fill="#9e8458"/>${crust}${straw}${water}${cup}${salt}${keys}</g></svg>`;
}