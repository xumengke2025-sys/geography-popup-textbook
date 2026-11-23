import type { Figure } from './textbook-catalog';
import { playbackPolicy } from './textbook-playback-policy';
import { inspectionTargets } from './textbook-inspection';

type Drive = ['wheel' | 'slide' | 'probe', string];
// The real drawn grips take precedence. These mechanisms serve drawings that
// have a flow, comparison or indicator but no physical way to move it yet.
const drives: Record<string, Drive> = {
  karst:['wheel','转动岩溶演示轮'], 'solar-activity':['wheel','转动太阳活动演示轮'],
  'seismic-waves':['wheel','转动振源偏心轮'], 'external-spheres':['slide','推移物质示踪尺'],
  'mars-base':['slide','推移舱间示踪器'], greenhouse:['slide','推移辐射示踪尺'],
  breeze:['wheel','转动昼夜盘'], 'pressure-wind':['slide','推移气压差示踪尺'],
  haze:['slide','推移烟尘观察尺'], 'basin-system':['probe','沿水路移动探针'],
  'water-renewal':['wheel','转动水量试验轮'], salinity:['wheel','转动水盐试验轮'],
  waves:['wheel','转动造波轮'], tides:['wheel','转动潮汐盘'], desalination:['wheel','转动排盐试验轮'],
  river:['slide','推移河曲观察尺'], 'coastal-landform':['wheel','转动造浪轮'],
  'terrain-observation':['probe','移动地貌测针'], 'karst-livelihood':['probe','移动山地观察针'],
  vegetation:['slide','推移物候观察尺'], 'soil-texture':['wheel','转动供水阀轮'],
  soil:['probe','推移土柱示踪针'], 'soil-factors':['probe','推移成土观察针'],
  'soil-care':['wheel','转动水盐示踪轮'], earthquake:['slide','推移波前记录尺'],
  slide:['slide','推移坡体试验尺'], 'disaster-chain':['slide','推移地景记录尺'],
  gis:['slide','推拉地图叠片'], 'quake-response-system':['slide','推移救援记录尺'],
};
const needsSelector = new Set(['karst','habitable','solar-activity','seismic-waves','external-spheres','mars-base','air-composition',
  'greenhouse','pressure-wind','wind-forces','water','water-renewal','salinity','density','waves','desalination',
  'coastal-landform','terrain-observation','karst-livelihood','vegetation','soil-composition','soil-factors','soil-care',
  'earthquake','slide','disaster-chain','mitigation','warehouse']);
const zones: Record<string,Record<string,[number,number,number,number]>> = {
  'basin-system': {upper:[103,152,229,220],bend:[292,250,213,173],mouth:[464,256,188,182],sediment:[343,246,306,213]},
  'quake-response-system': {remote:[164,157,347,258],position:[370,145,292,259],roads:[122,243,442,235],warehouses:[109,244,474,233]},
  'seismic-waves': {'particle-6':[100,75,285,240],'particle-14':[280,75,285,240]},
  'mars-base': {'mars-shell-0':[65,150,169,160],'mars-shell-1':[230,46,180,166],
    'mars-shell-2':[400,151,181,162],'mars-shell-3':[234,232,172,155]},
  'air-composition': {'counting-face':[44,59,248,252]},
  'water-renewal': {supply:[48,47,191,134],storage:[137,62,230,269],receiver:[338,128,212,203],sample:[161,168,184,161]},
};
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const etch=(x:number,y:number,s:string,size=31)=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#342f26" font-family="FieldSerif,SimSun,serif">${escape(s)}</text>`;
const brass='#ae8c54', steel='#7b8581', ink='#554b3b';
const key=(attr:string,x:number,y:number,label:string,dir:number)=>{
  const d=dir<0?'M8 -12L-8 0 8 12':'M-8 -12L8 0 -8 12';
  return `<g ${attr} data-specimen-key tabindex="0" role="button" aria-label="${escape(label)}" transform="translate(${x} ${y})">
    <rect x="-37" y="-35" width="74" height="70" rx="6" fill="transparent"/><rect x="-27" y="-25" width="54" height="51" rx="8" fill="#a78b58" stroke="${ink}" stroke-width="2"/>
    <rect x="-24" y="-23" width="48" height="44" rx="7" fill="#e9dfc2"/><path d="${d}" fill="none" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/></g>`;
};
function selector(options:ReadonlyArray<{value:string;label:string}>,current:string,inspection:boolean) {
  const at=Math.max(0,options.findIndex(o=>o.value===current)),len=options.length;
  const step=(dir:number)=>{
    const to=options[(at+dir+len)%len];
    return key(inspection?`data-model-inspection="${to.value}"`:`data-model-selection="${to.value}" data-keep-phase`,
      dir<0?55:585,38,(inspection?'检视':'换至')+to.label,dir);
  };
  const caption=(inspection?'检视 · ':'')+options[at].label;
  const returnToBench=inspection&&current!=='overview'?' data-model-inspection="overview" data-specimen-key tabindex="0" role="button" aria-label="收回检视镜，返回整体"':'';
  return `<g>${step(-1)}<g${returnToBench}><rect x="105" y="12" width="430" height="51" rx="4" fill="${inspection?'#cbd2c6':'#f1e7d0'}" stroke="#8a8067" stroke-width="2"/>
    ${etch(320,49,caption,caption.length<13?31:26)}</g>${step(1)}</g>`;
}
function manualDrive([type,label]:Drive,phase:number) {
  if(type==='wheel'){
    const angle=phase*360;
    return `<g transform="translate(100 57)" data-model-crank="1" data-radius="36" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
      <circle r="50" fill="transparent"/><circle r="37" stroke="${ink}" stroke-width="9" fill="none"/><circle r="37" stroke="${brass}" stroke-width="5" fill="none"/>
      <g transform="rotate(${90-angle})"><path d="M36 0C14 -6 7 -1 0 0Q-2 -12 -18 -31M0 0Q-10 4 -18 31" fill="none" stroke="${brass}" stroke-width="5"/>
      <circle cx="36" r="9" fill="#63412c" stroke="#ab8c5c" stroke-width="2"/></g><circle r="6" fill="${ink}"/></g>${etch(368,68,label)}`;
  }
  const x=70+500*phase, probe=type==='probe';
  return `<g data-phase-track="${escape(label)}" data-track-start="70" data-track-end="570" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
    <rect x="22" y="3" width="596" height="70" fill="transparent"/><path d="M70 34H570m-500 7H570" stroke="${steel}" stroke-width="3"/>
    <path d="M69 25v23m502-23v23" stroke="${ink}" stroke-width="7"/>
    <g transform="translate(${x} 37)"><rect x="-16" y="-13" width="32" height="27" rx="5" fill="${brass}" stroke="${ink}" stroke-width="2"/>
    ${probe?'<path d="M0 7V-21l4-6" fill="none" stroke="#4e6867" stroke-width="4"/><circle cy="-21" r="6" fill="#83a2a0"/>':'<ellipse cy="-5" rx="13" ry="11" fill="#775338" stroke="#554536" stroke-width="2"/>'}</g></g>${etch(320,96,label)}`;
}
const attrValues=(svg:string,attr:string)=>new Set(Array.from(svg.matchAll(new RegExp(' '+attr+'="([^"]+)"','g')),m=>m[1]));

