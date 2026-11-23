import { FIELD_VISUAL_THEME } from './textbook-visual-theme';

/** An ivory inscription seated in a chamfered brass holder. The transparent
 * margin keeps the original camera alignment and interaction plane intact. */
export function drawLabelSlip(canvas: HTMLCanvasElement, text: string, ink: string = FIELD_VISUAL_THEME.labels.ink) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const font = (px: number) => `500 ${px}px FieldSans, 'Microsoft YaHei', sans-serif`;
  let size = Math.floor(height * .66);
  ctx.font = font(size);
  const padding = Math.min(height * .28, width * .075);
  const available = width - 2 * padding;
  const measured = ctx.measureText(text).width;
  if (measured > available) size = Math.max(1, Math.floor(size * available / measured));
  ctx.font = font(size);
  const span = Math.min(width, Math.ceil(ctx.measureText(text).width + 2 * padding));
  const x = (width - span) / 2;
  const top = height * .035;
  const bottom = height - top;
  const chamfer = Math.min(span * .04, height * .13);
  const plate = (inset: number) => {
    const l = x + inset, r = x + span - inset;
    const t = top + inset, b = bottom - inset;
    const cut = Math.max(0, chamfer - inset * .55);
    ctx.beginPath();
    ctx.moveTo(l + cut, t); ctx.lineTo(r - cut, t); ctx.lineTo(r, t + cut);
    ctx.lineTo(r, b - cut); ctx.lineTo(r - cut, b); ctx.lineTo(l + cut, b);
    ctx.lineTo(l, b - cut); ctx.lineTo(l, t + cut); ctx.closePath(); ctx.fill();
  };
  const brass = ctx.createLinearGradient(x, top, x + span * .17, bottom);
  brass.addColorStop(0, '#7b5a2f');
  brass.addColorStop(.19, '#d7bf82');
  brass.addColorStop(.47, '#a58a50');
  brass.addColorStop(.74, '#c2a568');
  brass.addColorStop(1, '#675337');
  ctx.fillStyle = brass;
  plate(0);
  ctx.fillStyle = '#857248';
  plate(height * .047);
  ctx.fillStyle = FIELD_VISUAL_THEME.labels.paper;
  plate(height * .066);
  for (const center of [x + padding * .52, x + span - padding * .52]) {
    const radius = Math.min(height * .039, padding * .20);
    ctx.fillStyle = '#816a42';
    ctx.beginPath(); ctx.arc(center, height * .5, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dac38c';
    ctx.beginPath(); ctx.arc(center - radius * .2, height * .5 - radius * .28, radius * .58, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height * .52);
  return size / height;
}

export function updateLabelSlip(mesh: any, text: string) {
  if (mesh.userData.text === text) return;
  const texture = mesh.material.map;
  mesh.userData.fontRatio = drawLabelSlip(texture.image, text);
  mesh.userData.text = text;
  texture.needsUpdate = true;
}
