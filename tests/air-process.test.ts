import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { AIR_PROCESS_REFERENCE, AIR_PROCESS_STOPS, airArrowMeshData, airGroundHeight,
  airProcessDiagnostics, airProcessSvg, evaluateAirProcess, type AirProcessEffect } from '../src/textbook-air-process-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildAirProcessWorld } from '../src/textbook-air-process-world';

import { loadFieldInstrument } from '../src/textbook-field-instruments';
await Promise.all(['thermal','heating'].map(loadFieldInstrument));

function fixture(effect: AirProcessEffect) {
  const meshes: Three.Mesh[] = [], contours: Vec3[][] = [], root = new Three.Group();
  const b = {
    width: 150, height: 72, root,
    pop: { paper: ({ color }: { color: string }) => new Three.MeshBasicMaterial({ color }) },
    mesh(geometry: Three.BufferGeometry, color: string) {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    box(a: Vec3, c: Vec3, color: string) {
      const g = new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      g.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2); return this.mesh(g, color);
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height), '#f7f1e3'); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    contour(points: Vec3[]) { contours.push(points); }, outline() {},
  };
  const motion = buildAirProcessWorld(b as unknown as TextbookGeometry, effect);
  return { b, meshes, contours, motion };
}

function closedVolume(positions: number[], indices: number[]) {
  const edges = new Map<string, { count: number; balance: number }>();
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3), [a, b, c] = face.map(k => new Three.Vector3().fromArray(positions, k * 3));
    expect(new Three.Vector3().subVectors(b, a).cross(new Three.Vector3().subVectors(c, a)).length()).toBeGreaterThan(1e-9);
    volume += a.dot(new Three.Vector3().crossVectors(b, c)) / 6;
    for (let j = 0; j < 3; j++) {
      const u = face[j], v = face[(j + 1) % 3], key = `${Math.min(u, v)}:${Math.max(u, v)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 }; edge.count++; edge.balance += u < v ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(Math.abs(volume)).toBeGreaterThan(1e-7);
}

describe('textbook p.34: shortwave, a warming ground and terrestrial longwave', () => {
  it('reaches the ground before ground warming, and warms it before emitting the displayed longwave', () => {
    const incoming = evaluateAirProcess('heat', .14);
    expect(incoming.visibility.shortwave).toBeGreaterThan(0); expect(incoming.visibility.shortwave).toBeLessThan(1);
    expect(incoming.visibility.groundWarmth).toBe(0); expect(incoming.visibility.longwave).toBe(0);
    const reached = evaluateAirProcess('heat', .28);
    expect(reached.visibility).toEqual({ shortwave: 1, groundWarmth: 0, longwave: 0, airWarmth: 0 });
    reached.keyPositions.solarTip.forEach((coordinate, i) => expect(coordinate).toBeCloseTo(reached.keyPositions.groundFocus[i], 12));
    expect(reached.keyPositions.groundFocus[1]).toBeCloseTo(airGroundHeight(reached.keyPositions.groundFocus[0]) + .12, 12);
    const warm = evaluateAirProcess('heat', .52);
    expect(warm.visibility.groundWarmth).toBe(1); expect(warm.visibility.longwave).toBe(0);
    const outgoing = evaluateAirProcess('heat', .7);
    expect(outgoing.visibility.longwave).toBeGreaterThan(0); expect(outgoing.visibility.airWarmth).toBeGreaterThan(0);
    expect(outgoing.arrows[1].path[0][1]).toBeCloseTo(airGroundHeight(outgoing.arrows[1].path[0][0]) + .12, 12);
    expect(outgoing.keyPositions.longwaveTip[1]).toBeGreaterThan(outgoing.keyPositions.longwaveSource[1]);
    expect(evaluateAirProcess('heat', 1).visibility).toEqual({ shortwave: 1, groundWarmth: 1, longwave: 1, airWarmth: 1 });
  });

  it('has only incoming solar shortwave and outgoing terrestrial longwave in this figure', () => {
    const state = evaluateAirProcess('heat', 1);
    expect(state.arrows.map(a => a.id)).toEqual(['solar-shortwave', 'terrestrial-longwave']);
    expect(state.arrows[0].path[0][1]).toBeGreaterThan(state.arrows[0].tip[1]);
    expect(state.arrows[1].path[0][1]).toBeLessThan(state.arrows[1].tip[1]);
    expect(state.arrows[0].path).toHaveLength(2); expect(state.arrows[1].path.length).toBeGreaterThan(40);
    expect(AIR_PROCESS_REFERENCE.heat).toMatchObject({ textbookPage: 34, figure: '2.9', backRadiationIncluded: false,
      quantifiedEnergyBudget: false, wavelengthsToScale: false });
  });
});

describe('textbook p.36: a single cold-warm-cold section', () => {
  it('starts with uniform heating and only then reveals vertical motion, same-height pressure and horizontal flow', () => {
    const uniform = evaluateAirProcess('circulation', 0);
    expect(uniform.stage).toBe('uniform');
    expect(Object.values(uniform.visibility)).toEqual([0, 0, 0, 0]);
    expect(uniform.columns.every(c => c.relativeWarmth === 0 && c.nearPressure === 'equal' && c.upperPressure === 'equal')).toBe(true);
    expect(new Set(uniform.isobars.lower.map(p => p[1])).size).toBe(1);
    expect(new Set(uniform.isobars.upper.map(p => p[1])).size).toBe(1);
    const different = evaluateAirProcess('circulation', .24);
    expect(different.columns.map(c => [c.id, c.relativeWarmth])).toEqual([['B', -1], ['A', 1], ['C', -1]]);
    expect(different.visibility).toEqual({ thermalContrast: 1, vertical: 0, pressure: 0, horizontal: 0 });
    expect(evaluateAirProcess('circulation', .5).visibility).toEqual({ thermalContrast: 1, vertical: 1, pressure: 0, horizontal: 0 });
    expect(evaluateAirProcess('circulation', .74).visibility).toEqual({ thermalContrast: 1, vertical: 1, pressure: 1, horizontal: 0 });
    expect(evaluateAirProcess('circulation', 1).visibility).toEqual({ thermalContrast: 1, vertical: 1, pressure: 1, horizontal: 1 });
  });

  it('compares pressures at two fixed heights and bends equal-pressure surfaces consistently', () => {
    const state = evaluateAirProcess('circulation', .74);
    expect(state.comparisonHeights).toEqual([12, 51]);
    expect(state.columns.map(c => c.nearPressure)).toEqual(['high', 'low', 'high']);
    expect(state.columns.map(c => c.upperPressure)).toEqual(['low', 'high', 'low']);
    expect(state.isobars.lower[24][1]).toBeLessThan(state.isobars.lower[0][1]);
    expect(state.isobars.upper[24][1]).toBeGreaterThan(state.isobars.upper[0][1]);
    expect(AIR_PROCESS_REFERENCE.circulation.pressureComparison).toBe('same-height-only');
    expect(AIR_PROCESS_REFERENCE.circulation.revealOrderIsTeachingOrder).toBe(true);
  });

  it('joins warm ascent and cold descent to two closed cells with opposite upper and lower flows', () => {
    const state = evaluateAirProcess('circulation', 1), arrows = Object.fromEntries(state.arrows.map(a => [a.id, a]));
    expect(arrows['warm-ascent'].tip[1]).toBeGreaterThan(arrows['warm-ascent'].path[0][1]);
    for (const id of ['left-descent', 'right-descent']) expect(arrows[id].tip[1]).toBeLessThan(arrows[id].path[0][1]);
    for (const id of ['upper-left', 'lower-right']) expect(arrows[id].tip[0]).toBeLessThan(arrows[id].path[0][0]);
    for (const id of ['upper-right', 'lower-left']) expect(arrows[id].tip[0]).toBeGreaterThan(arrows[id].path[0][0]);
    for (const loop of state.loops) expect(loop[0]).toEqual(loop[loop.length - 1]);
    expect(state.loops[0].slice(0, 2)).toEqual(state.loops[1].slice(0, 2));
    for (const arrow of state.arrows) {
      expect(state.loops.some(loop => loop.slice(1).some((to, i) => {
        const from = loop[i], a = new Three.Vector3(...from), end = new Three.Vector3(...to), line = new Three.Line3(a, end);
        return line.closestPointToPoint(new Three.Vector3(...arrow.path[0]), true, new Three.Vector3()).distanceTo(new Three.Vector3(...arrow.path[0])) < 1e-8
          && line.closestPointToPoint(new Three.Vector3(...arrow.tip), true, new Three.Vector3()).distanceTo(new Three.Vector3(...arrow.tip)) < 1e-8;
      }))).toBe(true);
    }
  });
});

describe('shared deterministic progress and actual paper geometry', () => {
  it('places each named stop in its own production stage', () => {
    for (const effect of ['heat', 'circulation'] as const) AIR_PROCESS_STOPS[effect].forEach((stop, index) => {
      expect(evaluateAirProcess(effect, stop.phase).stageIndex).toBe(index);
    });
  });

  it('holds the endpoint and produces the same state after forward, backward and jumped seeking', () => {
    for (const effect of ['heat', 'circulation'] as const) {
      const baseline = evaluateAirProcess(effect, .63);
      for (const phase of [0, .9, .24, 1, .5]) evaluateAirProcess(effect, phase);
      expect(evaluateAirProcess(effect, .63)).toEqual(baseline);
      expect(evaluateAirProcess(effect, 2)).toEqual(evaluateAirProcess(effect, 1));
      for (const input of [-1, NaN, Infinity, -Infinity]) expect(evaluateAirProcess(effect, input)).toEqual(evaluateAirProcess(effect, 0));
      let previous = Object.values(evaluateAirProcess(effect, 0).visibility);
      for (let i = 1; i <= 100; i++) {
        const values = Object.values(evaluateAirProcess(effect, i / 100).visibility);
        values.forEach((value, k) => { expect(value).toBeGreaterThanOrEqual(previous[k]); expect(value).toBeLessThanOrEqual(1); }); previous = values;
      }
    }
  });

  it('makes closed arrow shafts and heads with real thickness and stable topology', () => {
    for (const effect of ['heat', 'circulation'] as const) for (const phase of [.18, .37, .69, .87, 1]) {
      for (const arrow of evaluateAirProcess(effect, phase).arrows) {
        const mesh = airArrowMeshData(arrow);
        expect(mesh.positions.every(Number.isFinite)).toBe(true);
        expect(mesh.tip).toEqual(arrow.tip);
        expect(mesh.positions.length).toBe(318);
        if (arrow.reveal > .02) {
          closedVolume(mesh.positions, mesh.indices);
          const zs = mesh.positions.filter((_, i) => i % 3 === 2);
          expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('renders native SVG with the exact production diagnostics and arrow tips', () => {
    for (const effect of ['heat', 'circulation'] as const) for (const phase of [0, .28, .52, .74, 1]) {
      const state = evaluateAirProcess(effect, phase), svg = airProcessSvg(effect, phase);
      expect(svg).not.toMatch(/<image|<animate|NaN|Infinity/);
      expect(JSON.parse(svg.match(/data-air-state='([^']+)'/)![1])).toEqual(JSON.parse(JSON.stringify(airProcessDiagnostics(state))));
      expect(svg.match(/data-air-arrow=/g) ?? []).toHaveLength(state.arrows.filter(a => a.reveal > .001).length);
      for (const a of state.arrows.filter(a => a.reveal > .001)) expect(svg).toContain(`data-tip='${JSON.stringify(a.tip)}'`);
      expect(svg).toContain(effect === 'heat' ? '不表示能量比例' : '分步显示是讲解顺序');
    }
  });

  it('uses a physical phase rail and object targets that point to the same named stops', () => {
    for (const effect of ['heat', 'circulation'] as const) {
      const { meshes, motion } = fixture(effect); motion.update(.62, 0, 0, false);
      const handle = meshes.find(m => m.userData.airProcessRole === 'phase-handle')!;
      expect(handle.userData.modelInput.kind).toBe('phase-track');
      expect(handle.geometry.attributes.position.count).toBeGreaterThan(100);
      const inputs = meshes.filter(m => m.userData.modelInput?.kind === 'select').map(m => m.userData.modelInput.selection);
      expect(new Set(inputs).size).toBe(AIR_PROCESS_STOPS[effect].length);
      expect(meshes.some(m => m.userData.airProcessRole === 'ground-volume' || m.userData.airProcessRole === 'ground-base')).toBe(true);
      for (const mesh of meshes.filter(m => m.userData.airArrowId)) expect(mesh.userData.airTipVertex).toBe(101);
    }
  });

  it('moves actual arrow vertices and the handle from the same state while retaining all buffers and focus bounds', () => {
    for (const effect of ['heat', 'circulation'] as const) {
      const { b, meshes, contours, motion } = fixture(effect), attributes = meshes.map(m => m.geometry.attributes.position);
      const count = meshes.length, focus = motion.focusBounds!();
      b.root.position.set(8, 31, -12); b.root.rotation.y = .2;
      for (const phase of [0, 1, .28, .74, .5, .37, 1]) {
        contours.length = 0; motion.update(phase, 0, .016, false);
        const state = evaluateAirProcess(effect, phase), d = motion.describe!();
        expect(d).toMatchObject(airProcessDiagnostics(state));
        expect(motion.focusBounds!()).toEqual(focus); expect(meshes).toHaveLength(count);
        meshes.forEach((mesh, i) => expect(mesh.geometry.attributes.position).toBe(attributes[i]));
        const handle = meshes.find(m => m.userData.airProcessRole === 'phase-handle')!;
        expect(d.handleWorld).toEqual(handle.getWorldPosition(new Three.Vector3()).toArray());
        (d.handleWorld as number[]).forEach((coordinate, i) => expect(coordinate).toBeCloseTo((d.keyWorldPositions as Record<string, number[]>).handle[i], 12));
        for (const arrow of state.arrows) {
          const mesh = meshes.find(m => m.userData.airArrowId === arrow.id)!, attribute = mesh.geometry.attributes.position, i = mesh.userData.airTipVertex;
          expect(mesh.visible).toBe(arrow.reveal > .001);
          expect(attribute.getX(i)).toBeCloseTo(arrow.tip[0] * 1.5, 5);
          expect(attribute.getY(i)).toBeCloseTo(arrow.tip[1] * 1.5, 5);
        }
        const snapshot = meshes.map(m => Array.from(m.geometry.attributes.position.array));
        motion.update(phase, 4, .05, true);
        expect(meshes.map(m => Array.from(m.geometry.attributes.position.array))).toEqual(snapshot);
      }
    }
  });

  it('changes the actual ground and air materials and bends the isobaric geometry at the intended stages', () => {
    const heat = fixture('heat'); heat.motion.update(0, 0, 0, true);
    const ground = heat.meshes.find(m => m.userData.airProcessRole === 'ground-volume')!;
    const air = heat.meshes.find(m => m.userData.airProcessRole === 'absorbing-air')!;
    const groundBefore = (ground.material as Three.MeshBasicMaterial).color.clone(), airBefore = (air.material as Three.MeshBasicMaterial).color.clone();
    heat.motion.update(.52, 0, 0, true);
    expect((ground.material as Three.MeshBasicMaterial).color.equals(groundBefore)).toBe(false);
    expect((air.material as Three.MeshBasicMaterial).color.equals(airBefore)).toBe(true);
    heat.motion.update(1, 0, 0, true); expect((air.material as Three.MeshBasicMaterial).color.equals(airBefore)).toBe(false);
    const circulation = fixture('circulation'); circulation.motion.update(.5, 0, 0, true);
    const isobar = circulation.meshes.find(m => m.userData.airProcessRole === 'isobaric-surface')!;
    const flat = Array.from(isobar.geometry.attributes.position.array);
    circulation.motion.update(.74, 0, 0, true); expect(Array.from(isobar.geometry.attributes.position.array)).not.toEqual(flat);
    expect(circulation.meshes.filter(m => m.userData.airProcessRole === 'pressure-label' && m.visible)).toHaveLength(6);
    circulation.motion.update(0, 0, 0, true);
    expect(circulation.meshes.filter(m => m.userData.airProcessRole === 'pressure-label' && m.visible)).toHaveLength(0);
  });

  it('keeps the physical warmth probes and same-height pressure pointers tied to the scientific state on reverse seeking', () => {
    for (const effect of ['heat', 'circulation'] as const) {
      const { meshes, motion } = fixture(effect);
      const needles = meshes.filter(m => m.userData.relativePressurePointer).map(m => m.parent!);
      expect(needles).toHaveLength(effect === 'heat' ? 2 : 6);
      for (const phase of [0, .24, .5, .74, 1, .37, 0, 1]) {
        motion.update(phase, 0, 0, true);
        const state = evaluateAirProcess(effect, phase);
        const expected = state.effect === 'heat'
          ? [state.visibility.groundWarmth, state.visibility.airWarmth]
          : [0, 1].flatMap(layer => state.columns.map(column => {
            const pressure = layer ? column.upperPressure : column.nearPressure;
            return (pressure === 'equal' ? 0 : pressure === 'high' ? 1 : -1) * state.visibility.pressure;
          }));
        needles.forEach((needle, i) => {
          expect(needle.userData.relativePressure).toBe(expected[i]);
          expect(needle.rotation.z).toBeCloseTo(-expected[i] * .72, 12);
        });
        expect(motion.describe!().comparisonInstrumentCalibrated).toBe(false);
      }
    }
  });
});
