import { evaluateFloodSequence } from './textbook-ground-process-model';

export function recorderWheel(x:number,y:number,r:number,phase:number,label:string) {
  const spokes=[0,1,2].map(i=>`<path d="M0 0V${-r}" transform="rotate(${120*i})" stroke="#9c7d49" stroke-width="5"/>`).join('');
  return `<g transform="translate(${x} ${y})" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100*phase)}" data-model-crank="1" data-radius="${r}">
    <circle r="${r+12}" fill="transparent"/><g transform="rotate(${-360*phase})"><circle r="${r}" fill="none" stroke="#675437" stroke-width="8"/>
    <circle r="${r}" fill="none" stroke="#d1b07b" stroke-width="4"/>${spokes}
    <circle r="7" fill="#71634d"/><circle cy="${r}" r="8.5" fill="#503c31" stroke="#c6a774" stroke-width="2"/></g></g>`;
}

/** The chart, keys and wheel are seated below the specimen section. Their
 * positions carry the same meaning as the 3D scribe and observation spindle. */
export function hydrologyDrawing(phase:number,condition:number,flood:boolean) {
  const keys=(flood?['常水','强降水']:['足水','少雨']).map((name,i)=>{
    const x=(flood?399:58)+i*102,pressed=i===condition;
    return `<g transform="translate(${x} 444)" data-model-selection="${i}" data-specimen-key="" data-keep-phase="" tabindex="0" role="button" aria-label="装入${name}记录" aria-pressed="${pressed}">
      <rect x="-3" y="-40" width="103" height="82" fill="transparent"/><rect x="0" y="-25" width="96" height="58" rx="5" fill="#584634"/>
      <rect x="0" y="${pressed?-25:-30}" width="96" height="54" rx="5" fill="${pressed?'#d5ceb0':'#f5ead1'}" stroke="#a18252" stroke-width="3"/>
      <text x="48" y="${pressed?11:6}" text-anchor="middle" fill="#3f4339" style="font-size:30px">${name}</text></g>`;
  }).join('');
  const bed='<rect x="25" y="388" width="590" height="116" rx="8" fill="#624432" stroke="#433c30" stroke-width="3"/><path d="M35 393h570m-570 105h570" stroke="#a88b5f"/>';
  if(!flood)return bed+keys+'<text x="380" y="454" text-anchor="middle" fill="#f6e8c4">记录轮</text>'+recorderWheel(530,445,41,phase,'转动旱情记录轮');
  const y=(at:number)=>460-(evaluateFloodSequence(at,condition).waterLevel-2.9)*8.4;
  const x=58+phase*291;
  const trace=Array.from({length:41},(_,i)=>[58+291*i/40,y(i/40)].map(n=>n.toFixed(2)).join(',')).join('L');
  return bed+keys+`<g data-phase-track="water-chart" data-track-start="58" data-track-end="349" tabindex="0" role="slider" aria-label="推拉水位记录游标" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
    <rect x="34" y="390" width="345" height="111" fill="transparent"/><rect x="46" y="402" width="315" height="84" rx="2" fill="#efe4c7" stroke="#aa854e" stroke-width="3"/>
    <path d="M54 463h296m-296 -20h296m-296 -20h296" stroke="#c1b89b" stroke-width="1.5"/><path d="M${trace}" fill="none" stroke="#41737a" stroke-width="4"/>
    <path d="M${x} 411v72" stroke="#9c7946" stroke-width="3"/><circle cx="${x}" cy="${y(phase)}" r="5" fill="#a14f39"/><rect x="${x-7}" y="477" width="14" height="12" rx="2" fill="#977c52"/></g>`;
}
