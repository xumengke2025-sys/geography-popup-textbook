import { drawingGrip } from './textbook-drawing-grip';

/** Front elevation of the same cord carriage as the 3-D navigation and optics benches. */
export function surveyRailDrawing(start:readonly number[],end:readonly number[],phase:number,travel:number,label:string,marker:string,drumRadius=2.58){
  const dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
  const grip=len*phase,turns=travel/(Math.PI*2*drumRadius);
  const divisions=Array.from({length:41},(_,i)=>`M${len*i/40} 13v${i%5?3:7}`).join('');
  return `<g transform="translate(${start.join(' ')}) rotate(${angle})">
    <rect x="-20" y="-10" width="${len+66}" height="37" rx="5" fill="#4f3d2c" stroke="#332a23" stroke-width="2"/>
    <rect x="-12" y="-5" width="${len+29}" height="10" rx="3" fill="#53605b" stroke="#b6a16b"/>
    <rect x="-1" y="12" width="${len+2}" height="10" fill="#dfcca1"/><path d="${divisions}" fill="none" stroke="#5c4a35"/>
    <g ${marker} transform="translate(${grip})"><rect x="-10" y="-7" width="20" height="11" rx="2" fill="#a78d56" stroke="#614e34"/>
    <ellipse cy="-5" rx="7" ry="4" fill="#c9af77"/><ellipse cy="-8" rx="8" ry="7" fill="#72503a" stroke="#453324"/></g>
    <g transform="translate(${len+50} -1)" data-model-crank="${turns}" data-radius="21" tabindex="0" role="slider" aria-label="转动绞盘，推进或倒回" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
      <circle r="34" fill="transparent"/><circle r="22" fill="#35463d" stroke="#927440" stroke-width="5"/>
      <g transform="rotate(${-360*phase*turns})"><path d="M0 -20V20" stroke="#c1a568" stroke-width="4"/>
      <circle cy="20" r="5.5" fill="#714b31" stroke="#483724"/></g><circle r="5" fill="#bb9c63"/></g></g>`
    +drawingGrip(label,start,end,phase);
}

