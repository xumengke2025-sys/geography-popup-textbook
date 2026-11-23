import { GEOLOGICAL_INTERVALS, geologicalInterval } from './textbook-sky-causality-model';

const outline = '#544e3e';
const path = (d:string,fill:string,stroke=outline,width=1.6) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const engraved = (d:string) => path(d,'none','#675e48',1.15);
const stone = 'url(#age-ochre)';
const moss = 'url(#age-olive)';

function stromatolite() {
  // A cross-section through domed microbial mats. Only the living surface is green.
  const top = (x:number) => 199 - 57*Math.exp(-(((x-240)/48)**2))
    - 95*Math.exp(-(((x-324)/59)**2)) - 48*Math.exp(-(((x-405)/38)**2));
  const band = (x:number,t:number) => top(x)*(1-t)+242*t+Math.sin(x*.091+t*4)*1.9;
  const trace = (t:number,reverse=false) => Array.from({length:85},(_,i)=>{
    const x=151+4*(reverse?84-i:i);
    return x+' '+band(x,t).toFixed(1);
  }).join('L');
  let beds='';
  const colors=['#788570','#c6b387','#a58e69','#dfceaa','#bba482','#ddcba9','#bda681','#dfcda8'];
  for(let i=0;i<colors.length;i++){
    const t=[0,.045,.12,.20,.32,.45,.63,.81,1];
    beds+=path('M'+trace(t[i])+'L'+trace(t[i+1],true)+'Z',colors[i],'#776e54',.85);
  }
  return beds+path('M151 242H487L476 250H161Z','#9c8867');
}

function trilobite() {
  let s=path('M-45 -43Q-46 -83 0 -89Q46 -83 45 -43L56 -19L37 -30Q31 57 0 80Q-31 57 -37 -30L-56 -19Z',stone);
  s+=path('M-39 -44Q-33 -75 0 -81Q33 -75 39 -44Q18 -49 9 -42H-9Q-18 -49 -39 -44Z','#c1ad82');
  s+=path('M-13 -46Q-19 -59 -9 -71Q0 -78 9 -71Q19 -59 13 -46Z',moss);
  for(const side of [-1,1]){
    s+=`<g transform="scale(${side} 1)">`+path('M17 -52Q24 -66 31 -62Q33 -57 24 -51Z','#665c49')
      +engraved('M16 -44Q28 -41 40 -47M11 -69Q4 -66 1 -68')+'</g>';
  }
  for(let i=0;i<13;i++){
    const y=-38+i*7,w=38-i*1.2,axis=10-i*.22;
    s+=path(`M${-w} ${y}Q${-axis} ${y-5} 0 ${y-2}Q${axis} ${y-5} ${w} ${y}l-1 5Q${axis} ${y+1} 0 ${y+6}Q${-axis} ${y+1} ${-w+1} ${y+5}Z`,stone);
    s+=path(`M${-axis} ${y-2}Q0 ${y-6} ${axis} ${y-2}v5Q0 ${y+8} ${-axis} ${y+3}Z`,moss);
  }
  s+=engraved('M-19 53Q-7 56 0 69Q7 56 19 53M-15 60L0 72L15 60');
  return `<g transform="translate(320 171) rotate(-14) scale(1.15 .98)">${s}</g>`;
}

function sauropod() {
  const body='M115 203Q158 207 198 189Q222 174 247 159Q285 138 329 151Q349 155 365 145Q387 132 408 99Q419 81 436 82Q453 82 459 92L453 99L437 98Q421 119 411 143Q398 169 365 185L355 201L354 239L343 240L338 207Q322 218 290 209L278 216L269 242L258 242L261 209Q246 206 234 198Q198 213 159 214Q132 212 115 203Z';
  return path('M275 187L297 203L309 235H297L280 213L264 208ZM340 177L360 179L372 230H362L349 202Z','#8c8b73')
    +path(body,moss)+engraved('M122 204Q163 210 195 197Q230 176 253 171M249 175Q265 185 262 208M323 161Q341 169 340 194M367 161Q403 132 424 98M436 94Q445 96 453 94')
    + Array.from({length:13},(_,i)=>{const x=248+i*6.7,y=156-9*Math.sin(i*.23);return engraved(`M${x} ${y+9}q2 4 5 5`)}).join('')
    +path('M441 88a1.7 1.7 0 1 0 .1 0Z','#35382e');
}

