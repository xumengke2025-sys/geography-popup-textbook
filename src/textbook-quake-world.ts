import { THREE as T } from './reference/engine.js';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { QUAKE_LAYOUT, evaluateQuake, type QuakePoint } from './textbook-quake-model';

/** An open paper cutaway; the original book page remains underneath it. */
export function buildQuakeWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, p = (u: number, v: number, h = 0) => b.p(u, v, h * s);
  const z0 = p(0, .59)[2], z1 = p(0, .93)[2];
  const at = ([x, y, z]: QuakePoint): Vec3 => [x * s, y * s, z1 + (.15 + z) * s];
  const source = at(QUAKE_LAYOUT.source), epicenter = at(QUAKE_LAYOUT.epicenter);
  for (const [i, color] of ['#aa715c', '#9b8580', '#baa08a'].entries())
    b.box([b.width * .07, i * 5 * s, z0], [b.width * .92, (i + 1) * 5 * s, z1], color);
  b.terrain(.07 * b.width, .92 * b.width, z0, z1, (x, z) => s * (QUAKE_LAYOUT.surface + 3 * Math.exp(-((x / b.width - .28) ** 2 / .016 + ((z - z0) / (z1 - z0) - .2) ** 2 / .15))), C.green, 32, 14, 14.9 * s);
  const focus = b.sphere(source, .8 * s, C.red), center = b.sphere(epicenter, .7 * s, C.red);
  focus.userData.quakeRole = 'source'; center.userData.quakeRole = 'epicenter';
  focus.userData.modelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '查看震后预警过程' };
  const originLabel = b.label('震源', [source[0] - 14 * s, 3 * s, source[2] + 4 * s], 8 * s, 4.6 * s);
  const centerLabel = b.label('震中', [epicenter[0] + 7 * s, 19 * s, epicenter[2] + s], 8 * s, 4.6 * s);
  const depthLabel = b.label('震源深度', [.18 * b.width, 10 * s, z1 + 5 * s], 17 * s, 4.6 * s);

  const station = at(QUAKE_LAYOUT.station);
  const stationParts = [
    b.box([station[0] - 1.6 * s, 15.2 * s, station[2]], [station[0] + 1.6 * s, 20 * s, station[2] + 2.3 * s], C.paper, false),
    b.cylinder([station[0], 7 * s, station[2] + .2 * s], [station[0], 15.4 * s, station[2] + .2 * s], .25 * s, C.rock),
    b.box([station[0] - .8 * s, 16.9 * s, station[2] + 2.4 * s], [station[0] + .8 * s, 18.1 * s, station[2] + 2.5 * s], C.cool, false),
  ];
  stationParts.forEach(mesh => { mesh.userData.quakeRole = 'monitoring-station'; mesh.userData.modelInput = { kind: 'select', selection: 1, label: '查看探测后的预警过程' }; });
  const stationLabel = b.label('监测站', [station[0], 4 * s, z1 + 4 * s], 14 * s, 5.2 * s);
  const cityLabel = b.label('远处聚落', [80 * s, 12 * s, z1 + 8 * s], 20 * s, 5.2 * s);
  const caption = b.label('等待开始', [53 * s, 35 * s, z1 - 7 * s], 27 * s, 5.2 * s);
  const pLegend = b.label('P波', [17 * s, 29 * s, z1 + s], 10 * s, 5.1 * s);
  const sLegend = b.label('S波', [17 * s, 21 * s, z1 + s], 10 * s, 5.1 * s);
  const updateText = (mesh: any, text: string) => {
    if (mesh.userData.text === text) return;
    const canvas = mesh.material.map.image as HTMLCanvasElement, ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#faf7ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let size = Math.floor(canvas.height * .69); ctx.font = `${size}px FieldSerif,SimSun,serif`;
    size = Math.min(size, Math.floor(size * canvas.width * .9 / Math.max(1, ctx.measureText(text).width)));
    ctx.font = `${size}px FieldSerif,SimSun,serif`; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height * .53);
    mesh.material.map.needsUpdate = true; mesh.userData.text = text; mesh.userData.fontRatio = size / canvas.height;
  };
  const houses: { mesh: any; rest: Vec3; near: boolean }[] = [];
  const makeHouse = (x: number, near: boolean) => {
    const z = z1 - 2 * s, y = 15.2 * s, w = 4.2 * s, h = 3.3 * s;
    const parts = [b.box([x - w / 2, y, z - w * .4], [x + w / 2, y + h, z + w * .4], C.paper, false)];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([
      x - w * .58, y + h, z - w * .46, x + w * .58, y + h, z - w * .46, x, y + h + w * .37, z - w * .46,
      x - w * .58, y + h, z + w * .46, x + w * .58, y + h, z + w * .46, x, y + h + w * .37, z + w * .46,
    ], 3));
    g.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]); g.computeVertexNormals();
    parts.push(b.mesh(g, C.land, false));
    parts.push(b.box([x - .5 * s, y, z + w * .41], [x + .5 * s, y + h * .65, z + w * .44], C.cool, false));
    parts.forEach(mesh => {
      mesh.userData.quakeRole = near ? 'near-settlement' : 'far-settlement';
      mesh.userData.modelInput = { kind: 'select', selection: near ? 1 : 2, label: near ? '对照远处聚落' : '对照近处聚落' };
      houses.push({ mesh, rest: mesh.position.toArray() as Vec3, near });
    });
  };
  makeHouse(.72 * b.width, false); makeHouse(.80 * b.width, false); makeHouse(.40 * b.width, true);
  const alert = b.sphere([80 * s, 22 * s, z1 + 1.1 * s], .65 * s, C.gold, false);
  alert.userData.quakeRole = 'warning-received';
  const signal = b.sphere([0, 0, 0], .65 * s, C.gold, false);
  signal.userData.quakeRole = 'communication-signal';
  const clipCircle = (center: Vec3, radius: number, plane: 'xy' | 'xz', type: 'P' | 'S') => {
    let segment: Vec3[] = [];
    const flush = () => { if (segment.length > 1) (type === 'P' ? b.flow : b.accentStrokes).push({ points: segment.map(q => b.v(q)), width: type === 'P' ? .75 : 1.15 }); segment = []; };
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * Math.PI * 2;
      const q: Vec3 = [center[0] + Math.cos(a) * radius, center[1] + (plane === 'xy' ? Math.sin(a) * radius : 0), center[2] + (plane === 'xz' ? Math.sin(a) * radius : 0)];
      const inside = q[0] >= 7 * s && q[0] <= 92 * s && (plane === 'xy' ? q[1] >= 0 && q[1] <= 15.3 * s : q[2] >= z0 && q[2] <= z1 + .2 * s);
      if (!inside || (type === 'P' && i % 9 > 5)) flush(); else segment.push(q);
    }
    flush();
  };
  let state = evaluateQuake(0);
  return {
    update(phase, selection) {
      state = evaluateQuake(phase, selection); const warning = state.view !== 'structure';
      centerLabel.visible = depthLabel.visible = !warning;
      originLabel.visible = !warning || !state.detected;
      [stationLabel, cityLabel, caption].forEach(m => { m.visible = warning; });
      pLegend.visible = sLegend.visible = warning && state.occurred;
      stationParts.forEach(m => { m.visible = warning; if (warning) b.outline(m, .45); });
      stationParts[2].material = b.material(state.detected ? C.gold : C.cool);
      if (!warning) b.contour([source, epicenter], .55);
      houses.forEach(({ mesh, rest, near }) => {
        mesh.visible = warning ? near === (state.targetId === 'near') : !near;
        mesh.position.set(rest[0] + (warning ? state.shake * s : 0), rest[1], rest[2]);
        if (mesh.visible) b.outline(mesh, .43);
      });
      if (state.occurred) {
        for (const [type, radius] of [['P', state.pRadius], ['S', state.sRadius]] as const) {
          clipCircle(source, radius * s, 'xy', type);
          const depth = epicenter[1] - source[1];
          if (radius * s > depth) clipCircle([epicenter[0], epicenter[1] + .12 * s, epicenter[2]], Math.sqrt((radius * s) ** 2 - depth ** 2), 'xz', type);
        }
      }
      const target = at(state.target);
      cityLabel.position.set(target[0], 14 * s, z1 + 8 * s);
      cityLabel.userData.modelInput = { kind: 'select', selection: state.targetId === 'near' ? 1 : 2, label: state.targetId === 'near' ? '对照远处聚落' : '对照近处聚落' };
      updateText(cityLabel, state.targetId === 'near' ? '近处聚落' : '远处聚落'); updateText(caption, state.caption);
      alert.visible = warning && state.alerted; alert.position.set(target[0], 22 * s, z1 + 1.1 * s);
      const signalPoint = (q: number): Vec3 => [station[0] + (target[0] - station[0]) * q, (22 + 7 * Math.sin(q * Math.PI)) * s, z1 + 1.1 * s];
      signal.visible = warning && state.sent && !state.alerted;
      if (warning && state.sent) {
        const path = Array.from({ length: 33 }, (_, i) => signalPoint(state.commProgress * i / 32));
        b.accentStrokes.push({ points: path.map(q => b.v(q)), width: .8 });
        signal.position.set(...signalPoint(state.commProgress));
      }
      if (warning && state.occurred) {
        b.flow.push({ points: [b.v([9 * s, 29 * s, z1 + s]), b.v([6 * s, 29 * s, z1 + s])], width: .85 });
        b.accentStrokes.push({ points: [b.v([9 * s, 21 * s, z1 + s]), b.v([6 * s, 21 * s, z1 + s])], width: 1.15 });
      }
    },
    focusBounds: () => ({ min: [0, -2 * s, z0 - 4 * s], max: [100 * s, 40 * s, z1 + 15 * s] }),
    describe: () => ({ kind: 'earthquake', ...state, waveOrigin: source, epicenterDirectlyAboveFocus: true,
      measuredWaveSpeed: false, warningIsPostEvent: true, timeUnits: 'schematic-phase', originalPagePreserved: true,
      waveGeometry: 'clipped-spherical-sections', communicationIsElectromagneticSchematic: true }),
  };
}
