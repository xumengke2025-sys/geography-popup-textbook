import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { AEOLIAN_FORMS, AEOLIAN_REFERENCE, AEOLIAN_STONE_PROFILE,
  aeolianRadiusScale, aeolianTransportPoint, evaluateAeolian } from '../src/textbook-aeolian-model';
import type { Figure } from '../src/textbook-catalog';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { flatLandExtra } from '../src/textbook-flat-land-extra';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildLandExtra } from '../src/textbook-models-land-extra';

import { loadFieldInstrument } from '../src/textbook-field-instruments';
import { advanceCrank } from '../src/textbook-model-input';

beforeAll(() => loadFieldInstrument('aeolian'));
const figure = { effect: 'aeolian' } as Figure;
function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b = {
    width: 300, height: 150, root, meshes,
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      meshes.push(mesh); root.add(mesh); return mesh;
    },
    box(a: Vec3, c: Vec3, color: string) {
      const geometry = new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      geometry.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
      return this.mesh(geometry, color);
    },
    cylinder(a: Vec3, c: Vec3, radius: number, color: string) {
      const start = new Three.Vector3(...a), end = new Three.Vector3(...c), direction = end.clone().sub(start);
      const geometry = new Three.CylinderGeometry(radius, radius, direction.length(), 12);
      geometry.applyQuaternion(new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), direction.normalize()));
      geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
      return this.mesh(geometry, color);
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke() {}, outline() {}, trace() {}, contour(points: Vec3[]) { contours.push(points); },
  };
  const motion = buildLandExtra(b as unknown as TextbookGeometry, 'aeolian')!;
  return { b, meshes, motion, contours };
}

describe('bounded, shared wind-landform demonstration state', () => {
  it('states the checked textbook pages, independent conditions and schematic limits', () => {
    expect(AEOLIAN_REFERENCE).toMatchObject({ printedPages: [72, 73], pdfPages: [77, 78],
      requiredLandformSequence: false, measuredRate: false, distancesAndTimeAreSchematic: true, wind: 'positive-x' });
    expect(evaluateAeolian(.4)).toMatchObject({ playback: 'once', independentForms: true, processIsSchematic: true });
  });
  it('holds progress 1 and out-of-range endpoints instead of applying modulo to the landform', () => {
    for (let selection = 0; selection < 4; selection++) {
      expect(evaluateAeolian(-.2, selection)).toEqual(evaluateAeolian(0, selection));
      expect(evaluateAeolian(1.2, selection)).toEqual(evaluateAeolian(1, selection));
      expect(evaluateAeolian(18, selection)).toEqual(evaluateAeolian(1, selection));
    }
    expect(evaluateAeolian(1).erosion).toBe(1);
    expect(evaluateAeolian(1).neckScale).toBe(.5);
    expect(evaluateAeolian(0).neckScale).toBeCloseTo(.725, 12);
  });
  it('shrinks the lower rock monotonically without moving its heights or growing its upper cap', () => {
    for (const [, height] of AEOLIAN_STONE_PROFILE) {
      let previous = 1;
      for (let i = 0; i <= 100; i++) {
        const state = evaluateAeolian(i / 100), radius = aeolianRadiusScale(height, state.erosion);
        expect(radius).toBeGreaterThan(0); expect(radius).toBeLessThanOrEqual(previous + 1e-12); previous = radius;
      }
    }
    expect(1 - aeolianRadiusScale(8, 1)).toBeGreaterThan(10 * (1 - aeolianRadiusScale(20, 1)));
  });
  it('moves only the unstabilized dune downwind, while keeping type choices independent', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const state = evaluateAeolian(i / 100, 2);
      expect(state.duneOffset).toBeGreaterThanOrEqual(previous); previous = state.duneOffset;
      expect(evaluateAeolian(i / 100, 3).duneOffset).toBe(0);
      for (let selection = 0; selection < 4; selection++) {
        expect(evaluateAeolian(i / 100, selection).form).toBe(AEOLIAN_FORMS[selection]);
      }
    }
    expect(evaluateAeolian(0, 2).duneOffset).toBe(-6); expect(evaluateAeolian(1, 2).duneOffset).toBe(6);
    expect(evaluateAeolian(1, 3).stabilized).toBe(true);
  });
  it('is a deterministic seek, rather than accumulated frame-dependent erosion', () => {
    const expected = evaluateAeolian(.637, 0);
    for (const phase of [0, .98, .4, 1, .637]) evaluateAeolian(phase, 3);
    expect(evaluateAeolian(.637, 0)).toEqual(expected);
    for (const input of [NaN, Infinity, -Infinity]) {
      const state = evaluateAeolian(input, input);
      expect(state).toEqual(evaluateAeolian(0, 0));
      expect(JSON.stringify(state)).not.toMatch(/null|NaN|Infinity/);
    }
  });
  it('keeps cyclic transport tracers separate from the bounded erosion and dune displacement', () => {
    const first = evaluateAeolian(0, 2), last = evaluateAeolian(1, 2);
    expect(first.grains).toEqual(last.grains);
    expect(last.duneOffset).toBeGreaterThan(first.duneOffset);
    expect(last.erosion).toBeGreaterThan(first.erosion);
    expect(evaluateAeolian(.5, 3).grains.every(grain => grain.visible === (grain.x < .54))).toBe(true);
  });
});

