import hemispheres from './assets/solar-instrument/observation-hemispheres.json';

export function habitableDrawing(selected:number){
  const slots=['适宜温度','液态水','大气条件'];
  const action=(i:number)=>`data-model-selection="${i}" role="button" tabindex="0" data-specimen-key="" aria-label="查看${slots[i]}" aria-pressed="${selected===i}"`;
  const rim=Array.from({length:60},(_,i)=>{const a=(90+3*i)*Math.PI/180,r=i%5?114:110;
    return `M${334+r*Math.cos(a)} ${146+r*Math.sin(a)}l${4*Math.cos(a)} ${4*Math.sin(a)}`;
  }).join('');
  const path=hemispheres.habitable;
  let svg=`<defs><radialGradient id="life-sea" cx=".35" cy=".25" r=".9"><stop stop-color="#86aa9c"/><stop offset=".72" stop-color="#548487"/><stop offset="1" stop-color="#345e63"/></radialGradient></defs>
    <ellipse cx="334" cy="288" rx="111" ry="22" fill="#634937" stroke="#443b2e" stroke-width="3"/><ellipse cx="334" cy="283" rx="112" ry="19" fill="#9f8558"/>
    <ellipse cx="334" cy="280" rx="106" ry="17" fill="#75543d" stroke="#574333"/>
    <path d="M250 276q-11-37-24-72t-25-43M407 274q12-37 23-65t35-47M334 274v-20" fill="none" stroke="#634f34" stroke-width="9"/>
    <path d="M250 274q-10-37-24-70t-25-43M407 273q12-37 23-64t35-47" fill="none" stroke="#b39a66" stroke-width="4"/>
    <path d="M334 31a115 115 0 0 0 0 230" fill="none" stroke="#a98a52" stroke-width="11"/><path d="${rim}" fill="none" stroke="#594a35" stroke-width="1.1"/>
    <g ${action(1)}><circle cx="334" cy="146" r="102" fill="url(#life-sea)" stroke="#3c5954" stroke-width="1.3"/>
    <g transform="translate(334 146) scale(1.02)"><path d="${path.land}" fill="#c9b78c" fill-rule="evenodd" stroke="#8e805f" stroke-width=".55"/><path d="${path.night}" fill="#183a40" opacity=".41"/></g></g>
    <g ${action(2)}><circle cx="334" cy="146" r="107.6" fill="none" stroke="${selected===2?'#72a6ad':'#a5beb9'}" stroke-width="${selected===2?4.6:1.6}"/>
    <path d="M286 112q14-6 24-3m46 44q19-2 28-7m-71 39q11 3 21-1" stroke="#e5e4d0" stroke-width="2.4" fill="none"/></g>
    <path d="M199 167c12 28 238 35 271-2" fill="none" stroke="#715b39" stroke-width="8"/><path d="M199 165c12 28 238 35 271-2" fill="none" stroke="#c4a770" stroke-width="4"/>`;
  if(selected===0)svg+=`<g ${action(0)} fill="none" stroke="#ad8349" stroke-width="2">${[112,126,140].map((y,i)=>`<path d="M${181-i*3} ${y-4}l56 4m-8-4l8 4-8 3"/>`).join('')}</g>`;
  if(selected===1)svg+='<path d="M258 150q5-3 10 0t10 0m-19 5q6-3 11 0t10 0" stroke="#dbe8d8" fill="none" stroke-width="2.2"/>';
  svg+=`<path d="M132 310h380l12 42-11 8H131l-11-9Z" fill="#75583f" stroke="#503d2c" stroke-width="2"/>`;
  slots.forEach((name,i)=>{const x=190+i*132;svg+=`<g ${action(i)}><rect x="${x-58}" y="314" width="116" height="39" rx="5" fill="${selected===i?'#bea375':'#9b8055'}" stroke="#645237"/><rect x="${x-54}" y="317" width="108" height="32" rx="3" fill="#e8ddbf"/><text x="${x}" y="341" text-anchor="middle" fill="#443d32" font-family="FieldSerif,SimSun,serif" font-size="21">${name}</text></g>`});
  return svg;
}