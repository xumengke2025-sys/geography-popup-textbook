import { recorderWheel } from './textbook-recorder-drawings';
import { drawingGrip } from './textbook-drawing-grip';
import { MARS_ARRIVALS, MARS_CIRCUITS } from './textbook-mars-reading';
const label=(x:number,y:number,text:string)=>`<text x="${x}" y="${y}" font-size="30" fill="#44473b" text-anchor="middle">${text}</text>`;
/** Section handles and circuit selector remain part of the drawing, including
 * when an individual cutaway has been brought to the observation window. */
export function marsBenchDrawing(body:string,phase:number,selection:number,inspection:string){
  const local=['mars-shell-0','mars-shell-1','mars-shell-2','mars-shell-3'].indexOf(inspection);
  const bounds=['65 143 171 176','223 43 195 177','396 144 188 177','230 228 181 158'];
  const active=selection>0,reading=active?phase:0,travel=300,origin=448,x=origin-travel*reading;
  const tags=MARS_ARRIVALS[selection].map(([at,name])=>{const px=origin-travel*at,tx=px+(selection===2?(name==='供食'?-10:name==='供氧'?9:0):0);return `<path d="M${px} 419v5l${tx-px} 4" stroke="#776446" stroke-width="2"/>${label(tx,456,name)}`;}).join('');
  const close=local<0?'':`<g data-model-inspection="overview" data-specimen-key tabindex="0" role="button" aria-label="收回检视，返回整座基地"><rect x="490" y="10" width="123" height="45" rx="6" fill="#e9ddc4" stroke="#8e7754"/>${label(552,45,'返回')}</g>`;
  const illustration=local<0?body:`<svg x="39" y="22" width="562" height="350" viewBox="${bounds[local]}" data-specimen-focus="${inspection}" preserveAspectRatio="xMidYMid meet">${body}</svg>${close}`;
  const crank=active?recorderWheel(540,427,27,reading,'手摇物资示踪器'):`<circle cx="540" cy="427" r="26" fill="#77694b" stroke="#a89160" stroke-width="6"/><path d="M519 414l39 25m-39 0 39-25" stroke="#ba9e67" stroke-width="4"/>`;
  const slide=active?drawingGrip('拖动到舱次序游标',[origin,409],[origin-travel,409],reading):'';
  return `${illustration}<g data-mars-drive="${active?'engaged':'parked'}">
  <path d="M18 398l16-10h568l23 10v84H18Z" fill="#525d4c" stroke="#796346" stroke-width="2"/>
  <path d="M22 474h599v48H22Z" fill="#755740" stroke="#594433" stroke-width="2"/>
  <path d="M24 474h593" stroke="#b69a63" stroke-width="4"/>
  <rect x="120" y="416" width="360" height="45" rx="4" fill="#e6d8b8" stroke="#b19561" stroke-width="4"/>${active?tags:label(300,456,'选择回路')}
  <path d="M87 407h451m-451 40h451" stroke="#aaa580" stroke-width="2.5"/>
  <g transform="translate(83 427) rotate(${-360*reading})"><circle r="22" fill="#8b7853" stroke="#a99767" stroke-width="4"/><circle r="13" fill="#536152"/><path d="M-15-9l30 18m-30 0 30-18" stroke="#b29965" stroke-width="3"/><circle r="4" fill="#a88d58"/></g>
  ${crank}<rect x="${x-8}" y="402" width="16" height="13" rx="3" fill="#b8965e" stroke="#765f42"/><path d="M${x} 416v17l-3-4" stroke="#6e6e5f" fill="none" stroke-width="2"/>${slide}
  ${MARS_CIRCUITS.map((v,i)=>`<g data-mars-key="${i}" data-model-selection="${i}" data-keep-phase data-specimen-key tabindex="0" role="button" aria-label="${v}" transform="translate(${88+i*151} 500)"><rect x="-66" y="-21" width="132" height="40" rx="4" fill="#b19465" stroke="#705a40"/><rect x="-63" y="-18" width="126" height="34" rx="3" fill="${selection===i?'#e2d2a8':'#f1e5ca'}"/>${label(0,11,v)}</g>`).join('')}</g>`;
}