describe('the wind tunnel and its specimens consume the shared state', () => {
  it('updates the sculpted sandstone vertices from the common radius envelope', () => {
    const { motion, meshes } = fixture();
    const mushroom = meshes.find(mesh => mesh.userData.aeolianRole === 'mushroom')!;
    const position = mushroom.geometry.attributes.position, original = Array.from(position.array);
    for (const phase of [0, .7, 1, .25, 1, 0]) {
      motion.update(phase, 0, 1 / 60, false);
      const state = evaluateAeolian(phase);
      expect(motion.describe!().state).toEqual(state);
      for (let i = 0; i < position.count; i += 13) {
        const scale = aeolianRadiusScale(original[i * 3 + 1] / 3, state.erosion);
        expect(position.getX(i)).toBeCloseTo(original[i * 3] * scale, 4);
        expect(position.getY(i)).toBe(original[i * 3 + 1]);
        expect(position.getZ(i)).toBeCloseTo(original[i * 3 + 2] * scale, 4);
      }
      expect((mushroom.material as Three.MeshBasicMaterial).userData.earthScan).toBe('outcrop');
    }
  });
  it('uses common dune displacement and grain positions without changing the base dune mesh', () => {
    const { b, meshes, motion } = fixture(), dune = meshes.find(mesh => mesh.userData.aeolianRole === 'dune')!;
    const source = new Float32Array(dune.geometry.attributes.position.array);
    for (const selection of [2, 3, 0, 1, 2]) for (const phase of [0, .3, 1]) {
      motion.update(phase, selection, 1 / 60, false);
      const state = evaluateAeolian(phase, selection);
      expect(dune.position.x).toBe(state.duneOffset * 3); expect(dune.visible).toBe(selection >= 2);
      expect(dune.geometry.attributes.position.array).toEqual(source);
      for (const grain of meshes.filter(mesh => mesh.userData.aeolianRole === 'sand-grain')) {
        const expected = state.grains[grain.userData.aeolianGrainId];
        const [x,h,z] = aeolianTransportPoint(expected.x,expected.depth,expected.height,selection,state.duneOffset);
        expect(grain.position.x).toBe(x * 3); expect(grain.position.y).toBe(h * 3);
        expect(grain.position.z).toBeCloseTo(-96 - b.height * .62 + z * 3, 10);
        expect(grain.visible).toBe(expected.visible);
      }
    }
  });
  it('replays a touched specimen and lets the individual porcelain keys change it at the same crank position', () => {
    const { meshes, motion } = fixture();
    const mushroom = meshes.find(mesh => mesh.userData.aeolianRole === 'mushroom')!;
    const dune = meshes.find(mesh => mesh.userData.aeolianRole === 'dune')!;
    expect(mushroom.userData.modelInput).toMatchObject({ kind: 'replay', selection: 0 });
    motion.update(.8, 3, 1 / 30, false);
    expect(dune.userData.modelInput).toMatchObject({ kind: 'replay', selection: 3 });
    const keys = meshes.filter(mesh => mesh.userData.modelInput?.kind === 'select');
    expect([...new Set(keys.map(m => m.userData.modelInput.selection))]).toEqual([0,1,2,3]);
    expect(keys.every(m => m.userData.modelInput.keepPhase)).toBe(true);
    const wheel = meshes.find(mesh => mesh.userData.blenderPart === 'wheel')!;
    expect(wheel.userData.modelInput.dial.turns).toBe(3);
    expect(wheel.rotation.z).toBeCloseTo(.8 * 6 * Math.PI);
  });
  it('crosses the marked seam in both directions, then stops and reverses without wrapping', () => {
    expect(advanceCrank(.3,.96,.05,3)).toBeCloseTo(.33);
    expect(advanceCrank(.33,.05,.96,3)).toBeCloseTo(.3);
    expect(advanceCrank(.99,.94,.08,3)).toBe(1);
    expect(advanceCrank(1,.08,.02,3)).toBeCloseTo(.98);
    expect(advanceCrank(.01,.08,.94,3)).toBe(0);
  });
  it('keeps geometry buffers, focus and results stable across seeks, frame rates and low-motion mode', () => {
    const { meshes, motion } = fixture(), focus = motion.focusBounds!(), count = meshes.length;
    const positions = meshes.map(mesh => mesh.geometry.attributes.position.array), indices = meshes.map(mesh => mesh.geometry.index?.array);
    for (const phase of [0, 1, .5, .1, .9, 1.2]) {
      motion.update(phase, 0, 1 / 30, false); const regular = motion.describe!();
      motion.update(phase, 0, 1 / 144, true); expect(motion.describe!()).toEqual(regular);
      expect(meshes).toHaveLength(count); expect(motion.focusBounds!()).toEqual(focus);
      meshes.forEach((mesh, i) => {
        expect(mesh.geometry.attributes.position.array).toBe(positions[i]); expect(mesh.geometry.index?.array).toBe(indices[i]);
      });
    }
  });
});

