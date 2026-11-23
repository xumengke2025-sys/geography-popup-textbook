import { recorderWheel } from './textbook-recorder-drawings';
/** Front elevation of the same cord, reel and model balloon as the solid. */
export function soundingBalloon(x:number,y:number,phase:number){
  const cy=y-35;
  return `<g data-model-sounding-height="${phase}"><path d="M${x} 29V${cy-21}M${x} 29H82V449H570" stroke="#8b826d" stroke-width="1.65" fill="none"/>
    <g transform="translate(${x} ${cy})"><path d="M0-21C-21-21-28 1-12 17l8 8h8l8-8C28 1 21-21 0-21Z" fill="#a69267" stroke="#7b7057" stroke-width="1.5"/>
    <path d="M0-21C-15-17-17 0-6 20l5 5h2l5-5C17 0 15-17 0-21Z" fill="#547581"/><path d="M0-21q-7 20 0 46m-14-9 8 17m20-17-8 17" fill="none" stroke="#ab966c" stroke-width="1"/>
    <path d="M-6 31H6l-1 7H-5Z" fill="#86694b" stroke="#725f45"/></g></g>`;
}
export function soundingFrame(phase:number){
  return `<defs><linearGradient id="sounding-copper"><stop stop-color="#745c40"/><stop offset=".22" stop-color="#ad9565"/><stop offset=".5" stop-color="#dbc394"/><stop offset=".76" stop-color="#9e8255"/><stop offset="1" stop-color="#746044"/></linearGradient></defs>
  <path d="M60 471l10-11h533l12 11v11H60Z" fill="#485a4c" stroke="#796747"/><path d="M62 481h550v12H62Z" fill="#74563d" stroke="#654d3c"/>
  <path d="M75 454V37q0-11 12-11h382q13 0 13 11v423M88 456V44h379v413" fill="none" stroke="url(#sounding-copper)" stroke-width="5"/>
  ${[82,186].map(x=>`<circle cx="${x}" cy="28" r="7" fill="url(#sounding-copper)" stroke="#7f6c4c"/><circle cx="${x}" cy="28" r="2" fill="#5f6254"/>`).join('')}
  <path d="M570 461v-28h15v28" fill="#7e6c4b" stroke="#716449"/>${recorderWheel(578,437,25,phase,'手摇探空绞盘')}`;
}
