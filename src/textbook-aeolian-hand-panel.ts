export function aeolianHandPanel(phase: number, selection: number) {
  const keys = ['蘑菇','雅丹','沙丘','固沙'].map((title, i) => {
    const pressed = selection === i;
    const x = 204 + 113 * i;
    return `<g transform="translate(${x} 454)" data-model-selection="${i}" data-keep-phase="" data-specimen-key="" role="button" tabindex="0" aria-pressed="${pressed}" aria-label="换入${title}标本">
      <rect x="-54" y="-46" width="108" height="92" rx="7" fill="transparent"/>
      <rect x="-48" y="-31" width="96" height="62" rx="8" fill="#735d42" stroke="#352e25" stroke-width="3"/>
      <rect x="-45" y="${pressed?-22:-29}" width="90" height="52" rx="7" fill="${pressed?'#d6c5a3':'#f1e4c5'}" stroke="#a08052" stroke-width="2"/>
      <text x="0" y="${pressed?13:7}" text-anchor="middle" fill="#393729" font-size="31">${title}</text></g>`;
  });
  return `<g class="aeolian-hand-panel" stroke-linecap="round" stroke-linejoin="round">
    <rect x="24" y="392" width="590" height="129" rx="11" fill="#765238" stroke="#523f2d" stroke-width="4"/>
    <path d="M33 398h572M33 516h572" stroke="#ad8759" fill="none"/>
    ${keys.join('')}
    <g transform="translate(86 455)" data-model-crank="3" data-radius="43" role="slider" tabindex="0" aria-label="转动风机木柄" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(phase*100)}">
      <circle r="56" fill="transparent"/><g transform="rotate(${-1080*phase})">
      <circle r="43" fill="none" stroke="#cfad70" stroke-width="8"/>
      ${Array.from({length:5},(_,i)=>`<path transform="rotate(${i*72})" d="M0 0Q-4 18 0 41" fill="none" stroke="#c29d64" stroke-width="6"/>`).join('')}
      <circle r="8" fill="#a3824e" stroke="#5d4833" stroke-width="2"/><circle cy="43" r="10" fill="#503725" stroke="#d0ac71" stroke-width="3"/></g>
    </g></g>`;
}