function mammoth() {
  const fur='M192 177Q190 152 207 136Q225 115 255 116Q273 91 305 96Q327 98 338 110Q365 102 381 119Q395 129 396 150Q394 172 405 191Q416 205 428 197Q430 212 417 218Q399 221 388 207Q376 192 372 171L356 177L350 205L346 238H331L329 204L315 197Q293 203 272 193L259 206L251 239H235L236 209L226 199Q214 194 205 185L197 204L188 211Q198 185 192 177Z';
  return path('M249 181L267 184L277 228H263L249 206ZM326 174L349 176L364 225H351L337 204Z','#89745c')
    +path(fur,stone)+path('M353 134Q330 123 332 145Q332 162 347 166Q360 158 353 134Z','#ab9371')
    +path('M376 160Q397 177 423 166Q442 157 440 140Q451 155 435 169Q406 193 376 170Z','#f1e3bc')
    +engraved('M211 143q-5 12 -4 17M220 141q-2 15 -8 25M240 130q-1 13 -7 24M261 122q-2 10 -6 17M291 111q-1 10 -6 14M310 112q3 9 0 16M228 169q1 13 -7 19M253 164q1 17 -7 26M270 166q-1 15 -8 22M297 169q-1 12 -8 19M311 168q0 12 -6 19M365 141q4 0 6 2M385 182l8 -3M390 191l8 -3M397 201l6 -3')
    +path('M368 145a2 2 0 1 0 .1 0Z','#37382d');
}

function fernFrond() {
  let frond=engraved('M395 242Q423 181 460 96');
  for(let i=0;i<12;i++){
    const x=402+i*4.8,y=225-i*10.5,w=30*Math.sin((i+2)*Math.PI/16);
    for(const side of [-1,1]){
      const tip=x+side*w;
      frond+=path(`M${x} ${y}Q${x+side*9} ${y-11} ${tip} ${y-20}Q${x+side*12} ${y-3} ${x} ${y}Z`,moss,outline,.8);
    }
  }
  return frond;
}

function floweringTwig() {
  let sprig=engraved('M432 240Q446 195 459 128M446 193l-21 -12M450 166l20 -16');
  for(const [x,y,sign] of [[442,207,-1],[448,184,1],[453,157,-1]]){
    sprig+=path(`M${x} ${y}q${sign*29} -2 ${sign*34} -31q${sign*-27} 4 ${sign*-34} 31Z`,moss)
      +engraved(`M${x} ${y}l${sign*25} -23`);
  }
  for(let i=0;i<5;i++)sprig+=`<ellipse cx="459" cy="116" rx="7.3" ry="14" transform="rotate(${i*72} 459 128)" fill="#e7d1ac" stroke="#776e54"/>`;
  return sprig+'<circle cx="459" cy="128" r="6.5" fill="#ab874f"/>';
}

export function geologicalPlate(selected:number) {
  const span=geologicalInterval(selected);
  const subject=['蓝细菌席与叠层石','三叶虫与蕨类植物','爬行动物 · 蜥脚类恐龙','猛犸象与被子植物'][selected];
  const drawings=[stromatolite,()=>'<g transform="translate(-58 0)">'+trilobite()+'</g>'+fernFrond(),
    sauropod,()=>'<g transform="translate(-52 0)">'+mammoth()+'</g>'+floweringTwig()];
  const defs='<defs><linearGradient id="age-ochre" x2=".25" y2="1"><stop stop-color="#eee1ba"/><stop offset=".43" stop-color="#c5ac80"/><stop offset="1" stop-color="#8a755c"/></linearGradient><linearGradient id="age-olive" x2=".32" y2="1"><stop stop-color="#bfbea0"/><stop offset=".52" stop-color="#929981"/><stop offset="1" stop-color="#696f60"/></linearGradient><linearGradient id="age-brass"><stop stop-color="#77613e"/><stop offset=".35" stop-color="#d1b777"/><stop offset=".72" stop-color="#a38a5f"/><stop offset="1" stop-color="#806941"/></linearGradient></defs>';
  const label=(x:number,y:number,value:string,size:number,anchor:string)=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="#354541" font-family="FieldSerif,SimSun,serif">${value}</text>`;
  const axis=GEOLOGICAL_INTERVALS.map((period,i)=>{
    const interval=geologicalInterval(i);
    return `<rect data-model-selection="${i}" role="button" tabindex="0" aria-label="查看${period.label}" aria-pressed="${i===selected}" x="${54+532*interval.start}" y="324" width="${532*interval.fraction}" height="13" fill="${['#b7aa8b','#8da6a1','#9daa84','#c8ac80'][i]}" stroke="#675e48" stroke-width=".9"/>`;
  }).join('');
  const pointer=54+532*(span.start+span.fraction/2);
  const age=(v:number)=>String(v/100);
  return defs+label(54,48,span.label,31,'start')+label(585,45,(span.toMa ? age(span.fromMa)+'—'+age(span.toMa)+' 亿年前' : age(span.fromMa)+' 亿年前至今'),21,'end')
    +path('M54 62H586','none','#aea080',1)
    +drawings[selected]()+label(320,286,subject,26,'middle')
    +path('M52 321H588V340H52Z','url(#age-brass)')+axis
    +path(`M${pointer-5} 314h10l-5 8Z`,'#82563e')
    +label(54,367,'46 亿年前',19,'start')+label(586,367,'现在',19,'end');
}
