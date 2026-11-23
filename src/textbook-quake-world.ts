import { updateLabelSlip } from './textbook-label-slip';
import { THREE as T } from './reference/engine.js';
import { PALETTE as C, type TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { mountFieldInstrument } from './textbook-field-instruments';
import { applyEarthScan, type EarthScan } from './textbook-earth-scan';
import { QUAKE_LAYOUT, evaluateQuake, type QuakePoint } from './textbook-quake-model';

/** A fitted geological section, station, and comparison recorder. */
export function buildQuakeWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, p = (u: number, v: number, h = 0) => b.p(u, v, h * s);
  const z0 = p(0, .59)[2], z1 = p(0, .93)[2];
  const at = ([x, y, z]: QuakePoint): Vec3 => [x * s, y * s, z1 + (.15 + z) * s];
  const source = at(QUAKE_LAYOUT.source), epicenter = at(QUAKE_LAYOUT.epicenter);
  const parts = mountFieldInstrument(b, 'earthquake', s, [0, 0, z1], (z1 - z0) / 30);
  const lithology: Record<string, [EarthScan, number]> = {
    '#976351': ['loam', 10], '#807b70': ['outcrop', 13],
    '#b08a68': ['alluvium', 8], '#9fa681': ['turf', 14],
  };
  for (const rock of parts.get('rock')!) {
    const surface = lithology[rock.userData.blenderColor];
    if (surface) applyEarthScan(rock.material, surface[0], surface[1] * s);
  }
  const focus = b.sphere(source, .8 * s, C.red), center = b.sphere(epicenter, .7 * s, C.red);
  focus.userData.quakeRole = 'source'; center.userData.quakeRole = 'epicenter';
  focus.userData.modelInput = { kind: 'select', selection: 1, toggleTo: 0, label: '查看震后预警过程' };
  const originLabel = b.label('震源', [source[0] - 14 * s, 3 * s, source[2] + 4 * s], 9.45 * s, 5.4 * s);
  const centerLabel = b.label('震中', [epicenter[0] + 7 * s, 19 * s, epicenter[2] + s], 9.45 * s, 5.4 * s);
  const depthLabel = b.label('震源深度', [.18 * b.width, 10 * s, z1 + 5 * s], 18.5 * s, 5.02 * s);

  const station = at(QUAKE_LAYOUT.station);
  const stationParts = [...parts.get('station')!, ...parts.get('sensor')!];
  stationParts.forEach(mesh => { mesh.userData.quakeRole = 'monitoring-station'; mesh.userData.modelInput = { kind: 'select', selection: 1, label: '查看探测后的预警过程' }; });
  const indicator = parts.get('sensor')![0];
  const awake = b.materialFor('enamel', '#e5af55'), idle = indicator.material;
  const recorder = parts.get('recorder')!;
  const cursors = parts.get('cursor')!;
  const track = { start: [14 * s, 1.6 * s, z1 + 7.9 * s], end: [86 * s, 1.6 * s, z1 + 7.9 * s] };
  for (const mesh of cursors) {
    mesh.userData.modelInput = { kind: 'phase-track', track, label: '拖动记录游标，对照探测、预警与震动到达' };
  }
  const markers = [
    { event: 'stationP', row: 3.24, color: '#4b7185', finish: 'enamel' },
    { event: 'warningArrival', row: 4.8, color: '#d1b27a', finish: 'brass' },
    { event: 'targetS', row: 6.34, color: '#ad5843', finish: 'enamel' },
  ].map(({ event, row, color, finish }) => {
    const marker = b.box([-.67*s, .17*s, z1+(row-.50)*s], [.67*s, .76*s, z1+(row+.50)*s], color, false);
    marker.material = b.materialFor(finish === 'brass' ? 'brass' : 'enamel', color);
    marker.userData.quakeRole = event;
    return { event: event as 'stationP' | 'warningArrival' | 'targetS', marker };
  });
  const stationLabel = b.label('监测站', [station[0], 11 * s, z1 + 4 * s], 14 * s, 5.2 * s);
  const cityLabel = b.label('远处聚落', [80 * s, 12 * s, z1 + 8 * s], 20 * s, 5.2 * s);
  const caption = b.label('等待开始', [53 * s, 35 * s, z1 - 7 * s], 27 * s, 5.2 * s);
  const pLegend = b.label('P波', [17 * s, 29 * s, z1 + s], 10 * s, 5.1 * s);
  const sLegend = b.label('S波', [17 * s, 21 * s, z1 + s], 10 * s, 5.1 * s);
  const houses: { mesh: any; rest: Vec3; near: boolean }[] = [];
  const makeHouse = (x: number, near: boolean) => {
    const z = z1 - 2 * s, y = 15.2 * s, w = 4.2 * s, h = 3.3 * s;
    const firstPart = b.meshes.length;
    b.house([x,y,z],w,h,C.paper);
    const parts = b.meshes.slice(firstPart);
    parts.forEach(mesh => {
      mesh.userData.quakeRole = near ? 'near-settlement' : 'far-settlement';
      mesh.userData.modelInput = { kind: 'select', selection: near ? 1 : 2, label: near ? '对照远处聚落' : '对照近处聚落' };
      houses.push({ mesh, rest: mesh.position.toArray() as Vec3, near });
    });
  };
  makeHouse(.72 * b.width, false); makeHouse(.80 * b.width, false); makeHouse(.40 * b.width, true);
  const alert = b.sphere([0, 0, 0], .65 * s, C.gold, false);
  alert.userData.quakeRole = 'warning-received';
  const signal = b.sphere([0, 0, 0], .65 * s, C.gold, false);
  signal.userData.quakeRole = 'communication-signal';
  const signalPoint = (target: QuakePoint, q: number): Vec3 =>
    [(QUAKE_LAYOUT.station[0] + (target[0] - QUAKE_LAYOUT.station[0]) * q) * s,
      (22 + 7 * Math.sin(q * Math.PI)) * s, z1 + 1.1 * s];
  const wireSlices = 64, wireSides = 8;
  const wires = (['far', 'near'] as const).map(id => {
    const curve = new T.CatmullRomCurve3(Array.from({ length: 33 }, (_, index) => b.v(signalPoint(QUAKE_LAYOUT[id], index / 32))));
    const geometry = new T.TubeGeometry(curve, wireSlices, .18 * s, wireSides, false);
    const wire = b.mesh(geometry, '#c39953', false, true, 'brass');
    wire.userData.quakeRole = 'communication-path';
    return { id, geometry, wire, lengths: curve.getLengths(wireSlices) };
  });
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
      for (const mesh of stationParts) mesh.visible = warning;
      indicator.material = state.detected ? awake : idle;
      for (const mesh of recorder) mesh.visible = warning;
      for (const cursor of cursors) {
        cursor.visible = warning;
        cursor.position.x = 72 * s * state.phase;
      }
      for (const { event, marker } of markers) {
        marker.position.x = (14 + state.events[event] * 72) * s;
        marker.visible = warning && phase >= state.events[event];
      }
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
      updateLabelSlip(cityLabel, state.targetId === 'near' ? '近处聚落' : '远处聚落'); updateLabelSlip(caption, state.caption);
      alert.visible = warning && state.alerted; alert.position.set(target[0], 22 * s, z1 + 1.1 * s);
      signal.visible = warning && state.sent && !state.alerted;
      for (const { id, geometry, wire, lengths } of wires) {
        wire.visible = warning && state.sent && state.targetId === id;
        if (!wire.visible) continue;
        const q = state.commProgress * wireSlices;
        const i = Math.min(wireSlices - 1, Math.floor(q));
        const length = lengths[i] + (lengths[i + 1] - lengths[i]) * (q - i);
        const visibleSlices = Math.floor(wireSlices * length / lengths[wireSlices] + 1e-7);
        geometry.setDrawRange(0, visibleSlices * wireSides * 6);
        signal.position.set(...signalPoint(state.target, state.commProgress));
      }
      if (warning && state.occurred) {
        b.flow.push({ points: [b.v([9 * s, 29 * s, z1 + s]), b.v([6 * s, 29 * s, z1 + s])], width: .85 });
        b.accentStrokes.push({ points: [b.v([9 * s, 21 * s, z1 + s]), b.v([6 * s, 21 * s, z1 + s])], width: 1.15 });
      }
    },
    focusBounds: () => ({ min: [0, -3 * s, z0 - 4 * s], max: [100 * s, 40 * s, z1 + 15 * s] }),
    describe: () => ({ kind: 'earthquake', ...state, waveOrigin: source, epicenterDirectlyAboveFocus: true,
      measuredWaveSpeed: false, warningIsPostEvent: true, timeUnits: 'schematic-phase', originalPagePreserved: true,
      waveGeometry: 'clipped-spherical-sections', communicationIsElectromagneticSchematic: true }),
  };
}