describe('native SVG fallback shares the live model conditions', () => {
  it('reads the same form, bounded progress, neck scale and downwind dune displacement for every choice', () => {
    for (const selection of [0, 1, 2, 3]) for (const phase of [0, .2, 1, 1.5]) {
      const state = evaluateAeolian(phase, selection), svg = flatLandExtra(figure, phase, selection)!;
      expect(svg).toContain(`data-aeolian-form="${state.form}"`); expect(svg).toContain(`data-aeolian-phase="${state.phase}"`);
      expect(svg).toContain(`data-aeolian-erosion="${state.erosion}"`); expect(svg).toContain(`data-aeolian-neck-scale="${state.neckScale}"`);
      expect(svg).toContain(`data-aeolian-dune-offset="${state.duneOffset}"`);
      expect(svg).toContain(`data-model-replay="true" data-model-selection="${selection}" role="button" tabindex="0"`);
      expect(svg).toContain('四种类型独立对照，距离与时间均为示意');
      expect(svg).not.toMatch(/<image\b|data:image|NaN|Infinity|undefined/);
      if (selection >= 2) expect(svg).toContain(`translate(${state.duneOffset * 4} 0)`);
    }
  });
  it('shows the endpoint unchanged until an explicit replay, including when input exceeds 1', () => {
    for (const selection of [0, 1, 2, 3]) {
      expect(flatLandExtra(figure, 18, selection)).toBe(flatLandExtra(figure, 1, selection));
      expect(flatLandExtra(figure, NaN, selection)).toBe(flatLandExtra(figure, 0, selection));
    }
    expect(flatLandExtra(figure, 0, 0)).not.toBe(flatLandExtra(figure, 1, 0));
    expect(flatLandExtra(figure, 0, 2)).not.toBe(flatLandExtra(figure, 1, 2));
  });
});