/** Add the missing working parts to the instrument drawing. Its coordinate
 * system and every existing teaching object remain the author's own. */
export function completeFlatApparatus(svg:string,figure:Figure,phase:number,selection:number,inspection:string){
  const id=figure.id;
  if(!drives[id]&&!needsSelector.has(id)&&!['basin-system','city-rain-system','urban-waterlogging','gis','quake-response-system'].includes(id))return svg;
  const root=svg.match(/<svg\b[^>]*>/)?.[0],box=root?.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if(!root||!box||box.length!==4)return svg;
  const [x,y,width,height]=box;
  const rows:{art:string;height:number}[]=[];
  if(drives[id] && playbackPolicy(figure,selection).enabled && !/data-phase-track=|data-model-crank=|data-orrery-control="crank"/.test(svg))
    rows.push({art:manualDrive(drives[id],phase),height:113});
  if(needsSelector.has(id)&&figure.controls?.length){
    const found=attrValues(svg,'data-model-selection');
    if(figure.controls.some((_,i)=>!found.has(String(i))))
      rows.push({art:selector(figure.controls.map((label,i)=>({value:String(i),label})),String(selection),false),height:76});
  }
  const targets=inspectionTargets(figure.effect,selection);
  if(targets.length>1){
    const found=attrValues(svg,'data-model-inspection');
    const existing=targets.filter(t=>found.has(t.target)).length;
    if(existing<targets.length && !(existing===targets.length-1&&inspection==='overview'&&!found.has('overview'))){
      rows.push({art:selector(targets.map(t=>({value:t.target,label:t.label})),inspection,true),height:76});
    }
  }
  if(!rows.length)return svg;
  const scale=width/640, extra=rows.reduce((n,row)=>n+row.height,0);
  const updated=root.replace(/viewBox="[^"]+"/,`viewBox="${x} ${y} ${width} ${height+extra*scale}"`).replace('role="img"','role="group"');
  let art=svg.slice(svg.indexOf(root)+root.length,svg.lastIndexOf('</svg>'));
  const focus=zones[id]?.[inspection];
  if(focus)art=`<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${focus.join(' ')}" preserveAspectRatio="xMidYMid meet" data-specimen-focus="${escape(inspection)}">${art}</svg>`;
  let pos=0;
  const panel=rows.map(row=>{const line=`<g transform="translate(0 ${pos})">${row.art}</g>`;pos+=row.height;return line;}).join('');
  return `${updated}${art}<g class="flat-instrument-controls" transform="translate(${x} ${y+height}) scale(${scale})">
    <rect x="8" y="2" width="624" height="${extra-5}" rx="8" fill="#d9d3ba" stroke="#8c7854" stroke-width="2"/>${panel}</g></svg>`;
}
